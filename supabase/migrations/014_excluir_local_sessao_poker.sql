create or replace function public.excluir_local_sessao_poker(
  p_mes_base text,
  p_data_cartao text,
  p_local text
)
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
    raise exception using errcode = '55000', message = 'Este dia está travado. Reabra o dia para excluir o local.';
  end if;

  delete from public.lancamentos_ma
  where usuario_id = auth.uid()
    and mes_base = p_mes_base
    and data_cartao = p_data_cartao
    and "local" = p_local;

  update public.poker_sessoes
  set locais = array_remove(locais, p_local)
  where usuario_id = auth.uid()
    and mes_base = p_mes_base
    and data_cartao = p_data_cartao;
end;
$$;

create or replace function public.impedir_alteracao_lancamento_poker_em_dia_travado()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if exists (
    select 1 from public.poker_dias_bloqueados b
    where b.usuario_id = old.usuario_id and b.data_cartao = old.data_cartao and b.travado = true
  ) then
    raise exception using errcode = '55000', message = 'Este dia está travado. Reabra o dia para alterar lançamentos.';
  end if;
  if tg_op = 'UPDATE' and exists (
    select 1 from public.poker_dias_bloqueados b
    where b.usuario_id = new.usuario_id and b.data_cartao = new.data_cartao and b.travado = true
  ) then
    raise exception using errcode = '55000', message = 'Este dia está travado. Reabra o dia para alterar lançamentos.';
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

drop trigger if exists impedir_exclusao_poker_dia_travado on public.lancamentos_ma;
drop trigger if exists impedir_alteracao_poker_dia_travado on public.lancamentos_ma;
create trigger impedir_alteracao_poker_dia_travado
  before update or delete on public.lancamentos_ma
  for each row execute function public.impedir_alteracao_lancamento_poker_em_dia_travado();
