-- Sistema de usuarios y rutinas propias por usuario.
--
-- Una "rutina" es el contenedor de dias/ejercicios. Antes había una sola
-- rutina implícita (global). Ahora cada usuario nuevo arranca con su propia
-- rutina en blanco, y una rutina puede tener varios usuarios (para poder
-- compartirla, como en el caso de los 2 usuarios actuales).

CREATE TABLE usuarios (
    id BIGSERIAL PRIMARY KEY,
    email TEXT NOT NULL UNIQUE,
    nombre TEXT NOT NULL,
    password_hash TEXT,
    google_id TEXT UNIQUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE rutinas (
    id BIGSERIAL PRIMARY KEY,
    nombre TEXT NOT NULL DEFAULT 'Mi rutina',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE rutina_usuarios (
    rutina_id BIGINT NOT NULL REFERENCES rutinas(id) ON DELETE CASCADE,
    usuario_id BIGINT NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    PRIMARY KEY (rutina_id, usuario_id)
);

CREATE TABLE sesiones (
    id TEXT PRIMARY KEY,
    usuario_id BIGINT NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX idx_sesiones_usuario ON sesiones(usuario_id);
CREATE INDEX idx_sesiones_expires ON sesiones(expires_at);

-- Vincula cada día existente a UNA rutina compartida (la rutina histórica),
-- y crea las 2 cuentas "semilla" para los usuarios actuales, ya unidas a
-- esa rutina compartida. Cuando Meczy o María inicien sesión por primera
-- vez (con Google o eligiendo "registrarme" con su mismo correo), su
-- cuenta ya va a estar conectada a la rutina que ya existe.

INSERT INTO rutinas (nombre) VALUES ('Rutina compartida') RETURNING id;

ALTER TABLE dias ADD COLUMN rutina_id BIGINT REFERENCES rutinas(id) ON DELETE CASCADE;

UPDATE dias SET rutina_id = (SELECT id FROM rutinas ORDER BY id LIMIT 1);

ALTER TABLE dias ALTER COLUMN rutina_id SET NOT NULL;

CREATE INDEX idx_dias_rutina ON dias(rutina_id);

INSERT INTO usuarios (email, nombre) VALUES
    ('meczy.gon@gmail.com', 'Meczy'),
    ('mariaisabeltobar10@gmail.com', 'María');

INSERT INTO rutina_usuarios (rutina_id, usuario_id)
SELECT (SELECT id FROM rutinas ORDER BY id LIMIT 1), id FROM usuarios
WHERE email IN ('meczy.gon@gmail.com', 'mariaisabeltobar10@gmail.com');

-- pesos y metricas_corporales seguían un "persona" de texto libre. Se
-- agrega usuario_id para asociarlos a la cuenta real; el texto libre
-- "persona" se conserva para no perder el historial ya cargado (que no
-- podemos re-mapear a una cuenta con certeza).

ALTER TABLE pesos ADD COLUMN usuario_id BIGINT REFERENCES usuarios(id) ON DELETE CASCADE;
CREATE INDEX idx_pesos_usuario ON pesos(usuario_id);

ALTER TABLE metricas_corporales ADD COLUMN usuario_id BIGINT REFERENCES usuarios(id) ON DELETE CASCADE;
CREATE INDEX idx_metricas_usuario ON metricas_corporales(usuario_id);
