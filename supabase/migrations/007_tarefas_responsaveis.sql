alter table public.organizacao_itens
  add column responsavel_id uuid references public.profiles(id) on delete set null,
  add column prioridade text not null default 'media' check (prioridade in ('baixa', 'media', 'alta'));

update public.organizacao_itens set responsavel_id = usuario_id where tipo = 'tarefa';

create or replace function public.validar_responsavel_item()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.tipo = 'tarefa' then
    new.responsavel_id := coalesce(new.responsavel_id, new.usuario_id);
    if not exists (
      select 1 from public.agenda_membros m
      where m.agenda_id = new.agenda_id and m.usuario_id = new.responsavel_id
    ) then
      raise exception 'O responsável precisa participar desta agenda.';
    end if;
  else
    new.responsavel_id := null;
  end if;
  return new;
end;
$$;
create trigger organizacao_itens_validar_responsavel
before insert or update of agenda_id, responsavel_id, tipo on public.organizacao_itens
for each row execute function public.validar_responsavel_item();

drop policy organizacao_itens_update_agenda_member on public.organizacao_itens;
create policy organizacao_itens_update_agenda_member on public.organizacao_itens for update to authenticated
  using (public.usuario_e_membro_agenda(agenda_id) and (usuario_id = auth.uid() or responsavel_id = auth.uid()))
  with check (public.usuario_e_membro_agenda(agenda_id) and (usuario_id = auth.uid() or responsavel_id = auth.uid()));

create or replace function public.listar_membros_agenda(p_agenda_id uuid default null)
returns table (usuario_id uuid, nome text, email text, cor text)
language plpgsql stable security definer set search_path = public as $$
begin
  if p_agenda_id is not null and not public.usuario_e_membro_agenda(p_agenda_id) then
    raise exception 'Você não participa desta agenda.';
  end if;
  return query
    select distinct p.id, coalesce(nullif(p.nome, ''), split_part(coalesce(p.email, ''), '@', 1), 'Participante'), p.email, m.cor
    from public.agenda_membros m
    join public.profiles p on p.id = m.usuario_id
    where (p_agenda_id is null and exists (
      select 1 from public.agenda_membros meus where meus.agenda_id = m.agenda_id and meus.usuario_id = auth.uid()
    )) or (p_agenda_id is not null and m.agenda_id = p_agenda_id)
    order by 2;
end;
$$;

revoke all on function public.validar_responsavel_item() from public, anon;
revoke all on function public.listar_membros_agenda(uuid) from public, anon;
grant execute on function public.listar_membros_agenda(uuid) to authenticated;
