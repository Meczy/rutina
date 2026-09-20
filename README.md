# MecFit

Aplicación web para gestionar rutinas de entrenamiento, ejercicios, pesos y métricas corporales.

MecFit utiliza un frontend web, una API desarrollada con Node.js y una base de datos PostgreSQL para almacenar y consultar la información de las rutinas.

La aplicación está desplegada en producción en:

**https://mecfit.app**

## Características

* Visualización de rutinas organizadas por días.
* Gestión de días de entrenamiento.
* Gestión de ejercicios.
* Edición de días y ejercicios.
* Reordenamiento de ejercicios.
* Registro de pesos por persona.
* Historial de pesos.
* Registro e historial de métricas corporales.
* Gestión administrativa de la rutina.
* Integración con datos de ejercicios de WGER.
* API propia para comunicación entre frontend y base de datos.
* Persistencia de datos mediante PostgreSQL.
* Interfaz web accesible desde dispositivos de escritorio y móviles.

## Arquitectura

```text
                         Internet
                            │
                            ▼
                     ┌─────────────┐
                     │  Cloudflare │
                     │     DNS     │
                     └──────┬──────┘
                            │
                         HTTPS
                            │
                            ▼
                     ┌─────────────┐
                     │    Nginx   │
                     │  :80 / :443│
                     └──────┬──────┘
                            │
                     reverse proxy
                            │
                            ▼
                     ┌─────────────┐
                     │   Node.js   │
                     │    :3000    │
                     │   systemd   │
                     └──────┬──────┘
                            │
                 ┌──────────┴──────────┐
                 │                     │
                 ▼                     ▼
            Frontend              API /api/rutina
                                       │
                                       ▼
                                ┌─────────────┐
                                │ PostgreSQL  │
                                │   rutina    │
                                └─────────────┘
```

## Tecnologías

* HTML
* CSS
* JavaScript
* Node.js
* PostgreSQL
* `pg`
* Drizzle ORM
* Drizzle Kit
* Nginx
* systemd
* Cloudflare
* Let's Encrypt / Certbot
* WGER API

## Estructura del proyecto

```text
/
├── css/
├── datos/
├── db/
│   └── schema.ts
├── icons/
├── js/
├── netlify/
│   └── functions/
│       └── rutina.mjs
├── index.html
├── manifest.json
├── sw.js
├── package.json
├── package-lock.json
├── drizzle.config.ts
├── server.mjs
├── rutina-api-node.mjs
└── README.md
```

## API

La aplicación utiliza el endpoint:

```text
/api/rutina
```

La API permite consultar la rutina y gestionar información relacionada con:

* días
* ejercicios
* pesos
* métricas corporales
* personas
* operaciones administrativas

Las operaciones administrativas requieren la contraseña configurada mediante una variable de entorno.

## Base de datos

MecFit utiliza PostgreSQL para la persistencia de datos.

Las migraciones se encuentran en:

```text
netlify/database/migrations/
```

Las principales tablas utilizadas actualmente son:

* `dias`
* `ejercicios`
* `pesos`
* `metricas_corporales`

Los ejercicios incluyen información adicional como:

* series
* repeticiones
* URL de video
* imagen
* identificador de WGER
* orden dentro de la rutina

La base de datos no se almacena dentro del repositorio.

Las credenciales se proporcionan mediante variables de entorno.

## Variables de entorno

Crear un archivo `.env` en la raíz del proyecto:

```env
NETLIFY_DATABASE_URL=postgresql://USUARIO:CONTRASEÑA@localhost:5432/rutina
ROUTINE_ADMIN_PASSWORD=CONTRASEÑA_ADMIN
```

**Nunca subir `.env` al repositorio.**

El archivo está excluido mediante `.gitignore`.

## Desarrollo local

Instalar las dependencias:

```bash
npm install
```

Iniciar el servidor:

```bash
node server.mjs
```

La aplicación queda disponible en:

```text
http://127.0.0.1:3000
```

La API queda disponible en:

```text
http://127.0.0.1:3000/api/rutina
```

## Producción

La aplicación está desplegada en un servidor Ubuntu.

Node.js se ejecuta mediante `systemd` utilizando el servicio:

```text
rutina.service
```

El servicio ejecuta:

```text
/home/rutina/app/server.mjs
```

y utiliza:

```text
/home/rutina/app/.env
```

Nginx funciona como reverse proxy y dirige las solicitudes hacia:

```text
127.0.0.1:3000
```

El dominio de producción es:

```text
https://mecfit.app
```

Cloudflare administra el DNS del dominio.

HTTPS está configurado mediante Let's Encrypt y Certbot.

## Comandos de producción

### Ver estado de MecFit

```bash
sudo systemctl status rutina
```

### Reiniciar MecFit

```bash
sudo systemctl restart rutina
```

### Ver logs de MecFit

```bash
sudo journalctl -u rutina -n 50 --no-pager
```

### Verificar Nginx

```bash
sudo nginx -t
```

### Reiniciar Nginx

```bash
sudo systemctl restart nginx
```

### Probar la aplicación

```bash
curl -I https://mecfit.app
```

### Probar la API

```bash
curl -s https://mecfit.app/api/rutina
```

## Git y GitHub

El código fuente se mantiene en GitHub:

```text
https://github.com/Meczy/rutina
```

Antes de realizar un commit se deben revisar los cambios:

```bash
git status
```

Para consultar las diferencias:

```bash
git diff
```

Después de revisar los cambios:

```bash
git add .
git commit -m "Actualizar despliegue de MecFit"
git push origin main
```

Los secretos, credenciales, `.env`, dependencias instaladas y archivos temporales no deben formar parte del repositorio.

## Estado actual

MecFit se encuentra desplegado y funcionando en producción con:

* PostgreSQL
* Node.js
* API propia
* Persistencia de datos
* systemd
* Nginx
* Cloudflare
* HTTPS
* Let's Encrypt
