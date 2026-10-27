# -*- coding: utf-8 -*-
"""Genera los SQL para actualizar los horarios 2026-2027 (cambio de docentes, oct. 2026).

Fuente: 26 fotos de las hojas impresas del colegio (12 grados, 12 docentes,
2 de Ingles), transcritas a mano. Este script CRUZA las dos fuentes antes de
escribir una sola linea de SQL: cada clase de la hoja de un grado tiene que ser
reclamada por exactamente un docente, y ningun docente puede reclamar una clase
que su grado no tiene. Si hay una errata de transcripcion, falla aqui.

Genera:
  20261027_horarios_actualizados_diagnostico.sql  (solo lectura, correr primero)
  20261027_horarios_actualizados_carga.sql        (transaccional, upsert)
"""
import os
import sys

SCHOOL = '0001da6e-2fe8-4dc9-97bf-8eadb7ee944e'
AQUI = os.path.dirname(os.path.abspath(__file__))

# ---------------------------------------------------------------- materias --
MAT = {
    'LE': 'Lengua Española', 'LEC': 'Lengua Española / Caligrafía',
    'CAL': 'Caligrafía', 'MAT': 'Matemática', 'CN': 'Ciencias Naturales',
    'BIO': 'Biología', 'FIS': 'Física', 'CS': 'Ciencias Sociales',
    'ING': 'Inglés', 'FH': 'Formación Humana', 'EA': 'Educación Artística',
    'EF': 'Educación Física', 'OE': 'Orientación Educativa',
    'SO': 'Salida Optativa',
}
# La hoja de estadistica del colegio (23/10/2026) le pone nombre a la optativa.
SALIDA_OPTATIVA_NUEVO = 'Salida Optativa (Matemática aplicada a la tecnología)'

# ------------------------------------------------------- docentes (llaves) --
# llave -> (patron de first_name, patron de last_name) para `ilike`.
# El guion bajo comodin cubre las tildes (g_nesis = Génesis/Genesis).
STAFF = {
    'yucleidy':   ('yuc%', 'pozo%'),
    'jsanchez':   ('jennifer%', 's_nchez%'),
    'casandra':   ('casandra%', 'medina%'),
    'marcelis':   ('marcelis%', 'santos%'),
    'elisa':      ('elisa%', 'santana%'),
    'gary':       ('gary%', '%'),
    'ruth':       ('ruth%', 'mingo%'),
    'yendry':     ('yendry%', 'paulino%'),
    'melissa':    ('melissa%', '%'),
    'genesis':    ('g_nesis%', 'rodr_guez%'),
    'jsoriano':   ('jenn%', 'soriano%'),
    'marianelis': ('mar_anelis%', 'rivera%'),
    'vianela':    ('vianela%', 'santana%'),
    'indira':     ('indira%', 'peguero%'),
    'manuela':    ('manuela%', 'vicente%'),
    'teresa':     ('teresa%', 'santana%'),
    'juanairis':  ('juana iris%', 'severino%'),
    'nicol':      ('nicol%', 'gonz_lez%'),
    'nercy':      ('nercy%', '%'),
    'yuleimi':    ('yule%', 'lugo%'),
}
TITULAR = {1: 'vianela', 2: 'indira', 3: 'manuela', 4: 'teresa', 5: 'juanairis', 6: 'nicol'}

DIAS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie']
ORD = {1: '1ro.', 2: '2do.', 3: '3ro.', 4: '4to.', 5: '5to.', 6: '6to.'}

# ------------------------------------------------- hojas de grado: PRIMARIA --
# Filas B1..B5 = 7:40, 8:30, 10:20, 11:10, 11:50. Columnas Lun..Vie.
PRIM = {
    1: ['ING EF LE LE CN', 'ING MAT LEC LE MAT', 'LEC CN FH MAT EA',
        'MAT CS ING MAT ING', 'MAT CS CN CAL ING'],
    2: ['LE MAT CN MAT ING', 'EF MAT CN MAT ING', 'LEC FH ING CN LE',
        'CS CS LE CN LEC', 'CS ING EA ING MAT'],
    3: ['EF ING MAT LE MAT', 'LE ING MAT ING EA', 'LEC CS MAT ING ING',
        'CS MAT CN LE CN', 'CS MAT CN CN FH'],
    4: ['LE CS ING FH LEC', 'CAL EF ING MAT LE', 'CN ING EA MAT CS',
        'MAT ING CN ING CS', 'MAT LEC CN CS CN'],
    5: ['LE MAT EF ING MAT', 'CS LEC CN LE MAT', 'ING ING CN ING CS',
        'CS ING MAT CN LEC', 'EA FH MAT CS LE'],
    6: ['ING MAT LE EF CS', 'ING MAT LEC ING CS', 'CN MAT MAT LE MAT',
        'CN LE CS ING ING', 'EA CN CN LE FH'],
}
# ----------------------------------------------- hojas de grado: SECUNDARIA --
# Filas P1..P6 = 7:30, 8:20, 9:10, 10:00, 11:10, 12:10.
SEC = {
    1: ['LE CS CN CS OE', 'LE CS MAT CN CS', 'MAT FH ING MAT EA',
        'MAT CN ING MAT FH', 'EF CN LE LE MAT', 'ING ING LE LE OE'],
    2: ['CS ING CS MAT LE', 'CS FH CS MAT FH', 'LE CN LE CN ING',
        'LE EA LE EA CN', 'ING MAT EF CN LE', 'EF MAT ING ING MAT'],
    3: ['MAT CN LE LE CS', 'MAT CN EF LE ING', 'FH LE MAT FH CS',
        'ING ING MAT ING MAT', 'EA ING CS EA CN', 'LE LE CS MAT CN'],
    4: ['BIO LE MAT LE LE', 'BIO LE MAT LE BIO', 'CS SO BIO ING FH',
        'CS MAT CS EA ING', 'LE MAT ING EF OE', 'SO CS ING ING MAT'],
    5: ['MAT ING ING CN MAT', 'MAT SO CN EF SO', 'CN CS LE LE MAT',
        'CN CS LE EF LE', 'ING LE EA CS ING', 'LE MAT FH CS ING'],
    6: ['LE MAT EA ING FIS', 'LE ING EA ING SO', 'MAT ING MAT CS ING',
        'MAT LE MAT CS MAT', 'CS EF LE SO FH', 'FIS LE FIS FH LE'],
}

# ------------------------------------- hojas de DOCENTE de secundaria -------
# Cada celda: 'dia:grado' o 'dia:grado:MATERIA' (cuando el docente da mas de una
# materia a ese grado). dia = 0..4 (Lun..Vie). Filas P1..P6.
def celdas(texto):
    """'P1 0:3 3:2' por linea -> {(periodo, dia): (grado, marca)}"""
    out = {}
    for linea in texto.strip().splitlines():
        p, *items = linea.split()
        for it in items:
            partes = it.split(':')
            d, g = int(partes[0]), int(partes[1])
            out[(int(p[1:]) - 1, d)] = (g, partes[2] if len(partes) > 2 else None)
    return out


DOCENTES_SEC = {
    # llave: (materias permitidas, celdas)
    'jsanchez': ({'MAT', 'SO'}, celdas("""
P1 0:3 3:2
P2 0:3 1:5:SO 2:1 3:2 4:5:SO
P3 0:1 1:4:SO 2:3 3:1
P4 0:1 2:3 3:1 4:3
P5 1:2 4:1
P6 0:4:SO 1:2 3:3 4:2""")),
    'yucleidy': ({'LE', 'EA'}, celdas("""
P1 0:1 2:3 3:3 4:2
P2 0:1 3:3
P3 0:2 1:3 2:2 4:1:EA
P4 0:2 2:2
P5 2:1 3:1 4:2
P6 0:3 1:3 2:1 3:1""")),
    'casandra': ({'CS'}, celdas("""
P1 0:2 1:1 2:2 3:1 4:3
P2 0:2 1:1 2:2 4:1
P3 0:4 1:5 3:6 4:3
P4 0:4 1:5 2:4 3:6
P5 0:6 2:3 3:5
P6 1:4 2:3 3:5""")),
    'marcelis': ({'CN', 'BIO', 'FIS'}, celdas("""
P1 0:4 1:3 2:1 3:5 4:6
P2 0:4 1:3 2:5 3:1 4:4
P3 0:5 1:2 2:4 3:2
P4 0:5 1:1 4:2
P5 1:1 3:2 4:3
P6 0:6 2:6 4:3""")),
    'elisa': ({'LE', 'EA'}, celdas("""
P1 0:6 1:4 3:4 4:4
P2 0:6 1:4 3:4
P3 2:5 3:5
P4 1:6 2:5 3:4:EA 4:5
P5 0:4 1:5 2:6
P6 0:5 1:6 4:6""")),
    'gary': ({'MAT', 'SO'}, celdas("""
P1 0:5 1:6 2:4 4:5
P2 0:5 2:4 4:6:SO
P3 0:6 2:6 4:5
P4 0:6 1:4 2:6 4:6
P5 1:4 3:6:SO
P6 1:5 4:4""")),
    'ruth': ({'FH', 'EA'}, celdas("""
P1 2:6:EA
P2 1:2:FH 2:6:EA 4:2:FH
P3 0:3:FH 1:1:FH 3:3:FH 4:4:FH
P4 1:2:EA 3:2:EA 4:1:FH
P5 0:3:EA 2:5:EA 3:3:EA 4:6:FH
P6 2:5:FH 3:6:FH""")),
    'yendry': ({'ING'}, celdas("""
P1 1:5 2:5 3:6
P2 1:6 3:6 4:3
P3 1:6 3:4 4:6
P4 0:3 1:3 3:3 4:4
P5 0:5 1:3 2:4 4:5
P6 2:4 3:4 4:5""")),
    'melissa': ({'ING'}, celdas("""
P1 1:2
P3 2:1 4:2
P4 2:1
P5 0:2
P6 0:1 1:1 2:2 3:2""")),
    'genesis': ({'OE'}, celdas("""
P1 4:1
P5 4:4
P6 4:1""")),
    'jsoriano': ({'EF'}, celdas("""
P2 2:3 3:5
P4 3:5
P5 0:1 1:6 2:2 3:4
P6 0:2""")),
}

# ------------------------- hojas de docente de PRIMARIA (cruce de control) ---
# 'dia:grado' por franja B1..B5.
def celdas_prim(texto):
    out = set()
    for linea in texto.strip().splitlines():
        b, *items = linea.split()
        for it in items:
            d, g = it.split(':')
            out.add((int(b[1:]) - 1, int(d), int(g)))
    return out


PRIM_MARIANELIS = celdas_prim("""
B1 0:1 1:3 2:4 4:2
B2 0:1 1:3 2:4 3:3 4:2
B3 1:4 2:2 3:3 4:3
B4 1:4 2:1 3:4 4:1
B5 1:2 3:2 4:1""")
PRIM_MELISSA = celdas_prim("""
B1 0:6 3:5
B2 0:6 3:6
B3 0:5 1:5 3:5
B4 1:5 3:6 4:6""")
PRIM_SORIANO = celdas_prim("""
B1 0:3 1:1 2:5 3:6
B2 0:2 1:4""")


def validar_y_armar():
    """Devuelve la lista de clases (nivel, grado, dia, periodo, materia, docente)."""
    errores, clases = [], []

    # ---- Primaria
    ing_celdas, ef_celdas = set(), set()
    for g, filas in PRIM.items():
        assert len(filas) == 5, f'{g}ro Primaria: filas'
        for b, fila in enumerate(filas):
            cols = fila.split()
            assert len(cols) == 5, f'{g}ro Primaria B{b+1}: {fila}'
            for d, cod in enumerate(cols):
                if cod == 'ING':
                    ing_celdas.add((b, d, g))
                if cod == 'EF':
                    ef_celdas.add((b, d, g))
    esperado_ing = ({c for c in ing_celdas if c[2] <= 4}, {c for c in ing_celdas if c[2] >= 5})
    if esperado_ing[0] != PRIM_MARIANELIS:
        errores.append(f'Ingles 1ro-4to Primaria vs hoja de Marianelis: {sorted(esperado_ing[0] ^ PRIM_MARIANELIS)}')
    if esperado_ing[1] != PRIM_MELISSA:
        errores.append(f'Ingles 5to-6to Primaria vs hoja de Melissa: {sorted(esperado_ing[1] ^ PRIM_MELISSA)}')
    if ef_celdas != PRIM_SORIANO:
        errores.append(f'Ed. Fisica Primaria vs hoja de Soriano: {sorted(ef_celdas ^ PRIM_SORIANO)}')

    for g, filas in PRIM.items():
        for b, fila in enumerate(filas):
            for d, cod in enumerate(fila.split()):
                if cod == 'ING':
                    doc = 'marianelis' if g <= 4 else 'melissa'
                elif cod == 'EF':
                    doc = 'jsoriano'
                else:
                    doc = TITULAR[g]
                clases.append(('Primaria', f'{ORD[g]} Primaria', d + 1, f'Bloque {b+1}', MAT[cod], doc))

    # ---- Secundaria
    reclamos = {}   # (g, p, d) -> [(docente, marca)]
    for doc, (permitidas, cel) in DOCENTES_SEC.items():
        for (p, d), (g, marca) in cel.items():
            reclamos.setdefault((g, p, d), []).append((doc, marca))
    for g, filas in SEC.items():
        assert len(filas) == 6, f'{g}ro Secundaria: filas'
        for p, fila in enumerate(filas):
            cols = fila.split()
            assert len(cols) == 5, f'{g}ro Secundaria P{p+1}: {fila}'
            for d, cod in enumerate(cols):
                rec = reclamos.pop((g, p, d), [])
                if len(rec) != 1:
                    errores.append(f'{g}ro Sec. {DIAS[d]} P{p+1} ({cod}): reclamada por {rec}')
                    continue
                doc, marca = rec[0]
                if cod not in DOCENTES_SEC[doc][0]:
                    errores.append(f'{g}ro Sec. {DIAS[d]} P{p+1}: {doc} no da {cod}')
                if marca and marca != cod:
                    errores.append(f'{g}ro Sec. {DIAS[d]} P{p+1}: marca {marca} != {cod}')
                clases.append(('Secundaria', f'{ORD[g]} Secundaria', d + 1, f'Sec. Bloque {p+1}', MAT[cod], doc))
    for (g, p, d), rec in reclamos.items():
        errores.append(f'Docente reclama clase inexistente: {g}ro Sec. {DIAS[d]} P{p+1} {rec}')

    if errores:
        print('ERRORES DE CRUCE:')
        for e in errores:
            print('  -', e)
        sys.exit(1)
    return clases


# ---------------------------------------------------------------- INICIAL ---
# (grado, dia 1..5, franja, materia, docente). Franjas propias de Inicial.
INI_PERIODOS = [
    ('Ini. 07:40', '07:40', '08:30', 20),
    ('Ini. 08:00', '08:00', '09:05', 21),
    ('Ini. 09:10', '09:10', '10:00', 22),
    ('Ini. 09:45', '09:45', '10:30', 23),
    ('Ini. 10:30', '10:30', '11:10', 24),
    ('Ini. 11:10', '11:10', '11:50', 25),
]
INICIAL = [
    # Nercy (Ingles)
    ('pk', 1, 'Ini. 08:00', 'ING', 'nercy'), ('pk', 4, 'Ini. 09:45', 'ING', 'nercy'),
    ('pk', 3, 'Ini. 10:30', 'ING', 'nercy'),
    ('k', 2, 'Ini. 08:00', 'ING', 'nercy'), ('k', 1, 'Ini. 09:45', 'ING', 'nercy'),
    ('k', 4, 'Ini. 10:30', 'ING', 'nercy'), ('k', 3, 'Ini. 11:10', 'ING', 'nercy'),
    ('k', 5, 'Ini. 11:10', 'ING', 'nercy'),
    ('pp', 4, 'Ini. 08:00', 'ING', 'nercy'), ('pp', 3, 'Ini. 09:45', 'ING', 'nercy'),
    ('pp', 2, 'Ini. 10:30', 'ING', 'nercy'), ('pp', 5, 'Ini. 10:30', 'ING', 'nercy'),
    # Yuleimi (hoja con celdas repetidas: solo lo que parece real)
    ('pk', 2, 'Ini. 07:40', 'ING', 'yuleimi'), ('pk', 4, 'Ini. 11:10', 'ING', 'yuleimi'),
    ('k', 5, 'Ini. 07:40', 'ING', 'yuleimi'),
    # Ed. Fisica de Pre-kinder (Soriano)
    ('pk', 3, 'Ini. 09:10', 'EF', 'jsoriano'), ('pk', 4, 'Ini. 09:10', 'EF', 'jsoriano'),
]
# Regex (postgres, ~*) para hallar el texto REAL de grade_level en `students`.
INI_GRADO_RE = {
    'pk': r'^pre[ -]*k.nder',
    'k': r'^k.nder',
    'pp': r'^pre[ -]*primario',
}


def sq(t):
    return t.replace("'", "''")


def staff_values(llaves):
    return ',\n    '.join(f"('{k}', '{STAFF[k][0]}', '{STAFF[k][1]}')" for k in sorted(llaves))


def main():
    clases = validar_y_armar()
    llaves = {c[5] for c in clases}
    n_prim = sum(1 for c in clases if c[0] == 'Primaria')
    n_sec = sum(1 for c in clases if c[0] == 'Secundaria')
    assert n_prim == 150 and n_sec == 180, (n_prim, n_sec)
    llaves_ini = {c[4] for c in INICIAL}
    todas = llaves | llaves_ini

    materias = sorted({c[4] for c in clases} | {MAT['ING'], MAT['EF']})
    materias = [SALIDA_OPTATIVA_NUEVO if m == MAT['SO'] else m for m in materias]

    # ------------------------------------------------------- diagnostico ---
    d = []
    d.append(f"""-- DIAGNOSTICO (solo lectura) -- horarios actualizados, oct. 2026.
-- Generado por generar_horarios_actualizados_2026_10.py. Correr ANTES de la carga.
-- Cada bloque es una consulta aparte: el editor de Supabase solo muestra la
-- ultima, asi que se corre un bloque a la vez (seleccionar y ejecutar).

-- A) Docentes: cada llave debe dar EXACTAMENTE 1 persona activa.
--    0 = falta darla de alta en Personal (con su correo real) antes de cargar.
--    2 o mas = ficha duplicada; hay que dejar una sola antes de cargar.
select k.key,
       count(s.id) as coincidencias,
       string_agg(s.first_name || ' ' || s.last_name || ' <' || coalesce(s.email, '') || '>', ' | ') as quien
from (values
    {staff_values(todas)}
) as k(key, f, l)
left join staff s on s.school_id = '{SCHOOL}' and s.deleted_at is null
     and s.first_name ilike k.f and s.last_name ilike k.l
group by k.key
order by (count(s.id) = 1), k.key;
""")
    d.append(f"""
-- B) Franjas de primaria y secundaria que la carga espera encontrar (deben salir las 11).
select name, start_time, end_time, level
from class_periods
where school_id = '{SCHOOL}'
  and name in ('Bloque 1','Bloque 2','Bloque 3','Bloque 4','Bloque 5',
               'Sec. Bloque 1','Sec. Bloque 2','Sec. Bloque 3','Sec. Bloque 4','Sec. Bloque 5','Sec. Bloque 6')
order by level, sort_order;
""")
    d.append(f"""
-- C) Texto REAL de grade_level en estudiantes inscritos (comparar con la lista que usa la carga:
--    1ro. Primaria ... 6to. Primaria, 1ro. Secundaria ... 6to. Secundaria).
select grade_level, count(*) as inscritos
from students
where school_id = '{SCHOOL}' and deleted_at is null and enrollment_status = 'inscrito'
group by grade_level order by grade_level;
""")
    d.append(f"""
-- D) Clases del horario VIGENTE que la carga dejaria intactas porque el horario nuevo ya
--    no las tiene (no se borran: borrar una clase borraria sus planificaciones).
--    Se muestra despues de cargar; antes de cargar, esto lista todo lo que cambia de docente.
select cs.grade_level, cs.day_of_week, p.name as franja, sj.name as materia,
       st.first_name || ' ' || st.last_name as docente_actual
from class_schedules cs
join class_periods p on p.id = cs.period_id
left join subjects sj on sj.id = cs.subject_id
left join staff st on st.id = cs.staff_id
where cs.school_id = '{SCHOOL}'
order by cs.grade_level, cs.day_of_week, p.sort_order
limit 400;
""")
    with open(os.path.join(AQUI, '20261027_horarios_actualizados_diagnostico.sql'), 'w', encoding='utf-8') as f:
        f.write(''.join(d))

    # ------------------------------------------------------------ carga ----
    c = []
    c.append(f"""-- CARGA de horarios actualizados 2026-2027 (oct. 2026) -- generado automaticamente.
-- Cambios: docentes nuevos (Melissa, Gary, Casandra, Elisa, Nicol...), salida de
-- Orlando Natera / Gabriela Lugo / Juana Alcantara / Alejandrina Lake / Diarkis Leon.
-- {n_prim} clases de Primaria + {n_sec} de Secundaria, cruzadas hoja de grado vs hoja de docente.
--
-- Que hace: ACTUALIZA en sitio (upsert por colegio+grado+dia+franja). NO borra clases
-- (class_schedules tiene lesson_plans colgando con on delete cascade). Si una clase del
-- horario viejo ya no existe en el nuevo, queda como esta y la consulta final la lista.
-- NO crea personal: las personas nuevas se dan de alta en Personal con su correo real
-- ANTES (el diagnostico A dice quien falta). Si falta o esta duplicada, aborta sin tocar nada.
-- Reejecutable sin riesgo.
begin;

create temp table _doc (key text, staff_id uuid) on commit drop;
insert into _doc (key, staff_id)
select k.key, s.id
from (values
    {staff_values(llaves)}
) as k(key, f, l)
join staff s on s.school_id = '{SCHOOL}' and s.deleted_at is null
     and s.first_name ilike k.f and s.last_name ilike k.l;

do $$
declare malos text;
begin
  select string_agg(k || ' (' || n || ')', ', ') into malos from (
    select k.key as k, count(d.staff_id) as n
    from (values {', '.join(f"('{k}')" for k in sorted(llaves))}) as k(key)
    left join _doc d on d.key = k.key
    group by k.key having count(d.staff_id) <> 1) x;
  if malos is not null then
    raise exception 'Docentes sin ficha unica en Personal (llave y coincidencias): %. Correr el diagnostico A y corregir.', malos;
  end if;
end $$;

-- Materia: la optativa pasa a llamarse como dice la estadistica del colegio (mismo id,
-- asi no se rompen notas ni horarios que ya la usan).
update subjects set name = '{sq(SALIDA_OPTATIVA_NUEVO)}'
where school_id = '{SCHOOL}' and name = 'Salida Optativa';
""")
    for m in materias:
        c.append(f"""insert into subjects (school_id, name) select '{SCHOOL}', '{sq(m)}'
where not exists (select 1 from subjects where school_id='{SCHOOL}' and name='{sq(m)}');
""")

    c.append("\ncreate temp table _nuevo (grade text, dia int, periodo text, materia text, doc text) on commit drop;\ninsert into _nuevo values\n")
    filas = []
    for nivel, grado, dia, per, mat, doc in clases:
        mat = SALIDA_OPTATIVA_NUEVO if mat == MAT['SO'] else mat
        filas.append(f"('{sq(grado)}', {dia}, '{sq(per)}', '{sq(mat)}', '{doc}')")
    c.append(',\n'.join(filas) + ';\n')

    c.append(f"""
do $$
declare esperadas int; resueltas int;
begin
  select count(*) into esperadas from _nuevo;
  select count(*) into resueltas
  from _nuevo n
  join class_periods p on p.school_id = '{SCHOOL}' and p.name = n.periodo
  join subjects sj on sj.school_id = '{SCHOOL}' and sj.name = n.materia
  join _doc d on d.key = n.doc;
  if esperadas <> resueltas then
    raise exception 'Solo % de % clases resuelven franja/materia/docente. Correr el diagnostico B.', resueltas, esperadas;
  end if;
end $$;

insert into class_schedules (school_id, grade_level, day_of_week, period_id, subject_id, staff_id)
select '{SCHOOL}', n.grade, n.dia, p.id, sj.id, d.staff_id
from _nuevo n
join class_periods p on p.school_id = '{SCHOOL}' and p.name = n.periodo
join subjects sj on sj.school_id = '{SCHOOL}' and sj.name = n.materia
join _doc d on d.key = n.doc
on conflict (school_id, grade_level, day_of_week, period_id) do update
   set subject_id = excluded.subject_id, staff_id = excluded.staff_id, updated_at = now();

-- Resumen: cuantas clases del horario nuevo quedaron, y cuantas del viejo sobran.
select (select count(*) from _nuevo) as clases_nuevas_cargadas,
       (select count(*) from class_schedules cs
         where cs.school_id = '{SCHOOL}'
           and exists (select 1 from class_periods pl where pl.id = cs.period_id and pl.level in ('primaria','secundaria'))
           and not exists (
             select 1 from _nuevo n
             join class_periods p on p.school_id = cs.school_id and p.name = n.periodo
             where n.grade = cs.grade_level and n.dia = cs.day_of_week and p.id = cs.period_id
           )) as clases_viejas_que_sobran;

commit;
""")

    # ---- PARTE 2: Inicial (transaccion aparte, para que un problema aqui no frene lo de arriba)
    c.append(f"""

-- =========================================================================
-- PARTE 2 -- INICIAL (transaccion aparte). Correr DESPUES de la parte 1.
-- Inglés de Nercy y de Yuleimi, y Ed. Fisica de Pre-kinder. Las franjas de Inicial
-- no son las de primaria (arrancan a las 8:00 y el recreo es de 9:05 a 9:45), asi que
-- se crean con level = 'inicial'. Los grados se buscan por su texto REAL en `students`:
-- si no hay EXACTAMENTE un texto distinto por grado, aborta.
-- OJO: Pre-kinder jueves tiene Ed. Fisica 9:10-10:00 e Ingles 9:45-10:30 (se pisan 15 min).
-- =========================================================================
begin;
""")
    for nombre, ini, fin, orden in INI_PERIODOS:
        c.append(f"""insert into class_periods (school_id, name, start_time, end_time, sort_order, level)
select '{SCHOOL}', '{nombre}', '{ini}', '{fin}', {orden}, 'inicial'
where not exists (select 1 from class_periods where school_id='{SCHOOL}' and name='{nombre}');
""")
    c.append(f"""
create temp table _doc_i (key text, staff_id uuid) on commit drop;
insert into _doc_i (key, staff_id)
select k.key, s.id
from (values
    {staff_values(llaves_ini)}
) as k(key, f, l)
join staff s on s.school_id = '{SCHOOL}' and s.deleted_at is null
     and s.first_name ilike k.f and s.last_name ilike k.l;

create temp table _grado_i (cod text, texto text) on commit drop;
""")
    for cod, rx in INI_GRADO_RE.items():
        c.append(f"insert into _grado_i select '{cod}', grade_level from students where school_id='{SCHOOL}' and deleted_at is null and enrollment_status='inscrito' and grade_level ~* '{rx}' group by grade_level;\n")
    c.append("""
do $$
declare malos text;
begin
  select string_agg(cod || ' (' || n || ')', ', ') into malos from (
    select v.cod, count(g.texto) as n
    from (values ('pk'),('k'),('pp')) v(cod) left join _grado_i g on g.cod = v.cod
    group by v.cod having count(g.texto) <> 1) x;
  if malos is not null then
    raise exception 'Grados de Inicial sin texto unico en students (cod, textos distintos): %. Revisar el diagnostico C.', malos;
  end if;
  select string_agg(k, ', ') into malos from (values ('nercy'),('yuleimi'),('jsoriano')) v(k)
   where (select count(*) from _doc_i where key = v.k) <> 1;
  if malos is not null then
    raise exception 'Docentes de Inicial sin ficha unica: %', malos;
  end if;
end $$;

create temp table _nuevo_i (cod text, dia int, periodo text, materia text, doc text) on commit drop;
insert into _nuevo_i values
""")
    c.append(',\n'.join(f"('{g}', {dia}, '{per}', '{MAT[mat]}', '{doc}')" for g, dia, per, mat, doc in INICIAL) + ';\n')
    c.append(f"""
insert into class_schedules (school_id, grade_level, day_of_week, period_id, subject_id, staff_id)
select '{SCHOOL}', g.texto, n.dia, p.id, sj.id, d.staff_id
from _nuevo_i n
join _grado_i g on g.cod = n.cod
join class_periods p on p.school_id = '{SCHOOL}' and p.name = n.periodo
join subjects sj on sj.school_id = '{SCHOOL}' and sj.name = n.materia
join _doc_i d on d.key = n.doc
on conflict (school_id, grade_level, day_of_week, period_id) do update
   set subject_id = excluded.subject_id, staff_id = excluded.staff_id, updated_at = now();

select (select count(*) from _nuevo_i) as clases_inicial_esperadas,
       (select count(*) from class_schedules cs join _grado_i g on g.texto = cs.grade_level
         where cs.school_id = '{SCHOOL}') as clases_inicial_en_base;
commit;

-- =========================================================================
-- PARTE 3 -- Adriana de los Santos Pena: ayudante docente de 1ro Primaria.
-- Solo la asignacion de grado (para que vea a sus estudiantes y ayude a pasar lista).
-- La ficha y el ACCESO se crean en Personal (puesto "Ayudante Docente", con su correo
-- real, y "Dar acceso al sistema"). Si la ficha aun no existe, esto no hace nada.
-- =========================================================================
insert into teacher_assignments (school_id, staff_id, grade_level, category)
select '{SCHOOL}', s.id, '1ro. Primaria', 'regular'
from staff s
where s.school_id = '{SCHOOL}' and s.deleted_at is null
  and s.first_name ilike 'adriana%' and s.last_name ilike '%santos%'
  and not exists (select 1 from teacher_assignments t
                  where t.staff_id = s.id and t.category = 'regular' and t.grade_level = '1ro. Primaria');
""")
    with open(os.path.join(AQUI, '20261027_horarios_actualizados_carga.sql'), 'w', encoding='utf-8') as f:
        f.write(''.join(c))

    print(f'OK: {n_prim} primaria + {n_sec} secundaria = {n_prim + n_sec}; inicial {len(INICIAL)}; docentes {len(todas)}')


if __name__ == '__main__':
    main()
