-- Bind agents to vaults and persist detailed agent-run traces.

alter table if exists agents
  add column if not exists vault_id text references vaults(id);

create index if not exists agents_vault_id_idx on agents(vault_id);

alter table if exists agent_runs
  add column if not exists trace_json text;
