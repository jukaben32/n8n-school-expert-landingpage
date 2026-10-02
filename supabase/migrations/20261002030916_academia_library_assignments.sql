-- Library publication and classroom assignment are independent.
alter table public.lessons add column if not exists is_library boolean not null default true;
create table if not exists public.academia_assignments (
 id uuid primary key default gen_random_uuid(),
 school_id uuid not null references public.schools(id),
 lesson_id uuid not null references public.lessons(id),
 grade_level text not null,
 subject_id uuid not null references public.subjects(id),
 instructions text not null default '' check(length(instructions)<=10000),
 due_date date,
 delivery_mode text not null default 'quiz' check(delivery_mode in ('quiz','text','classroom')),
 is_active boolean not null default true,
 created_by uuid references public.users_profiles(id),
 created_at timestamptz not null default now(),
 legacy boolean not null default false
);
create unique index if not exists academia_legacy_lesson on public.academia_assignments(lesson_id) where legacy;
create index if not exists academia_assignments_course on public.academia_assignments(school_id,grade_level,created_at desc);
create table if not exists public.academia_assignment_students (
 assignment_id uuid not null references public.academia_assignments(id) on delete cascade,
 student_id uuid not null references public.students(id),
 primary key(assignment_id,student_id)
);
create index if not exists academia_assignment_students_student on public.academia_assignment_students(student_id,assignment_id);
create table if not exists public.academia_submissions (
 assignment_id uuid not null references public.academia_assignments(id),
 student_id uuid not null references public.students(id),
 response text not null default '' check(length(response)<=20000),
 status text not null default 'submitted' check(status in ('submitted','reviewed','returned')),
 feedback text not null default '' check(length(feedback)<=5000),
 submitted_at timestamptz not null default now(),
 reviewed_at timestamptz,
 primary key(assignment_id,student_id)
);
alter table public.quiz_attempts add column if not exists assignment_id uuid references public.academia_assignments(id);
-- Preserve already visible activities and their historical results; never notify during conversion.
drop trigger if exists academia_assignment_validate on public.academia_assignments;
drop trigger if exists academia_assignment_enqueue on public.academia_assignments;
drop trigger if exists family_academia_first_publication on public.lessons;
insert into public.academia_assignments(school_id,lesson_id,grade_level,subject_id,created_by,created_at,legacy)
select school_id,id,grade_level,subject_id,created_by,created_at,true from public.lessons
where is_published and deleted_at is null and grade_level is not null
on conflict(lesson_id) where legacy do nothing;
insert into public.academia_assignment_students(assignment_id,student_id)
select a.id,s.id from public.academia_assignments a join public.students s on s.school_id=a.school_id and s.grade_level=a.grade_level
where a.legacy and s.deleted_at is null and s.enrollment_status='inscrito' on conflict do nothing;
update public.quiz_attempts q set assignment_id=a.id from public.academia_assignments a where a.lesson_id=q.lesson_id and a.legacy and q.assignment_id is null;
create index if not exists academia_attempt_lookup on public.quiz_attempts(assignment_id,student_id) where completed_at is not null;

-- Boolean predicates only: explicit auth.uid, empty search_path, no anonymous execution.
create or replace function public.academia_staff_scope(p_school uuid,p_grade text,p_subject uuid)
returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.users_profiles up where up.auth_id=auth.uid() and
 case when up.role='super_admin' then true
 when up.school_id is distinct from p_school then false
 when up.role in ('director','school_admin') then true
 when up.role='teacher' then exists(select 1 from public.subjects subj where subj.id=p_subject and subj.school_id=p_school)
 and case when p_grade ~* '(primaria|primario|kinder|p[áa]rv|inicial|infantil)' then public.teacher_is_assigned_to_grade(p_school,p_grade,'regular')
 else exists(select 1 from public.class_schedules cs where cs.school_id=p_school and cs.staff_id=up.staff_id and cs.grade_level=p_grade and cs.subject_id=p_subject) end
 else false end);
$$;
create or replace function public.academia_student_scope(p_assignment uuid,p_student uuid)
returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.users_profiles up join public.students s on s.id=up.student_id
 join public.academia_assignment_students recipient on recipient.student_id=s.id
 join public.academia_assignments a on a.id=recipient.assignment_id
 join public.lessons l on l.id=a.lesson_id
 where up.auth_id=auth.uid() and up.role='student' and s.id=p_student and a.id=p_assignment
 and up.school_id=s.school_id and s.school_id=a.school_id and s.grade_level=a.grade_level
 and s.deleted_at is null and s.enrollment_status='inscrito' and a.is_active
 and l.school_id=a.school_id and l.grade_level=a.grade_level and l.subject_id=a.subject_id and l.is_published and l.deleted_at is null);
$$;
create or replace function public.academia_family_scope(p_assignment uuid,p_student uuid)
returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.users_profiles up join public.guardians g on g.id=up.guardian_id
 join public.student_guardians sg on sg.guardian_id=g.id join public.students s on s.id=sg.student_id
 join public.academia_assignment_students recipient on recipient.student_id=s.id
 join public.academia_assignments a on a.id=recipient.assignment_id join public.lessons l on l.id=a.lesson_id
 where up.auth_id=auth.uid() and s.id=p_student and a.id=p_assignment and up.school_id=a.school_id
 and g.school_id=a.school_id and g.deleted_at is null and s.school_id=a.school_id and s.grade_level=a.grade_level
 and s.deleted_at is null and a.is_active and l.is_published and l.deleted_at is null
 and l.school_id=a.school_id and l.grade_level=a.grade_level and l.subject_id=a.subject_id);
$$;
create or replace function public.academia_assignment_read(p_assignment uuid)
returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.academia_assignments a where a.id=p_assignment and
 (public.academia_staff_scope(a.school_id,a.grade_level,a.subject_id)
 or exists(select 1 from public.academia_assignment_students r where r.assignment_id=a.id and
 (public.academia_student_scope(a.id,r.student_id) or public.academia_family_scope(a.id,r.student_id)))));
$$;
create or replace function public.academia_lesson_read(p_lesson uuid)
returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.lessons l where l.id=p_lesson and
 (public.academia_staff_scope(l.school_id,l.grade_level,l.subject_id)
 or exists(select 1 from public.academia_assignments a join public.academia_assignment_students r on r.assignment_id=a.id
 where a.lesson_id=l.id and (public.academia_student_scope(a.id,r.student_id) or public.academia_family_scope(a.id,r.student_id)))));
$$;
do $$ declare fn text; begin
 foreach fn in array array['academia_staff_scope(uuid,text,uuid)','academia_student_scope(uuid,uuid)','academia_family_scope(uuid,uuid)','academia_assignment_read(uuid)','academia_lesson_read(uuid)'] loop
 execute 'revoke all on function public.'||fn||' from public,anon';
 execute 'grant execute on function public.'||fn||' to authenticated,service_role';
 end loop;
end $$;

alter table public.academia_assignments enable row level security;
alter table public.academia_assignment_students enable row level security;
alter table public.academia_submissions enable row level security;
revoke all on public.academia_assignments,public.academia_assignment_students,public.academia_submissions from anon,authenticated;
grant select,insert on public.academia_assignments to authenticated;
grant update(instructions,due_date,is_active) on public.academia_assignments to authenticated;
grant select on public.academia_assignment_students,public.academia_submissions to authenticated;
grant all on public.academia_assignments,public.academia_assignment_students,public.academia_submissions to service_role;
drop policy if exists assignments_read on public.academia_assignments;
create policy assignments_read on public.academia_assignments for select to authenticated using(public.academia_staff_scope(school_id,grade_level,subject_id) or public.academia_assignment_read(id));
drop policy if exists assignments_insert on public.academia_assignments;
create policy assignments_insert on public.academia_assignments for insert to authenticated with check(public.academia_staff_scope(school_id,grade_level,subject_id) and created_by=(select id from public.users_profiles where auth_id=auth.uid()) and not legacy);
drop policy if exists assignments_update on public.academia_assignments;
create policy assignments_update on public.academia_assignments for update to authenticated using(public.academia_staff_scope(school_id,grade_level,subject_id)) with check(public.academia_staff_scope(school_id,grade_level,subject_id));
drop policy if exists recipients_read on public.academia_assignment_students;
create policy recipients_read on public.academia_assignment_students for select to authenticated using(
 public.academia_student_scope(assignment_id,student_id) or public.academia_family_scope(assignment_id,student_id)
 or exists(select 1 from public.academia_assignments a where a.id=assignment_id and public.academia_staff_scope(a.school_id,a.grade_level,a.subject_id)));
drop policy if exists submissions_read on public.academia_submissions;
create policy submissions_read on public.academia_submissions for select to authenticated using(
 public.academia_student_scope(assignment_id,student_id) or public.academia_family_scope(assignment_id,student_id)
 or exists(select 1 from public.academia_assignments a where a.id=assignment_id and public.academia_staff_scope(a.school_id,a.grade_level,a.subject_id)));

-- Restrictive policies close the older permissive paths without changing unrelated modules.
drop policy if exists academia_lesson_scope on public.lessons;
create policy academia_lesson_scope on public.lessons as restrictive for select to authenticated using(public.academia_staff_scope(school_id,grade_level,subject_id) or public.academia_lesson_read(id));
do $$ declare operation text; begin
 foreach operation in array array['insert','update','delete'] loop
 execute 'drop policy if exists academia_lesson_'||operation||'_scope on public.lessons';
 execute 'create policy academia_lesson_'||operation||'_scope on public.lessons as restrictive for '||operation||' to authenticated '||
 case when operation='insert' then '' else 'using(public.academia_staff_scope(school_id,grade_level,subject_id)) ' end||
 case when operation='delete' then '' else 'with check(public.academia_staff_scope(school_id,grade_level,subject_id))' end;
 end loop;
end $$;
drop policy if exists academia_attempt_scope on public.quiz_attempts;
-- The timetable is authoritative in Secondary; remove the obsolete grade-only write gates.
drop policy if exists lessons_staff_write on public.lessons;
create policy lessons_staff_write on public.lessons for insert to authenticated with check(public.academia_staff_scope(school_id,grade_level,subject_id));
drop policy if exists lessons_staff_update on public.lessons;
create policy lessons_staff_update on public.lessons for update to authenticated using(public.academia_staff_scope(school_id,grade_level,subject_id)) with check(public.academia_staff_scope(school_id,grade_level,subject_id));
drop policy if exists lessons_staff_delete on public.lessons;
create policy lessons_staff_delete on public.lessons for delete to authenticated using(public.academia_staff_scope(school_id,grade_level,subject_id));
do $$ declare tbl text; op text; predicate text; policy_name text; begin
 foreach tbl in array array['quiz_questions','quiz_options'] loop
 predicate:=case when tbl='quiz_questions' then 'exists(select 1 from public.lessons l where l.id=lesson_id and public.academia_staff_scope(l.school_id,l.grade_level,l.subject_id))'
 else 'exists(select 1 from public.quiz_questions q join public.lessons l on l.id=q.lesson_id where q.id=question_id and public.academia_staff_scope(l.school_id,l.grade_level,l.subject_id))' end;
 foreach op in array array['insert','update','delete'] loop
 policy_name:=tbl||'_staff_'||case when op='insert' then 'write' else op end;
 execute format('drop policy if exists %I on public.%I',policy_name,tbl);
 execute format('create policy %I on public.%I for %s to authenticated ',policy_name,tbl,op)||
 case when op='insert' then '' else 'using('||predicate||') ' end||case when op='delete' then '' else 'with check('||predicate||')' end;
 end loop; end loop;
end $$;
create policy academia_attempt_scope on public.quiz_attempts as restrictive for select to authenticated using(
 exists(select 1 from public.lessons l where l.id=lesson_id and public.academia_staff_scope(l.school_id,l.grade_level,l.subject_id))
 or public.academia_student_scope(assignment_id,student_id));
-- Browser payload cannot mint a score or alter completed attempts/answers.
do $$ declare tbl text; operation text; begin
 foreach tbl in array array['quiz_attempts','quiz_answers'] loop
 foreach operation in array array['insert','update','delete'] loop
 execute format('drop policy if exists academia_%s_server_%s on public.%I',tbl,operation,tbl);
 execute format('create policy academia_%s_server_%s on public.%I as restrictive for %s to authenticated ',tbl,operation,tbl,operation)||
 case when operation='insert' then '' else 'using(public.is_super_admin()) ' end||
 case when operation='delete' then '' else 'with check(public.is_super_admin())' end;
 end loop; end loop;
end $$;

create or replace function private.validate_academia_assignment()
returns trigger language plpgsql security definer set search_path='' as $$
begin
 if not exists(select 1 from public.lessons l join public.subjects subj on subj.id=l.subject_id and subj.school_id=l.school_id
 where l.id=new.lesson_id and l.school_id=new.school_id and l.grade_level=new.grade_level and l.subject_id=new.subject_id and l.is_published and l.deleted_at is null)
 then raise exception 'La lección no está disponible para ese curso y materia'; end if;
 if tg_op='INSERT' and new.legacy then raise exception 'Las asignaciones históricas no se crean desde la aplicación'; end if;
 return new;
end $$;
revoke all on function private.validate_academia_assignment() from public,anon,authenticated;
drop trigger if exists academia_assignment_validate on public.academia_assignments;
create trigger academia_assignment_validate before insert on public.academia_assignments for each row execute function private.validate_academia_assignment();

alter table public.family_academia_notifications add column if not exists assignment_id uuid references public.academia_assignments(id);
update public.family_academia_notifications n set assignment_id=a.id from public.academia_assignments a where a.lesson_id=n.lesson_id and a.legacy and n.assignment_id is null;
alter table public.family_academia_notifications drop constraint if exists family_academia_notifications_guardian_id_student_id_lesson_id_key;
create unique index if not exists family_academia_assignment_notice on public.family_academia_notifications(guardian_id,student_id,assignment_id) where assignment_id is not null;
create or replace function private.enqueue_academia_assignment()
returns trigger language plpgsql security definer set search_path='' as $$
begin
 insert into public.academia_assignment_students(assignment_id,student_id)
 select new.id,s.id from public.students s where s.school_id=new.school_id and s.grade_level=new.grade_level and s.deleted_at is null and s.enrollment_status='inscrito';
 if new.is_active then
 insert into public.family_academia_notifications(school_id,guardian_id,student_id,lesson_id,assignment_id)
 select new.school_id,g.id,s.id,new.lesson_id,new.id from public.academia_assignment_students r
 join public.students s on s.id=r.student_id join public.student_guardians sg on sg.student_id=s.id
 join public.guardians g on g.id=sg.guardian_id where r.assignment_id=new.id and g.school_id=new.school_id and g.deleted_at is null
 on conflict do nothing;
 perform private.dispatch_academia_notifications(); end if;
 return new;
end $$;
revoke all on function private.enqueue_academia_assignment() from public,anon,authenticated;
drop trigger if exists academia_assignment_enqueue on public.academia_assignments;
create trigger academia_assignment_enqueue after insert on public.academia_assignments for each row execute function private.enqueue_academia_assignment();
drop policy if exists family_academia_notices_read on public.family_academia_notifications;
create policy family_academia_notices_read on public.family_academia_notifications for select to authenticated using(public.family_can_read_academia_notice(school_id,guardian_id,student_id,lesson_id) and public.academia_family_scope(assignment_id,student_id));
drop policy if exists family_academia_notices_ack on public.family_academia_notifications;
create policy family_academia_notices_ack on public.family_academia_notifications for update to authenticated using(public.family_can_read_academia_notice(school_id,guardian_id,student_id,lesson_id) and public.academia_family_scope(assignment_id,student_id)) with check(public.academia_family_scope(assignment_id,student_id));

-- Authenticated RPCs validate ownership again; student_id and scores never come from callers.
create or replace function public.academia_submit_text(p_assignment uuid,p_response text)
returns void language plpgsql security definer set search_path='' as $$
declare sid uuid; mode text;
begin
 select student_id into sid from public.users_profiles where auth_id=auth.uid() and role='student';
 if not public.academia_student_scope(p_assignment,sid) then raise exception 'No tienes acceso a esta tarea' using errcode='42501'; end if;
 select delivery_mode into mode from public.academia_assignments where id=p_assignment;
 if mode<>'text' or length(btrim(coalesce(p_response,'')))=0 or length(p_response)>20000 then raise exception 'Escribe una respuesta válida'; end if;
 insert into public.academia_submissions(assignment_id,student_id,response) values(p_assignment,sid,btrim(p_response))
 on conflict(assignment_id,student_id) do update set response=excluded.response,status='submitted',feedback='',submitted_at=now(),reviewed_at=null where academia_submissions.status='returned';
 if not found then raise exception 'Esta tarea ya fue entregada'; end if;
end $$;
create or replace function public.academia_review_submission(p_assignment uuid,p_student uuid,p_status text,p_feedback text)
returns void language plpgsql security definer set search_path='' as $$
declare a public.academia_assignments;
begin
 select * into a from public.academia_assignments where id=p_assignment;
 if not public.academia_staff_scope(a.school_id,a.grade_level,a.subject_id) then raise exception 'No tienes acceso a esta tarea' using errcode='42501'; end if;
 if p_status not in ('reviewed','returned') or length(coalesce(p_feedback,''))>5000 or not exists(select 1 from public.academia_assignment_students where assignment_id=p_assignment and student_id=p_student) then raise exception 'Revisión inválida'; end if;
 if a.delivery_mode='classroom' and p_status='reviewed' then
 insert into public.academia_submissions(assignment_id,student_id,status,feedback,reviewed_at) values(p_assignment,p_student,p_status,coalesce(p_feedback,''),now()) on conflict(assignment_id,student_id) do update set status=excluded.status,feedback=excluded.feedback,reviewed_at=now();
 else
 update public.academia_submissions set status=p_status,feedback=coalesce(p_feedback,''),reviewed_at=now() where assignment_id=p_assignment and student_id=p_student;
 if not found then raise exception 'No hay una entrega para revisar'; end if;
 end if;
end $$;
create or replace function public.academia_submit_quiz(p_assignment uuid,p_answers jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare sid uuid; a public.academia_assignments; attempt public.quiz_attempts; q record; option_id uuid; correct boolean; result jsonb:='[]'; earned int:=0; maximum int:=0; hits int:=0; total int:=0;
begin
 select student_id into sid from public.users_profiles where auth_id=auth.uid() and role='student';
 if not public.academia_student_scope(p_assignment,sid) then raise exception 'No tienes acceso a esta tarea' using errcode='42501'; end if;
 select * into a from public.academia_assignments where id=p_assignment;
 if a.delivery_mode<>'quiz' or p_answers is null or jsonb_typeof(p_answers)<>'array' then raise exception 'Cuestionario inválido'; end if;
 perform pg_advisory_xact_lock(hashtextextended(p_assignment::text||sid::text,0));
 select * into attempt from public.quiz_attempts where assignment_id=p_assignment and student_id=sid and completed_at is not null limit 1;
 if found then return jsonb_build_object('score',attempt.score,'max_score',attempt.max_score); end if;
 for q in select * from public.quiz_questions where lesson_id=a.lesson_id order by sort_order loop
 total:=total+1; maximum:=maximum+q.points;
 select (x->>'selectedOptionId')::uuid into option_id from jsonb_array_elements(p_answers) x where x->>'questionId'=q.id::text;
 select is_correct into correct from public.quiz_options where id=option_id and question_id=q.id;
 if not found then raise exception 'Falta una respuesta válida'; end if;
 if correct then earned:=earned+q.points; hits:=hits+1; end if;
 result:=result||jsonb_build_array(jsonb_build_object('question',q.id,'option',option_id,'correct',correct));
 end loop;
 if jsonb_array_length(p_answers)<>total then raise exception 'Número de respuestas inválido'; end if;
 insert into public.quiz_attempts(school_id,lesson_id,student_id,assignment_id,score,max_score,correct_count,total_questions,completed_at)
 values(a.school_id,a.lesson_id,sid,a.id,earned,maximum,hits,total,now()) returning * into attempt;
 insert into public.quiz_answers(attempt_id,question_id,selected_option_id,is_correct) select attempt.id,(x->>'question')::uuid,(x->>'option')::uuid,(x->>'correct')::boolean from jsonb_array_elements(result) x;
 return jsonb_build_object('score',earned,'max_score',maximum);
end $$;
revoke all on function public.academia_submit_text(uuid,text),public.academia_review_submission(uuid,uuid,text,text),public.academia_submit_quiz(uuid,jsonb) from public,anon;
grant execute on function public.academia_submit_text(uuid,text),public.academia_review_submission(uuid,uuid,text,text),public.academia_submit_quiz(uuid,jsonb) to authenticated;

create or replace function public.academia_available_scopes(p_school uuid)
returns table(grade_level text,subject_id uuid,subject_name text) language sql stable security definer set search_path='' as $$
 select distinct s.grade_level,subj.id,subj.name from public.students s join public.subjects subj on subj.school_id=s.school_id
 where s.school_id=p_school and s.deleted_at is null and s.enrollment_status='inscrito' and s.grade_level is not null
 and public.academia_staff_scope(p_school,s.grade_level,subj.id) order by s.grade_level,subj.name;
$$;
create or replace function public.academia_create_manual_assignment(p_school uuid,p_grade text,p_subject uuid,p_title text,p_instructions text,p_due date,p_mode text)
returns uuid language plpgsql security definer set search_path='' as $$
declare lesson uuid; assignment uuid; author uuid;
begin
 if not public.academia_staff_scope(p_school,p_grade,p_subject) then raise exception 'No tienes permiso para ese curso y materia' using errcode='42501'; end if;
 if p_mode not in ('text','classroom') or coalesce(length(btrim(p_title)),0) not between 1 and 200 or coalesce(length(btrim(p_instructions)),0) not between 1 and 10000 then raise exception 'Completa el título y las instrucciones'; end if;
 select id into author from public.users_profiles where auth_id=auth.uid();
 insert into public.lessons(school_id,grade_level,subject_id,title,description,video_url,video_provider,is_published,is_library,created_by)
 values(p_school,p_grade,p_subject,btrim(p_title),btrim(p_instructions),null,null,true,false,author) returning id into lesson;
 insert into public.academia_assignments(school_id,lesson_id,grade_level,subject_id,instructions,due_date,delivery_mode,created_by)
 values(p_school,lesson,p_grade,p_subject,btrim(p_instructions),p_due,p_mode,author) returning id into assignment;
 return assignment;
end $$;
revoke all on function public.academia_available_scopes(uuid),public.academia_create_manual_assignment(uuid,text,uuid,text,text,date,text) from public,anon;
grant execute on function public.academia_available_scopes(uuid),public.academia_create_manual_assignment(uuid,text,uuid,text,text,date,text) to authenticated;

-- Staff screens must not inherit the extra family read scope of dual-role teachers.
create or replace view public.academia_staff_lessons with(security_invoker=true) as
 select l.* from public.lessons l where public.academia_staff_scope(l.school_id,l.grade_level,l.subject_id);
create or replace view public.academia_staff_assignments with(security_invoker=true) as
 select a.* from public.academia_assignments a where public.academia_staff_scope(a.school_id,a.grade_level,a.subject_id);
create or replace view public.academia_staff_attempts with(security_invoker=true) as
 select q.* from public.quiz_attempts q join public.lessons l on l.id=q.lesson_id where public.academia_staff_scope(l.school_id,l.grade_level,l.subject_id);
revoke all on public.academia_staff_lessons,public.academia_staff_assignments,public.academia_staff_attempts from anon,authenticated;
grant select on public.academia_staff_lessons,public.academia_staff_assignments,public.academia_staff_attempts to authenticated;
grant select on public.academia_staff_lessons,public.academia_staff_assignments,public.academia_staff_attempts to service_role;
notify pgrst,'reload schema';

-- Short rollout bridge for the already deployed player. Only legacy activities,
-- own enrolled student and matching school/course; new assignments always use RPC.
-- The follow-up migration removes this bridge after Vercel finishes deploying.
create or replace function public.academia_legacy_attempt_scope(p_lesson uuid,p_student uuid,p_school uuid)
returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.academia_assignments a where a.lesson_id=p_lesson and a.school_id=p_school and a.legacy and public.academia_student_scope(a.id,p_student));
$$;
revoke all on function public.academia_legacy_attempt_scope(uuid,uuid,uuid) from public,anon;
grant execute on function public.academia_legacy_attempt_scope(uuid,uuid,uuid) to authenticated;
drop policy if exists academia_attempt_scope on public.quiz_attempts;
create policy academia_attempt_scope on public.quiz_attempts as restrictive for select to authenticated using(
 exists(select 1 from public.lessons l where l.id=lesson_id and public.academia_staff_scope(l.school_id,l.grade_level,l.subject_id))
 or public.academia_student_scope(assignment_id,student_id)
 or (assignment_id is null and public.academia_legacy_attempt_scope(lesson_id,student_id,school_id)));
drop policy if exists academia_quiz_attempts_server_insert on public.quiz_attempts;
create policy academia_quiz_attempts_server_insert on public.quiz_attempts as restrictive for insert to authenticated with check(
 public.is_super_admin() or (assignment_id is null and public.academia_legacy_attempt_scope(lesson_id,student_id,school_id)));
drop policy if exists academia_quiz_answers_server_insert on public.quiz_answers;
create policy academia_quiz_answers_server_insert on public.quiz_answers as restrictive for insert to authenticated with check(
 public.is_super_admin() or exists(select 1 from public.quiz_attempts q where q.id=attempt_id and q.assignment_id is null and public.academia_legacy_attempt_scope(q.lesson_id,q.student_id,q.school_id)));
