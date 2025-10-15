export interface Contact {
  id: string;
  nome: string;
  telefone: string;
  email?: string | null;
  observacoes?: string | null;
  tags: string[];
  tenantId?: string | null;
  criadoEm: Date;
  atualizadoEm: Date;
}

export interface ContactInput {
  nome: string;
  telefone: string;
  email?: string;
  observacoes?: string;
  tags?: string[];
  categoriaId?: string;
  tenantId?: string;
}

export interface ContactsResponse {
  contacts: Contact[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface Category {
  id: string;
  nome: string;
  cor: string;
  descricao?: string | null;
  criadoEm: Date;
  atualizadoEm: Date;
}

export interface CategoryInput {
  nome: string;
  cor: string;
  descricao?: string;
}

export interface CategoriesResponse {
  categories: Category[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface ApiError {
  error: string;
  details?: any;
}

export interface ImportResult {
  success: boolean;
  totalRows: number;
  successfulImports: number;
  failedImports: number;
  errors: string[];
  message?: string;
}

// WhatsApp Provider Types
export type WhatsAppProvider = 'WAHA' | 'EVOLUTION' | 'DIGITALSAC';

export interface WhatsAppSession {
  id: string;
  name: string;
  displayName?: string | null;
  status: string;
  provider: WhatsAppProvider;
  connectionUuid?: string | null; // Para DigitalSac
  tenantId?: string | null;
  criadoEm: Date;
  atualizadoEm: Date;
}