-- Cuatro paletas nuevas en Mi cuenta → Apariencia: lavanda, coral, malva
-- (más femeninas) y carbón (masculina). Se amplía la lista de valores
-- permitidos de usuarios.tema.
ALTER TABLE usuarios DROP CONSTRAINT usuarios_tema_check;
ALTER TABLE usuarios ADD CONSTRAINT usuarios_tema_check
    CHECK (tema IN ('rosa', 'indigo', 'petroleo', 'grafito', 'lavanda', 'coral', 'malva', 'carbon'));
