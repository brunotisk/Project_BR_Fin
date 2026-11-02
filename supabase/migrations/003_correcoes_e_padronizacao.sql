-- =========================================================
-- 003 · Correções, padronização em português e fuso America/Sao_Paulo
-- =========================================================
-- Idempotente: pode ser aplicada sobre
--   (a) as migrations 0001 + 0002 do projeto (profiles mínima), ou
--   (b) o schema completo de 001_initial_schema.sql,
-- e pode ser reaplicada sem efeitos colaterais. Dados existentes são preservados.
--
-- O que muda:
--   1. Colunas técnicas em português: user_id -> usuario_id,
--      created_at -> criado_em, updated_at -> atualizado_em.
--   2. Fuso: timestamps usam now() (instante absoluto); datas "de hoje" usam
--      public.hoje(), calculada em America/Sao_Paulo (e não no fuso da sessão, UTC).
--   3. Integridade: categoria precisa ser do mesmo tipo da transação; orçamento só
--      aceita categoria do próprio usuário (e de despesa); parcelas precisam fechar
--      com o valor da transação (validado no COMMIT).
--   4. Parcelas ganham usuario_id (RLS simples + FK composta com a transação) e
--      a função criar_transacao_parcelada() cria compra + parcelas de forma atômica.
--   5. RLS com (select auth.uid()), funções com search_path fixo, índices redundantes
--      removidos e usuario_id com default auth.uid().

-- =========================================================
-- 1. Funções auxiliares
-- =========================================================

-- Data de "hoje" no Brasil, independente do fuso da sessão do banco.
create or replace function public.hoje()
returns date
language sql
stable
set search_path = ''
as $$
  select (now() at time zone 'America/Sao_Paulo')::date
$$;

comment on function public.hoje() is 'Data atual em America/Sao_Paulo.';

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.atualizado_em = now();
  return new;
end;
$$;

-- =========================================================
-- 2. Renomeia colunas técnicas (se ainda estiverem com o nome antigo)
-- =========================================================

do $$
declare
  t text;
  r record;
begin
  foreach t in array array['profiles','categorias','contas','transacoes','parcelas','metas','orcamentos'] loop
    for r in
      select * from (values
        ('user_id', 'usuario_id'),
        ('created_at', 'criado_em'),
        ('updated_at', 'atualizado_em')
      ) as m(antigo, novo)
    loop
      if exists (
        select 1 from information_schema.columns
        where table_schema = 'public' and table_name = t and column_name = r.antigo
      ) and not exists (
        select 1 from information_schema.columns
        where table_schema = 'public' and table_name = t and column_name = r.novo
      ) then
        execute format('alter table public.%I rename column %I to %I', t, r.antigo, r.novo);
      end if;
    end loop;
  end loop;
end $$;

-- =========================================================
-- 3. Tabelas (cria o que faltar; no cenário (b) nada disso é recriado)
-- =========================================================

-- PROFILES (no cenário (a) só existiam id e criado_em)
alter table public.profiles add column if not exists nome text;
alter table public.profiles add column if not exists email text;
alter table public.profiles add column if not exists atualizado_em timestamptz not null default now();

comment on table public.profiles is 'Perfil do usuário do aplicativo.';

create table if not exists public.categorias (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  nome text not null,
  tipo text not null check (tipo in ('receita', 'despesa')),
  cor text,
  icone text,
  criado_em timestamptz not null default now(),
  constraint categorias_nome_not_empty check (length(trim(nome)) > 0)
);

comment on table public.categorias is 'Categorias de receitas e despesas.';

create table if not exists public.contas (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  nome text not null,
  tipo text not null check (tipo in ('corrente', 'poupanca', 'carteira', 'investimento', 'outro')),
  saldo_inicial numeric(14,2) not null default 0,
  instituicao text,
  cor text,
  ativa boolean not null default true,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  constraint contas_nome_not_empty check (length(trim(nome)) > 0)
);

comment on table public.contas is 'Contas e locais onde o dinheiro do usuário é mantido.';

create table if not exists public.transacoes (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  conta_id uuid not null references public.contas(id) on delete restrict,
  categoria_id uuid references public.categorias(id) on delete set null,
  tipo text not null check (tipo in ('receita', 'despesa')),
  descricao text not null,
  valor numeric(14,2) not null check (valor > 0),
  data date not null default public.hoje(),
  observacao text,
  status text not null default 'confirmado' check (status in ('pendente', 'confirmado', 'cancelado')),
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  constraint transacoes_descricao_not_empty check (length(trim(descricao)) > 0)
);

comment on table public.transacoes is 'Receitas e despesas do usuário.';

create table if not exists public.parcelas (
  id uuid primary key default gen_random_uuid(),
  transacao_id uuid not null,
  usuario_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  numero integer not null,
  total_parcelas integer not null,
  valor numeric(14,2) not null check (valor > 0),
  data_vencimento date not null,
  status text not null default 'pendente' check (status in ('pendente', 'paga', 'cancelada')),
  criado_em timestamptz not null default now(),
  constraint parcelas_numero_valido check (numero >= 1 and numero <= total_parcelas),
  constraint parcelas_total_valido check (total_parcelas >= 1)
);

comment on table public.parcelas is 'Parcelas associadas a transações parceladas.';

create table if not exists public.metas (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  nome text not null,
  valor_objetivo numeric(14,2) not null check (valor_objetivo > 0),
  valor_atual numeric(14,2) not null default 0 check (valor_atual >= 0),
  data_limite date,
  status text not null default 'ativa' check (status in ('ativa', 'concluida', 'cancelada')),
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  constraint metas_nome_not_empty check (length(trim(nome)) > 0)
);

comment on table public.metas is 'Objetivos financeiros do usuário.';

create table if not exists public.orcamentos (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  categoria_id uuid not null references public.categorias(id) on delete cascade,
  mes smallint not null check (mes between 1 and 12),
  ano smallint not null check (ano between 2000 and 2200),
  valor_limite numeric(14,2) not null check (valor_limite >= 0),
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

comment on table public.orcamentos is 'Limites mensais de gastos por categoria.';

-- =========================================================
-- 4. Defaults (cenário (b) vinha com timezone('utc', now()) e sem default de usuário)
-- =========================================================

do $$
declare
  t text;
  c text;
begin
  foreach t in array array['profiles','categorias','contas','transacoes','parcelas','metas','orcamentos'] loop
    foreach c in array array['criado_em','atualizado_em'] loop
      if exists (
        select 1 from information_schema.columns
        where table_schema = 'public' and table_name = t and column_name = c
      ) then
        execute format('alter table public.%I alter column %I set default now()', t, c);
      end if;
    end loop;

    if exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = t and column_name = 'usuario_id'
    ) then
      execute format('alter table public.%I alter column usuario_id set default auth.uid()', t);
    end if;
  end loop;
end $$;

alter table public.transacoes alter column data set default public.hoje();

-- =========================================================
-- 5. Parcelas: usuario_id + FK composta com a transação
-- =========================================================

alter table public.parcelas
  add column if not exists usuario_id uuid references public.profiles(id) on delete cascade;

update public.parcelas p
set usuario_id = t.usuario_id
from public.transacoes t
where t.id = p.transacao_id
  and p.usuario_id is null;

alter table public.parcelas alter column usuario_id set not null;
alter table public.parcelas alter column usuario_id set default auth.uid();

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'transacoes_id_usuario_unique'
      and conrelid = 'public.transacoes'::regclass
  ) then
    alter table public.transacoes
      add constraint transacoes_id_usuario_unique unique (id, usuario_id);
  end if;

  -- FK simples antiga (cenário (b)); substituída pela composta abaixo.
  if exists (
    select 1 from pg_constraint
    where conname = 'parcelas_transacao_id_fkey'
      and conrelid = 'public.parcelas'::regclass
  ) then
    alter table public.parcelas drop constraint parcelas_transacao_id_fkey;
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'parcelas_transacao_usuario_fk'
      and conrelid = 'public.parcelas'::regclass
  ) then
    alter table public.parcelas
      add constraint parcelas_transacao_usuario_fk
      foreign key (transacao_id, usuario_id)
      references public.transacoes (id, usuario_id)
      on delete cascade;
  end if;
end $$;

-- =========================================================
-- 6. Índices (remove os antigos/redundantes e cria o conjunto final)
-- =========================================================

drop index if exists public.categorias_user_id_idx;
drop index if exists public.categorias_user_tipo_idx;
drop index if exists public.categorias_user_nome_tipo_unique;
drop index if exists public.contas_user_id_idx;
drop index if exists public.contas_user_ativa_idx;
drop index if exists public.transacoes_user_id_idx;
drop index if exists public.transacoes_user_data_idx;
drop index if exists public.transacoes_user_tipo_data_idx;
drop index if exists public.parcelas_transacao_id_idx;
drop index if exists public.parcelas_vencimento_idx;
drop index if exists public.metas_user_id_idx;
drop index if exists public.metas_user_status_idx;
drop index if exists public.orcamentos_user_id_idx;
drop index if exists public.orcamentos_user_periodo_idx;
drop index if exists public.orcamentos_user_categoria_periodo_unique;

create index if not exists profiles_email_idx on public.profiles (email);

create index if not exists categorias_usuario_tipo_idx
  on public.categorias (usuario_id, tipo);
create unique index if not exists categorias_usuario_nome_tipo_unique
  on public.categorias (usuario_id, lower(nome), tipo);

create index if not exists contas_usuario_ativa_idx
  on public.contas (usuario_id, ativa);

create index if not exists transacoes_usuario_data_idx
  on public.transacoes (usuario_id, data desc);
create index if not exists transacoes_usuario_tipo_data_idx
  on public.transacoes (usuario_id, tipo, data desc);
create index if not exists transacoes_conta_id_idx
  on public.transacoes (conta_id);
create index if not exists transacoes_categoria_id_idx
  on public.transacoes (categoria_id);

create unique index if not exists parcelas_transacao_numero_unique
  on public.parcelas (transacao_id, numero);
create index if not exists parcelas_usuario_vencimento_idx
  on public.parcelas (usuario_id, data_vencimento);

create index if not exists metas_usuario_status_idx
  on public.metas (usuario_id, status);

create unique index if not exists orcamentos_usuario_categoria_periodo_unique
  on public.orcamentos (usuario_id, categoria_id, ano, mes);
create index if not exists orcamentos_usuario_periodo_idx
  on public.orcamentos (usuario_id, ano, mes);
create index if not exists orcamentos_categoria_id_idx
  on public.orcamentos (categoria_id);

-- =========================================================
-- 7. Funções e triggers de integridade
-- =========================================================

-- Transação: conta e categoria são do usuário e a categoria tem o mesmo tipo.
create or replace function public.validate_transaction_ownership()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_conta_usuario uuid;
  v_cat_usuario uuid;
  v_cat_tipo text;
begin
  select usuario_id into v_conta_usuario
  from public.contas
  where id = new.conta_id;

  if v_conta_usuario is null or v_conta_usuario <> new.usuario_id then
    raise exception 'A conta informada não pertence ao usuário.';
  end if;

  if new.categoria_id is not null then
    select usuario_id, tipo into v_cat_usuario, v_cat_tipo
    from public.categorias
    where id = new.categoria_id;

    if v_cat_usuario is null or v_cat_usuario <> new.usuario_id then
      raise exception 'A categoria informada não pertence ao usuário.';
    end if;

    if v_cat_tipo <> new.tipo then
      raise exception 'A categoria informada é de % e a transação é de %.', v_cat_tipo, new.tipo;
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists validate_transaction_ownership_trigger on public.transacoes;
create trigger validate_transaction_ownership_trigger
before insert or update of usuario_id, conta_id, categoria_id, tipo on public.transacoes
for each row execute function public.validate_transaction_ownership();

-- Orçamento: categoria do próprio usuário e de despesa.
create or replace function public.validar_posse_orcamento()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_cat_usuario uuid;
  v_cat_tipo text;
begin
  select usuario_id, tipo into v_cat_usuario, v_cat_tipo
  from public.categorias
  where id = new.categoria_id;

  if v_cat_usuario is null or v_cat_usuario <> new.usuario_id then
    raise exception 'A categoria informada não pertence ao usuário.';
  end if;

  if v_cat_tipo <> 'despesa' then
    raise exception 'Orçamentos só podem ser definidos para categorias de despesa.';
  end if;

  return new;
end;
$$;

drop trigger if exists orcamentos_validar_posse on public.orcamentos;
create trigger orcamentos_validar_posse
before insert or update of usuario_id, categoria_id on public.orcamentos
for each row execute function public.validar_posse_orcamento();

-- Categoria em uso não pode mudar de tipo (quebraria a regra acima).
create or replace function public.proteger_tipo_categoria()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.tipo <> old.tipo and (
    exists (select 1 from public.transacoes where categoria_id = old.id)
    or exists (select 1 from public.orcamentos where categoria_id = old.id)
  ) then
    raise exception 'Não é possível alterar o tipo de uma categoria que já está em uso.';
  end if;
  return new;
end;
$$;

drop trigger if exists categorias_proteger_tipo on public.categorias;
create trigger categorias_proteger_tipo
before update of tipo on public.categorias
for each row execute function public.proteger_tipo_categoria();

-- Parcelas: quantidade e soma precisam fechar com a transação (checado no COMMIT,
-- para permitir inserir todas as parcelas na mesma requisição/transação).
create or replace function public.checar_parcelas(p_transacao_id uuid)
returns void
language plpgsql
set search_path = ''
as $$
declare
  v_valor numeric;
  v_soma numeric;
  v_qtd integer;
  v_total integer;
  v_totais integer;
begin
  select valor into v_valor
  from public.transacoes
  where id = p_transacao_id;

  if not found then
    return; -- transação removida (parcelas saem por cascade)
  end if;

  select coalesce(sum(valor), 0), count(*), max(total_parcelas), count(distinct total_parcelas)
    into v_soma, v_qtd, v_total, v_totais
  from public.parcelas
  where transacao_id = p_transacao_id;

  if v_qtd = 0 then
    return; -- transação à vista
  end if;

  if v_totais > 1 or v_qtd <> v_total then
    raise exception 'Parcelas inconsistentes: esperado % parcela(s), encontrado %.', v_total, v_qtd
      using errcode = '23514';
  end if;

  if v_soma <> v_valor then
    raise exception 'A soma das parcelas (%) difere do valor da transação (%).', v_soma, v_valor
      using errcode = '23514';
  end if;
end;
$$;

create or replace function public.trg_parcelas_checar()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  perform public.checar_parcelas(
    case when tg_op = 'DELETE' then old.transacao_id else new.transacao_id end
  );
  if tg_op = 'UPDATE' and old.transacao_id <> new.transacao_id then
    perform public.checar_parcelas(old.transacao_id);
  end if;
  return null;
end;
$$;

create or replace function public.trg_transacao_checar_parcelas()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  perform public.checar_parcelas(new.id);
  return null;
end;
$$;

drop trigger if exists parcelas_checar on public.parcelas;
create constraint trigger parcelas_checar
after insert or update or delete on public.parcelas
deferrable initially deferred
for each row execute function public.trg_parcelas_checar();

drop trigger if exists transacoes_checar_parcelas on public.transacoes;
create constraint trigger transacoes_checar_parcelas
after update of valor on public.transacoes
deferrable initially deferred
for each row execute function public.trg_transacao_checar_parcelas();

-- updated_at
drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

drop trigger if exists contas_set_updated_at on public.contas;
create trigger contas_set_updated_at
before update on public.contas
for each row execute function public.set_updated_at();

drop trigger if exists transacoes_set_updated_at on public.transacoes;
create trigger transacoes_set_updated_at
before update on public.transacoes
for each row execute function public.set_updated_at();

drop trigger if exists metas_set_updated_at on public.metas;
create trigger metas_set_updated_at
before update on public.metas
for each row execute function public.set_updated_at();

drop trigger if exists orcamentos_set_updated_at on public.orcamentos;
create trigger orcamentos_set_updated_at
before update on public.orcamentos
for each row execute function public.set_updated_at();

-- =========================================================
-- 8. Cadastro: perfil + categorias padrão
-- =========================================================

create or replace function public.inserir_categorias_padrao(p_usuario_id uuid)
returns void
language plpgsql
set search_path = ''
as $$
begin
  insert into public.categorias (usuario_id, nome, tipo, icone)
  values
    (p_usuario_id, 'Alimentação', 'despesa', 'utensils'),
    (p_usuario_id, 'Moradia', 'despesa', 'home'),
    (p_usuario_id, 'Transporte', 'despesa', 'car'),
    (p_usuario_id, 'Lazer', 'despesa', 'gamepad'),
    (p_usuario_id, 'Saúde', 'despesa', 'heart'),
    (p_usuario_id, 'Educação', 'despesa', 'book'),
    (p_usuario_id, 'Compras', 'despesa', 'shopping-bag'),
    (p_usuario_id, 'Contas', 'despesa', 'receipt'),
    (p_usuario_id, 'Outros', 'despesa', 'more-horizontal'),
    (p_usuario_id, 'Salário', 'receita', 'briefcase'),
    (p_usuario_id, 'Investimentos', 'receita', 'trending-up'),
    (p_usuario_id, 'Outras receitas', 'receita', 'plus-circle')
  on conflict do nothing;
end;
$$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
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

create or replace function public.create_default_categories()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.inserir_categorias_padrao(new.id);
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

drop trigger if exists create_default_categories_trigger on public.profiles;
create trigger create_default_categories_trigger
after insert on public.profiles
for each row execute function public.create_default_categories();

-- Funções internas: nunca devem ser chamadas pelo cliente.
revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.create_default_categories() from public, anon, authenticated;
revoke execute on function public.inserir_categorias_padrao(uuid) from public, anon, authenticated;

-- =========================================================
-- 9. RLS
-- =========================================================

alter table public.profiles enable row level security;
alter table public.categorias enable row level security;
alter table public.contas enable row level security;
alter table public.transacoes enable row level security;
alter table public.parcelas enable row level security;
alter table public.metas enable row level security;
alter table public.orcamentos enable row level security;

-- Recria todas as políticas com nomes padronizados e (select auth.uid()),
-- que o Postgres avalia uma vez por consulta em vez de uma vez por linha.
do $$
declare
  r record;
  t text;
begin
  for r in
    select policyname, tablename
    from pg_policies
    where schemaname = 'public'
      and tablename in ('profiles','categorias','contas','transacoes','parcelas','metas','orcamentos')
  loop
    execute format('drop policy %I on public.%I', r.policyname, r.tablename);
  end loop;

  foreach t in array array['categorias','contas','transacoes','parcelas','metas','orcamentos'] loop
    execute format(
      'create policy %I on public.%I for select to authenticated using (usuario_id = (select auth.uid()))',
      t || '_select_own', t);
    execute format(
      'create policy %I on public.%I for insert to authenticated with check (usuario_id = (select auth.uid()))',
      t || '_insert_own', t);
    execute format(
      'create policy %I on public.%I for update to authenticated using (usuario_id = (select auth.uid())) with check (usuario_id = (select auth.uid()))',
      t || '_update_own', t);
    execute format(
      'create policy %I on public.%I for delete to authenticated using (usuario_id = (select auth.uid()))',
      t || '_delete_own', t);
  end loop;
end $$;

create policy "profiles_select_own"
  on public.profiles for select to authenticated
  using (id = (select auth.uid()));

create policy "profiles_insert_own"
  on public.profiles for insert to authenticated
  with check (id = (select auth.uid()));

create policy "profiles_update_own"
  on public.profiles for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- =========================================================
-- 10. Backfill (dados que já existiam antes desta migration)
-- =========================================================

-- Perfis faltantes (dispara o seed de categorias pelo trigger).
insert into public.profiles (id, nome, email)
select
  u.id,
  coalesce(u.raw_user_meta_data ->> 'nome', u.raw_user_meta_data ->> 'name'),
  u.email
from auth.users u
where not exists (select 1 from public.profiles p where p.id = u.id)
on conflict (id) do nothing;

-- Nome e e-mail dos perfis criados antes dessas colunas existirem.
update public.profiles p
set email = coalesce(p.email, u.email),
    nome = coalesce(p.nome, u.raw_user_meta_data ->> 'nome', u.raw_user_meta_data ->> 'name')
from auth.users u
where u.id = p.id
  and (p.email is null or p.nome is null);

-- Categorias padrão para quem ainda não tem nenhuma (uma única vez, nesta migration).
do $$
declare
  r record;
begin
  for r in
    select p.id
    from public.profiles p
    where not exists (select 1 from public.categorias c where c.usuario_id = p.id)
  loop
    perform public.inserir_categorias_padrao(r.id);
  end loop;
end $$;

-- =========================================================
-- 11. RPC: transação parcelada (compra + parcelas de forma atômica)
-- =========================================================
-- A primeira parcela absorve o resto da divisão (ex.: 100,00 em 3x = 33,34 + 33,33 + 33,33).
-- Roda como o usuário chamador (security invoker): RLS e triggers se aplicam normalmente.

create or replace function public.criar_transacao_parcelada(
  p_conta_id uuid,
  p_categoria_id uuid,
  p_descricao text,
  p_valor_total numeric,
  p_total_parcelas integer,
  p_primeiro_vencimento date,
  p_tipo text default 'despesa',
  p_data date default null,
  p_observacao text default null
)
returns uuid
language plpgsql
set search_path = ''
as $$
declare
  v_usuario uuid := auth.uid();
  v_id uuid;
  v_base numeric;
  v_resto numeric;
begin
  if v_usuario is null then
    raise exception 'Usuário não autenticado.';
  end if;

  if p_valor_total is null or p_valor_total <= 0 or round(p_valor_total, 2) <> p_valor_total then
    raise exception 'O valor total deve ser positivo e ter no máximo 2 casas decimais.';
  end if;

  if p_total_parcelas is null or p_total_parcelas < 2 or p_total_parcelas > 120 then
    raise exception 'O número de parcelas deve estar entre 2 e 120.';
  end if;

  if p_primeiro_vencimento is null then
    raise exception 'Informe a data de vencimento da primeira parcela.';
  end if;

  v_base := trunc(p_valor_total / p_total_parcelas, 2);
  v_resto := p_valor_total - v_base * p_total_parcelas;

  if v_base <= 0 then
    raise exception 'O valor total é pequeno demais para % parcelas.', p_total_parcelas;
  end if;

  insert into public.transacoes
    (usuario_id, conta_id, categoria_id, tipo, descricao, valor, data, observacao)
  values
    (v_usuario, p_conta_id, p_categoria_id, p_tipo, p_descricao, p_valor_total,
     coalesce(p_data, public.hoje()), p_observacao)
  returning id into v_id;

  insert into public.parcelas
    (transacao_id, usuario_id, numero, total_parcelas, valor, data_vencimento)
  select
    v_id,
    v_usuario,
    n,
    p_total_parcelas,
    case when n = 1 then v_base + v_resto else v_base end,
    (p_primeiro_vencimento + make_interval(months => n - 1))::date
  from generate_series(1, p_total_parcelas) as n;

  return v_id;
end;
$$;

comment on function public.criar_transacao_parcelada is
  'Cria uma transação e suas parcelas de forma atômica. A 1ª parcela absorve o resto da divisão.';

revoke execute on function public.criar_transacao_parcelada(uuid, uuid, text, numeric, integer, date, text, date, text)
  from public, anon;
grant execute on function public.criar_transacao_parcelada(uuid, uuid, text, numeric, integer, date, text, date, text)
  to authenticated;
