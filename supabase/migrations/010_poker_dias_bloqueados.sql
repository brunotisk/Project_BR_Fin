create table if not exists public.poker_dias_bloqueados (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  data_cartao text not null,
  travado boolean not null default true,
  atualizado_em timestamptz not null default now(),
  constraint poker_dia_bloqueado_unique unique (usuario_id, data_cartao)
);

alter table public.poker_dias_bloqueados enable row level security;
drop policy if exists "Usuário gerencia seus dias de Poker bloqueados" on public.poker_dias_bloqueados;
create policy "Usuário gerencia seus dias de Poker bloqueados"
  on public.poker_dias_bloqueados
  for all
  using (usuario_id = (select auth.uid()))
  with check (usuario_id = (select auth.uid()));

create or replace function public.impedir_exclusao_lancamento_poker_em_dia_travado()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if exists (
    select 1
    from public.poker_dias_bloqueados b
    where b.usuario_id = old.usuario_id
      and b.data_cartao = old.data_cartao
      and b.travado = true
  ) then
    raise exception using
      errcode = '55000',
      message = 'Este dia está travado. Reabra o dia para excluir lançamentos.';
  end if;
  return old;
end;
$$;

drop trigger if exists impedir_exclusao_poker_dia_travado on public.lancamentos_ma;
create trigger impedir_exclusao_poker_dia_travado
  before delete on public.lancamentos_ma
  for each row execute function public.impedir_exclusao_lancamento_poker_em_dia_travado();
