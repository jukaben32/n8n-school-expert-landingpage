-- Run only inside a transaction that is rolled back by the runner.
do $$
declare school uuid; teacher uuid; teacher_profile uuid; secondary uuid; secondary_profile uuid;
 sid uuid; student_auth uuid; guardian uuid; guardian_auth uuid; primary_grade text; secondary_grade text; subject uuid; secondary_subject uuid;
 foreign_subject uuid:=gen_random_uuid(); library uuid:=gen_random_uuid(); foreign_lesson uuid:=gen_random_uuid(); question uuid:=gen_random_uuid(); correct_option uuid:=gen_random_uuid(); wrong_option uuid:=gen_random_uuid(); assignment uuid; manual uuid; classroom uuid; count_before int; actual int; result jsonb; prior_guardian uuid;
begin
 select s.school_id,s.id,up.auth_id,g.id,gup.auth_id into school,sid,student_auth,guardian,guardian_auth
 from public.students s join public.users_profiles up on up.student_id=s.id and up.role='student'
 join public.student_guardians sg on sg.student_id=s.id join public.guardians g on g.id=sg.guardian_id
 join public.users_profiles gup on gup.guardian_id=g.id and gup.role='guardian'
 where s.deleted_at is null and g.deleted_at is null limit 1;
 select up.auth_id,up.id,ta.grade_level into teacher,teacher_profile,primary_grade
 from public.users_profiles up join public.teacher_assignments ta on ta.staff_id=up.staff_id
 where up.role='teacher' and up.school_id=school and ta.grade_level ilike '%primaria%' limit 1;
 select up.auth_id,up.id,cs.grade_level,cs.subject_id into secondary,secondary_profile,secondary_grade,secondary_subject
 from public.users_profiles up join public.class_schedules cs on cs.staff_id=up.staff_id
 join public.teacher_assignments ta on ta.staff_id=up.staff_id and ta.grade_level=cs.grade_level
 where up.role='teacher' and up.school_id=school and cs.grade_level ilike '%secundaria%' and cs.subject_id is not null limit 1;
 select id into subject from public.subjects where school_id=school limit 1;
 if school is null or teacher is null or secondary is null then raise exception 'Missing real test actors'; end if;
 update public.students set grade_level=primary_grade where id=sid;
 insert into public.subjects(id,school_id,name) values(foreign_subject,school,'TEST-ASSIGNMENTS-foreign-subject');
 insert into public.lessons(id,school_id,subject_id,grade_level,title,video_url,video_provider,is_published)
 values(library,school,subject,primary_grade,'TEST-ASSIGNMENTS-library',null,null,false),
 (foreign_lesson,school,foreign_subject,secondary_grade,'TEST-ASSIGNMENTS-foreign',null,null,true);
 insert into public.quiz_questions(id,lesson_id,prompt,points) values(question,library,'TEST-ASSIGNMENTS-question',10);
 insert into public.quiz_options(id,question_id,label,is_correct) values(correct_option,question,'Correct',true),(wrong_option,question,'Wrong',false);
 select count(*) into count_before from public.family_academia_notifications where lesson_id=library;
 update public.lessons set is_published=true where id=library;
 if (select count(*) from public.family_academia_notifications where lesson_id=library)<>count_before then raise exception 'Publishing library notifies families'; end if;

 perform set_config('request.jwt.claims',jsonb_build_object('sub',teacher,'role','authenticated')::text,true);
 execute 'set local role authenticated';
 if not public.academia_staff_scope(school,primary_grade,subject) then raise exception 'Primary teacher lost own course'; end if;
 if public.academia_staff_scope(school,secondary_grade,foreign_subject) then raise exception 'Primary teacher sees foreign course'; end if;
 select count(*) into actual from public.lessons where id=foreign_lesson;
 if actual<>0 then raise exception 'Teacher reads foreign lesson'; end if;
 insert into public.academia_assignments(school_id,lesson_id,grade_level,subject_id,created_by) values(school,library,primary_grade,subject,teacher_profile) returning id into assignment;
 if not exists(select 1 from public.academia_assignment_students where assignment_id=assignment and student_id=sid) then raise exception 'Own student not assigned'; end if;
 manual:=public.academia_create_manual_assignment(school,primary_grade,subject,'TEST-ASSIGNMENTS-manual','Describe el tema',current_date,'text');
 classroom:=public.academia_create_manual_assignment(school,primary_grade,subject,'TEST-ASSIGNMENTS-classroom','En cuaderno',null,'classroom');
 execute 'reset role';
 if (select count(*) from public.family_academia_notifications where assignment_id=assignment and guardian_id=guardian and student_id=sid)<>1 then raise exception 'Assignment did not notify own guardian exactly once'; end if;
 update public.academia_assignments set is_active=false where id=assignment;
 update public.academia_assignments set is_active=true where id=assignment;
 if (select count(*) from public.family_academia_notifications where assignment_id=assignment and guardian_id=guardian and student_id=sid)<>1 then raise exception 'Reactivation duplicates notifications'; end if;

 perform set_config('request.jwt.claims',jsonb_build_object('sub',secondary,'role','authenticated')::text,true);
 execute 'set local role authenticated';
 if not public.academia_staff_scope(school,secondary_grade,secondary_subject) then raise exception 'Secondary teacher lost assigned subject'; end if;
 if public.academia_staff_scope(school,secondary_grade,foreign_subject) then raise exception 'Secondary teacher sees foreign subject'; end if;
 if (select count(*) from public.lessons where id=foreign_lesson)<>0 then raise exception 'Secondary teacher reads foreign subject'; end if;
 begin
 perform public.academia_create_manual_assignment(school,secondary_grade,foreign_subject,'UNAUTHORIZED','Instructions',null,'text');
 raise exception 'Secondary teacher writes foreign subject'; exception when insufficient_privilege then null; end;
 begin
 perform public.academia_review_submission(manual,sid,'reviewed','UNAUTHORIZED');
 raise exception 'Teacher reviews foreign task'; exception when insufficient_privilege then null; end;
 execute 'reset role';

 -- A Secondary teacher who is also this child's parent gets family read access,
 -- but staff library/assignment views still exclude that child's other course.
 select guardian_id into prior_guardian from public.users_profiles where id=secondary_profile;
 update public.users_profiles set guardian_id=guardian where id=secondary_profile;
 execute 'set local role authenticated';
 if not public.academia_family_scope(assignment,sid) then raise exception 'Dual-role family access failed'; end if;
 if (select count(*) from public.academia_staff_lessons where id=library)<>0 then raise exception 'Dual role leaks family lessons into staff library'; end if;
 if (select count(*) from public.academia_staff_assignments where id=assignment)<>0 then raise exception 'Dual role leaks family task into staff management'; end if;
 execute 'reset role';
 update public.users_profiles set guardian_id=prior_guardian where id=secondary_profile;

 perform set_config('request.jwt.claims',jsonb_build_object('sub',student_auth,'role','authenticated')::text,true);
 execute 'set local role authenticated';
 if (select count(*) from public.academia_assignments where id=assignment)<>1 then raise exception 'Student cannot see own assignment'; end if;
 if (select count(*) from public.lessons where id=foreign_lesson)<>0 then raise exception 'Student sees foreign course'; end if;
 result:=public.academia_submit_quiz(assignment,jsonb_build_array(jsonb_build_object('questionId',question,'selectedOptionId',correct_option,'score',999,'isCorrect',false)));
 if (result->>'score')::int<>10 then raise exception 'Score does not come from database options'; end if;
 perform public.academia_submit_quiz(assignment,jsonb_build_array(jsonb_build_object('questionId',question,'selectedOptionId',wrong_option)));
 if (select count(*) from public.quiz_attempts where assignment_id=assignment and student_id=sid)<>1 then raise exception 'Quiz retry creates duplicate result'; end if;
 begin
 insert into public.quiz_attempts(school_id,lesson_id,student_id,assignment_id,score) values(school,library,sid,assignment,999);
 raise exception 'Student can forge score'; exception when insufficient_privilege then null; end;
 perform public.academia_submit_text(manual,'Mi respuesta');
 begin perform public.academia_submit_text(manual,'Overwrite'); raise exception 'Student changes submitted response'; exception when raise_exception then if sqlerrm='Student changes submitted response' then raise; end if; end;
 begin perform public.academia_review_submission(manual,sid,'reviewed','Self review'); raise exception 'Student reviews own work'; exception when insufficient_privilege then null; end;
 execute 'reset role';

 perform set_config('request.jwt.claims',jsonb_build_object('sub',teacher,'role','authenticated')::text,true);
 execute 'set local role authenticated';
 perform public.academia_review_submission(manual,sid,'returned','Amplía la explicación');
 perform public.academia_review_submission(classroom,sid,'reviewed','Revisado en clase');
 execute 'reset role';
 perform set_config('request.jwt.claims',jsonb_build_object('sub',student_auth,'role','authenticated')::text,true);
 execute 'set local role authenticated';
 perform public.academia_submit_text(manual,'Respuesta corregida');
 execute 'reset role';
 perform set_config('request.jwt.claims',jsonb_build_object('sub',teacher,'role','authenticated')::text,true);
 execute 'set local role authenticated';
 perform public.academia_review_submission(manual,sid,'reviewed','Bien');
 execute 'reset role';

 perform set_config('request.jwt.claims',jsonb_build_object('sub',guardian_auth,'role','authenticated')::text,true);
 execute 'set local role authenticated';
 if not public.academia_family_scope(assignment,sid) then raise exception 'Guardian cannot read own task'; end if;
 if (select count(*) from public.family_academia_notifications where assignment_id=assignment and student_id=sid)<>1 then raise exception 'Guardian notification scope failed'; end if;
 if (select count(*) from public.academia_assignment_students where assignment_id=assignment and student_id<>sid)<>0 then raise exception 'Guardian sees classmates'; end if;
 begin perform public.academia_submit_text(manual,'Parent answers'); raise exception 'Guardian answers as child'; exception when insufficient_privilege then null; end;
 update public.academia_assignments set is_active=false where id=assignment; get diagnostics actual=row_count;
 if actual<>0 then raise exception 'Guardian edits assignment'; end if;
 execute 'reset role';
 update public.academia_assignments set is_active=false where id=assignment;
 perform set_config('request.jwt.claims',jsonb_build_object('sub',student_auth,'role','authenticated')::text,true);
 execute 'set local role authenticated';
 if public.academia_student_scope(assignment,sid) then raise exception 'Withdrawn assignment remains accessible'; end if;
 execute 'reset role';
 update public.academia_assignments set is_active=true where id=assignment;
 -- A newly published library item has no assignment and stays hidden.
 insert into public.lessons(school_id,subject_id,grade_level,title,video_url,video_provider,is_published)
 values(school,subject,primary_grade,'TEST-ASSIGNMENTS-unassigned',null,null,true) returning id into library;
 execute 'set local role authenticated';
 if (select count(*) from public.lessons where id=library)<>0 then raise exception 'Unassigned library appears to student'; end if;
 execute 'reset role';
 raise notice 'PASS: library vs assignment, primary course, secondary subject, own recipients, notifications, quiz integrity/retry, manual submit/return/review, classroom review, guardian read-only, withdrawal';
end $$;
