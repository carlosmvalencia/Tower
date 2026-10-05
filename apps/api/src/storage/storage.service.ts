import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Storage } from '@google-cloud/storage';
import { randomUUID } from 'crypto';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Abstracción de almacenamiento de archivos.
 *
 * - STORAGE_BACKEND=local (dev): guarda en disco bajo UPLOADS_DIR y sirve
 *   por el endpoint estático /uploads.
 * - STORAGE_BACKEND=gcs (prod): sube a Cloud Storage (GCS_BUCKET) y genera
 *   signed URLs temporales para lectura.
 *
 * El "key" que se persiste en la BD es relativo (ej. "fuel/uuid.jpg"),
 * independiente del backend. getReadUrl(key) devuelve la URL servible.
 */
@Injectable()
export class StorageService implements OnModuleInit {
  private readonly logger = new Logger(StorageService.name);
  private backend: 'local' | 'gcs';
  private uploadsDir: string;
  private publicBaseUrl: string;
  private gcs?: Storage;
  private bucketName?: string;

  constructor(private readonly config: ConfigService) {
    this.backend = (this.config.get<string>('STORAGE_BACKEND', 'local') as 'local' | 'gcs');
    this.uploadsDir = this.config.get<string>('UPLOADS_DIR', path.join(process.cwd(), 'uploads'));
    // Para construir URLs absolutas en modo local (la API sirve /uploads)
    this.publicBaseUrl = this.config.get<string>('PUBLIC_API_URL', '');
    if (this.backend === 'gcs') {
      this.gcs = new Storage();
      this.bucketName = this.config.get<string>('GCS_BUCKET');
    }
  }

  onModuleInit() {
    if (this.backend === 'local') {
      fs.mkdirSync(this.uploadsDir, { recursive: true });
      this.logger.log(`Storage backend: local (${this.uploadsDir})`);
    } else {
      this.logger.log(`Storage backend: gcs (bucket=${this.bucketName})`);
    }
  }

  /**
   * Guarda un archivo y devuelve su key relativo.
   * @param folder ej. "fuel"
   * @param buffer contenido
   * @param originalName para extraer extensión
   * @param mimeType para metadata en GCS
   */
  async save(folder: string, buffer: Buffer, originalName: string, mimeType: string): Promise<string> {
    const ext = (originalName.split('.').pop() ?? 'bin').toLowerCase().replace(/[^a-z0-9]/g, '');
    const key = `${folder}/${randomUUID()}.${ext}`;

    if (this.backend === 'gcs') {
      const file = this.gcs!.bucket(this.bucketName!).file(key);
      await file.save(buffer, { contentType: mimeType, resumable: false });
      return key;
    }

    // local
    const fullPath = path.join(this.uploadsDir, key);
    fs.mkdirSync(path.dirname(fullPath), { recursive: true });
    fs.writeFileSync(fullPath, buffer);
    return key;
  }

  /**
   * Devuelve una URL servible para leer el archivo.
   * - local: URL absoluta al endpoint estático /uploads/<key>
   * - gcs: signed URL válida por `expiresMinutes` (default 60)
   */
  async getReadUrl(key: string, expiresMinutes = 60): Promise<string> {
    if (!key) return '';
    if (this.backend === 'gcs') {
      const [url] = await this.gcs!
        .bucket(this.bucketName!)
        .file(key)
        .getSignedUrl({
          action: 'read',
          expires: Date.now() + expiresMinutes * 60 * 1000,
        });
      return url;
    }
    // local: el endpoint /uploads sirve los archivos
    const base = this.publicBaseUrl || '';
    return `${base}/uploads/${key}`;
  }

  /** Elimina un archivo por su key. No falla si no existe. */
  async remove(key: string): Promise<void> {
    if (!key) return;
    try {
      if (this.backend === 'gcs') {
        await this.gcs!.bucket(this.bucketName!).file(key).delete({ ignoreNotFound: true });
      } else {
        const fullPath = path.join(this.uploadsDir, key);
        if (fs.existsSync(fullPath)) fs.unlinkSync(fullPath);
      }
    } catch (e) {
      this.logger.warn(`No se pudo eliminar ${key}: ${(e as Error).message}`);
    }
  }

  get uploadsDirectory(): string {
    return this.uploadsDir;
  }

  get isLocal(): boolean {
    return this.backend === 'local';
  }
}
