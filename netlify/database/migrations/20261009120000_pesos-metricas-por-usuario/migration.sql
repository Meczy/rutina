-- Pesos y métricas pasan a identificarse por usuario_id en vez de por el
-- nombre de texto "persona". Antes, si alguien cambiaba su nombre su
-- historial quedaba partido en dos, y dos personas con el mismo nombre que
-- compartieran rutina se pisaban los registros del mismo día.
--
-- "persona" se conserva como dato informativo, pero ya no forma parte de
-- ninguna restricción.

-- 1. Los registros cargados antes de que existieran las cuentas no tienen
--    usuario_id: se les asigna la cuenta cuyo nombre coincide (solo si
--    coincide con exactamente una).
UPDATE pesos p
SET usuario_id = u.id
FROM usuarios u
WHERE p.usuario_id IS NULL
  AND lower(u.nombre) = lower(p.persona)
  AND (SELECT COUNT(*) FROM usuarios u2 WHERE lower(u2.nombre) = lower(p.persona)) = 1;

UPDATE metricas_corporales m
SET usuario_id = u.id
FROM usuarios u
WHERE m.usuario_id IS NULL
  AND lower(u.nombre) = lower(m.persona)
  AND (SELECT COUNT(*) FROM usuarios u2 WHERE lower(u2.nombre) = lower(m.persona)) = 1;

-- Si quedó alguno sin poder asignar, se frena la migración en vez de
-- borrar historial: hay que asignarlo a mano y volver a correrla.
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pesos WHERE usuario_id IS NULL)
       OR EXISTS (SELECT 1 FROM metricas_corporales WHERE usuario_id IS NULL) THEN
        RAISE EXCEPTION 'Hay pesos o métricas sin usuario_id que no se pudieron asignar por nombre.';
    END IF;
END $$;

-- 2. Por las dudas, si dos registros del mismo usuario chocan en el mismo
--    ejercicio/día (o día, en métricas), se conserva el más reciente.
DELETE FROM pesos a
USING pesos b
WHERE a.usuario_id = b.usuario_id
  AND a.catalogo_id = b.catalogo_id
  AND a.fecha = b.fecha
  AND (a.created_at, a.id) < (b.created_at, b.id);

DELETE FROM metricas_corporales a
USING metricas_corporales b
WHERE a.usuario_id = b.usuario_id
  AND a.fecha = b.fecha
  AND (a.created_at, a.id) < (b.created_at, b.id);

-- 3. Restricciones nuevas por usuario.
ALTER TABLE pesos ALTER COLUMN usuario_id SET NOT NULL;
ALTER TABLE pesos DROP CONSTRAINT pesos_catalogo_persona_fecha_unique;
ALTER TABLE pesos
    ADD CONSTRAINT pesos_catalogo_usuario_fecha_unique UNIQUE (catalogo_id, usuario_id, fecha);
DROP INDEX IF EXISTS idx_pesos_catalogo_persona;

ALTER TABLE metricas_corporales ALTER COLUMN usuario_id SET NOT NULL;
ALTER TABLE metricas_corporales DROP CONSTRAINT metricas_corporales_persona_fecha_key;
ALTER TABLE metricas_corporales
    ADD CONSTRAINT metricas_corporales_usuario_fecha_unique UNIQUE (usuario_id, fecha);
DROP INDEX IF EXISTS idx_metricas_persona;
