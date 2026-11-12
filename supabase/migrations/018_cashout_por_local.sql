alter table public.poker_sessoes_cashout
  add column if not exists valores_por_local jsonb not null default '{}'::jsonb;

alter table public.poker_sessoes_cashout enable row level security;

drop policy if exists "Usuário gerencia seus cashouts de Poker" on public.poker_sessoes_cashout;
create policy "Usuário gerencia seus cashouts de Poker"
  on public.poker_sessoes_cashout
  for all
  to authenticated
  using (usuario_id = (select auth.uid()))
  with check (usuario_id = (select auth.uid()));

drop trigger if exists set_poker_sessoes_cashout_updated_at on public.poker_sessoes_cashout;
create trigger set_poker_sessoes_cashout_updated_at
  before update on public.poker_sessoes_cashout
  for each row execute function public.set_updated_at();

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

  delete from public.lancamentos_ma
  where usuario_id = auth.uid() and data_cartao = p_data_cartao and mes_base = p_mes_base;
  delete from public.poker_sessoes
  where usuario_id = auth.uid() and data_cartao = p_data_cartao and mes_base = p_mes_base;
  delete from public.poker_sessoes_cashout
  where usuario_id = auth.uid() and data_cartao = p_data_cartao and mes_base = p_mes_base;
end;
$$;
