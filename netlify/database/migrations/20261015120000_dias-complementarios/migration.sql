-- Días complementarios (por ejemplo, Abdomen): siguen en la rutina con su
-- pestaña, pero no cuentan como día de entrenamiento: no suman en "Días
-- completados", el calendario ni la racha, y nunca son "el día que toca".
ALTER TABLE dias ADD COLUMN complementario BOOLEAN NOT NULL DEFAULT false;
