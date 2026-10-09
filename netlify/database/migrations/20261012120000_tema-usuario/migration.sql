-- Paleta de colores elegida por cada usuario (Mi cuenta → Apariencia).
-- NULL = la paleta por defecto. Se guarda en la cuenta para verla igual en
-- todos los dispositivos.
ALTER TABLE usuarios
    ADD COLUMN tema TEXT
        CHECK (tema IN ('rosa', 'indigo', 'petroleo', 'grafito'));
