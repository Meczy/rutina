-- Marcas de "hecho" de cada ejercicio, por usuario y por semana (la fecha
-- del lunes). Antes vivían en el localStorage de cada navegador; ahora se
-- ven igual en todos los dispositivos. El "reinicio" de cada lunes se da
-- solo porque la app consulta únicamente la semana actual: las semanas
-- anteriores quedan guardadas como historial.
CREATE TABLE marcas_semana (
    usuario_id BIGINT NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    ejercicio_id BIGINT NOT NULL REFERENCES ejercicios(id) ON DELETE CASCADE,
    semana DATE NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (usuario_id, semana, ejercicio_id)
);

CREATE INDEX idx_marcas_semana_ejercicio ON marcas_semana(ejercicio_id);
