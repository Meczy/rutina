-- Antes de aplicar la restricción, eliminamos posibles duplicados existentes
-- dejando solo el registro más reciente de cada ejercicio/persona/día.
DELETE FROM pesos a
USING pesos b
WHERE a.ejercicio_id = b.ejercicio_id
  AND a.persona = b.persona
  AND a.fecha = b.fecha
  AND a.created_at < b.created_at;

-- A partir de ahora, solo puede existir un peso por ejercicio, persona y día.
-- Si se vuelve a registrar un peso el mismo día, se actualiza en vez de duplicarse.
ALTER TABLE pesos
    ADD CONSTRAINT pesos_ejercicio_persona_fecha_unique
    UNIQUE (ejercicio_id, persona, fecha);
