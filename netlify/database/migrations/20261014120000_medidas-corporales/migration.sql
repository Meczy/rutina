-- Medidas corporales en Mi progreso (en cm), cada una con su propio gráfico.
-- El peso pasa a ser opcional: un registro puede tener solo medidas. La API
-- exige que haya al menos un dato.
ALTER TABLE metricas_corporales ALTER COLUMN peso DROP NOT NULL;

ALTER TABLE metricas_corporales ADD COLUMN cintura NUMERIC(5,1);
ALTER TABLE metricas_corporales ADD COLUMN cadera NUMERIC(5,1);
ALTER TABLE metricas_corporales ADD COLUMN pecho NUMERIC(5,1);
ALTER TABLE metricas_corporales ADD COLUMN brazo NUMERIC(5,1);
ALTER TABLE metricas_corporales ADD COLUMN muslo NUMERIC(5,1);
