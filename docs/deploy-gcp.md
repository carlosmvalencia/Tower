# Despliegue de Tower en Google Cloud

Proyecto GCP: `sandor-prod` (compartido con Sandor) · Región: `us-east1`.

| Pieza | Recurso |
|---|---|
| API | Cloud Run `tower-api` → https://tower-api-41401520286.us-east1.run.app |
| Base de datos | Cloud SQL instancia `sandor-db`, base `tower`, usuario `tower-app` |
| Web | Firebase Hosting site `tower-wms` → https://tower-wms.web.app |
| Imágenes | Artifact Registry `us-east1-docker.pkg.dev/sandor-prod/sandor/tower-api` |
| CI/CD | Cloud Build trigger en push a `main` del repo GitHub `carlosmvalencia/Tower` |

## CI/CD (automático)

`git push` a `main` → Cloud Build ejecuta `cloudbuild.yaml`: build de la imagen →
push a Artifact Registry → deploy a Cloud Run. Las migraciones de Prisma se
aplican al arrancar el contenedor (`prisma migrate deploy` en el CMD).

Las variables de entorno y la conexión a Cloud SQL quedan configuradas en el
servicio de Cloud Run (el paso de deploy del CI no las toca).

## Deploy manual de la web

```bash
cd apps/web
npm run build          # usa .env.production (VITE_API_BASE_URL)
npx firebase-tools deploy --only hosting --project sandor-prod --non-interactive
```

## Primer deploy de la API (referencia)

```bash
gcloud builds submit C:/Tower --config=C:/Tower/cloudbuild.yaml --project=sandor-prod
gcloud run deploy tower-api \
  --image=us-east1-docker.pkg.dev/sandor-prod/sandor/tower-api:latest \
  --region=us-east1 --allow-unauthenticated \
  --service-account=sandor-api@sandor-prod.iam.gserviceaccount.com \
  --add-cloudsql-instances=sandor-prod:us-east1:sandor-db \
  --env-vars-file=<archivo-yaml-con-secretos>
```

Los secretos (JWT, DATABASE_URL) viven como env vars del servicio de Cloud Run,
no en el repo. Para rotarlos: `gcloud run services update tower-api --region=us-east1 --env-vars-file=...`.

## Pendientes conocidos

- `STORAGE_BACKEND=local` con `/tmp/uploads` (efímero) — al llegar la Fase 1
  (fotos de recepción) crear bucket `tower-uploads-sandor-prod` y cambiar a
  `gcs`, igual que el módulo Combustible de Sandor.
- Dominio propio `tower.all-logistics.co` — pospuesto, igual que se hizo con Sandor.
