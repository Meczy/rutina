-- Write your migration SQL here
--
-- Example:
--   CREATE TABLE IF NOT EXISTS users (
--     id SERIAL PRIMARY KEY,
--     name TEXT NOT NULL,
--     created_at TIMESTAMP DEFAULT NOW()
--   );
CREATE TABLE dias (
    id BIGSERIAL PRIMARY KEY,
    numero INTEGER NOT NULL,
    nombre TEXT NOT NULL,
    orden INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE ejercicios (
    id BIGSERIAL PRIMARY KEY,
    dia_id BIGINT NOT NULL REFERENCES dias(id) ON DELETE CASCADE,
    nombre TEXT NOT NULL,
    series TEXT,
    repeticiones TEXT,
    video_url TEXT,
    orden INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_ejercicios_dia
    ON ejercicios(dia_id);

CREATE INDEX idx_ejercicios_orden
    ON ejercicios(dia_id, orden);