-- Permite registrar despesas diretamente em um cartão de crédito, sem associar
-- artificialmente a compra a uma conta ou carteira.
alter table public.transacoes
  alter column conta_id drop not null;

create or replace function public.validate_transaction_ownership()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_conta_usuario uuid;
  v_cartao_usuario uuid;
  v_cat_usuario uuid;
  v_cat_tipo text;
begin
  if new.conta_id is not null then
    select usuario_id into v_conta_usuario
    from public.contas
    where id = new.conta_id;

    if v_conta_usuario is null or v_conta_usuario <> new.usuario_id then
      raise exception 'A conta informada não pertence ao usuário.';
    end if;
  end if;

  if new.cartao_id is not null then
    select usuario_id into v_cartao_usuario
    from public.cartoes_credito
    where id = new.cartao_id;

    if v_cartao_usuario is null or v_cartao_usuario <> new.usuario_id then
      raise exception 'O cartão informado não pertence ao usuário.';
    end if;
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
before insert or update of usuario_id, conta_id, cartao_id, categoria_id, tipo on public.transacoes
for each row execute function public.validate_transaction_ownership();

create or replace function public.criar_transacao_parcelada_cartao(
  p_cartao_id uuid,
  p_categoria_id uuid,
  p_descricao text,
  p_valor_total numeric,
  p_total_parcelas integer,
  p_primeiro_vencimento date,
  p_data date,
  p_observacao text
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

  if p_cartao_id is null then
    raise exception 'Selecione um cartão.';
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
    (usuario_id, conta_id, cartao_id, categoria_id, tipo, descricao, valor, data, observacao)
  values
    (v_usuario, null, p_cartao_id, p_categoria_id, 'despesa', p_descricao, p_valor_total,
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

revoke execute on function public.criar_transacao_parcelada_cartao(uuid, uuid, text, numeric, integer, date, date, text)
  from public, anon;
grant execute on function public.criar_transacao_parcelada_cartao(uuid, uuid, text, numeric, integer, date, date, text)
  to authenticated;
