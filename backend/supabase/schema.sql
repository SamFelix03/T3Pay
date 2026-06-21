create table if not exists users (
  id text primary key,
  auth_user_id uuid unique,
  email text,
  did text not null,
  display_name text not null,
  created_at timestamptz not null
);

create unique index if not exists users_email_idx on users(email) where email is not null;

create table if not exists vaults (
  id text primary key,
  user_id text not null references users(id),
  status text not null,
  created_at timestamptz not null
);

create table if not exists payment_methods (
  id text primary key,
  vault_id text not null references vaults(id),
  type text not null,
  alias text not null,
  display text not null,
  balance_cents integer not null,
  currency text not null,
  status text not null,
  t3n_secret_ref text not null,
  created_at timestamptz not null
);

create table if not exists agents (
  id text primary key,
  user_id text not null references users(id),
  vault_id text references vaults(id),
  app_agent_id text not null unique,
  t3n_did text not null,
  agent_did_source text not null default 'derived_adk_eth',
  agent_public_key_b64u text,
  name text not null,
  role text not null,
  status text not null,
  payment_method text not null,
  created_at timestamptz not null,
  updated_at timestamptz not null
);

create table if not exists mandates (
  id text primary key,
  user_id text not null references users(id),
  agent_id text not null references agents(id),
  status text not null,
  budget_cents integer not null,
  budget_remaining_cents integer not null,
  per_purchase_limit_cents integer not null,
  approval_threshold_cents integer not null,
  currency text not null,
  expires_at timestamptz not null,
  allowed_merchants_json text not null,
  allowed_categories_json text not null,
  payment_methods_json text not null,
  cadence text not null,
  t3n_record_key text not null,
  mandate_hash text not null,
  created_at timestamptz not null,
  updated_at timestamptz not null
);

create table if not exists delegations (
  id text primary key,
  mandate_id text not null references mandates(id),
  agent_id text not null references agents(id),
  status text not null,
  grant_scope_hash text not null,
  t3n_vc_id text,
  credential_jcs_b64u text,
  user_sig_b64u text,
  agent_invocation_sig_b64u text,
  agent_nonce_b64u text,
  request_hash_b64u text,
  agent_pubkey_b64u text,
  user_did text,
  agent_did text,
  contract_name text,
  contract_version text,
  functions_json text,
  allowed_hosts_json text,
  metadata_json text,
  t3n_grant_result_json text,
  t3n_revocation_result_json text,
  created_at timestamptz not null,
  revoked_at timestamptz
);

create table if not exists approvals (
  id text primary key,
  mandate_id text not null references mandates(id),
  agent_id text not null references agents(id),
  status text not null,
  payload_json text not null,
  reason text not null,
  expires_at timestamptz not null,
  created_at timestamptz not null,
  resolved_at timestamptz
);

create table if not exists purchase_attempts (
  id text primary key,
  mandate_id text not null references mandates(id),
  agent_id text not null references agents(id),
  merchant_id text not null,
  product_id text not null,
  category text not null,
  amount_cents integer not null,
  currency text not null,
  payment_method text not null,
  decision text not null,
  reason text,
  approval_id text,
  order_id text,
  receipt_id text,
  sanitized_response_json text not null,
  created_at timestamptz not null
);

create table if not exists receipts (
  id text primary key,
  purchase_attempt_id text not null,
  receipt_hash text not null unique,
  receipt_type text not null,
  payload_json text not null,
  created_at timestamptz not null
);

create table if not exists audit_events (
  id text primary key,
  user_id text,
  agent_id text,
  type text not null,
  entity_type text not null,
  entity_id text not null,
  decision text,
  hash text not null,
  payload_json text not null,
  created_at timestamptz not null
);

create table if not exists merchants (
  id text primary key,
  name text not null,
  category text not null,
  status text not null
);

create table if not exists products (
  id text primary key,
  merchant_id text not null references merchants(id),
  name text not null,
  category text not null,
  price_cents integer not null,
  currency text not null,
  inventory integer not null
);

create table if not exists merchant_orders (
  id text primary key,
  merchant_id text not null references merchants(id),
  product_id text not null references products(id),
  payment_method_id text not null,
  amount_cents integer not null,
  currency text not null,
  status text not null,
  sanitized_confirmation_json text not null,
  created_at timestamptz not null
);

create table if not exists agent_runs (
  id text primary key,
  agent_id text not null references agents(id),
  mandate_id text not null references mandates(id),
  objective text not null,
  use_case text not null,
  model text not null,
  candidate_products_json text not null,
  selected_product_id text not null,
  selected_merchant_id text not null,
  rationale text not null,
  confidence double precision not null,
  purchase_attempt_id text,
  receipt_id text,
  status text not null,
  trace_json text,
  created_at timestamptz not null
);

create index if not exists agents_user_id_idx on agents(user_id);
create index if not exists agents_vault_id_idx on agents(vault_id);
create index if not exists delegations_agent_id_idx on delegations(agent_id);
create index if not exists delegations_mandate_id_idx on delegations(mandate_id);
create index if not exists mandates_user_id_idx on mandates(user_id);
create index if not exists approvals_status_idx on approvals(status);
create index if not exists purchase_attempts_decision_idx on purchase_attempts(decision);
create index if not exists agent_runs_created_at_idx on agent_runs(created_at desc);

create or replace function vaultpay_finalize_purchase(
  p_attempt_id text,
  p_order_id text,
  p_receipt_id text,
  p_mandate_id text,
  p_agent_id text,
  p_merchant_id text,
  p_product_id text,
  p_payment_method_id text,
  p_category text,
  p_amount_cents integer,
  p_currency text,
  p_payment_method_type text,
  p_approval_id text,
  p_sanitized_response_json text,
  p_receipt_hash text,
  p_receipt_type text,
  p_receipt_payload_json text,
  p_created_at timestamptz
) returns jsonb
language plpgsql
as $$
declare
  v_mandate mandates%rowtype;
  v_product products%rowtype;
  v_payment payment_methods%rowtype;
  v_attempt purchase_attempts%rowtype;
  v_receipt receipts%rowtype;
begin
  select * into v_attempt from purchase_attempts where id = p_attempt_id;
  if found then
    select * into v_receipt from receipts where id = v_attempt.receipt_id;
    return jsonb_build_object(
      'attempt', row_to_json(v_attempt),
      'receipt', row_to_json(v_receipt),
      'idempotent', true
    );
  end if;

  select * into v_mandate from mandates where id = p_mandate_id for update;
  if not found then raise exception 'mandate_not_found'; end if;
  if v_mandate.agent_id <> p_agent_id then raise exception 'mandate_agent_mismatch'; end if;
  if v_mandate.status <> 'active' then raise exception 'mandate_not_active'; end if;
  if v_mandate.budget_remaining_cents < p_amount_cents then raise exception 'budget_exceeded'; end if;

  select * into v_product from products where id = p_product_id for update;
  if not found then raise exception 'product_not_found'; end if;
  if v_product.merchant_id <> p_merchant_id then raise exception 'product_merchant_mismatch'; end if;
  if v_product.price_cents <> p_amount_cents then raise exception 'amount_mismatch'; end if;
  if v_product.currency <> p_currency then raise exception 'currency_mismatch'; end if;
  if v_product.inventory <= 0 then raise exception 'product_out_of_stock'; end if;

  select * into v_payment from payment_methods where id = p_payment_method_id for update;
  if not found then raise exception 'payment_method_not_found'; end if;
  if v_payment.status <> 'active' then raise exception 'payment_method_not_active'; end if;
  if v_payment.type <> p_payment_method_type then raise exception 'payment_method_type_mismatch'; end if;
  if v_payment.balance_cents < p_amount_cents then raise exception 'insufficient_payment_balance'; end if;

  update payment_methods
    set balance_cents = balance_cents - p_amount_cents
    where id = p_payment_method_id;

  update products
    set inventory = inventory - 1
    where id = p_product_id;

  update mandates
    set budget_remaining_cents = budget_remaining_cents - p_amount_cents,
        updated_at = p_created_at
    where id = p_mandate_id;

  insert into merchant_orders (
    id, merchant_id, product_id, payment_method_id, amount_cents, currency, status,
    sanitized_confirmation_json, created_at
  ) values (
    p_order_id, p_merchant_id, p_product_id, p_payment_method_id, p_amount_cents, p_currency, 'paid',
    jsonb_build_object(
      'orderId', p_order_id,
      'merchantId', p_merchant_id,
      'productId', p_product_id,
      'status', 'paid',
      'amountCents', p_amount_cents,
      'currency', p_currency
    )::text,
    p_created_at
  );

  insert into receipts (
    id, purchase_attempt_id, receipt_hash, receipt_type, payload_json, created_at
  ) values (
    p_receipt_id, p_attempt_id, p_receipt_hash, p_receipt_type, p_receipt_payload_json, p_created_at
  );

  insert into purchase_attempts (
    id, mandate_id, agent_id, merchant_id, product_id, category, amount_cents, currency,
    payment_method, decision, reason, approval_id, order_id, receipt_id, sanitized_response_json, created_at
  ) values (
    p_attempt_id, p_mandate_id, p_agent_id, p_merchant_id, p_product_id, p_category, p_amount_cents, p_currency,
    p_payment_method_type, 'approved', null, p_approval_id, p_order_id, p_receipt_id, p_sanitized_response_json, p_created_at
  )
  returning * into v_attempt;

  select * into v_receipt from receipts where id = p_receipt_id;

  return jsonb_build_object(
    'attempt', row_to_json(v_attempt),
    'receipt', row_to_json(v_receipt),
    'idempotent', false
  );
end;
$$;
