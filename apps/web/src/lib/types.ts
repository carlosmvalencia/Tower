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

export interface Customer {
  id: string;
  code: string;
  name: string;
  taxId?: string | null;
  contactName?: string | null;
  phone?: string | null;
  email?: string | null;
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
  unit: string;
  environment: Environment;
  shelfLifeDays?: number | null;
  notes?: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  customer?: CustomerOption;
}

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
