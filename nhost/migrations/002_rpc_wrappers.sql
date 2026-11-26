-- Result rows let Hasura expose the app's existing RPCs as GraphQL functions.
-- Nas funções plpgsql "void", RETURN QUERY devolve a coluna (select true), não row(...)::tipo:
-- o registro composto numa coluna só causava erro 42804 e desfazia a ação inteira.
create table if not exists public.nhost_rpc_uuid_result (result uuid);
create table if not exists public.nhost_rpc_void_result (result boolean);
create table if not exists public.nhost_rpc_membro_result (
  usuario_id uuid,
  nome text,
  email text,
  cor text
);
create table if not exists public.nhost_rpc_convite_result (
  convite_id uuid,
  agenda_id uuid,
  agenda_nome text,
  remetente text,
  criado_em timestamptz
);

create or replace function public.nhost_listar_membros_agenda(p_agenda_id uuid)
returns setof public.nhost_rpc_membro_result
language sql stable set search_path = public, auth as $$
  select * from public.listar_membros_agenda(p_agenda_id)
$$;

create or replace function public.nhost_listar_convites_recebidos()
returns setof public.nhost_rpc_convite_result
language sql stable set search_path = public, auth as $$
  select * from public.listar_convites_recebidos()
$$;

create or replace function public.nhost_convidar_para_agenda(p_email text)
returns setof public.nhost_rpc_uuid_result
language sql volatile set search_path = public, auth as $$
  select row(public.convidar_para_agenda(p_email))::public.nhost_rpc_uuid_result
$$;

create or replace function public.nhost_aceitar_convite_agenda(p_convite_id uuid)
returns setof public.nhost_rpc_void_result
language plpgsql volatile set search_path = public, auth as $$
begin
  perform public.aceitar_convite_agenda(p_convite_id);
  return query select true;
end;
$$;

create or replace function public.nhost_atualizar_cor_agendas(p_cor text)
returns setof public.nhost_rpc_void_result
language plpgsql volatile set search_path = public, auth as $$
begin
  perform public.atualizar_cor_agendas(p_cor);
  return query select true;
end;
$$;

create or replace function public.nhost_criar_transacao_parcelada_cartao(
  p_cartao_id uuid, p_categoria_id uuid, p_descricao text, p_valor_total numeric,
  p_total_parcelas integer, p_primeiro_vencimento date, p_data date, p_observacao text
)
returns setof public.nhost_rpc_uuid_result
language sql volatile set search_path = public, auth as $$
  select row(public.criar_transacao_parcelada_cartao(
    p_cartao_id, p_categoria_id, p_descricao, p_valor_total,
    p_total_parcelas, p_primeiro_vencimento, p_data, p_observacao
  ))::public.nhost_rpc_uuid_result
$$;

create or replace function public.nhost_excluir_sessao_poker(p_mes_base text, p_data_cartao text)
returns setof public.nhost_rpc_void_result
language plpgsql volatile set search_path = public, auth as $$
begin
  perform public.excluir_sessao_poker(p_mes_base, p_data_cartao);
  return query select true;
end;
$$;

create or replace function public.nhost_salvar_sessao_poker(p_mes_base text, p_data_cartao text, p_local text)
returns setof public.nhost_rpc_uuid_result
language sql volatile set search_path = public, auth as $$
  select row(public.salvar_sessao_poker(p_mes_base, p_data_cartao, p_local))::public.nhost_rpc_uuid_result
$$;

create or replace function public.nhost_excluir_local_sessao_poker(p_mes_base text, p_data_cartao text, p_local text)
returns setof public.nhost_rpc_void_result
language plpgsql volatile set search_path = public, auth as $$
begin
  perform public.excluir_local_sessao_poker(p_mes_base, p_data_cartao, p_local);
  return query select true;
end;
$$;
