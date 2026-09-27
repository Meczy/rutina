-- Evita ejercicios duplicados en el catálogo: agrega una restricción a
-- nivel de base de datos (sin distinguir mayúsculas/minúsculas) además de
-- la validación que ya hace la API al crear o renombrar un ejercicio.
--
-- Antes de agregar la restricción, por las dudas, fusiona cualquier
-- duplicado que ya exista por diferencias de mayúsculas/minúsculas (la
-- migración anterior agrupó por nombre exacto, no por nombre sin
-- mayúsculas). Se conserva el registro más antiguo de cada grupo y se
-- reasignan sus asignaciones a días y su historial de peso.

DO $$
DECLARE
    grupo RECORD;
    sobreviviente BIGINT;
BEGIN
    FOR grupo IN
        SELECT rutina_id, lower(nombre) AS nombre_normalizado
        FROM ejercicios_catalogo
        GROUP BY rutina_id, lower(nombre)
        HAVING COUNT(*) > 1
    LOOP
        SELECT id INTO sobreviviente
        FROM ejercicios_catalogo
        WHERE rutina_id = grupo.rutina_id AND lower(nombre) = grupo.nombre_normalizado
        ORDER BY id
        LIMIT 1;

        UPDATE ejercicios
        SET catalogo_id = sobreviviente
        WHERE catalogo_id IN (
            SELECT id FROM ejercicios_catalogo
            WHERE rutina_id = grupo.rutina_id AND lower(nombre) = grupo.nombre_normalizado AND id <> sobreviviente
        );

        -- Si el peso de un ejercicio "duplicado" choca con uno que ya tenía
        -- el sobreviviente para la misma persona y fecha, nos quedamos con
        -- el más reciente antes de repointearlo (para no violar el UNIQUE).
        DELETE FROM pesos a
        USING pesos b
        WHERE a.catalogo_id IN (
                SELECT id FROM ejercicios_catalogo
                WHERE rutina_id = grupo.rutina_id AND lower(nombre) = grupo.nombre_normalizado AND id <> sobreviviente
              )
          AND b.catalogo_id = sobreviviente
          AND a.persona = b.persona
          AND a.fecha = b.fecha
          AND (a.created_at, a.id) < (b.created_at, b.id);

        DELETE FROM pesos a
        USING pesos b
        WHERE a.catalogo_id = sobreviviente
          AND b.catalogo_id IN (
                SELECT id FROM ejercicios_catalogo
                WHERE rutina_id = grupo.rutina_id AND lower(nombre) = grupo.nombre_normalizado AND id <> sobreviviente
              )
          AND a.persona = b.persona
          AND a.fecha = b.fecha
          AND (a.created_at, a.id) < (b.created_at, b.id);

        UPDATE pesos
        SET catalogo_id = sobreviviente
        WHERE catalogo_id IN (
            SELECT id FROM ejercicios_catalogo
            WHERE rutina_id = grupo.rutina_id AND lower(nombre) = grupo.nombre_normalizado AND id <> sobreviviente
        );

        DELETE FROM ejercicios_catalogo
        WHERE rutina_id = grupo.rutina_id AND lower(nombre) = grupo.nombre_normalizado AND id <> sobreviviente;
    END LOOP;
END $$;

CREATE UNIQUE INDEX idx_catalogo_rutina_nombre_unico ON ejercicios_catalogo (rutina_id, lower(nombre));
