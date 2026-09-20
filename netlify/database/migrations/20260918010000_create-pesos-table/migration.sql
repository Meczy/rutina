-- Registro histórico de peso levantado por persona, por ejercicio y por fecha.
CREATE TABLE pesos (
    id BIGSERIAL PRIMARY KEY,
    ejercicio_id BIGINT NOT NULL REFERENCES ejercicios(id) ON DELETE CASCADE,
    persona TEXT NOT NULL,
    peso NUMERIC(6,2) NOT NULL,
    fecha DATE NOT NULL DEFAULT CURRENT_DATE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_pesos_ejercicio
    ON pesos(ejercicio_id);

CREATE INDEX idx_pesos_ejercicio_persona
    ON pesos(ejercicio_id, persona);
