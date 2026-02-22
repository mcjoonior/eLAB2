// ============================================================
// Enums (mirror backend)
// ============================================================

export type UserRole = 'ADMIN' | 'LABORANT' | 'VIEWER';
export type ProcessType = string;
export type SampleType = 'BATH' | 'RINSE' | 'WASTEWATER' | 'RAW_MATERIAL' | 'OTHER';
export type SampleStatus = 'REGISTERED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
export type AnalysisStatus = 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'APPROVED' | 'REJECTED';
export type AnalysisType = 'CHEMICAL';
export type Deviation = 'CRITICAL_LOW' | 'BELOW_MIN' | 'WITHIN_RANGE' | 'ABOVE_MAX' | 'CRITICAL_HIGH';
export type RecommendationType = 'INCREASE' | 'DECREASE' | 'MAINTAIN' | 'URGENT_ACTION';
export type Priority = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
export type ImportType = 'FULL' | 'CLIENTS_ONLY' | 'ANALYSES_ONLY' | 'PROCESSES_ONLY' | 'SAMPLES_ONLY';
export type ImportStatus = 'UPLOADED' | 'VALIDATING' | 'VALIDATION_FAILED' | 'IMPORTING' | 'COMPLETED' | 'PARTIALLY_COMPLETED' | 'FAILED';
export type DeviceStatus = 'ACTIVE' | 'INACTIVE' | 'OUT_OF_SERVICE' | 'RETIRED';
export type MaintenanceType = 'CALIBRATION' | 'INSPECTION' | 'SERVICE';
export type MaintenanceResult = 'PASSED' | 'FAILED' | 'CONDITIONAL';
export type OrderStatus = 'NEW' | 'IN_PROGRESS' | 'COMPLETED' | 'INVOICED' | 'CANCELLED';
export type DashboardVariant = 'CLEAN' | 'MODERN' | 'OCEAN' | 'GRAPHITE' | 'LIGHT_CONCEPT';
export type ThemeMode = 'LIGHT' | 'DARK';
export type AppLanguage = 'PL' | 'EN';

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
  orderId?: string | null;
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
  order?: {
    id: string;
    orderCode: string;
    status: OrderStatus;
  };
  analyses?: Analysis[];
}

export interface Analysis {
  id: string;
  analysisCode: string;
  sampleId: string;
  priceListId?: string | null;
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
  priceList?: Pick<AnalysisPriceListItem, 'id' | 'code' | 'name' | 'priceNet' | 'currency'>;
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
  measurementUncertainty?: number;
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
  dashboardVariant?: DashboardVariant;
  themeMode?: ThemeMode;
  appLanguage?: AppLanguage;
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

export interface LabDevice {
  id: string;
  code: string;
  name: string;
  deviceType: string;
  manufacturer?: string | null;
  model?: string | null;
  serialNumber?: string | null;
  location?: string | null;
  status: DeviceStatus;
  requiresCalibration: boolean;
  requiresInspection: boolean;
  calibrationIntervalDays?: number | null;
  inspectionIntervalDays?: number | null;
  lastCalibrationAt?: string | null;
  nextCalibrationAt?: string | null;
  lastInspectionAt?: string | null;
  nextInspectionAt?: string | null;
  responsibleUserId?: string | null;
  notes?: string | null;
  createdAt: string;
  updatedAt: string;
  responsibleUser?: User;
  maintenanceLogs?: DeviceMaintenanceLog[];
  _count?: {
    maintenanceLogs: number;
  };
}

export interface DeviceMaintenanceLog {
  id: string;
  deviceId: string;
  maintenanceType: MaintenanceType;
  performedAt: string;
  result: MaintenanceResult;
  certificateNumber?: string | null;
  certificatePath?: string | null;
  notes?: string | null;
  performedBy?: string | null;
  nextDueAt?: string | null;
  createdAt: string;
  performer?: User;
}

export interface AnalysisPriceListItem {
  id: string;
  code: string;
  name: string;
  analysisType: string;
  description?: string | null;
  unit?: string | null;
  priceNet: number;
  vatRate: number;
  currency: string;
  isActive: boolean;
  effectiveFrom: string;
  effectiveTo?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface OrderItem {
  id: string;
  orderId: string;
  sampleId?: string | null;
  analysisId?: string | null;
  priceListId?: string | null;
  description: string;
  quantity: number;
  unitPriceNet: number;
  vatRate: number;
  lineTotalNet: number;
  lineTotalGross: number;
  createdAt: string;
  updatedAt: string;
  sample?: Pick<Sample, 'id' | 'sampleCode'>;
  analysis?: Pick<Analysis, 'id' | 'analysisCode' | 'analysisType'>;
  priceList?: Pick<AnalysisPriceListItem, 'id' | 'code' | 'name'>;
}

export interface Order {
  id: string;
  orderCode: string;
  clientId: string;
  status: OrderStatus;
  currency: string;
  notes?: string | null;
  manualAdjustmentNet: number;
  manualAdjustmentVatRate: number;
  totalNet: number;
  totalGross: number;
  createdBy?: string | null;
  createdAt: string;
  updatedAt: string;
  client?: Client;
  creator?: User;
  samples?: Sample[];
  items?: OrderItem[];
  _count?: {
    samples: number;
    items: number;
  };
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
