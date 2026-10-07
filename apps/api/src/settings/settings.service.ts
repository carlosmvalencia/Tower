import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

// Claves conocidas y sus valores por defecto.
export const DEFAULT_SETTINGS: Record<string, string> = {
  'tare.canastillaKg': '2',
  'tare.estibaKg': '25',
};

@Injectable()
export class SettingsService {
  constructor(private readonly prisma: PrismaService) {}

  async getAll(): Promise<Record<string, string>> {
    const rows = await this.prisma.setting.findMany();
    const result = { ...DEFAULT_SETTINGS };
    for (const row of rows) result[row.key] = row.value;
    return result;
  }

  async getNumber(key: keyof typeof DEFAULT_SETTINGS): Promise<number> {
    const row = await this.prisma.setting.findUnique({ where: { key } });
    const raw = row?.value ?? DEFAULT_SETTINGS[key] ?? '0';
    const n = Number(raw);
    return Number.isFinite(n) ? n : 0;
  }

  async setMany(values: Record<string, string>): Promise<Record<string, string>> {
    for (const [key, value] of Object.entries(values)) {
      await this.prisma.setting.upsert({
        where: { key },
        update: { value },
        create: { key, value },
      });
    }
    return this.getAll();
  }
}
