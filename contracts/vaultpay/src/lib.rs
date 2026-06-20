//! VaultPay real T3N tenant contract.
//!
//! This crate follows the Terminal 3 ADK walkthrough shape: Rust -> WASM
//! component, WIT `contracts` exports, and real tenant host imports.

#![warn(clippy::style, missing_debug_implementations)]
#![cfg_attr(not(target_arch = "wasm32"), allow(dead_code))]

extern crate alloc;

pub const CONTRACT_VERSION: &str = "0.2.1";

wit_bindgen::generate!({
    world: "vaultpay",
    path: "wit",
    additional_derives: [
        serde::Deserialize,
        serde::Serialize,
    ],
    generate_all,
});

mod model;
mod vaultpay;

struct Component;

#[cfg(target_arch = "wasm32")]
impl exports::z::vaultpay::contracts::Guest for Component {
    fn create_mandate(
        req: exports::z::vaultpay::contracts::GenericInput,
    ) -> Result<alloc::vec::Vec<u8>, alloc::string::String> {
        let input = req.input.ok_or("create-mandate: missing input")?;
        vaultpay::create_mandate(&input)
    }

    fn read_mandate(
        req: exports::z::vaultpay::contracts::GenericInput,
    ) -> Result<alloc::vec::Vec<u8>, alloc::string::String> {
        let input = req.input.ok_or("read-mandate: missing input")?;
        vaultpay::read_mandate(&input)
    }

    fn revoke_mandate(
        req: exports::z::vaultpay::contracts::GenericInput,
    ) -> Result<alloc::vec::Vec<u8>, alloc::string::String> {
        let input = req.input.ok_or("revoke-mandate: missing input")?;
        vaultpay::revoke_mandate(&input)
    }

    fn read_remaining(
        req: exports::z::vaultpay::contracts::GenericInput,
    ) -> Result<alloc::vec::Vec<u8>, alloc::string::String> {
        let input = req.input.ok_or("read-remaining: missing input")?;
        vaultpay::read_remaining(&input)
    }

    fn validate_and_pay(
        req: exports::z::vaultpay::contracts::GenericInput,
    ) -> Result<alloc::vec::Vec<u8>, alloc::string::String> {
        let input = req.input.ok_or("validate-and-pay: missing input")?;
        vaultpay::validate_and_pay(&input)
    }

    fn create_approval_request(
        req: exports::z::vaultpay::contracts::GenericInput,
    ) -> Result<alloc::vec::Vec<u8>, alloc::string::String> {
        let input = req.input.ok_or("create-approval-request: missing input")?;
        vaultpay::create_approval_request(&input)
    }

    fn approve_action(
        req: exports::z::vaultpay::contracts::GenericInput,
    ) -> Result<alloc::vec::Vec<u8>, alloc::string::String> {
        let input = req.input.ok_or("approve-action: missing input")?;
        vaultpay::approve_action(&input)
    }

    fn reject_action(
        req: exports::z::vaultpay::contracts::GenericInput,
    ) -> Result<alloc::vec::Vec<u8>, alloc::string::String> {
        let input = req.input.ok_or("reject-action: missing input")?;
        vaultpay::reject_action(&input)
    }

    fn issue_receipt(
        req: exports::z::vaultpay::contracts::GenericInput,
    ) -> Result<alloc::vec::Vec<u8>, alloc::string::String> {
        let input = req.input.ok_or("issue-receipt: missing input")?;
        vaultpay::issue_receipt(&input)
    }

    fn verify_receipt(
        req: exports::z::vaultpay::contracts::GenericInput,
    ) -> Result<alloc::vec::Vec<u8>, alloc::string::String> {
        let input = req.input.ok_or("verify-receipt: missing input")?;
        vaultpay::verify_receipt(&input)
    }
}

#[cfg(target_arch = "wasm32")]
export!(Component);

#[cfg(test)]
mod tests {
    use super::CONTRACT_VERSION;

    #[test]
    fn contract_version_is_semver() {
        let parts: Vec<&str> = CONTRACT_VERSION.split('.').collect();
        assert_eq!(parts.len(), 3);
        for part in parts {
            assert!(part.parse::<u32>().is_ok());
        }
    }
}
