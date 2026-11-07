insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('poker-fotos', 'poker-fotos', false, 20971520, array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'])
on conflict (id) do update set
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create table if not exists public.poker_sessao_fotos (
  id uuid primary key,
  usuario_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  mes_base text not null,
  data_cartao text not null,
  local text not null,
  nome_arquivo text not null,
  tipo_mime text not null,
  storage_path text not null unique,
  criado_em timestamptz not null default now()
);

alter table public.poker_sessao_fotos enable row level security;
drop policy if exists "Usuário lê fotos de Poker" on public.poker_sessao_fotos;
create policy "Usuário lê fotos de Poker" on public.poker_sessao_fotos
  for select using (usuario_id = (select auth.uid()));
drop policy if exists "Usuário anexa fotos em dia aberto de Poker" on public.poker_sessao_fotos;
create policy "Usuário anexa fotos em dia aberto de Poker" on public.poker_sessao_fotos
  for insert with check (
    usuario_id = (select auth.uid())
    and not exists (
      select 1 from public.poker_dias_bloqueados b
      where b.usuario_id = (select auth.uid()) and b.data_cartao = poker_sessao_fotos.data_cartao and b.travado = true
    )
  );
drop policy if exists "Usuário remove metadados de foto de Poker" on public.poker_sessao_fotos;
create policy "Usuário remove metadados de foto de Poker" on public.poker_sessao_fotos
  for delete using (usuario_id = (select auth.uid()));

drop policy if exists "Usuário gerencia suas fotos de Poker no Storage" on storage.objects;
create policy "Usuário gerencia suas fotos de Poker no Storage" on storage.objects
  for all using (
    bucket_id = 'poker-fotos'
    and exists (
      select 1 from public.poker_sessao_fotos f
      where f.storage_path = name and f.usuario_id = (select auth.uid())
    )
  ) with check (
    bucket_id = 'poker-fotos'
    and exists (
      select 1 from public.poker_sessao_fotos f
      where f.storage_path = name and f.usuario_id = (select auth.uid())
    )
    and not exists (
      select 1
      from public.poker_dias_bloqueados b
      join public.poker_sessao_fotos f on f.storage_path = name
      where b.usuario_id = (select auth.uid()) and b.data_cartao = f.data_cartao and b.travado = true
    )
  );
