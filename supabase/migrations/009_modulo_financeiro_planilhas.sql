-- =========================================================
-- 009 · Tabelas para Módulo Financeiro: Fechamento, Cartões MA e Lançamentos MA
-- =========================================================

-- 1. Fechamentos Mensais (Necessidade de Caixa)
create table if not exists public.fechamentos_mensais (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  mes_ano text not null, -- ex: 'Outubro', 'Novembro' ou '2026-10'
  valor_cartoes numeric(14,2) not null default 0,
  valor_contas numeric(14,2) not null default 0,
  valor_dinheiro numeric(14,2) not null default 0,
  valor_pix numeric(14,2) not null default 0,
  valor_conta_corrente numeric(14,2) not null default 0,
  valor_salario numeric(14,2) not null default 0,
  valor_necessario numeric(14,2) not null default 0,
  observacao text,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  constraint fechamento_usuario_mes_unique unique (usuario_id, mes_ano)
);

-- 2. Controle de Cartões (Vigentes e Detalhamento MA)
create table if not exists public.cartoes_controle_ma (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  mes_referencia text not null default 'Outubro', -- ex: 'Outubro', 'Novembro'
  tabela_tipo text not null check (tabela_tipo in ('vigente', 'detalhado_ma')),
  cartao_nome text not null,
  valor numeric(14,2) not null default 0,
  valor_ma numeric(14,2) not null default 0,
  valor_sem_ma numeric(14,2) not null default 0,
  fechamento text,
  pagamento text,
  atualizado_em_texto text,
  ordem integer not null default 0,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

-- 3. Lançamentos / Saques Poker (Múltiplas entradas com data, cartão, local, valor e taxa)
create table if not exists public.lancamentos_ma (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  mes_base text not null default 'Novembro',
  data_cartao text not null, -- ex: '31/out', '30/out'
  cartao_nome text not null, -- ex: 'Nubank', 'PicPay'
  local text not null,       -- ex: 'MonteCarlo', 'H2'
  valor numeric(14,2) not null default 0,
  taxa numeric(14,2) not null default 0,
  ordem integer not null default 0,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

-- 4. Sessões de Poker (Cash Out por Data/Sessão)
create table if not exists public.poker_sessoes_cashout (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  mes_base text not null default 'Novembro',
  data_cartao text not null,
  cashout numeric(14,2) not null default 0,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  constraint poker_sessao_unique unique (usuario_id, mes_base, data_cartao)
);

-- RLS
alter table public.fechamentos_mensais enable row level security;
alter table public.cartoes_controle_ma enable row level security;
alter table public.lancamentos_ma enable row level security;

-- Policies Fechamentos
drop policy if exists "Usuário gerencia seus próprios fechamentos" on public.fechamentos_mensais;
create policy "Usuário gerencia seus próprios fechamentos"
  on public.fechamentos_mensais
  for all
  using (usuario_id = (select auth.uid()))
  with check (usuario_id = (select auth.uid()));

-- Policies Cartões Controle MA
drop policy if exists "Usuário gerencia seus próprios cartões de controle" on public.cartoes_controle_ma;
create policy "Usuário gerencia seus próprios cartões de controle"
  on public.cartoes_controle_ma
  for all
  using (usuario_id = (select auth.uid()))
  with check (usuario_id = (select auth.uid()));

-- Policies Lançamentos MA
drop policy if exists "Usuário gerencia seus próprios lançamentos MA" on public.lancamentos_ma;
create policy "Usuário gerencia seus próprios lançamentos MA"
  on public.lancamentos_ma
  for all
  using (usuario_id = (select auth.uid()))
  with check (usuario_id = (select auth.uid()));

-- Triggers para atualizado_em
drop trigger if exists set_fechamentos_updated_at on public.fechamentos_mensais;
create trigger set_fechamentos_updated_at
  before update on public.fechamentos_mensais
  for each row execute function public.set_updated_at();

drop trigger if exists set_cartoes_controle_updated_at on public.cartoes_controle_ma;
create trigger set_cartoes_controle_updated_at
  before update on public.cartoes_controle_ma
  for each row execute function public.set_updated_at();

drop trigger if exists set_lancamentos_ma_updated_at on public.lancamentos_ma;
create trigger set_lancamentos_ma_updated_at
  before update on public.lancamentos_ma
  for each row execute function public.set_updated_at();
