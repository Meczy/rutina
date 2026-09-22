-- Registro de progreso corporal (peso, % grasa, % agua) por persona y por día.
-- Igual que "pesos", solo puede existir un registro por persona y día:
-- si se vuelve a guardar el mismo día, se actualiza en vez de duplicarse.
CREATE TABLE metricas_corporales (
    id BIGSERIAL PRIMARY KEY,
    persona TEXT NOT NULL,
    fecha DATE NOT NULL DEFAULT CURRENT_DATE,
    peso NUMERIC(6,2) NOT NULL,
    grasa NUMERIC(5,2),
    agua NUMERIC(5,2),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (persona, fecha)
);

CREATE INDEX idx_metricas_persona
    ON metricas_corporales(persona, fecha DESC);
