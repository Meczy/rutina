import crypto from "node:crypto";

const SESSION_COOKIE = "rutina_session";
const SESSION_DIAS_DURACION = 30;

// ---------- Contraseñas ----------
// Usamos scrypt (nativo de Node, sin dependencias externas) en vez de bcrypt.

export function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(String(password), salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

export function verifyPassword(password, stored) {
  if (!stored || !stored.includes(":")) return false;
  const [salt, hash] = stored.split(":");
  const hashIntentado = crypto.scryptSync(String(password), salt, 64).toString("hex");
  const bufferAlmacenado = Buffer.from(hash, "hex");
  const bufferIntentado = Buffer.from(hashIntentado, "hex");
  if (bufferAlmacenado.length !== bufferIntentado.length) return false;
  return crypto.timingSafeEqual(bufferAlmacenado, bufferIntentado);
}

// ---------- Cookies ----------

export function parseCookies(cookieHeader) {
  const cookies = {};
  if (!cookieHeader) return cookies;
  cookieHeader.split(";").forEach((parte) => {
    const idx = parte.indexOf("=");
    if (idx === -1) return;
    const nombre = parte.slice(0, idx).trim();
    const valor = parte.slice(idx + 1).trim();
    if (nombre) cookies[nombre] = decodeURIComponent(valor);
  });
  return cookies;
}

export function crearCookieSesion(token, maxAgeSegundos) {
  const partes = [
    `${SESSION_COOKIE}=${encodeURIComponent(token)}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    `Max-Age=${maxAgeSegundos}`,
  ];
  if (process.env.NODE_ENV !== "development") partes.push("Secure");
  return partes.join("; ");
}

export function cookieDeLogout() {
  const partes = [
    `${SESSION_COOKIE}=`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    "Max-Age=0",
  ];
  if (process.env.NODE_ENV !== "development") partes.push("Secure");
  return partes.join("; ");
}

export function obtenerTokenSesion(request) {
  const cookies = parseCookies(request.headers.get("cookie"));
  return cookies[SESSION_COOKIE] || null;
}

export { SESSION_COOKIE, SESSION_DIAS_DURACION };

// ---------- Sesiones (respaldadas en DB) ----------

export function generarTokenSesion() {
  return crypto.randomBytes(32).toString("hex");
}

export function fechaExpiracionSesion() {
  const fecha = new Date();
  fecha.setDate(fecha.getDate() + SESSION_DIAS_DURACION);
  return fecha;
}

// ---------- Google ----------
// Verifica el id_token que entrega Google Identity Services en el frontend
// contra el endpoint público tokeninfo de Google. No requiere client secret.

export async function verificarGoogleIdToken(idToken, googleClientId) {
  if (!idToken) throw new Error("Falta el token de Google.");
  if (!googleClientId) throw new Error("Google no está configurado en el servidor.");

  const resp = await fetch(
    `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(idToken)}`
  );

  if (!resp.ok) throw new Error("Token de Google inválido.");

  const payload = await resp.json();

  if (payload.aud !== googleClientId) {
    throw new Error("El token de Google no corresponde a esta aplicación.");
  }
  if (!payload.email || payload.email_verified !== "true") {
    throw new Error("La cuenta de Google no tiene un correo verificado.");
  }

  return {
    googleId: payload.sub,
    email: String(payload.email).toLowerCase(),
    nombre: payload.name || payload.email.split("@")[0],
  };
}

// ---------- Validación básica ----------

export function emailValido(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email || "").trim());
}
