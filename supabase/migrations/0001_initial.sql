-- StonkLaunch: apply to an existing Supabase project using an authorized operator.
-- No demo cluster, private keys, wallet credentials, or automatic financial writes.
begin;
create schema if not exists stonklaunch_private;
revoke all on schema stonklaunch_private from public, anon, authenticated;

create table public.verified_wallets (
 user_id uuid not null references auth.users(id) on delete cascade,
 wallet text not null check (wallet ~ '^[1-9A-HJ-NP-Za-km-z]{32,44}$'),
 verified_at timestamptz not null default now(),
 primary key (user_id, wallet)
);
comment on table public.verified_wallets is 'Service writes only after auth.getUser validates immutable Solana Web3 identity. Never populate from request wallet or editable user_metadata.';
create function stonklaunch_private.owns_wallet(target_user uuid, target_wallet text)
returns boolean language sql stable security definer set search_path = '' as $$
 select target_user = auth.uid() and exists (
  select 1 from public.verified_wallets w where w.user_id = auth.uid() and w.wallet = target_wallet
 );
$$;
revoke all on function stonklaunch_private.owns_wallet(uuid,text) from public;
grant usage on schema stonklaunch_private to authenticated;
grant execute on function stonklaunch_private.owns_wallet(uuid,text) to authenticated;

create table public.asset_capabilities (
 cluster text not null check(cluster in ('devnet','mainnet-beta')),
 asset_key text not null, symbol text not null, mint text, token_program text,
 decimals smallint check(decimals between 0 and 255), global_config_id text, cpmm_config_id text,
 status text not null check(status in ('enabled','verification_required','preview','blocked','temporarily_unavailable')),
 can_create boolean not null default false, can_buy boolean not null default false, can_sell boolean not null default false,
 migration_path_verified boolean not null default false, reason_codes text[] not null default '{}',
 checked_slot bigint check(checked_slot >= 0), checked_at timestamptz,
 primary key(cluster,asset_key),
 check(not can_create or (mint is not null and token_program is not null and decimals is not null and global_config_id is not null and cpmm_config_id is not null and migration_path_verified and status='enabled'))
);
create table public.launches (
 cluster text not null check(cluster in ('devnet','mainnet-beta')), pool_id text not null,
 mint_a text not null, mint_b text not null, platform_id text not null, creator text,
 name text not null default '', symbol text not null default '', description text not null default '',
 image_url text, metadata_uri text, status smallint not null check(status in (0,1,2)),
 raised_raw numeric(78,0) not null default 0 check(raised_raw>=0), target_raw numeric(78,0) not null default 0 check(target_raw>=0),
 volume_raw numeric(78,0) check(volume_raw>=0), cpmm_pool_id text, cpmm_verified boolean not null default false,
 lp_evidence jsonb, confirmed_slot bigint check(confirmed_slot>=0), signature text,
 created_at timestamptz not null default now(), observed_at timestamptz not null default now(),
 data_source text not null default 'rpc', payload jsonb not null default '{}' check(jsonb_typeof(payload)='object'), primary key(cluster,pool_id),
 check(not cpmm_verified or (status=2 and cpmm_pool_id is not null))
);
create function stonklaunch_private.preserve_launch_identity_and_slot()
returns trigger language plpgsql set search_path = '' as $$
begin
 if new.cluster is distinct from old.cluster or new.pool_id is distinct from old.pool_id
 or new.mint_a is distinct from old.mint_a or new.mint_b is distinct from old.mint_b
 or new.platform_id is distinct from old.platform_id then
  raise exception 'LAUNCH_IDENTITY_IMMUTABLE';
 end if;
 if old.confirmed_slot is not null and (new.confirmed_slot is null or new.confirmed_slot < old.confirmed_slot) then
  return old;
 end if;
 return new;
end;
$$;
revoke all on function stonklaunch_private.preserve_launch_identity_and_slot() from public;
create trigger preserve_launch_identity_and_slot before update on public.launches
 for each row execute function stonklaunch_private.preserve_launch_identity_and_slot();
create index launches_mint on public.launches(cluster,mint_a);
create index launches_platform_time on public.launches(cluster,platform_id,created_at desc,pool_id);
create index launches_creator on public.launches(cluster,creator);
create table public.launch_drafts (
 draft_id uuid primary key default gen_random_uuid(),
 owner_user_id uuid not null references auth.users(id) on delete cascade,
 owner_wallet text not null,
 cluster text not null check(cluster in ('devnet','mainnet-beta')),
 parameters jsonb not null default '{}' check(jsonb_typeof(parameters)='object'),
 client_mint_public_key text, confirmed_signature text,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 unique(cluster,owner_user_id,client_mint_public_key),
 foreign key(owner_user_id,owner_wallet) references public.verified_wallets(user_id,wallet)
);
create function stonklaunch_private.preserve_draft_identity()
returns trigger language plpgsql set search_path = '' as $$
begin
 if new.draft_id is distinct from old.draft_id or new.owner_user_id is distinct from old.owner_user_id or new.owner_wallet is distinct from old.owner_wallet
 or new.cluster is distinct from old.cluster or (old.client_mint_public_key is not null and new.client_mint_public_key is distinct from old.client_mint_public_key) then
  raise exception 'DRAFT_IDENTITY_IMMUTABLE';
 end if;
 new.updated_at := now();
 return new;
end;
$$;
revoke all on function stonklaunch_private.preserve_draft_identity() from public;
create trigger preserve_draft_identity before update on public.launch_drafts
 for each row execute function stonklaunch_private.preserve_draft_identity();
create index launch_drafts_owner on public.launch_drafts(owner_user_id,updated_at desc);
create table public.chain_events (
 cluster text not null check(cluster in ('devnet','mainnet-beta')), signature text not null,
 outer_instruction_index integer not null check(outer_instruction_index>=0),
 event_index integer not null check(event_index>=0), event_type text not null,
 pool_id text, quote_mint text, block_time timestamptz, slot bigint not null check(slot>=0),
 commitment text not null check(commitment in ('confirmed','finalized')),
 amount_raw numeric(78,0) check(amount_raw>=0), protocol_fee_raw numeric(78,0) check(protocol_fee_raw>=0),
 platform_fee_raw numeric(78,0) check(platform_fee_raw>=0), creator_fee_raw numeric(78,0) check(creator_fee_raw>=0),
 referral_fee_raw numeric(78,0) check(referral_fee_raw>=0),
 primary key(cluster,signature,outer_instruction_index,event_index)
);
create index chain_events_pool_slot on public.chain_events(cluster,pool_id,slot);
create table public.fee_claims (
 cluster text not null check(cluster in ('devnet','mainnet-beta')), signature text not null,
 event_index integer not null check(event_index>=0), claimant text not null, quote_mint text not null,
 amount_raw numeric(78,0) not null check(amount_raw>=0), destination text not null,
 status text not null check(status in ('confirmed','finalized')),
 claim_scope text not null check(claim_scope in ('platform','creator_quote_aggregate','cpmm')),
 attribution_status text not null check(attribution_status in ('verified','unallocated','partial')),
 slot bigint not null check(slot>=0), observed_at timestamptz not null default now(),
 primary key(cluster,signature,event_index)
);
create index fee_claims_claimant on public.fee_claims(cluster,claimant,quote_mint);
create table public.indexer_cursors (
 cluster text not null check(cluster in ('devnet','mainnet-beta')), stream text not null,
 partition text not null default 'default', cursor jsonb, slot bigint check(slot>=0),
 last_success_at timestamptz, last_error_code text, updated_at timestamptz not null default now(),
 primary key(cluster,stream,partition)
);
create table public.growth_events (
 event_id uuid primary key default gen_random_uuid(), session_id uuid,
 event_type text not null check(event_type in ('launch_started','draft_saved','create_confirmed','poster_downloaded','share_editor_opened')),
 source text check(length(source)<=120), cluster text not null check(cluster in ('devnet','mainnet-beta')),
 pool_id text, created_at timestamptz not null default now()
);
-- Default-deny every table, including new financial records. No public financial views.
do $$ declare t text; begin
 foreach t in array array['verified_wallets','asset_capabilities','launches','launch_drafts','chain_events','fee_claims','indexer_cursors','growth_events'] loop
  execute format('alter table public.%I enable row level security',t);
  execute format('revoke all on table public.%I from public, anon, authenticated',t);
  execute format('grant all on table public.%I to service_role',t);
 end loop;
end $$;
-- Public projections omit private drafts, wallet mappings, financial entries and cursor errors.
grant select on public.asset_capabilities to anon,authenticated;
grant select(cluster,pool_id,mint_a,mint_b,platform_id,creator,name,symbol,description,image_url,metadata_uri,status,raised_raw,target_raw,volume_raw,cpmm_pool_id,cpmm_verified,lp_evidence,confirmed_slot,signature,created_at,observed_at,data_source) on public.launches to anon,authenticated;
create policy capabilities_public_read on public.asset_capabilities for select to anon,authenticated using(true);
create policy launches_public_read on public.launches for select to anon,authenticated using(true);
grant select,delete on public.launch_drafts to authenticated;
-- A draft owner cannot forge confirmed_signature or alter ownership after insertion.
grant insert(draft_id,owner_user_id,owner_wallet,cluster,parameters,client_mint_public_key) on public.launch_drafts to authenticated;
grant update(draft_id,owner_user_id,owner_wallet,cluster,parameters,client_mint_public_key,updated_at) on public.launch_drafts to authenticated;
create policy drafts_owner_read on public.launch_drafts for select to authenticated using(stonklaunch_private.owns_wallet(owner_user_id,owner_wallet));
create policy drafts_owner_insert on public.launch_drafts for insert to authenticated with check(stonklaunch_private.owns_wallet(owner_user_id,owner_wallet));
create policy drafts_owner_update on public.launch_drafts for update to authenticated using(stonklaunch_private.owns_wallet(owner_user_id,owner_wallet)) with check(stonklaunch_private.owns_wallet(owner_user_id,owner_wallet));
create policy drafts_owner_delete on public.launch_drafts for delete to authenticated using(stonklaunch_private.owns_wallet(owner_user_id,owner_wallet));
commit;
