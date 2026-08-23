# Seeds — carga de datos puntuales

A diferencia de `supabase/migrations/`, lo que vive aquí **no** son cambios de
esquema y **no** se aplica solo con `supabase db push`. Son cargas de datos de
un colegio concreto, que se corren a mano una vez.

Por eso no van como migración: una migración se aplica a todos los entornos, y
estos datos son del colegio piloto (Gran Manantial de Sabiduría) únicamente.

## `20260823_horarios_2026_2027.sql`

Carga los horarios 2026-2027 completos: 330 clases de los 12 grados
(1ro-6to de primaria y de secundaria). Generado con
`generar_horarios_2026_2027.py` a partir del Excel corregido que cruzó los tres
documentos de horario del colegio.

Qué hace, en orden (todo dentro de una transacción):

1. **Crea a Orlando Antoine Natera** en `staff` — docente de Inglés de 1er ciclo
   de secundaria (área de Inglés/Amco). No existía en la base, pero da 15
   sesiones semanales.
2. **Puebla `subjects`** con 14 materias canónicas. La tabla estaba vacía, y los
   documentos traían variantes del mismo nombre ("Inglés"/"Ingles",
   "Naturales"/"Ciencias Naturales", "Artística"/"Educación Artística") que
   habrían quedado como materias duplicadas.
3. **Marca como `primaria`** las 7 franjas que ya existían en `class_periods`
   (se comprobó que son las de primaria: coinciden exactamente con las horas del
   documento de ese nivel).
4. **Crea las 7 franjas de secundaria**, que no existían — el colegio usa dos
   rejillas horarias distintas a la vez (ver migración
   `20260823000000_class_periods_level.sql`).
5. **Normaliza `grade_level`** en `students` y `teacher_assignments`. Es el campo
   por el que la política RLS une el horario con cada familia, así que una
   variante de texto (`"6to Secundaria"` sin punto) deja a esa familia sin ver su
   horario. Se corrigen 4 variantes.
6. **Inserta las 330 clases** en `class_schedules`.

Es reejecutable sin riesgo: todo usa `where not exists` / `on conflict`, así que
correrlo dos veces no duplica nada.

### Dos criterios que conviene conocer

- **La franja de Inglés de 1ro (viernes 7:30-8:20)** aparecía en el horario de
  los dos profesores de Inglés a la vez. Se resolvió a favor de **Orlando
  Natera** por la estructura del área de Inglés: 1er ciclo de secundaria
  (1ro, 2do, 3ro) es suyo, y Yendry Paulino cubre 2do ciclo (4to-6to) — lo que
  además es coherente con el resto de sus asignaciones en el propio documento.
- **6to de Primaria queda sin docente titular** (19 clases con `staff_id` nulo):
  el documento de origen trae ese campo en blanco. Falta que Dirección Académica
  diga quién es; se puede asignar después desde `/dashboard/horarios` sin volver
  a correr este script.
