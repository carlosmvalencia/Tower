export type UserRole = 'ADMIN' | 'SUPERVISOR' | 'OPERARIO';

export type Environment = 'FROZEN' | 'REFRIGERATED' | 'DRY';

export interface User {
  id: string;
  email: string;
  fullName: string;
  role: UserRole;
  isActive: boolean;
}

export interface LoginResponse {
  accessToken: string;
  refreshToken: string;
  user: User;
}

export type CustomerServiceType = 'INVENTORY' | 'CROSS_DOCK' | 'BOTH';
export type MeasureType = 'KG' | 'UND';

export interface Customer {
  id: string;
  code: string;
  name: string;
  taxId?: string | null;
  addressLine?: string | null;
  contactName?: string | null;
  phone?: string | null;
  email?: string | null;
  serviceType: CustomerServiceType;
  notes?: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  _count?: { products: number };
}

export interface CustomerOption {
  id: string;
  code: string;
  name: string;
}

export interface Product {
  id: string;
  customerId: string;
  code: string;
  name: string;
  barcode?: string | null;
  measure: MeasureType;
  unit: string;
  environment: Environment;
  shelfLifeDays?: number | null;
  notes?: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  customer?: CustomerOption;
}

// ---------- Recepción de inventario ----------

export type ReceiptStatus = 'DRAFT' | 'CONFIRMED' | 'CANCELLED';
export type PalletStatus = 'IN_STORAGE' | 'DISPATCHED';

export interface ProductRef {
  id: string;
  code: string;
  name: string;
  measure: MeasureType;
  unit: string;
  environment: Environment;
}

export type TareKind = 'CANASTILLA' | 'ESTIBA' | 'OTRO';

export interface TareType {
  id: string;
  kind: TareKind;
  name: string;
  weightKg: string;
  isActive: boolean;
}

export interface LineTare {
  id: string;
  tareTypeId: string;
  qty: number;
  tareType: { id: string; kind: TareKind; name: string; weightKg: string };
}

export interface ReceiptLine {
  id: string;
  receiptId: string;
  palletId?: string | null;
  productId: string;
  lotCode: string;
  expiryDate?: string | null;
  grossKg?: string | null;
  canastillas: number;
  estibas: number;
  tareKg?: string | null;
  netKg?: string | null;
  units?: number | null;
  notes?: string | null;
  product: ProductRef;
  tares?: LineTare[];
}

export const TARE_KIND_LABELS: Record<TareKind, string> = {
  CANASTILLA: 'Canastilla',
  ESTIBA: 'Estiba',
  OTRO: 'Otro',
};

export interface Pallet {
  id: string;
  code: string;
  receiptId: string;
  environment: Environment;
  status: PalletStatus;
  lines: ReceiptLine[];
}

export interface Photo {
  id: string;
  key: string;
  url?: string;
  createdAt: string;
}

export interface Receipt {
  id: string;
  code: string;
  customerId: string;
  status: ReceiptStatus;
  receivedAt: string;
  notes?: string | null;
  confirmedAt?: string | null;
  customer?: CustomerOption;
  pallets: Pallet[];
  photos: Photo[];
  createdAt: string;
  _count?: { pallets: number; lines: number; photos: number };
}

export interface PalletLabel extends Pallet {
  receipt: Receipt & { customer: CustomerOption };
}

// ---------- Cross-dock ----------

export type CrossDockStatus = 'OPEN' | 'CLOSED' | 'CANCELLED';

export interface CrossDockDispatch {
  id: string;
  dispatchedAt: string;
  boxesOut: number;
  destination?: string | null;
  notes?: string | null;
  photos: Photo[];
}

export interface CrossDockReceipt {
  id: string;
  code: string;
  customerId: string;
  status: CrossDockStatus;
  arrivedAt: string;
  boxesIn: number;
  grossKg?: string | null;
  notes?: string | null;
  boxesOut: number;
  boxesPending: number;
  customer?: CustomerOption;
  dispatches: CrossDockDispatch[];
  photos: Photo[];
  _count?: { photos: number };
}

// ---------- Sedes ----------

export interface CustomerSite {
  id: string;
  customerId: string;
  name: string;
  addressLine?: string | null;
  city?: string | null;
  contactName?: string | null;
  phone?: string | null;
  notes?: string | null;
  isActive: boolean;
}

// ---------- Salidas (SM) ----------

export type DispatchStatus = 'DRAFT' | 'CONFIRMED' | 'CANCELLED';

export interface LotRef {
  id: string;
  code: string;
  expiryDate?: string | null;
}

export interface DispatchLine {
  id: string;
  dispatchId: string;
  productId: string;
  lotId: string;
  qty: string;
  notes?: string | null;
  product: ProductRef;
  lot: LotRef;
}

export interface Dispatch {
  id: string;
  code: string;
  customerId: string;
  siteId?: string | null;
  status: DispatchStatus;
  dispatchedAt: string;
  notes?: string | null;
  confirmedAt?: string | null;
  customer?: CustomerOption;
  site?: CustomerSite | null;
  lines: DispatchLine[];
  photos: Photo[];
  _count?: { lines: number; photos: number };
}

// ---------- Ajustes (AJ) ----------

export type AdjustmentDirection = 'IN' | 'OUT';

export interface Adjustment {
  id: string;
  code: string;
  direction: AdjustmentDirection;
  qty: string;
  reason: string;
  notes?: string | null;
  createdAt: string;
  product: ProductRef & { customer?: CustomerOption };
  lot: LotRef;
}

// ---------- Inventario ----------

export interface LotAvailability {
  lotId: string;
  lotCode: string;
  expiryDate?: string | null;
  available: number;
}

export interface StockRow {
  product: Product;
  total: number;
  lots: LotAvailability[];
}

// ---------- Almacenaje ----------

export type StorageChargeUnit = 'POSITION_DAY' | 'KG_DAY';
export type StorageExtraKind = 'CARGUE_DESCARGUE' | 'NIVELACION' | 'OTRO';

export interface StorageRate {
  id: string;
  customerId: string;
  environment: Environment;
  unit: StorageChargeUnit;
  ratePerDay: string;
  validFrom: string;
}

export interface StorageExtraRate {
  id: string;
  customerId: string;
  kind: StorageExtraKind;
  name?: string | null;
  ratePerKg: string;
  validFrom: string;
}

export interface StorageDayRecord {
  id: string;
  date: string;
  customerId: string;
  environment: Environment;
  posIn: number;
  posOut: number;
  kgIn: string;
  kgOut: string;
  kgHandledOverride?: string | null;
  kgLeveled: string;
  note?: string | null;
  invoiceRef?: string | null;
}

export interface StorageDayRow {
  customerId: string;
  customer: CustomerOption;
  environment: Environment;
  record: StorageDayRecord | null;
  posBalance: number;
  kgBalance: number;
  unit: StorageChargeUnit | null;
  rate: number | null;
  storageValue: number;
  kgHandled: number;
  handlingRate: number | null;
  handlingValue: number;
  levelingRate: number | null;
  levelingValue: number;
  totalValue: number;
}

export interface OccupancyCell {
  occupied: number;
  capacity: number;
  available: number;
  pct: number | null;
}

export interface OccupancyDay {
  date: string;
  FROZEN: OccupancyCell;
  REFRIGERATED: OccupancyCell;
  DRY: OccupancyCell;
}

export interface StorageTotals {
  storage: number;
  handling: number;
  leveling: number;
  total: number;
}

export interface MonthlyReport {
  customer: CustomerOption;
  month: string;
  days: { date: string; rows: StorageDayRow[] }[];
  totals: StorageTotals;
  closed: boolean;
  invoiceRefs: string[];
}

export interface BillingSummary {
  month: string;
  closed: boolean;
  rows: { customer: CustomerOption; totals: StorageTotals; invoiceRefs: string[] }[];
  grand: StorageTotals;
}

export interface MonthClosure {
  id: string;
  month: string;
  closedAt: string;
}

export const EXTRA_KIND_LABELS: Record<StorageExtraKind, string> = {
  CARGUE_DESCARGUE: 'Cargue / descargue',
  NIVELACION: 'Nivelación de temperatura',
  OTRO: 'Otro',
};

export const DISPATCH_STATUS_LABELS: Record<DispatchStatus, string> = {
  DRAFT: 'En registro',
  CONFIRMED: 'Confirmada',
  CANCELLED: 'Anulada',
};

export const RECEIPT_STATUS_LABELS: Record<ReceiptStatus, string> = {
  DRAFT: 'En registro',
  CONFIRMED: 'Confirmada',
  CANCELLED: 'Anulada',
};

export const CROSSDOCK_STATUS_LABELS: Record<CrossDockStatus, string> = {
  OPEN: 'Abierto',
  CLOSED: 'Cerrado',
  CANCELLED: 'Anulado',
};

export const SERVICE_TYPE_LABELS: Record<CustomerServiceType, string> = {
  INVENTORY: 'Inventario',
  CROSS_DOCK: 'Cross-dock',
  BOTH: 'Inventario + Cross-dock',
};

export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export const ROLE_LABELS: Record<UserRole, string> = {
  ADMIN: 'Administrador',
  SUPERVISOR: 'Supervisor',
  OPERARIO: 'Operario',
};

export const ENVIRONMENT_LABELS: Record<Environment, string> = {
  FROZEN: 'Congelado',
  REFRIGERATED: 'Refrigerado',
  DRY: 'Seco',
};
