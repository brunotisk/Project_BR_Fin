create table public.agendas (
  id uuid primary key default gen_random_uuid(), proprietario_id uuid not null references public.profiles(id) on delete cascade,
  nome text not null default 'Minha Agenda', principal boolean not null default false, criado_em timestamptz not null default now()
);
create unique index agendas_uma_principal_por_usuario on public.agendas (proprietario_id) where principal;
create table public.agenda_membros (
  agenda_id uuid not null references public.agendas(id) on delete cascade,
  usuario_id uuid not null references public.profiles(id) on delete cascade,
  papel text not null default 'editor' check (papel in ('proprietario', 'editor')),
  cor text not null default '#2563EB', entrou_em timestamptz not null default now(), primary key (agenda_id, usuario_id)
);
create table public.agenda_convites (
  id uuid primary key default gen_random_uuid(), agenda_id uuid not null references public.agendas(id) on delete cascade,
  email text not null, convidado_por uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'pendente' check (status in ('pendente', 'aceito')),
  criado_em timestamptz not null default now(), unique (agenda_id, email)
);

insert into public.agendas (proprietario_id, nome, principal)
select p.id, coalesce(nullif(p.nome, ''), 'Minha Agenda'), true from public.profiles p
on conflict (proprietario_id) where principal do nothing;
insert into public.agenda_membros (agenda_id, usuario_id, papel, cor)
select a.id, a.proprietario_id, 'proprietario', '#2563EB' from public.agendas a where a.principal
on conflict (agenda_id, usuario_id) do nothing;

alter table public.organizacao_itens add column agenda_id uuid references public.agendas(id) on delete cascade;
update public.organizacao_itens i set agenda_id = a.id
from public.agendas a where a.proprietario_id = i.usuario_id and a.principal and i.agenda_id is null;
alter table public.organizacao_itens alter column agenda_id set not null;
create index organizacao_itens_agenda_data_idx on public.organizacao_itens (agenda_id, data, horario);

create or replace function public.criar_agenda_principal()
returns trigger language plpgsql security definer set search_path = public as $$
declare nova_agenda uuid;
begin
  insert into public.agendas (proprietario_id, nome, principal)
  values (new.id, coalesce(nullif(new.nome, ''), 'Minha Agenda'), true)
  on conflict (proprietario_id) where principal do update set nome = excluded.nome
  returning id into nova_agenda;
  insert into public.agenda_membros (agenda_id, usuario_id, papel, cor)
  values (nova_agenda, new.id, 'proprietario', '#2563EB') on conflict (agenda_id, usuario_id) do nothing;
  return new;
end;
$$;
create trigger profiles_criar_agenda_principal after insert on public.profiles
for each row execute function public.criar_agenda_principal();

create or replace function public.definir_agenda_item()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.agenda_id is null then
    select id into new.agenda_id from public.agendas where proprietario_id = new.usuario_id and principal limit 1;
  end if;
  return new;
end;
$$;
create trigger organizacao_itens_definir_agenda before insert on public.organizacao_itens
for each row execute function public.definir_agenda_item();

create or replace function public.usuario_e_membro_agenda(p_agenda_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.agenda_membros m where m.agenda_id = p_agenda_id and m.usuario_id = auth.uid());
$$;

alter table public.agendas enable row level security;
alter table public.agenda_membros enable row level security;
alter table public.agenda_convites enable row level security;
create policy agendas_membros_select on public.agendas for select to authenticated
  using (proprietario_id = auth.uid() or public.usuario_e_membro_agenda(id));
create policy agendas_owner_update on public.agendas for update to authenticated
  using (proprietario_id = auth.uid()) with check (proprietario_id = auth.uid());
create policy agenda_membros_select on public.agenda_membros for select to authenticated
  using (usuario_id = auth.uid() or public.usuario_e_membro_agenda(agenda_id));
create policy agenda_membros_leave on public.agenda_membros for delete to authenticated
  using (usuario_id = auth.uid() and papel <> 'proprietario');
create policy agenda_convites_select_involved on public.agenda_convites for select to authenticated
  using (convidado_por = auth.uid() or lower(email) = lower(coalesce(auth.jwt() ->> 'email', '')));

drop policy organizacao_itens_select_own on public.organizacao_itens;
drop policy organizacao_itens_insert_own on public.organizacao_itens;
drop policy organizacao_itens_update_own on public.organizacao_itens;
drop policy organizacao_itens_delete_own on public.organizacao_itens;
create policy organizacao_itens_select_agenda_member on public.organizacao_itens for select to authenticated
  using (public.usuario_e_membro_agenda(agenda_id));
create policy organizacao_itens_insert_agenda_member on public.organizacao_itens for insert to authenticated
  with check (usuario_id = auth.uid() and public.usuario_e_membro_agenda(agenda_id));
create policy organizacao_itens_update_agenda_member on public.organizacao_itens for update to authenticated
  using (usuario_id = auth.uid() and public.usuario_e_membro_agenda(agenda_id))
  with check (usuario_id = auth.uid() and public.usuario_e_membro_agenda(agenda_id));
create policy organizacao_itens_delete_agenda_member on public.organizacao_itens for delete to authenticated
  using (usuario_id = auth.uid() and public.usuario_e_membro_agenda(agenda_id));

create or replace function public.convidar_para_agenda(p_email text)
returns uuid language plpgsql security definer set search_path = public, auth as $$
declare v_agenda uuid; v_email text; v_id uuid;
begin
  v_email := lower(trim(p_email));
  if v_email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' then raise exception 'Informe um e-mail válido.'; end if;
  if v_email = lower(coalesce(auth.jwt() ->> 'email', '')) then raise exception 'Você já é membro da sua agenda.'; end if;
  select id into v_agenda from public.agendas where proprietario_id = auth.uid() and principal;
  if v_agenda is null then raise exception 'Agenda principal não encontrada.'; end if;
  insert into public.agenda_convites (agenda_id, email, convidado_por, status)
  values (v_agenda, v_email, auth.uid(), 'pendente')
  on conflict (agenda_id, email) do update set convidado_por = excluded.convidado_por, status = 'pendente', criado_em = now()
  returning id into v_id;
  return v_id;
end;
$$;

create or replace function public.listar_convites_recebidos()
returns table (convite_id uuid, agenda_id uuid, agenda_nome text, remetente text, criado_em timestamptz)
language sql stable security definer set search_path = public, auth as $$
  select c.id, c.agenda_id, a.nome, coalesce(p.nome, p.email, 'Usuário'), c.criado_em
  from public.agenda_convites c join public.agendas a on a.id = c.agenda_id
  join public.profiles p on p.id = c.convidado_por
  where c.status = 'pendente' and lower(c.email) = lower(coalesce(auth.jwt() ->> 'email', ''));
$$;

create or replace function public.aceitar_convite_agenda(p_convite_id uuid)
returns void language plpgsql security definer set search_path = public, auth as $$
declare v_agenda uuid;
begin
  select c.agenda_id into v_agenda from public.agenda_convites c
  where c.id = p_convite_id and c.status = 'pendente' and lower(c.email) = lower(coalesce(auth.jwt() ->> 'email', ''));
  if v_agenda is null then raise exception 'Convite não encontrado para este usuário.'; end if;
  insert into public.agenda_membros (agenda_id, usuario_id, papel, cor)
  values (v_agenda, auth.uid(), 'editor', '#8B5CF6') on conflict (agenda_id, usuario_id) do nothing;
  update public.agenda_convites set status = 'aceito' where id = p_convite_id;
end;
$$;

create or replace function public.atualizar_cor_agendas(p_cor text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if p_cor !~ '^#[0-9A-Fa-f]{6}$' then raise exception 'Cor inválida.'; end if;
  update public.agenda_membros set cor = p_cor where usuario_id = auth.uid();
end;
$$;

revoke all on function public.usuario_e_membro_agenda(uuid) from public, anon;
revoke all on function public.convidar_para_agenda(text) from public, anon;
revoke all on function public.listar_convites_recebidos() from public, anon;
revoke all on function public.aceitar_convite_agenda(uuid) from public, anon;
revoke all on function public.atualizar_cor_agendas(text) from public, anon;
grant execute on function public.usuario_e_membro_agenda(uuid) to authenticated;
grant execute on function public.convidar_para_agenda(text) to authenticated;
grant execute on function public.listar_convites_recebidos() to authenticated;
grant execute on function public.aceitar_convite_agenda(uuid) to authenticated;
grant execute on function public.atualizar_cor_agendas(text) to authenticated;
