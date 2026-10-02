-- Durable notices on first publication. No historical backfill or widening LMS policies.
create table if not exists public.family_academia_notifications (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  guardian_id uuid not null references public.guardians(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  lesson_id uuid not null references public.lessons(id) on delete cascade,
  created_at timestamptz not null default now(),
  read_at timestamptz,
  whatsapp_state text not null default 'pending' check (whatsapp_state in ('pending','sending','sent','failed','cancelled')),
  whatsapp_sent_at timestamptz,
  whatsapp_claimed_at timestamptz,
  whatsapp_attempts integer not null default 0,
  unique (guardian_id,student_id,lesson_id)
);
create index if not exists family_academia_notices_unread on public.family_academia_notifications(guardian_id,created_at desc) where read_at is null;
alter table public.family_academia_notifications enable row level security;
revoke all on public.family_academia_notifications from anon,authenticated;
grant select, update(read_at) on public.family_academia_notifications to authenticated;
grant all on public.family_academia_notifications to service_role;

create or replace function private.can_read_academia_notice(p_school uuid,p_guardian uuid,p_student uuid,p_lesson uuid)
returns boolean language sql stable security definer set search_path='' as $$
  select exists (
    select 1 from public.users_profiles up
    join public.guardians g on g.id=up.guardian_id
    join public.student_guardians sg on sg.guardian_id=g.id
    join public.students s on s.id=sg.student_id
    join public.lessons l on l.id=p_lesson
    where up.auth_id=auth.uid() and up.school_id=p_school
      and g.id=p_guardian and g.school_id=p_school and g.deleted_at is null
      and s.id=p_student and s.school_id=p_school and s.deleted_at is null
      and l.school_id=p_school and l.grade_level=s.grade_level
      and l.is_published and l.deleted_at is null
  );
$$;
revoke all on function private.can_read_academia_notice(uuid,uuid,uuid,uuid) from public,anon,authenticated;
-- Expose only this ownership predicate; do not widen access to the private schema.
create or replace function public.family_can_read_academia_notice(p_school uuid,p_guardian uuid,p_student uuid,p_lesson uuid)
returns boolean language sql stable security definer set search_path='' as $$
  select auth.uid() is not null and private.can_read_academia_notice(p_school,p_guardian,p_student,p_lesson);
$$;
revoke all on function public.family_can_read_academia_notice(uuid,uuid,uuid,uuid) from public,anon;
grant execute on function public.family_can_read_academia_notice(uuid,uuid,uuid,uuid) to authenticated;
drop policy if exists family_academia_notices_read on public.family_academia_notifications;
create policy family_academia_notices_read on public.family_academia_notifications for select to authenticated
using (public.family_can_read_academia_notice(school_id,guardian_id,student_id,lesson_id));
drop policy if exists family_academia_notices_ack on public.family_academia_notifications;
create policy family_academia_notices_ack on public.family_academia_notifications for update to authenticated
using (public.family_can_read_academia_notice(school_id,guardian_id,student_id,lesson_id))
with check (public.family_can_read_academia_notice(school_id,guardian_id,student_id,lesson_id));

create or replace function private.dispatch_academia_notifications()
returns void language plpgsql security definer set search_path='' as $$
declare endpoint text; secret text;
begin
  if not exists(select 1 from public.family_academia_notifications where whatsapp_state='pending' and created_at>now()-interval '7 days') then return; end if;
  endpoint:=private.get_app_setting('edge_function_url');
  secret:=private.get_app_setting('webhook_secret');
  if coalesce(endpoint,'')='' or coalesce(secret,'')='' then return; end if;
  perform net.http_post(url:=rtrim(endpoint,'/')||'/notify-academia',
    headers:=jsonb_build_object('Content-Type','application/json','x-webhook-secret',secret),
    body:='{}'::jsonb,timeout_milliseconds:=10000);
exception when others then
  -- A delivery infrastructure failure must not undo the teacher's saved task.
  raise warning 'Academia WhatsApp dispatch deferred';
end; $$;
revoke all on function private.dispatch_academia_notifications() from public,anon,authenticated;

create or replace function private.enqueue_family_academia_notices()
returns trigger language plpgsql security definer set search_path='' as $$
begin
  if not new.is_published or new.deleted_at is not null then return new; end if;
  if tg_op='UPDATE' and old.is_published then return new; end if;
  insert into public.family_academia_notifications(school_id,guardian_id,student_id,lesson_id)
  select new.school_id,g.id,s.id,new.id
  from public.students s
  join public.student_guardians sg on sg.student_id=s.id
  join public.guardians g on g.id=sg.guardian_id
  where s.school_id=new.school_id and s.grade_level=new.grade_level
    and s.deleted_at is null and s.enrollment_status='inscrito'
    and g.school_id=new.school_id and g.deleted_at is null
  on conflict(guardian_id,student_id,lesson_id) do nothing;
  perform private.dispatch_academia_notifications();
  return new;
end; $$;
revoke all on function private.enqueue_family_academia_notices() from public,anon,authenticated;
drop trigger if exists family_academia_first_publication on public.lessons;
create trigger family_academia_first_publication after insert or update of is_published on public.lessons
for each row execute function private.enqueue_family_academia_notices();

-- Retry disconnected schools once they connect. Use existing pg_cron if installed.
do $$ begin
  if exists(select 1 from pg_extension where extname='pg_cron') then
    perform cron.schedule('family-academia-whatsapp','*/15 * * * *','select private.dispatch_academia_notifications();');
  end if;
end; $$;
