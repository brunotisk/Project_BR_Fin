create table if not exists public.poker_sessoes (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  mes_base text not null,
  data_cartao text not null,
  locais text[] not null default '{}',
  criado_em timestamptz not null default now(),
  constraint poker_sessoes_usuario_fatura_data_unique unique (usuario_id, mes_base, data_cartao)
);

alter table public.poker_sessoes enable row level security;
drop policy if exists "Usuário gerencia suas sessões de Poker" on public.poker_sessoes;
create policy "Usuário gerencia suas sessões de Poker"
  on public.poker_sessoes for all
  using (usuario_id = (select auth.uid()))
  with check (usuario_id = (select auth.uid()));

create or replace function public.salvar_sessao_poker(p_mes_base text, p_data_cartao text, p_local text)
returns uuid
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_id uuid;
begin
  if auth.uid() is null then
    raise exception using errcode = '42501', message = 'É necessário estar autenticado.';
  end if;
  if exists (
    select 1 from public.poker_dias_bloqueados b
    where b.usuario_id = auth.uid() and b.data_cartao = p_data_cartao and b.travado = true
  ) then
    raise exception using errcode = '55000', message = 'Este dia está travado. Reabra o dia para alterar os locais.';
  end if;

  insert into public.poker_sessoes as sessao_atual (usuario_id, mes_base, data_cartao, locais)
  values (auth.uid(), p_mes_base, p_data_cartao, array[p_local])
  on conflict (usuario_id, mes_base, data_cartao)
  do update set locais = (
    select array_agg(distinct local_nome)
    from unnest(coalesce(sessao_atual.locais, '{}'::text[]) || excluded.locais) as locais(local_nome)
  )
  returning id into v_id;
  return v_id;
end;
$$;

drop function if exists public.excluir_sessao_poker(text);

create or replace function public.excluir_sessao_poker(p_mes_base text, p_data_cartao text)
returns void
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
begin
  if auth.uid() is null then
    raise exception using errcode = '42501', message = 'É necessário estar autenticado.';
  end if;
  if exists (
    select 1 from public.poker_dias_bloqueados b
    where b.usuario_id = auth.uid() and b.data_cartao = p_data_cartao and b.travado = true
  ) then
    raise exception using errcode = '55000', message = 'Este dia está travado. Reabra o dia para excluir a sessão.';
  end if;

  delete from public.lancamentos_ma where usuario_id = auth.uid() and data_cartao = p_data_cartao and mes_base = p_mes_base;
  delete from public.poker_sessoes where usuario_id = auth.uid() and data_cartao = p_data_cartao and mes_base = p_mes_base;
  if not exists (
    select 1 from public.poker_sessoes s where s.usuario_id = auth.uid() and s.data_cartao = p_data_cartao
  ) and not exists (
    select 1 from public.lancamentos_ma l where l.usuario_id = auth.uid() and l.data_cartao = p_data_cartao
  ) then
    delete from public.poker_sessoes_cashout where usuario_id = auth.uid() and data_cartao = p_data_cartao;
  end if;
end;
$$;
