drop policy if exists "Usuário remove metadados de foto de Poker" on public.poker_sessao_fotos;
create policy "Usuário remove fotos de Poker em dia aberto" on public.poker_sessao_fotos
  for delete using (
    usuario_id = (select auth.uid())
    and not exists (
      select 1 from public.poker_dias_bloqueados b
      where b.usuario_id = (select auth.uid())
        and b.data_cartao = poker_sessao_fotos.data_cartao
        and b.travado = true
    )
  );

drop policy if exists "Usuário gerencia suas fotos de Poker no Storage" on storage.objects;
create policy "Usuário lê fotos privadas de Poker" on storage.objects
  for select using (
    bucket_id = 'poker-fotos'
    and exists (
      select 1 from public.poker_sessao_fotos f
      where f.storage_path = name and f.usuario_id = (select auth.uid())
    )
  );
create policy "Usuário envia fotos de Poker em dia aberto" on storage.objects
  for insert with check (
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
create policy "Usuário exclui fotos de Poker em dia aberto" on storage.objects
  for delete using (
    bucket_id = 'poker-fotos'
    and exists (
      select 1 from public.poker_sessao_fotos f
      where f.storage_path = name
        and f.usuario_id = (select auth.uid())
        and not exists (
          select 1 from public.poker_dias_bloqueados b
          where b.usuario_id = f.usuario_id and b.data_cartao = f.data_cartao and b.travado = true
        )
    )
  );
