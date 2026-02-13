// ============================================================
// Enums (mirror backend)
// ============================================================

export type UserRole = 'ADMIN' | 'LABORANT' | 'VIEWER';
export type ProcessType = string;
export type SampleType = 'BATH' | 'RINSE' | 'WASTEWATER' | 'RAW_MATERIAL' | 'OTHER';
export type SampleStatus = 'REGISTERED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
export type AnalysisStatus = 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'APPROVED' | 'REJECTED';
export type AnalysisType = 'CHEMICAL' | 'CORROSION_TEST' | 'SURFACE_ANALYSIS';
export type Deviation = 'CRITICAL_LOW' | 'BELOW_MIN' | 'WITHIN_RANGE' | 'ABOVE_MAX' | 'CRITICAL_HIGH';
export type RecommendationType = 'INCREASE' | 'DECREASE' | 'MAINTAIN' | 'URGENT_ACTION';
export type Priority = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
export type ImportType = 'FULL' | 'CLIENTS_ONLY' | 'ANALYSES_ONLY' | 'PROCESSES_ONLY' | 'SAMPLES_ONLY';
export type ImportStatus = 'UPLOADED' | 'VALIDATING' | 'VALIDATION_FAILED' | 'IMPORTING' | 'COMPLETED' | 'PARTIALLY_COMPLETED' | 'FAILED';

// ============================================================
// Models
// ============================================================

export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Client {
  id: string;
  companyName: string;
  nip?: string;
  address?: string;
  city?: string;
  postalCode?: string;
  country: string;
  contactPerson?: string;
  email?: string;
  phone?: string;
  notes?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  samples?: Sample[];
}

export interface Process {
  id: string;
  name: string;
  description?: string;
  processType: ProcessType;
  clientId?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  parameters?: ProcessParameter[];
  client?: Client;
}

export interface ProcessTypeDefinition {
  id: string;
  code: string;
  name: string;
  isActive: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface ProcessParameter {
  id: string;
  processId: string;
  parameterName: string;
  unit: string;
  minValue?: number;
  maxValue?: number;
  optimalValue?: number;
  isActive: boolean;
  sortOrder: number;
}

export interface Sample {
  id: string;
  sampleCode: string;
  clientId: string;
  processId: string;
  collectedBy?: string;
  collectedAt: string;
  sampleType: SampleType;
  description?: string;
  status: SampleStatus;
  createdAt: string;
  updatedAt: string;
  client?: Client;
  process?: Process;
  collector?: User;
  analyses?: Analysis[];
}

export interface Analysis {
  id: string;
  analysisCode: string;
  sampleId: string;
  performedBy: string;
  analysisType: AnalysisType;
  analysisDate: string;
  status: AnalysisStatus;
  notes?: string;
  approvedBy?: string;
  approvedAt?: string;
  createdAt: string;
  updatedAt: string;
  sample?: Sample;
  performer?: User;
  approver?: User;
  results?: AnalysisResult[];
  recommendations?: Recommendation[];
  reports?: Report[];
  attachments?: AnalysisAttachment[];
}

export interface AnalysisAttachment {
  id: string;
  analysisId: string;
  filename: string;
  originalName: string;
  mimeType: string;
  fileSize: number;
  description?: string;
  createdAt: string;
}

export interface AnalysisResult {
  id: string;
  analysisId: string;
  parameterName: string;
  unit: string;
  value: number;
  minReference?: number;
  maxReference?: number;
  optimalReference?: number;
  deviation: Deviation;
  deviationPercent?: number;
  createdAt: string;
}

export interface Recommendation {
  id: string;
  analysisId: string;
  parameterName: string;
  currentValue?: number;
  targetValue?: number;
  recommendationType: RecommendationType;
  description: string;
  priority: Priority;
  createdBy: string;
  createdAt: string;
  creator?: User;
}

export interface Report {
  id: string;
  reportCode: string;
  analysisId: string;
  generatedBy: string;
  generatedAt: string;
  pdfPath?: string;
  sentToClient: boolean;
  sentAt?: string;
  sentToEmail?: string;
  createdAt: string;
  analysis?: Analysis;
  generator?: User;
}

export interface CompanySettings {
  id: string;
  companyName: string;
  appSubtitle?: string;
  logoUrl?: string;
  address?: string;
  city?: string;
  postalCode?: string;
  nip?: string;
  phone?: string;
  email?: string;
  website?: string;
  smtpHost?: string;
  smtpPort?: number;
  smtpUser?: string;
  smtpPassword?: string;
  smtpFrom?: string;
  reportHeaderText?: string;
  reportFooterText?: string;
}

export interface ImportJob {
  id: string;
  importCode: string;
  importedBy: string;
  sourceSystem?: string;
  importType: ImportType;
  status: ImportStatus;
  fileName?: string;
  fileSize?: number;
  totalRecords: number;
  importedRecords: number;
  skippedRecords: number;
  errorRecords: number;
  validationErrors?: ValidationError[];
  mappingConfig?: MappingConfig;
  notes?: string;
  startedAt?: string;
  completedAt?: string;
  createdAt: string;
  importer?: User;
}

export interface ImportTemplate {
  id: string;
  name: string;
  description?: string;
  mappingConfig: MappingConfig;
  sourceSystem?: string;
  createdBy: string;
  isPublic: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AuditLog {
  id: string;
  userId?: string;
  action: string;
  entityType: string;
  entityId?: string;
  details?: Record<string, any>;
  ipAddress?: string;
  createdAt: string;
  user?: User;
}

export interface Notification {
  id: string;
  userId: string;
  title: string;
  message: string;
  type: 'info' | 'warning' | 'error' | 'success';
  isRead: boolean;
  link?: string;
  createdAt: string;
}

// ============================================================
// API Types
// ============================================================

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface DashboardStats {
  samplesToday: number;
  samplesThisWeek: number;
  samplesThisMonth: number;
  analysesInProgress: number;
  analysesCompleted: number;
  criticalDeviations: number;
}

export interface DashboardKpis {
  dueTodayAnalyses: number;
  dueTodaySamples: number;
  overdueAnalyses: number;
  samplesWithoutAnalyses: number;
  myInProgressAnalyses: number;
  criticalDeviationAnalyses: number;
}

export interface DashboardAttentionItem {
  id: string;
  type: 'OVERDUE' | 'NO_ANALYSIS';
  tag: string;
  message: string;
  details: string;
  date: string;
  link: string;
}

export interface DashboardRecentAnalysisRow {
  id: string;
  analysisCode: string;
  sampleCode: string;
  clientName: string;
  analystName: string;
  status: AnalysisStatus;
  deadline: string;
  date: string;
  link: string;
}

export interface DashboardQuickAction {
  id: string;
  label: string;
  link: string;
}

export interface DashboardOverview {
  kpis: DashboardKpis;
  attentionItems: DashboardAttentionItem[];
  recentAnalyses: DashboardRecentAnalysisRow[];
  quickActions: DashboardQuickAction[];
}

export interface TrendDataPoint {
  date: string;
  value: number;
  min?: number;
  max?: number;
  optimal?: number;
}

export interface ValidationError {
  row: number;
  column: string;
  message: string;
  severity: 'error' | 'warning';
}

export interface MappingConfig {
  type?: string;
  columns?: Record<string, string>;
  parameterColumns?: string | string[];
  dateFormat?: string;
  decimalSeparator?: string;
  separator?: string;
  encoding?: string;
  sheets?: Record<string, any>;
  [key: string]: any;
}

export interface AuthResponse {
  accessToken: string;
  user: User;
}

export interface LoginRequest {
  email: string;
  password: string;
}
