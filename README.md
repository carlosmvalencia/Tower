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

```bash
npm install
npm run db:up        # Postgres en localhost:5433 (Sandor usa 5432)
npm run db:migrate   # primera vez: npm run db:migrate -- --name init
npm run db:seed      # crea el usuario admin
npm run dev:api      # API en :3001/api/v1 — Swagger en :3001/docs
npm run dev:web      # Web en :5174
```

Login sembrado: `admin@all-logistics.co` / `Admin123!` (cambiarla tras el primer login).

## Fases

0. ✅ Fundación: auth + usuarios/roles + clientes + productos
1. Recepción (lotes, vencimientos, foto soporte, escaneo con cámara)
2. Inventario (saldos, kardex, ajustes, alertas de vencimiento)
3. Despacho (FEFO, picking móvil, cross-dock)
4. Producción GCP + CI/CD
5. Integración con Sandor + reportes
