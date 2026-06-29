-- Phase campaign storage for Vercel + Supabase.
-- Run once in the Supabase SQL editor (or via supabase db push).

create table if not exists campaigns (
  id text primary key,
  name text not null,
  kind text check (kind in ('claim', 'batch', 'vesting')),
  token_address text not null,
  airdrop_address text,
  creator text,
  start_timestamp bigint not null,
  end_timestamp bigint not null,
  recipient_count integer not null default 0,
  claims_count integer not null default 0,
  status text not null check (status in ('draft', 'deploying', 'live', 'ended')),
  metadata_uri text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists campaign_previews (
  id bigserial primary key,
  campaign_id text not null references campaigns (id) on delete cascade,
  recipient_address text not null,
  masked_address text not null,
  status text not null check (status in ('pending', 'revealed', 'claimed')),
  proof_hash text not null,
  updated_at timestamptz not null default now(),
  unique (campaign_id, recipient_address)
);

create table if not exists claims (
  campaign_id text not null references campaigns (id) on delete cascade,
  recipient text not null,
  encrypted_handle text not null,
  input_proof text not null,
  signature text not null,
  issued_at timestamptz not null default now(),
  revealed_at timestamptz,
  claimed_at timestamptz,
  primary key (campaign_id, recipient)
);

create table if not exists vesting_schedules (
  campaign_id text not null references campaigns (id) on delete cascade,
  recipient text not null,
  vesting_id text not null,
  manager_address text,
  batch_index integer,
  tx_hash text,
  created_at timestamptz not null default now(),
  primary key (campaign_id, vesting_id)
);

create index if not exists campaigns_created_at_idx on campaigns (created_at desc);
create index if not exists campaign_previews_campaign_id_idx on campaign_previews (campaign_id, updated_at desc);
create index if not exists claims_campaign_id_idx on claims (campaign_id);
create index if not exists vesting_schedules_campaign_recipient_idx on vesting_schedules (campaign_id, recipient);
