alter table public.cartoes_controle_ma
  add column if not exists fechamento_estimado boolean not null default false,
  add column if not exists status text not null default 'aberto';

alter table public.cartoes_controle_ma
  drop constraint if exists cartoes_controle_ma_status_check;

alter table public.cartoes_controle_ma
  add constraint cartoes_controle_ma_status_check
  check (status in ('aberto', 'fechado'));
