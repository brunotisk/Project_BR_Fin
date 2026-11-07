create table if not exists public.preferencias_acesso_modulos (
  usuario_id uuid primary key references public.profiles(id) on delete cascade,
  todo_lista_ativo boolean not null default true,
  agenda_ativo boolean not null default true,
  financeiro_ativo boolean not null default true,
  atualizado_em timestamptz not null default now()
);

alter table public.preferencias_acesso_modulos enable row level security;
drop policy if exists "Usuário gerencia o próprio acesso aos módulos" on public.preferencias_acesso_modulos;
create policy "Usuário gerencia o próprio acesso aos módulos"
  on public.preferencias_acesso_modulos
  for all
  using (usuario_id = (select auth.uid()))
  with check (usuario_id = (select auth.uid()));
