export type ImportType = 'customers' | 'products' | 'sites';

export interface ImportRowError {
  row: number; // número de fila en el Excel (1-based, contando el encabezado)
  field?: string;
  message: string;
}

export interface ImportReport {
  dryRun: boolean;
  total: number;
  created: number;
  updated: number;
  skipped: number;
  errors: ImportRowError[];
}

/** Definición de cada plantilla: encabezados exactos + fila de ejemplo. */
export const TEMPLATES: Record<ImportType, { name: string; headers: string[]; example: (string | number)[] }> = {
  customers: {
    name: 'clientes',
    headers: [
      'Razón social*',
      'NIT',
      'Código (vacío = automático)',
      'Dirección',
      'Contacto',
      'Teléfono',
      'Correo',
      'Tipo de servicio (INVENTARIO / CROSS-DOCK / AMBOS)',
      'Notas',
    ],
    example: [
      'Gran Colombia S.A.S',
      '900123456-7',
      '',
      'Cra 1 # 23-45, Cali',
      'Laura Mejía',
      '3001234567',
      'compras@grancolombia.co',
      'INVENTARIO',
      '',
    ],
  },
  products: {
    name: 'items',
    headers: [
      'Cliente (código CL-xxxx o NIT)*',
      'Código del item*',
      'Nombre*',
      'Manejo (KG / UND)*',
      'Bodega (CONGELADO / REFRIGERADO / SECO)*',
      'Código de barras',
      'Unidad visible (UND, CAJA...)',
      'Vida útil (días)',
      'Notas',
    ],
    example: ['CL-0002', 'GC-LOMO', 'Lomo de cerdo', 'KG', 'REFRIGERADO', '7701111222333', '', 30, ''],
  },
  sites: {
    name: 'sedes',
    headers: [
      'Cliente (código CL-xxxx o NIT)*',
      'Nombre de la sede*',
      'Dirección',
      'Ciudad',
      'Contacto',
      'Teléfono',
      'Notas',
    ],
    example: ['CL-0002', 'Sede Cali Norte', 'Av 6N # 45-12', 'Cali', 'Pedro Gómez', '3109876543', ''],
  },
};
