-- =========================================================
-- 004 · Tabela cartoes_credito no schema public
-- =========================================================

create table if not exists public.cartoes_credito (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  nome text not null,
  limite numeric(14,2) not null default 0 check (limite >= 0),
  dia_fechamento smallint not null default 25 check (dia_fechamento between 1 and 31),
  dia_vencimento smallint not null default 5 check (dia_vencimento between 1 and 31),
  bandeira text not null default 'mastercard' check (bandeira in ('mastercard', 'visa', 'elo', 'amex', 'hipercard', 'outro')),
  cor text not null default '#820AD1',
  ativo boolean not null default true,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  constraint cartoes_nome_not_empty check (length(trim(nome)) > 0)
);

comment on table public.cartoes_credito is 'Cartões de crédito com controle de limite, fechamento e vencimento.';

-- Coluna opcional de cartão em transacoes
alter table public.transacoes add column if not exists cartao_id uuid references public.cartoes_credito(id) on delete set null;

-- RLS
alter table public.cartoes_credito enable row level security;

drop policy if exists "Usuário gerencia seus próprios cartões" on public.cartoes_credito;
create policy "Usuário gerencia seus próprios cartões"
  on public.cartoes_credito
  for all
  using (usuario_id = (select auth.uid()))
  with check (usuario_id = (select auth.uid()));

-- Trigger para atualizado_em
drop trigger if exists set_cartoes_updated_at on public.cartoes_credito;
create trigger set_cartoes_updated_at
  before update on public.cartoes_credito
  for each row execute function public.set_updated_at();
