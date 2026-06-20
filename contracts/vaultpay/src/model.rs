use serde::{Deserialize, Serialize};

pub const MAX_CONTRACT_RECORD_BYTES: usize = 511;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum PaymentMethod {
    Card,
    Stablecoin,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum RecordStatus {
    Active,
    Revoked,
    Approved,
    Rejected,
    Pending,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum PolicyDecision {
    Approved,
    Rejected,
    PendingApproval,
    Revoked,
    Expired,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct CompactMandate {
    pub v: u8,
    pub id: String,
    pub a: String,
    pub d: String,
    pub b: u64,
    pub r: u64,
    pub l: u64,
    pub t: u64,
    pub x: u64,
    pub m: Vec<String>,
    pub c: Vec<String>,
    pub p: Vec<PaymentMethod>,
    pub s: RecordStatus,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub h: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct CreateMandateRequest {
    pub mandate: CompactMandate,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct MandateLookupRequest {
    pub mandate_id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct ValidateAndPayRequest {
    pub mandate_id: String,
    #[serde(default)]
    pub approval_id: Option<String>,
    pub app_agent_id: String,
    pub agent_did: String,
    #[serde(default)]
    pub delegation_id: Option<String>,
    #[serde(default)]
    pub delegation_vc_id: Option<String>,
    pub merchant_id: String,
    pub category: String,
    pub amount_cents: u64,
    pub payment_method: PaymentMethod,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct DecisionResponse {
    pub decision: PolicyDecision,
    pub reason: Option<String>,
    pub mandate_id: String,
    pub budget_remaining_cents: u64,
    pub mandate_hash: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct ApprovalRecord {
    pub v: u8,
    pub id: String,
    pub mid: String,
    pub aid: String,
    pub amt: u64,
    pub s: RecordStatus,
    pub exp: u64,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub h: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct CreateApprovalRequest {
    pub approval: ApprovalRecord,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct ApprovalLookupRequest {
    pub approval_id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct ReceiptRecord {
    pub v: u8,
    pub id: String,
    pub pid: String,
    pub mid: String,
    pub aid: String,
    pub mer: String,
    pub amt: u64,
    pub ord: String,
    pub mh: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub h: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct IssueReceiptRequest {
    pub receipt: ReceiptRecord,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct VerifyReceiptRequest {
    pub receipt: ReceiptRecord,
}
