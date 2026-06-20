use crate::model::{
    ApprovalLookupRequest, ApprovalRecord, CompactMandate, CreateApprovalRequest,
    CreateMandateRequest, DecisionResponse, IssueReceiptRequest, MandateLookupRequest,
    MAX_CONTRACT_RECORD_BYTES, PolicyDecision, RecordStatus, ReceiptRecord,
    ValidateAndPayRequest, VerifyReceiptRequest,
};
use sha2::{Digest, Sha256};

#[cfg(any(test, not(target_arch = "wasm32")))]
use crate::model::PaymentMethod;

const MANDATES_MAP_TAIL: &str = "mandates";
const APPROVALS_MAP_TAIL: &str = "approvals";

pub fn create_mandate(input: &[u8]) -> Result<Vec<u8>, String> {
    let req: CreateMandateRequest =
        serde_json::from_slice(input).map_err(|e| format!("create-mandate: bad input: {e}"))?;
    let mandate = with_hash(req.mandate)?;
    assert_small("mandate", &mandate)?;
    serde_json::to_vec(&mandate).map_err(|e| e.to_string())
}

pub fn read_mandate(input: &[u8]) -> Result<Vec<u8>, String> {
    let req: MandateLookupRequest =
        serde_json::from_slice(input).map_err(|e| format!("read-mandate: bad input: {e}"))?;

    #[cfg(target_arch = "wasm32")]
    {
        get_record_bytes(MANDATES_MAP_TAIL, &req.mandate_id)
            .and_then(|record| record.ok_or_else(|| format!("mandate not found: {}", req.mandate_id)))
    }

    #[cfg(not(target_arch = "wasm32"))]
    {
        let _ = req;
        Err("read_mandate requires T3N kv-store and only runs on wasm32".to_string())
    }
}

pub fn read_remaining(input: &[u8]) -> Result<Vec<u8>, String> {
    let req: MandateLookupRequest =
        serde_json::from_slice(input).map_err(|e| format!("read-remaining: bad input: {e}"))?;
    let mandate = load_mandate_or_native(&req.mandate_id, None)?;
    serde_json::to_vec(&DecisionResponse {
        decision: PolicyDecision::Approved,
        reason: None,
        mandate_id: mandate.id.clone(),
        budget_remaining_cents: mandate.r,
        mandate_hash: mandate.h.clone().unwrap_or_else(|| hash_value(&mandate)),
    })
    .map_err(|e| e.to_string())
}

pub fn revoke_mandate(input: &[u8]) -> Result<Vec<u8>, String> {
    let req: MandateLookupRequest =
        serde_json::from_slice(input).map_err(|e| format!("revoke-mandate: bad input: {e}"))?;
    let mut mandate = load_mandate_or_native(&req.mandate_id, None)?;
    mandate.s = RecordStatus::Revoked;
    let mandate = with_hash(mandate)?;
    assert_small("revoked mandate", &mandate)?;
    serde_json::to_vec(&mandate).map_err(|e| e.to_string())
}

pub fn validate_and_pay(input: &[u8]) -> Result<Vec<u8>, String> {
    let req: ValidateAndPayRequest =
        serde_json::from_slice(input).map_err(|e| format!("validate-and-pay: bad input: {e}"))?;
    let mandate = load_mandate_or_native(&req.mandate_id, Some(&req))?;
    let approved_override = is_request_approved(&req).unwrap_or(false);
    let response = evaluate_policy(&mandate, &req, current_time_secs(), approved_override);
    serde_json::to_vec(&response).map_err(|e| e.to_string())
}

pub fn create_approval_request(input: &[u8]) -> Result<Vec<u8>, String> {
    let req: CreateApprovalRequest =
        serde_json::from_slice(input).map_err(|e| format!("create-approval-request: bad input: {e}"))?;
    let approval = with_hash(req.approval)?;
    assert_small("approval", &approval)?;
    serde_json::to_vec(&approval).map_err(|e| e.to_string())
}

pub fn approve_action(input: &[u8]) -> Result<Vec<u8>, String> {
    update_approval_status(input, RecordStatus::Approved)
}

pub fn reject_action(input: &[u8]) -> Result<Vec<u8>, String> {
    update_approval_status(input, RecordStatus::Rejected)
}

pub fn issue_receipt(input: &[u8]) -> Result<Vec<u8>, String> {
    let req: IssueReceiptRequest =
        serde_json::from_slice(input).map_err(|e| format!("issue-receipt: bad input: {e}"))?;
    let receipt = with_hash(req.receipt)?;
    assert_small("receipt", &receipt)?;
    serde_json::to_vec(&receipt).map_err(|e| e.to_string())
}

pub fn verify_receipt(input: &[u8]) -> Result<Vec<u8>, String> {
    let req: VerifyReceiptRequest =
        serde_json::from_slice(input).map_err(|e| format!("verify-receipt: bad input: {e}"))?;
    let valid = req
        .receipt
        .h
        .as_ref()
        .map(|stored| stored == &hash_without_hash(&req.receipt))
        .unwrap_or(false);
    serde_json::to_vec(&serde_json::json!({ "valid": valid, "receipt_id": req.receipt.id }))
        .map_err(|e| e.to_string())
}

pub fn evaluate_policy(
    mandate: &CompactMandate,
    req: &ValidateAndPayRequest,
    now_secs: u64,
    approved_override: bool,
) -> DecisionResponse {
    let mandate_hash = mandate.h.clone().unwrap_or_else(|| hash_value(mandate));
    let reject = |decision, reason: &str| DecisionResponse {
        decision,
        reason: Some(reason.to_string()),
        mandate_id: mandate.id.clone(),
        budget_remaining_cents: mandate.r,
        mandate_hash: mandate_hash.clone(),
    };

    if mandate.s == RecordStatus::Revoked {
        return reject(PolicyDecision::Revoked, "mandate_revoked");
    }
    if mandate.x <= now_secs {
        return reject(PolicyDecision::Expired, "mandate_expired");
    }
    if mandate.a != req.app_agent_id {
        return reject(PolicyDecision::Rejected, "agent_not_allowed");
    }
    if mandate.d != req.agent_did {
        return reject(PolicyDecision::Rejected, "agent_did_not_allowed");
    }
    if !mandate.m.contains(&req.merchant_id) {
        return reject(PolicyDecision::Rejected, "merchant_not_allowed");
    }
    if !mandate.c.contains(&req.category) {
        return reject(PolicyDecision::Rejected, "category_not_allowed");
    }
    if !mandate.p.contains(&req.payment_method) {
        return reject(PolicyDecision::Rejected, "payment_method_not_allowed");
    }
    if req.amount_cents > mandate.r {
        return reject(PolicyDecision::Rejected, "budget_exceeded");
    }
    if req.amount_cents > mandate.l {
        return reject(PolicyDecision::Rejected, "per_purchase_limit_exceeded");
    }
    if req.amount_cents > mandate.t && !approved_override {
        return reject(PolicyDecision::PendingApproval, "approval_required");
    }

    DecisionResponse {
        decision: PolicyDecision::Approved,
        reason: None,
        mandate_id: mandate.id.clone(),
        budget_remaining_cents: mandate.r,
        mandate_hash,
    }
}

fn update_approval_status(input: &[u8], status: RecordStatus) -> Result<Vec<u8>, String> {
    let req: ApprovalLookupRequest =
        serde_json::from_slice(input).map_err(|e| format!("approval status: bad input: {e}"))?;

    #[cfg(target_arch = "wasm32")]
    let mut approval: ApprovalRecord = {
        let bytes = get_record_bytes(APPROVALS_MAP_TAIL, &req.approval_id)?
            .ok_or_else(|| format!("approval not found: {}", req.approval_id))?;
        serde_json::from_slice(&bytes).map_err(|e| e.to_string())?
    };

    #[cfg(not(target_arch = "wasm32"))]
    let mut approval = ApprovalRecord {
        v: 1,
        id: req.approval_id,
        mid: "native_mandate".to_string(),
        aid: "native_agent".to_string(),
        amt: 0,
        s: RecordStatus::Pending,
        exp: u64::MAX,
        h: None,
    };

    approval.s = status;
    let approval = with_hash(approval)?;
    assert_small("approval", &approval)?;
    serde_json::to_vec(&approval).map_err(|e| e.to_string())
}

fn is_request_approved(req: &ValidateAndPayRequest) -> Result<bool, String> {
    let Some(approval_id) = &req.approval_id else {
        return Ok(false);
    };

    #[cfg(target_arch = "wasm32")]
    {
        let Some(bytes) = get_record_bytes(APPROVALS_MAP_TAIL, approval_id)? else {
            return Ok(false);
        };
        let approval: ApprovalRecord = serde_json::from_slice(&bytes).map_err(|e| e.to_string())?;
        return Ok(approval.id == *approval_id
            && approval.mid == req.mandate_id
            && approval.s == RecordStatus::Approved);
    }

    #[cfg(not(target_arch = "wasm32"))]
    {
        let _ = approval_id;
        Ok(false)
    }
}

fn load_mandate_or_native(
    mandate_id: &str,
    _native_req: Option<&ValidateAndPayRequest>,
) -> Result<CompactMandate, String> {
    #[cfg(target_arch = "wasm32")]
    {
        let bytes = get_record_bytes(MANDATES_MAP_TAIL, mandate_id)?
            .ok_or_else(|| format!("mandate not found: {mandate_id}"))?;
        serde_json::from_slice(&bytes).map_err(|e| e.to_string())
    }

    #[cfg(not(target_arch = "wasm32"))]
    {
        let req = _native_req.ok_or("native mandate requires request context")?;
        Ok(sample_native_mandate(mandate_id, req))
    }
}

fn with_hash<T>(mut value: T) -> Result<T, String>
where
    T: HashField + serde::Serialize,
{
    value.clear_hash();
    let hash = hash_value(&value);
    value.set_hash(hash);
    Ok(value)
}

trait HashField {
    fn clear_hash(&mut self);
    fn set_hash(&mut self, hash: String);
}

impl HashField for CompactMandate {
    fn clear_hash(&mut self) {
        self.h = None;
    }
    fn set_hash(&mut self, hash: String) {
        self.h = Some(hash);
    }
}

impl HashField for ApprovalRecord {
    fn clear_hash(&mut self) {
        self.h = None;
    }
    fn set_hash(&mut self, hash: String) {
        self.h = Some(hash);
    }
}

impl HashField for ReceiptRecord {
    fn clear_hash(&mut self) {
        self.h = None;
    }
    fn set_hash(&mut self, hash: String) {
        self.h = Some(hash);
    }
}

fn assert_small<T: serde::Serialize>(label: &str, value: &T) -> Result<(), String> {
    let bytes = serde_json::to_vec(value).map_err(|e| e.to_string())?;
    if bytes.len() > MAX_CONTRACT_RECORD_BYTES {
        return Err(format!(
            "{label} record exceeds {MAX_CONTRACT_RECORD_BYTES} bytes: {}",
            bytes.len()
        ));
    }
    Ok(())
}

fn hash_without_hash<T>(value: &T) -> String
where
    T: Clone + HashField + serde::Serialize,
{
    let mut cloned = value.clone();
    cloned.clear_hash();
    hash_value(&cloned)
}

fn hash_value<T: serde::Serialize>(value: &T) -> String {
    let bytes = serde_json::to_vec(value).unwrap_or_default();
    hex::encode(Sha256::digest(bytes))
}

#[cfg(target_arch = "wasm32")]
fn map_name(tail: &str) -> String {
    use crate::host::tenant::tenant_context;
    format!("z:{}:{tail}", hex::encode(tenant_context::tenant_did()))
}

#[cfg(target_arch = "wasm32")]
fn get_record_bytes(tail: &str, key: &str) -> Result<Option<Vec<u8>>, String> {
    use crate::host::interfaces::kv_store;
    let map = map_name(tail);
    kv_store::get(&map, key.as_bytes()).map_err(|e| format!("kv get {tail}: {e}"))
}

#[cfg(target_arch = "wasm32")]
fn current_time_secs() -> u64 {
    use crate::host::tenant::tenant_context;
    tenant_context::cluster_timestamp_secs()
}

#[cfg(not(target_arch = "wasm32"))]
fn current_time_secs() -> u64 {
    0
}

#[cfg(not(target_arch = "wasm32"))]
fn sample_native_mandate(mandate_id: &str, req: &ValidateAndPayRequest) -> CompactMandate {
    CompactMandate {
        v: 1,
        id: mandate_id.to_string(),
        a: req.app_agent_id.clone(),
        d: req.agent_did.clone(),
        b: 20_000,
        r: 20_000,
        l: 15_000,
        t: 15_000,
        x: u64::MAX,
        m: vec![req.merchant_id.clone()],
        c: vec![req.category.clone()],
        p: vec![PaymentMethod::Card, PaymentMethod::Stablecoin],
        s: RecordStatus::Active,
        h: None,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn mandate() -> CompactMandate {
        with_hash(CompactMandate {
            v: 1,
            id: "m1".to_string(),
            a: "a1".to_string(),
            d: "did:t3n:demo".to_string(),
            b: 20_000,
            r: 20_000,
            l: 15_000,
            t: 15_000,
            x: 4_102_444_800,
            m: vec!["electronics-store".to_string()],
            c: vec!["electronics".to_string()],
            p: vec![PaymentMethod::Card, PaymentMethod::Stablecoin],
            s: RecordStatus::Active,
            h: None,
        })
        .unwrap()
    }

    fn request(amount_cents: u64) -> ValidateAndPayRequest {
        ValidateAndPayRequest {
            mandate_id: "m1".to_string(),
            approval_id: None,
            app_agent_id: "a1".to_string(),
            agent_did: "did:t3n:demo".to_string(),
            delegation_id: Some("dlg1".to_string()),
            delegation_vc_id: Some("vc1".to_string()),
            merchant_id: "electronics-store".to_string(),
            category: "electronics".to_string(),
            amount_cents,
            payment_method: PaymentMethod::Card,
        }
    }

    #[test]
    fn compact_mandate_stays_under_record_limit() {
        let bytes = serde_json::to_vec(&mandate()).unwrap();
        assert!(bytes.len() <= MAX_CONTRACT_RECORD_BYTES, "{}", bytes.len());
    }

    #[test]
    fn approves_valid_purchase() {
        let decision = evaluate_policy(&mandate(), &request(2_999), 1, false);
        assert_eq!(decision.decision, PolicyDecision::Approved);
        assert_eq!(decision.reason, None);
    }

    #[test]
    fn routes_approval_threshold() {
        let decision = evaluate_policy(&mandate(), &request(17_500), 1, false);
        assert_eq!(decision.decision, PolicyDecision::Rejected);
        assert_eq!(decision.reason.as_deref(), Some("per_purchase_limit_exceeded"));
    }

    #[test]
    fn approved_override_allows_above_threshold_when_limit_allows() {
        let mut m = mandate();
        m.l = 18_000;
        let decision = evaluate_policy(&m, &request(17_500), 1, true);
        assert_eq!(decision.decision, PolicyDecision::Approved);
    }

    #[test]
    fn rejects_disallowed_merchant() {
        let mut req = request(2_999);
        req.merchant_id = "other".to_string();
        let decision = evaluate_policy(&mandate(), &req, 1, false);
        assert_eq!(decision.decision, PolicyDecision::Rejected);
        assert_eq!(decision.reason.as_deref(), Some("merchant_not_allowed"));
    }

    #[test]
    fn rejects_wrong_agent_did() {
        let mut req = request(2_999);
        req.agent_did = "did:t3n:wrong".to_string();
        let decision = evaluate_policy(&mandate(), &req, 1, false);
        assert_eq!(decision.decision, PolicyDecision::Rejected);
        assert_eq!(decision.reason.as_deref(), Some("agent_did_not_allowed"));
    }

    #[test]
    fn creates_and_verifies_receipt_hash() {
        let receipt = ReceiptRecord {
            v: 1,
            id: "r1".to_string(),
            pid: "p1".to_string(),
            mid: "m1".to_string(),
            aid: "a1".to_string(),
            mer: "electronics-store".to_string(),
            amt: 2_999,
            ord: "o1".to_string(),
            mh: "abc".to_string(),
            h: None,
        };
        let out = issue_receipt(&serde_json::to_vec(&IssueReceiptRequest { receipt }).unwrap()).unwrap();
        let stored: ReceiptRecord = serde_json::from_slice(&out).unwrap();
        assert!(stored.h.is_some());
        let verified = verify_receipt(&serde_json::to_vec(&VerifyReceiptRequest { receipt: stored }).unwrap()).unwrap();
        assert!(String::from_utf8(verified).unwrap().contains("\"valid\":true"));
    }
}
