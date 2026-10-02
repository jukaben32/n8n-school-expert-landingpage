-- Only before the finish migration, inside the runner's rollback transaction.
do $$ declare sid uuid; actor uuid; a public.academia_assignments; attempt uuid; q uuid; opt uuid;
begin
 select s.id,up.auth_id into sid,actor from public.students s join public.users_profiles up on up.student_id=s.id and up.role='student' where s.deleted_at is null limit 1;
 select aa.* into a from public.academia_assignments aa join public.students s on s.school_id=aa.school_id where s.id=sid and aa.legacy limit 1;
 if a.id is null then raise exception 'No historical activity for compatibility test'; end if;
 update public.students set grade_level=a.grade_level,enrollment_status='inscrito' where id=sid;
 insert into public.academia_assignment_students(assignment_id,student_id) values(a.id,sid) on conflict do nothing;
 select qq.id,qo.id into q,opt from public.quiz_questions qq join public.quiz_options qo on qo.question_id=qq.id where qq.lesson_id=a.lesson_id limit 1;
 perform set_config('request.jwt.claims',jsonb_build_object('sub',actor,'role','authenticated')::text,true);
 execute 'set local role authenticated';
 insert into public.quiz_attempts(school_id,lesson_id,student_id,score,max_score,completed_at) values(a.school_id,a.lesson_id,sid,0,10,now()) returning id into attempt;
 if not exists(select 1 from public.quiz_attempts where id=attempt) then raise exception 'Legacy player cannot read saved attempt'; end if;
 if q is not null then insert into public.quiz_answers(attempt_id,question_id,selected_option_id,is_correct) values(attempt,q,opt,false); end if;
 execute 'reset role';
end $$;
