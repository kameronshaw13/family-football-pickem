-- Preserve the prior-week settlement separately from the new week's deposit.
-- This is displayed as a standalone Payout row between weeks.
alter table public.bank_resets
  add column if not exists settlement_week integer,
  add column if not exists settlement_amount numeric(12,2);
alter table public.bank_resets
  drop constraint if exists bank_resets_settlement_week_nonnegative;
alter table public.bank_resets
  add constraint bank_resets_settlement_week_nonnegative
  check (settlement_week is null or settlement_week >= 0);
