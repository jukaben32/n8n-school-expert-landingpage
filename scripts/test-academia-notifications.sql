-- Production regression: every fixture, notification and HTTP queue entry rolls back.
do $test$
declare owner_auth uuid; owner_guardian uuid; child uuid; school uuid; grade text;
author uuid; subject uuid; draft uuid; published uuid; foreign_lesson uuid;
expected integer; actual integer; original_title text;
begin
  select up.auth_id,g.id,s.id,s.school_id,s.grade_level
  into owner_auth,owner_guardian,child,school,grade
  from public.users_profiles up join public.guardians g on g.id=up.guardian_id
  join public.student_guardians sg on sg.guardian_id=g.id
  join public.students s on s.id=sg.student_id
  where up.role='guardian' and up.school_id=s.school_id and g.school_id=s.school_id
    and g.deleted_at is null and s.deleted_at is null and s.enrollment_status='inscrito'
    and s.grade_level is not null limit 1;
  if child is null then raise exception 'Missing guardian fixture'; end if;
  select id into author from public.users_profiles where school_id=school and role='teacher' limit 1;
  select id into subject from public.subjects where school_id=school limit 1;
  if author is null or subject is null then raise exception 'Missing lesson fixture'; end if;
  insert into public.lessons(school_id,subject_id,grade_level,title,is_published,created_by,video_provider)
  values(school,subject,grade,'ROLLBACK notice draft',false,author,null) returning id into draft;
  select count(*) into actual from public.family_academia_notifications where lesson_id=draft;
  if actual<>0 then raise exception 'Draft generated notices'; end if;
  update public.lessons set is_published=true where id=draft;
  published:=draft;
  select count(distinct (g.id,s.id)) into expected
  from public.students s join public.student_guardians sg on sg.student_id=s.id
  join public.guardians g on g.id=sg.guardian_id where s.school_id=school
    and s.grade_level=grade and s.deleted_at is null and s.enrollment_status='inscrito'
    and g.school_id=school and g.deleted_at is null;
  select count(*) into actual from public.family_academia_notifications where lesson_id=published;
  if actual<>expected or actual=0 then raise exception 'Wrong publication recipients'; end if;
  update public.lessons set is_published=false where id=published;
  update public.lessons set is_published=true where id=published;
  select count(*) into actual from public.family_academia_notifications where lesson_id=published;
  if actual<>expected then raise exception 'Republishing duplicated notices'; end if;
  insert into public.lessons(school_id,subject_id,grade_level,title,is_published,created_by,video_provider)
  values(school,subject,'ROLLBACK foreign course','ROLLBACK foreign lesson',true,author,null) returning id into foreign_lesson;
  perform set_config('request.jwt.claims',json_build_object('sub',owner_auth,'role','authenticated')::text,true);
  execute 'set local role authenticated';
  select count(*) into actual from public.family_academia_notifications where student_id=child and lesson_id=published;
  if actual<>1 then raise exception 'Guardian cannot read own notice'; end if;
  select count(*) into actual from public.family_academia_notifications where guardian_id<>owner_guardian;
  if actual<>0 then raise exception 'Guardian sees foreign notices'; end if;
  update public.family_academia_notifications set read_at=now() where student_id=child and lesson_id=published;
  get diagnostics actual=row_count;
  if actual<>1 then raise exception 'Guardian cannot acknowledge own notice'; end if;
  begin
    update public.family_academia_notifications set lesson_id=foreign_lesson where student_id=child;
    raise exception 'Guardian can change notice payload';
  exception when insufficient_privilege then null; end;
  update public.lessons set title='UNAUTHORIZED' where id=published;
  get diagnostics actual=row_count;
  if actual<>0 then raise exception 'Guardian can edit lessons'; end if;
  delete from public.lessons where id=published;
  get diagnostics actual=row_count;
  if actual<>0 then raise exception 'Guardian can delete lessons'; end if;
  begin
    insert into public.quiz_attempts(school_id,student_id,lesson_id) values(school,child,published);
    raise exception 'Guardian can answer on behalf of child';
  exception when insufficient_privilege then null; end;
  select count(*) into actual from public.lessons where id=foreign_lesson;
  if actual<>0 then raise exception 'Guardian sees foreign course'; end if;
  execute 'reset role';
  update public.lessons set is_published=false where id=published;
  execute 'set local role authenticated';
  select count(*) into actual from public.family_academia_notifications where lesson_id=published;
  if actual<>0 then raise exception 'Unpublished lesson notice remains visible'; end if;
  execute 'reset role';
end $test$;
select 'PASS: drafts, correct recipients, deduplication, own reads, own acknowledgement, payload protection, edit/delete/answer denied, foreign course denied, unpublish hides notices' as result;
