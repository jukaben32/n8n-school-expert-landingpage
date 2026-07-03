-- =========================================================================
-- SCHOOLOS — Migración 002: Módulo de Comunicados y Asistencia
-- =========================================================================

-- Tabla de Comunicados (mensajes del colegio a las familias)
create table messages (
    id uuid primary key default gen_random_uuid(),
    school_id uuid not null references schools(id),
    author_id uuid not null references users_profiles(id),
    title text not null,
    body text not null,
    -- audience: 'all', 'grade', 'section', 'family', 'student'
    audience_type text not null default 'all',
    audience_ids uuid[],                      -- IDs específicos si audience_type != 'all'
    priority text not null default 'normal'   -- 'normal' | 'urgent'
        check (priority in ('normal', 'urgent')),
    published_at timestamptz,                 -- NULL = borrador, valor = publicado
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    deleted_at timestamptz
);

create index idx_messages_school on messages(school_id) where deleted_at is null;
create index idx_messages_published on messages(school_id, published_at desc) where deleted_at is null;

-- Tabla de Lectura de Comunicados (trazabilidad "Lectura confirmada")
create table message_reads (
    id uuid primary key default gen_random_uuid(),
    message_id uuid not null references messages(id) on delete cascade,
    user_id uuid not null references users_profiles(id),
    read_at timestamptz not null default now(),
    unique(message_id, user_id)             -- Un usuario solo puede "leer" un mensaje una vez
);

create index idx_message_reads_msg on message_reads(message_id);
create index idx_message_reads_user on message_reads(user_id);

-- =========================================================================
-- Tabla de Asistencia
-- =========================================================================
create table attendance (
    id uuid primary key default gen_random_uuid(),
    school_id uuid not null references schools(id),
    student_id uuid not null references students(id),
    recorded_by uuid not null references users_profiles(id),
    date date not null,
    status text not null
        check (status in ('presente', 'ausente', 'tardanza', 'justificado')),
    notes text,
    -- Seguimiento de notificación a los padres
    notified_at timestamptz,               -- Cuándo se envió el aviso
    notification_channel text,             -- 'whatsapp' | 'email' | 'none'
    ai_message_sent text,                  -- El mensaje que redactó la IA y envió
    created_at timestamptz not null default now(),
    unique(student_id, date)               -- Un registro de asistencia por estudiante por día
);

create index idx_attendance_school_date on attendance(school_id, date);
create index idx_attendance_student on attendance(student_id);

-- =========================================================================
-- RLS para Comunicados y Asistencia
-- =========================================================================

alter table messages enable row level security;
alter table message_reads enable row level security;
alter table attendance enable row level security;

-- Comunicados: el personal del colegio puede leer/crear; los guardians solo ver los publicados
create policy "messages_staff_all" on messages
for all using (
    school_id in (
        select school_id from users_profiles
        where auth_id = auth.uid()
        and role in ('super_admin','school_admin','director','teacher','finance','reception')
    )
);

create policy "messages_guardian_read" on messages
for select using (
    school_id in (
        select school_id from users_profiles
        where auth_id = auth.uid() and role = 'guardian'
    )
    and published_at is not null
    and deleted_at is null
);

-- Lecturas: cada usuario puede marcar y ver sus propias lecturas
create policy "message_reads_own" on message_reads
for all using (
    user_id in (
        select id from users_profiles where auth_id = auth.uid()
    )
);

-- Asistencia: staff puede ver y crear; guardians solo pueden ver la de sus hijos
create policy "attendance_staff_all" on attendance
for all using (
    school_id in (
        select school_id from users_profiles
        where auth_id = auth.uid()
        and role in ('super_admin','school_admin','director','teacher','reception')
    )
);

create policy "attendance_guardian_read" on attendance
for select using (
    student_id in (
        select sg.student_id
        from student_guardians sg
        join guardians g on g.id = sg.guardian_id
        join users_profiles up on up.guardian_id = g.id
        where up.auth_id = auth.uid() and up.role = 'guardian'
    )
);
