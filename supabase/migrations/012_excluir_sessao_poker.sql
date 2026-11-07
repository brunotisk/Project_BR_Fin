create or replace function public.excluir_sessao_poker(p_data_cartao text)
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
    select 1
    from public.poker_dias_bloqueados b
    where b.usuario_id = auth.uid()
      and b.data_cartao = p_data_cartao
      and b.travado = true
  ) then
    raise exception using errcode = '55000', message = 'Este dia está travado. Reabra o dia para excluir a sessão.';
  end if;

  delete from public.lancamentos_ma
  where usuario_id = auth.uid() and data_cartao = p_data_cartao;

  delete from public.poker_sessoes_cashout
  where usuario_id = auth.uid() and data_cartao = p_data_cartao;
end;
$$;
