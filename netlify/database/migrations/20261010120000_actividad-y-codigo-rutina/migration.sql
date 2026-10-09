-- Actividad de usuarios y rutinas compartidas por código.

-- Última vez que el usuario abrió la app (se actualiza al cargar la rutina,
-- como mucho cada 5 minutos). Se inicializa con su sesión más reciente.
ALTER TABLE usuarios ADD COLUMN ultimo_uso TIMESTAMPTZ;

UPDATE usuarios u
SET ultimo_uso = s.ultima
FROM (SELECT usuario_id, MAX(created_at) AS ultima FROM sesiones GROUP BY usuario_id) s
WHERE s.usuario_id = u.id;

-- Código para que otra persona se una a la rutina desde la app (sin pasar
-- por el admin). Se genera la primera vez que alguien lo pide y se puede
-- regenerar para que el anterior deje de servir.
ALTER TABLE rutinas ADD COLUMN codigo TEXT UNIQUE;
