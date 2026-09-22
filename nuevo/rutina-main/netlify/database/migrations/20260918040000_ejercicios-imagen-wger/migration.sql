-- Permite vincular cada ejercicio con la librería pública de wger.de:
-- guardamos la imagen elegida y el ID del ejercicio en wger, para poder
-- "normalizar" los ejercicios propios contra ese catálogo.
ALTER TABLE ejercicios
    ADD COLUMN image_url TEXT,
    ADD COLUMN wger_id INTEGER;

CREATE INDEX idx_ejercicios_wger_id ON ejercicios(wger_id);
