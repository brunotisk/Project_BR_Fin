create table if not exists public.organizacao_itens (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  tipo text not null check (tipo in ('tarefa', 'compromisso')),
  titulo text not null check (length(trim(titulo)) > 0),
  descricao text,
  data date not null default public.hoje(),
  horario time,
  mostrar_na_agenda boolean not null default false,
  mostrar_na_todo boolean not null default true,
  concluido boolean not null default false,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create index if not exists organizacao_itens_usuario_data_idx
  on public.organizacao_itens (usuario_id, data, concluido);
alter table public.organizacao_itens enable row level security;
create policy "organizacao_itens_select_own" on public.organizacao_itens for select to authenticated using (usuario_id = auth.uid());
create policy "organizacao_itens_insert_own" on public.organizacao_itens for insert to authenticated with check (usuario_id = auth.uid());
create policy "organizacao_itens_update_own" on public.organizacao_itens for update to authenticated using (usuario_id = auth.uid()) with check (usuario_id = auth.uid());
create policy "organizacao_itens_delete_own" on public.organizacao_itens for delete to authenticated using (usuario_id = auth.uid());
