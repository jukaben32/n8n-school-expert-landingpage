-- Apply only after the new web deployment is healthy; close the legacy player bridge.
update public.quiz_attempts q set assignment_id=a.id from public.academia_assignments a
where a.lesson_id=q.lesson_id and a.legacy and q.assignment_id is null;
drop policy if exists academia_attempt_scope on public.quiz_attempts;
create policy academia_attempt_scope on public.quiz_attempts as restrictive for select to authenticated using(
 exists(select 1 from public.lessons l where l.id=lesson_id and public.academia_staff_scope(l.school_id,l.grade_level,l.subject_id))
 or public.academia_student_scope(assignment_id,student_id));
drop policy if exists academia_quiz_attempts_server_insert on public.quiz_attempts;
create policy academia_quiz_attempts_server_insert on public.quiz_attempts as restrictive for insert to authenticated with check(public.is_super_admin());
drop policy if exists academia_quiz_answers_server_insert on public.quiz_answers;
create policy academia_quiz_answers_server_insert on public.quiz_answers as restrictive for insert to authenticated with check(public.is_super_admin());
drop function if exists public.academia_legacy_attempt_scope(uuid,uuid,uuid);
notify pgrst,'reload schema';
