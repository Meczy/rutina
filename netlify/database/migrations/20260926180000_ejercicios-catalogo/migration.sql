-- ⚠️ HACER UN BACKUP DE LA BASE DE DATOS ANTES DE CORRER ESTO. ⚠️
-- Esta migración reestructura ejercicios y pesos: borra columnas y
-- reasigna a qué fila apuntan los pesos históricos. No es reversible
-- sin un backup.
--
-- Problema que resuelve: hoy "ejercicios" mezcla dos cosas distintas:
-- el ejercicio en sí (nombre, imagen, video) y su aparición en un día
-- puntual (series, repeticiones, orden). Si el mismo ejercicio aparece
-- en dos días, son dos filas con distinto id, y los pesos (que se
-- guardan contra ese id) quedan separados aunque sea "el mismo"
-- ejercicio.
--
-- Esta migración separa eso en dos tablas:
--   - ejercicios_catalogo: el ejercicio en sí (nombre/imagen/video),
--     uno por rutina. Se mantiene independiente de los días.
--   - ejercicios: pasa a ser solo la asignación día -> ejercicio del
--     catálogo, con las series/repeticiones/orden propias de ese día.
--
-- Los pesos (pesos.catalogo_id) pasan a apuntar al catálogo en vez de
-- a la asignación del día, así que el historial de peso de un
-- ejercicio es uno solo sin importar en cuántos días aparezca. Como
-- efecto secundario esto también corrige que antes, al borrar un
-- ejercicio de un día, se perdía su historial de pesos (por el
-- ON DELETE CASCADE contra la fila de "ejercicios"); ahora borrar la
-- asignación de un día no toca el catálogo ni los pesos.

-- 1) Catálogo de ejercicios, uno por rutina.
CREATE TABLE ejercicios_catalogo (
    id BIGSERIAL PRIMARY KEY,
    rutina_id BIGINT NOT NULL REFERENCES rutinas(id) ON DELETE CASCADE,
    nombre TEXT NOT NULL,
    video_url TEXT,
    image_url TEXT,
    wger_id INTEGER,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_catalogo_rutina ON ejercicios_catalogo(rutina_id);

-- 2) Poblar el catálogo con un registro por cada (rutina, nombre)
--    distinto que ya existe hoy repartido en "ejercicios". Si el mismo
--    nombre aparece varias veces con distinta imagen/video, se prioriza
--    la fila que sí tenga imagen, luego la que tenga video, y por
--    último la más antigua.
INSERT INTO ejercicios_catalogo (rutina_id, nombre, video_url, image_url, wger_id)
SELECT DISTINCT ON (d.rutina_id, TRIM(e.nombre))
    d.rutina_id,
    TRIM(e.nombre),
    e.video_url,
    e.image_url,
    e.wger_id
FROM ejercicios e
JOIN dias d ON d.id = e.dia_id
ORDER BY d.rutina_id, TRIM(e.nombre), (e.image_url IS NULL) ASC, (e.video_url IS NULL) ASC, e.id ASC;

-- 3) Vincular cada asignación día/ejercicio a su fila del catálogo.
ALTER TABLE ejercicios ADD COLUMN catalogo_id BIGINT REFERENCES ejercicios_catalogo(id) ON DELETE CASCADE;

UPDATE ejercicios e
SET catalogo_id = c.id
FROM dias d
JOIN ejercicios_catalogo c ON c.rutina_id = d.rutina_id
WHERE e.dia_id = d.id
  AND c.nombre = TRIM(e.nombre);

ALTER TABLE ejercicios ALTER COLUMN catalogo_id SET NOT NULL;
CREATE INDEX idx_ejercicios_catalogo ON ejercicios(catalogo_id);

-- 4) Remapear los pesos: pasan de apuntar a la asignación del día
--    (ejercicios.id) a apuntar al catálogo (ejercicios_catalogo.id).
ALTER TABLE pesos ADD COLUMN catalogo_id BIGINT REFERENCES ejercicios_catalogo(id) ON DELETE CASCADE;

UPDATE pesos p
SET catalogo_id = e.catalogo_id
FROM ejercicios e
WHERE p.ejercicio_id = e.id;

-- Por si quedara algún peso huérfano (no debería, pesos tiene
-- ON DELETE CASCADE contra ejercicios), lo eliminamos en vez de dejar
-- la columna nueva en null.
DELETE FROM pesos WHERE catalogo_id IS NULL;

-- Como ahora varias filas de "ejercicios" (una por día) pueden mapear
-- al mismo catalogo_id, puede haber quedado más de un peso para el
-- mismo catalogo_id + persona + fecha (uno registrado desde cada día
-- donde aparecía). Nos quedamos con el más reciente.
DELETE FROM pesos a
USING pesos b
WHERE a.catalogo_id = b.catalogo_id
  AND a.persona = b.persona
  AND a.fecha = b.fecha
  AND (a.created_at, a.id) < (b.created_at, b.id);

ALTER TABLE pesos ALTER COLUMN catalogo_id SET NOT NULL;

ALTER TABLE pesos DROP CONSTRAINT pesos_ejercicio_persona_fecha_unique;
ALTER TABLE pesos ADD CONSTRAINT pesos_catalogo_persona_fecha_unique UNIQUE (catalogo_id, persona, fecha);

DROP INDEX IF EXISTS idx_pesos_ejercicio;
DROP INDEX IF EXISTS idx_pesos_ejercicio_persona;
CREATE INDEX idx_pesos_catalogo ON pesos(catalogo_id);
CREATE INDEX idx_pesos_catalogo_persona ON pesos(catalogo_id, persona);

ALTER TABLE pesos DROP COLUMN ejercicio_id;

-- 5) Los datos descriptivos del ejercicio ahora viven solo en el
--    catálogo; se limpian de la tabla de asignaciones día/ejercicio.
DROP INDEX IF EXISTS idx_ejercicios_wger_id;
ALTER TABLE ejercicios DROP COLUMN nombre;
ALTER TABLE ejercicios DROP COLUMN video_url;
ALTER TABLE ejercicios DROP COLUMN image_url;
ALTER TABLE ejercicios DROP COLUMN wger_id;
