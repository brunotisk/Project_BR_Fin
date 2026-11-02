alter table public.organizacao_itens add column horario_fim time;
update public.organizacao_itens
set horario_fim = case when horario < time '23:00' then horario + interval '1 hour' else time '23:59' end
where horario is not null and horario_fim is null;

create table public.agenda_preferencias (
  usuario_id uuid primary key references public.profiles(id) on delete cascade,
  inicio_dia time not null default time '07:00',
  fim_dia time not null default time '20:00',
  atualizado_em timestamptz not null default now(),
  constraint agenda_preferencias_intervalo_valido check (inicio_dia < fim_dia)
);
alter table public.agenda_preferencias enable row level security;
create policy agenda_preferencias_select_own on public.agenda_preferencias for select to authenticated
  using (usuario_id = auth.uid());
create policy agenda_preferencias_insert_own on public.agenda_preferencias for insert to authenticated
  with check (usuario_id = auth.uid());
create policy agenda_preferencias_update_own on public.agenda_preferencias for update to authenticated
  using (usuario_id = auth.uid()) with check (usuario_id = auth.uid());
