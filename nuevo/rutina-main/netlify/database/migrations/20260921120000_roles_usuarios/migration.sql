-- Agrega roles a usuarios para poder tener un panel de administración
-- separado de la app de entrenamiento normal.
--
-- rol = 'usuario' (por defecto) ve la app normal.
-- rol = 'admin' ve el panel de administración en su lugar (no tiene
-- rutina propia; si un admin quiere entrenar, crea otra cuenta normal).

ALTER TABLE usuarios
    ADD COLUMN rol TEXT NOT NULL DEFAULT 'usuario'
        CHECK (rol IN ('usuario', 'admin'));

-- Para convertir tu cuenta en administrador, corré esto a mano una vez
-- (reemplazando el correo) y luego volvé a iniciar sesión:
--
--   UPDATE usuarios SET rol = 'admin' WHERE email = 'tu_correo@ejemplo.com';
