alter table public.poker_sessao_fotos
  add column if not exists thumbnail_path text;

drop policy if exists "Usuário lê fotos privadas de Poker" on storage.objects;
create policy "Usuário lê fotos privadas de Poker" on storage.objects
  for select using (
    bucket_id = 'poker-fotos'
    and exists (
      select 1 from public.poker_sessao_fotos f
      where (f.storage_path = name or f.thumbnail_path = name)
        and f.usuario_id = (select auth.uid())
    )
  );

drop policy if exists "Usuário envia fotos de Poker em dia aberto" on storage.objects;
create policy "Usuário envia fotos de Poker em dia aberto" on storage.objects
  for insert with check (
    bucket_id = 'poker-fotos'
    and exists (
      select 1 from public.poker_sessao_fotos f
      where (f.storage_path = name or f.thumbnail_path = name)
        and f.usuario_id = (select auth.uid())
        and not exists (
          select 1 from public.poker_dias_bloqueados b
          where b.usuario_id = f.usuario_id
            and b.data_cartao = f.data_cartao
            and b.travado = true
        )
    )
  );

drop policy if exists "Usuário exclui fotos de Poker em dia aberto" on storage.objects;
create policy "Usuário exclui fotos de Poker em dia aberto" on storage.objects
  for delete using (
    bucket_id = 'poker-fotos'
    and exists (
      select 1 from public.poker_sessao_fotos f
      where (f.storage_path = name or f.thumbnail_path = name)
        and f.usuario_id = (select auth.uid())
        and not exists (
          select 1 from public.poker_dias_bloqueados b
          where b.usuario_id = f.usuario_id
            and b.data_cartao = f.data_cartao
            and b.travado = true
        )
    )
  );
