# Tower — WMS de All-logistics

Sistema de gestión de bodega (Warehouse Management System) de All-logistics.
Proyecto hermano de Sandor (TMS), con el mismo stack pero repo, base de datos
y despliegue independientes.

## Qué cubre

- Operación 3PL: inventario de mercancía de los clientes comerciales, por
  **ambiente** (congelado / refrigerado / seco) y **lote con fecha de
  vencimiento** (FEFO).
- Cross-docking: mercancía en tránsito que entra y sale hacia los ruteros.
- Pantallas **mobile-first (PWA)** para los operarios en el piso de bodega.

## Stack

- `apps/api` — NestJS 10 + Prisma + PostgreSQL 16
- `apps/web` — React 19 + Vite + Tailwind + TanStack Query (PWA)

## Arrancar en local

La base de datos vive en **Cloud SQL** (instancia `sandor-db` del proyecto GCP
`sandor-prod`, base `tower`). En desarrollo se llega a ella por el
**Cloud SQL Auth Proxy** en `localhost:5433` — no hay Postgres local.

```bash
npm install
# 1. Proxy a Cloud SQL (déjalo corriendo; requiere gcloud autenticado)
C:/Users/carlo/cloud-sql-proxy.exe --gcloud-auth --port 5433 sandor-prod:us-east1:sandor-db
# 2. En otra terminal:
npm run dev:api      # API en :3001/api/v1 — Swagger en :3001/docs
npm run dev:web      # Web en :5174
```

Migraciones: `npm run db:migrate` (con el proxy corriendo). Seed: `npm run db:seed`.
Login sembrado: `admin@all-logistics.co` / `Admin123!` (cambiarla tras el primer login).

> `infra/docker-compose.yml` queda como alternativa de Postgres local (puerto
> 5433), hoy sin uso: Docker Desktop está dañado en el equipo y la decisión es
> que todo viva en Google Cloud.

## Fases

0. ✅ Fundación: auth + usuarios/roles + clientes + productos
1. Recepción (lotes, vencimientos, foto soporte, escaneo con cámara)
2. Inventario (saldos, kardex, ajustes, alertas de vencimiento)
3. Despacho (FEFO, picking móvil, cross-dock)
4. Producción GCP + CI/CD
5. Integración con Sandor + reportes
