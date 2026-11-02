-- 1) Política de update com WITH CHECK: impede que o usuário altere a linha
--    para um id que não seja o dele.
drop policy if exists "Users can update own profile" on public.profiles;

create policy "Users can update own profile"
  on public.profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- 2) Cria o perfil automaticamente quando um usuário se cadastra,
--    sem depender do app para inserir a linha.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id)
  values (new.id)
  on conflict (id) do nothing;
  return new;
end;
$$;

-- A função só deve ser executada pelo trigger, nunca chamada pelo cliente.
revoke execute on function public.handle_new_user() from public, anon, authenticated;

drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- 3) Backfill: cria perfil para usuários que já existiam antes do trigger.
insert into public.profiles (id)
select id from auth.users
on conflict (id) do nothing;
