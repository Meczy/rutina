// Crea una cuenta de administrador directamente en la base de datos,
// sin pasar por el navegador. El admin NO recibe una rutina propia.
//
// Uso:
//   node scripts/crear-admin.mjs correo@ejemplo.com "Nombre" "contraseña"
//
// Requiere que exista NETLIFY_DATABASE_URL en el .env de la carpeta
// donde se ejecuta (o como variable de entorno).

import "dotenv/config";
import { Pool } from "pg";
import { hashPassword, emailValido } from "../auth.mjs";

const [, , emailArg, nombreArg, passwordArg] = process.argv;

if (!emailArg || !nombreArg || !passwordArg) {
  console.error("Uso: node scripts/crear-admin.mjs correo@ejemplo.com \"Nombre\" \"contraseña\"");
  process.exit(1);
}

const email = emailArg.trim().toLowerCase();
const nombre = nombreArg.trim().slice(0, 60);
const password = passwordArg;

if (!emailValido(email)) {
  console.error("Ese correo no es válido.");
  process.exit(1);
}
if (password.length < 6) {
  console.error("La contraseña debe tener al menos 6 caracteres.");
  process.exit(1);
}
if (!nombre) {
  console.error("Falta el nombre.");
  process.exit(1);
}

if (!process.env.NETLIFY_DATABASE_URL) {
  console.error("No encontré NETLIFY_DATABASE_URL. Corré este script desde la carpeta del proyecto, con su .env.");
  process.exit(1);
}

const pool = new Pool({ connectionString: process.env.NETLIFY_DATABASE_URL });

try {
  const existente = await pool.query("SELECT id, rol FROM usuarios WHERE email = $1", [email]);

  if (existente.rows.length) {
    console.error(
      `Ya existe una cuenta con ese correo (id ${existente.rows[0].id}, rol "${existente.rows[0].rol}"). ` +
        `Usá un correo distinto, o cambiá su rol desde el panel de administración.`
    );
    process.exit(1);
  }

  const passwordHash = hashPassword(password);
  const resultado = await pool.query(
    `INSERT INTO usuarios (email, nombre, password_hash, rol) VALUES ($1, $2, $3, 'admin') RETURNING id`,
    [email, nombre, passwordHash]
  );

  console.log(`Listo. Cuenta admin creada con id ${resultado.rows[0].id} para ${email}.`);
  console.log("Ya podés iniciar sesión con ese correo y contraseña; te va a llevar directo al panel de administración.");
} finally {
  await pool.end();
}
