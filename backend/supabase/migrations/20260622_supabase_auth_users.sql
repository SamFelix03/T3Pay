-- Link app users to Supabase Auth accounts.

alter table if exists users
  add column if not exists email text,
  add column if not exists auth_user_id uuid unique;

create unique index if not exists users_email_idx on users(email) where email is not null;
