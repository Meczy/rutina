-- Write your migration SQL here
--
-- Example:
--   CREATE TABLE IF NOT EXISTS users (
--     id SERIAL PRIMARY KEY,
--     name TEXT NOT NULL,
--     created_at TIMESTAMP DEFAULT NOW()
--   );
INSERT INTO dias (numero, nombre, orden)
VALUES
    (1, 'Pierna (cuádriceps), bíceps y espalda', 1),
    (2, 'Pierna (femoral), pecho y tríceps', 2),
    (3, 'Glúteo, Pierna (abductores) y hombro', 3),
    (4, 'Pierna (cuádriceps) y pierna femoral', 4),
    (5, 'Glúteo, Pierna (abductores)', 5);
	
INSERT INTO ejercicios
(dia_id, nombre, series, repeticiones, video_url, orden)
SELECT
    d.id,
    x.nombre,
    x.series,
    x.repeticiones,
    x.video_url,
    x.orden
FROM dias d
JOIN (
    VALUES
    (1, 'Extensión de Rodilla en máquina', '3', '10',
     'https://www.youtube.com/shorts/PzIfB9MiiX8', 1),

    (1, 'Sentadilla goblet con elevacion', '3', '10',
     'https://www.youtube.com/watch?v=RUXLuZ_GLrE', 2),

    (1, 'Press Pierna Inclinado', '3', '10',
     'https://www.youtube.com/shorts/NY5fw4Zaofg', 3),

    (1, 'Jalón cerrado supino', '3', '10',
     'https://www.youtube.com/shorts/E-ftSvmzRME', 4),

    (1, 'Remo Hammer con agarre neutro', '3', '10',
     'https://www.youtube.com/shorts/oeGnGldKrWs', 5),

    (1, 'Remo con pecho apoyado', '', '',
     'https://youtube.com/shorts/JLvoftF6t_M', 6),

    (1, 'Curl martillo con mancuernas', '3', '10',
     'https://www.youtube.com/shorts/hV4NpBjDHp8', 7),

    (1, 'Curl Predicador', '3', '10',
     'https://www.youtube.com/shorts/dc330H9yN3Y', 8)
) AS x(dia_numero,nombre,series,repeticiones,video_url,orden)
ON d.numero = x.dia_numero;


INSERT INTO ejercicios
(dia_id, nombre, series, repeticiones, video_url, orden)
SELECT
    d.id,
    x.nombre,
    x.series,
    x.repeticiones,
    x.video_url,
    x.orden
FROM dias d
JOIN (
    VALUES
    (2, 'Peso Muerto Rumano (con mancuernas)', '3', '10',
     'https://www.youtube.com/shorts/pQQrNsuCSug', 1),

    (2, 'Flexion Rodilla Maquina Sentado', '3', '10',
     'https://www.youtube.com/shorts/T46yKiz8laY', 2),

    (2, 'Good Morning Super Squat', '3', '10',
     'https://www.youtube.com/shorts/s0vCmIQpOOo?feature=share', 3),

    (2, 'Pec Deck', '3', '10',
     'https://youtube.com/shorts/rOrr4kSwQpE?si=ATXzgYugIUgQSJkM', 4),

    (2, 'Press inclinado', '3', '10',
     'https://youtube.com/shorts/a64mtMHyPfY?si=tnaJstywoqNj4WNA', 5),

    (2, 'Polea con cuerda', '3', '10',
     'https://youtube.com/shorts/fyY-ubX23j8?si=DJ3B7k-THZQ-nvSP', 6),

    (2, 'Extensión de tríceps por encima de la cabeza con mancuerna', '3', '10',
     'https://youtube.com/shorts/nGZR230Tvvo?si=KhTxnPJx_JGlM_i2', 7)

) AS x(dia_numero,nombre,series,repeticiones,video_url,orden)
ON d.numero = x.dia_numero;

INSERT INTO ejercicios
(dia_id, nombre, series, repeticiones, video_url, orden)
SELECT
    d.id,
    x.nombre,
    x.series,
    x.repeticiones,
    x.video_url,
    x.orden
FROM dias d
JOIN (
    VALUES
    (3, 'Hip thrust en máquina', '3', '10',
     'https://youtube.com/shorts/m8g9VogoxMo?si=u-Gw_9oqyI-iDGe5', 1),

    (3, 'Sentadilla con barra', '3', '10',
     'https://youtube.com/shorts/7xeLHxobaWs?si=F8xNtmjBCI8KE0cM', 2),

    (3, 'Patada de glúteo en polea', '3', '10',
     'https://youtube.com/shorts/GvgL2NbOaKE?si=Ehwt-obl4R4Dyp2i', 3),

    (3, 'Sentadilla sumo con mancuerna', '3', '10',
     'https://youtube.com/shorts/4YFyCNBwBwc?si=7mOCh2dv8s4h0Dum', 4),

    (3, 'Aducción de cadera en maquina', '', '',
     'https://youtube.com/shorts/vlViIgtkvh4?si=5e3gXGCbjzzmWid7', 5),

    (3, 'Abducción de cadera en máquina', '3', '10',
     'https://youtu.be/gMu2tYMi4-c?si=MfKPtCEfmxubgGy9', 6),

    (3, 'Elevaciones frontales con mancuernas', '3', '10',
     'https://youtube.com/shorts/zuID1WDdAFE?si=t_4LGPiag_Ruiq2R', 7),

    (3, 'Reverse Pec Deck', '3', '10',
     'https://youtube.com/shorts/NG-tstEu6bg?si=BgMuWZWh_laB8p5L', 8)

) AS x(dia_numero,nombre,series,repeticiones,video_url,orden)
ON d.numero = x.dia_numero;

INSERT INTO ejercicios
(dia_id, nombre, series, repeticiones, video_url, orden)
SELECT
    d.id,
    x.nombre,
    x.series,
    x.repeticiones,
    x.video_url,
    x.orden
FROM dias d
JOIN (
    VALUES
    (4, 'Extensión de Rodilla en máquina', '3', '10',
     'https://www.youtube.com/shorts/PzIfB9MiiX8', 1),

    (4, 'Sentadilla goblet con elevacion', '3', '10',
     'https://www.youtube.com/watch?v=RUXLuZ_GLrE', 2),

    (4, 'Press Pierna Inclinado', '3', '10',
     'https://www.youtube.com/shorts/NY5fw4Zaofg', 3),

    (4, 'Flexion Rodilla Maquina Sentado', '3', '10',
     'https://www.youtube.com/shorts/T46yKiz8laY', 4),

    (4, 'Good Morning Super Squat', '3', '10',
     'https://www.youtube.com/shorts/s0vCmIQpOOo?feature=share', 5),

    (4, 'Peso Muerto Rumano (con mancuernas)', '3', '10',
     'https://www.youtube.com/shorts/pQQrNsuCSug', 6)

) AS x(dia_numero,nombre,series,repeticiones,video_url,orden)
ON d.numero = x.dia_numero;


INSERT INTO ejercicios
(dia_id, nombre, series, repeticiones, video_url, orden)
SELECT
    d.id,
    x.nombre,
    x.series,
    x.repeticiones,
    x.video_url,
    x.orden
FROM dias d
JOIN (
    VALUES
    (5, 'Hip thrust en máquina', '3', '10',
     'https://youtube.com/shorts/m8g9VogoxMo?si=u-Gw_9oqyI-iDGe5', 1),

    (5, 'Sentadilla con barra', '3', '10',
     'https://youtube.com/shorts/7xeLHxobaWs?si=F8xNtmjBCI8KE0cM', 2),

    (5, 'Patada de glúteo en polea', '3', '10',
     'https://youtube.com/shorts/GvgL2NbOaKE?si=Ehwt-obl4R4Dyp2i', 3),

    (5, 'Sentadilla sumo con mancuerna', '3', '10',
     'https://youtube.com/shorts/4YFyCNBwBwc?si=7mOCh2dv8s4h0Dum', 4),

    (5, 'Aducción de cadera en maquina', '', '',
     'https://youtube.com/shorts/vlViIgtkvh4?si=5e3gXGCbjzzmWid7', 5),

    (5, 'Abducción de cadera en máquina', '3', '10',
     'https://youtube.com/shorts/HJLzMM_naPg?si=cR3V5bqph5fhuoy4', 6)

) AS x(dia_numero,nombre,series,repeticiones,video_url,orden)
ON d.numero = x.dia_numero;