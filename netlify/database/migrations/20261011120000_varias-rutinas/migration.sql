-- Varias rutinas por usuario, con una activa.
--
-- Hasta ahora cada usuario trabajaba sobre una sola rutina. A partir de acá
-- puede tener varias (propias, importadas o compartidas) y elegir con cuál
-- entrenar; la elegida queda guardada hasta que la cambie.
ALTER TABLE rutina_usuarios ADD COLUMN activa BOOLEAN NOT NULL DEFAULT false;

-- La rutina que cada usuario venía usando (la de menor id, igual que hasta
-- ahora) pasa a ser la activa.
UPDATE rutina_usuarios ru
SET activa = true
FROM (SELECT usuario_id, MIN(rutina_id) AS rutina_id FROM rutina_usuarios GROUP BY usuario_id) primera
WHERE ru.usuario_id = primera.usuario_id AND ru.rutina_id = primera.rutina_id;

-- Como mucho una rutina activa por usuario.
CREATE UNIQUE INDEX idx_rutina_usuarios_una_activa ON rutina_usuarios (usuario_id) WHERE activa;
