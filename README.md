# Mapa Regadores API

Backend REST API para el sistema de monitoreo GPS de regadores. Conecta con PostgreSQL (esquema `mapa_regadores`).

## Requisitos

- Node.js 18+
- PostgreSQL con el esquema `mapa_regadores` configurado

## Variables de entorno

Crear archivo `.env` en la raíz:

```
DATABASE_URL=postgresql://usuario:password@host:5432/db_control_operacional
PORT=3001
```

## Instalación

```bash
npm install
```

## Ejecutar en desarrollo

```bash
npm run dev
```

Inicia en `http://localhost:3001` con hot-reload.

## Ejecutar en producción

```bash
npm start
```

## Endpoints

| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/api/sessions` | Listar sesiones GPS |
| POST | `/api/sessions` | Crear sesión |
| PATCH | `/api/sessions` | Actualizar sesión |
| GET/POST | `/api/points` | Puntos GPS |
| POST | `/api/dispositivos` | Registrar dispositivo |
| GET/POST/PATCH/DELETE | `/api/paradas` | CRUD paradas |
| POST | `/api/parada-fotos` | Subir foto de parada |
| POST | `/api/alertas` | Crear alerta |

## Deploy

Desplegado en Render. Push a `main` despliega automáticamente.
