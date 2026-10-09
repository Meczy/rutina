-- Notas del entrenador para cada ejercicio de un día: el descanso ("90seg",
-- "Superserie") y las observaciones ("Por pierna", "Banca 30 grados").
-- Vienen del PDF al importar y se pueden editar. Son de la asignación a un
-- día (como series y repeticiones), no del catálogo.
ALTER TABLE ejercicios ADD COLUMN descanso TEXT;
ALTER TABLE ejercicios ADD COLUMN observaciones TEXT;
