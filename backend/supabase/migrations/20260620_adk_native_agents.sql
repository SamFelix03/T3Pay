-- VaultPay ADK-native agent migration.
-- Run this in the Supabase SQL editor before using the migrated backend.
--
-- Cleanup decision:
-- No existing agent/delegation columns are dropped in this migration.
-- agents.t3n_did is still needed and now means the real T3N agent DID.
-- agents.app_agent_id is still needed as the VaultPay UI/projection id.
-- delegations remains useful as a dashboard projection of ADK grant metadata.

alter table if exists agents
  add column if not exists agent_did_source text not null default 'derived_adk_eth',
  add column if not exists agent_public_key_b64u text;

alter table if exists delegations
  add column if not exists t3n_vc_id text,
  add column if not exists credential_jcs_b64u text,
  add column if not exists user_sig_b64u text,
  add column if not exists agent_invocation_sig_b64u text,
  add column if not exists agent_nonce_b64u text,
  add column if not exists request_hash_b64u text,
  add column if not exists agent_pubkey_b64u text,
  add column if not exists user_did text,
  add column if not exists agent_did text,
  add column if not exists contract_name text,
  add column if not exists contract_version text,
  add column if not exists functions_json text,
  add column if not exists allowed_hosts_json text,
  add column if not exists metadata_json text,
  add column if not exists t3n_grant_result_json text,
  add column if not exists t3n_revocation_result_json text;

create index if not exists delegations_agent_id_idx on delegations(agent_id);
create index if not exists delegations_mandate_id_idx on delegations(mandate_id);
