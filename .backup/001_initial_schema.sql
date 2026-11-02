-- App Financeiro
-- Migration: 001_initial_schema.sql
-- Supabase / PostgreSQL

create extension if not exists "pgcrypto";

-- =========================================================
-- Helper: updated_at
-- =========================================================

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

-- =========================================================
-- PROFILES
-- Extends auth.users
-- =========================================================

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  nome text,
  email text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

comment on table public.profiles is 'Perfil do usuário do aplicativo.';

create index if not exists profiles_email_idx
  on public.profiles(email);

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

-- Cria o profile automaticamente quando um usuário se cadastra.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, nome, email)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'nome', new.raw_user_meta_data ->> 'name'),
    new.email
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

-- =========================================================
-- CATEGORIAS
-- =========================================================

create table if not exists public.categorias (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  nome text not null,
  tipo text not null check (tipo in ('receita', 'despesa')),
  cor text,
  icone text,
  created_at timestamptz not null default timezone('utc', now()),

  constraint categorias_nome_not_empty check (length(trim(nome)) > 0)
);

comment on table public.categorias is 'Categorias de receitas e despesas.';

create index if not exists categorias_user_id_idx
  on public.categorias(user_id);

create index if not exists categorias_user_tipo_idx
  on public.categorias(user_id, tipo);

create unique index if not exists categorias_user_nome_tipo_unique
  on public.categorias(user_id, lower(nome), tipo);

-- =========================================================
-- CONTAS
-- =========================================================

create table if not exists public.contas (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  nome text not null,
  tipo text not null check (
    tipo in ('corrente', 'poupanca', 'carteira', 'investimento', 'outro')
  ),
  saldo_inicial numeric(14,2) not null default 0,
  instituicao text,
  cor text,
  ativa boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),

  constraint contas_nome_not_empty check (length(trim(nome)) > 0)
);

comment on table public.contas is 'Contas e locais onde o dinheiro do usuário é mantido.';

create index if not exists contas_user_id_idx
  on public.contas(user_id);

create index if not exists contas_user_ativa_idx
  on public.contas(user_id, ativa);

drop trigger if exists contas_set_updated_at on public.contas;
create trigger contas_set_updated_at
before update on public.contas
for each row execute function public.set_updated_at();

-- =========================================================
-- TRANSACOES
-- =========================================================

create table if not exists public.transacoes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  conta_id uuid not null references public.contas(id) on delete restrict,
  categoria_id uuid references public.categorias(id) on delete set null,
  tipo text not null check (tipo in ('receita', 'despesa')),
  descricao text not null,
  valor numeric(14,2) not null check (valor > 0),
  data date not null default current_date,
  observacao text,
  status text not null default 'confirmado'
    check (status in ('pendente', 'confirmado', 'cancelado')),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),

  constraint transacoes_descricao_not_empty
    check (length(trim(descricao)) > 0)
);

comment on table public.transacoes is 'Receitas e despesas do usuário.';

create index if not exists transacoes_user_id_idx
  on public.transacoes(user_id);

create index if not exists transacoes_conta_id_idx
  on public.transacoes(conta_id);

create index if not exists transacoes_categoria_id_idx
  on public.transacoes(categoria_id);

create index if not exists transacoes_user_data_idx
  on public.transacoes(user_id, data desc);

create index if not exists transacoes_user_tipo_data_idx
  on public.transacoes(user_id, tipo, data desc);

drop trigger if exists transacoes_set_updated_at on public.transacoes;
create trigger transacoes_set_updated_at
before update on public.transacoes
for each row execute function public.set_updated_at();

-- =========================================================
-- PARCELAS
-- =========================================================

create table if not exists public.parcelas (
  id uuid primary key default gen_random_uuid(),
  transacao_id uuid not null references public.transacoes(id) on delete cascade,
  numero integer not null,
  total_parcelas integer not null,
  valor numeric(14,2) not null check (valor > 0),
  data_vencimento date not null,
  status text not null default 'pendente'
    check (status in ('pendente', 'paga', 'cancelada')),
  created_at timestamptz not null default timezone('utc', now()),

  constraint parcelas_numero_valido
    check (numero >= 1 and numero <= total_parcelas),

  constraint parcelas_total_valido
    check (total_parcelas >= 1)
);

comment on table public.parcelas is 'Parcelas associadas a transações parceladas.';

create index if not exists parcelas_transacao_id_idx
  on public.parcelas(transacao_id);

create index if not exists parcelas_vencimento_idx
  on public.parcelas(data_vencimento);

create unique index if not exists parcelas_transacao_numero_unique
  on public.parcelas(transacao_id, numero);

-- =========================================================
-- METAS
-- =========================================================

create table if not exists public.metas (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  nome text not null,
  valor_objetivo numeric(14,2) not null check (valor_objetivo > 0),
  valor_atual numeric(14,2) not null default 0 check (valor_atual >= 0),
  data_limite date,
  status text not null default 'ativa'
    check (status in ('ativa', 'concluida', 'cancelada')),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),

  constraint metas_nome_not_empty check (length(trim(nome)) > 0)
);

comment on table public.metas is 'Objetivos financeiros do usuário.';

create index if not exists metas_user_id_idx
  on public.metas(user_id);

create index if not exists metas_user_status_idx
  on public.metas(user_id, status);

drop trigger if exists metas_set_updated_at on public.metas;
create trigger metas_set_updated_at
before update on public.metas
for each row execute function public.set_updated_at();

-- =========================================================
-- ORCAMENTOS
-- =========================================================

create table if not exists public.orcamentos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  categoria_id uuid not null references public.categorias(id) on delete cascade,
  mes smallint not null check (mes between 1 and 12),
  ano smallint not null check (ano between 2000 and 2200),
  valor_limite numeric(14,2) not null check (valor_limite >= 0),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

comment on table public.orcamentos is 'Limites mensais de gastos por categoria.';

create index if not exists orcamentos_user_id_idx
  on public.orcamentos(user_id);

create index if not exists orcamentos_user_periodo_idx
  on public.orcamentos(user_id, ano, mes);

create unique index if not exists orcamentos_user_categoria_periodo_unique
  on public.orcamentos(user_id, categoria_id, ano, mes);

drop trigger if exists orcamentos_set_updated_at on public.orcamentos;
create trigger orcamentos_set_updated_at
before update on public.orcamentos
for each row execute function public.set_updated_at();

-- =========================================================
-- FUNÇÃO: garante que relacionamentos pertençam ao mesmo usuário
-- =========================================================

create or replace function public.validate_transaction_ownership()
returns trigger
language plpgsql
as $$
declare
  conta_user_id uuid;
  categoria_user_id uuid;
begin
  select user_id into conta_user_id
  from public.contas
  where id = new.conta_id;

  if conta_user_id is null or conta_user_id <> new.user_id then
    raise exception 'A conta informada não pertence ao usuário.';
  end if;

  if new.categoria_id is not null then
    select user_id into categoria_user_id
    from public.categorias
    where id = new.categoria_id;

    if categoria_user_id is null or categoria_user_id <> new.user_id then
      raise exception 'A categoria informada não pertence ao usuário.';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists validate_transaction_ownership_trigger
on public.transacoes;

create trigger validate_transaction_ownership_trigger
before insert or update on public.transacoes
for each row execute function public.validate_transaction_ownership();

-- =========================================================
-- RLS
-- =========================================================

alter table public.profiles enable row level security;
alter table public.categorias enable row level security;
alter table public.contas enable row level security;
alter table public.transacoes enable row level security;
alter table public.parcelas enable row level security;
alter table public.metas enable row level security;
alter table public.orcamentos enable row level security;

-- Profiles
drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own"
on public.profiles for select
to authenticated
using (id = auth.uid());

drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own"
on public.profiles for insert
to authenticated
with check (id = auth.uid());

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own"
on public.profiles for update
to authenticated
using (id = auth.uid())
with check (id = auth.uid());

-- Categorias
drop policy if exists "categorias_select_own" on public.categorias;
create policy "categorias_select_own"
on public.categorias for select
to authenticated
using (user_id = auth.uid());

drop policy if exists "categorias_insert_own" on public.categorias;
create policy "categorias_insert_own"
on public.categorias for insert
to authenticated
with check (user_id = auth.uid());

drop policy if exists "categorias_update_own" on public.categorias;
create policy "categorias_update_own"
on public.categorias for update
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

drop policy if exists "categorias_delete_own" on public.categorias;
create policy "categorias_delete_own"
on public.categorias for delete
to authenticated
using (user_id = auth.uid());

-- Contas
drop policy if exists "contas_select_own" on public.contas;
create policy "contas_select_own"
on public.contas for select
to authenticated
using (user_id = auth.uid());

drop policy if exists "contas_insert_own" on public.contas;
create policy "contas_insert_own"
on public.contas for insert
to authenticated
with check (user_id = auth.uid());

drop policy if exists "contas_update_own" on public.contas;
create policy "contas_update_own"
on public.contas for update
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

drop policy if exists "contas_delete_own" on public.contas;
create policy "contas_delete_own"
on public.contas for delete
to authenticated
using (user_id = auth.uid());

-- Transações
drop policy if exists "transacoes_select_own" on public.transacoes;
create policy "transacoes_select_own"
on public.transacoes for select
to authenticated
using (user_id = auth.uid());

drop policy if exists "transacoes_insert_own" on public.transacoes;
create policy "transacoes_insert_own"
on public.transacoes for insert
to authenticated
with check (user_id = auth.uid());

drop policy if exists "transacoes_update_own" on public.transacoes;
create policy "transacoes_update_own"
on public.transacoes for update
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

drop policy if exists "transacoes_delete_own" on public.transacoes;
create policy "transacoes_delete_own"
on public.transacoes for delete
to authenticated
using (user_id = auth.uid());

-- Parcelas
-- O acesso é derivado da transação proprietária.
drop policy if exists "parcelas_select_own" on public.parcelas;
create policy "parcelas_select_own"
on public.parcelas for select
to authenticated
using (
  exists (
    select 1
    from public.transacoes t
    where t.id = parcelas.transacao_id
      and t.user_id = auth.uid()
  )
);

drop policy if exists "parcelas_insert_own" on public.parcelas;
create policy "parcelas_insert_own"
on public.parcelas for insert
to authenticated
with check (
  exists (
    select 1
    from public.transacoes t
    where t.id = parcelas.transacao_id
      and t.user_id = auth.uid()
  )
);

drop policy if exists "parcelas_update_own" on public.parcelas;
create policy "parcelas_update_own"
on public.parcelas for update
to authenticated
using (
  exists (
    select 1
    from public.transacoes t
    where t.id = parcelas.transacao_id
      and t.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.transacoes t
    where t.id = parcelas.transacao_id
      and t.user_id = auth.uid()
  )
);

drop policy if exists "parcelas_delete_own" on public.parcelas;
create policy "parcelas_delete_own"
on public.parcelas for delete
to authenticated
using (
  exists (
    select 1
    from public.transacoes t
    where t.id = parcelas.transacao_id
      and t.user_id = auth.uid()
  )
);

-- Metas
drop policy if exists "metas_select_own" on public.metas;
create policy "metas_select_own"
on public.metas for select
to authenticated
using (user_id = auth.uid());

drop policy if exists "metas_insert_own" on public.metas;
create policy "metas_insert_own"
on public.metas for insert
to authenticated
with check (user_id = auth.uid());

drop policy if exists "metas_update_own" on public.metas;
create policy "metas_update_own"
on public.metas for update
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

drop policy if exists "metas_delete_own" on public.metas;
create policy "metas_delete_own"
on public.metas for delete
to authenticated
using (user_id = auth.uid());

-- Orçamentos
drop policy if exists "orcamentos_select_own" on public.orcamentos;
create policy "orcamentos_select_own"
on public.orcamentos for select
to authenticated
using (user_id = auth.uid());

drop policy if exists "orcamentos_insert_own" on public.orcamentos;
create policy "orcamentos_insert_own"
on public.orcamentos for insert
to authenticated
with check (user_id = auth.uid());

drop policy if exists "orcamentos_update_own" on public.orcamentos;
create policy "orcamentos_update_own"
on public.orcamentos for update
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

drop policy if exists "orcamentos_delete_own" on public.orcamentos;
create policy "orcamentos_delete_own"
on public.orcamentos for delete
to authenticated
using (user_id = auth.uid());

-- =========================================================
-- SEED: categorias padrão
-- Criadas automaticamente para cada novo usuário.
-- =========================================================

create or replace function public.create_default_categories()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.categorias (user_id, nome, tipo, icone)
  values
    (new.id, 'Alimentação', 'despesa', 'utensils'),
    (new.id, 'Moradia', 'despesa', 'home'),
    (new.id, 'Transporte', 'despesa', 'car'),
    (new.id, 'Lazer', 'despesa', 'gamepad'),
    (new.id, 'Saúde', 'despesa', 'heart'),
    (new.id, 'Educação', 'despesa', 'book'),
    (new.id, 'Compras', 'despesa', 'shopping-bag'),
    (new.id, 'Contas', 'despesa', 'receipt'),
    (new.id, 'Outros', 'despesa', 'more-horizontal'),
    (new.id, 'Salário', 'receita', 'briefcase'),
    (new.id, 'Investimentos', 'receita', 'trending-up'),
    (new.id, 'Outras receitas', 'receita', 'plus-circle');

  return new;
end;
$$;

drop trigger if exists create_default_categories_trigger on public.profiles;
create trigger create_default_categories_trigger
after insert on public.profiles
for each row execute function public.create_default_categories();

-- =========================================================
-- Fim da migration
-- =========================================================
