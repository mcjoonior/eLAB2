// Shared types between frontend and backend

export type UserRole = 'ADMIN' | 'LABORANT' | 'VIEWER';
export type ProcessType = string;
export type SampleType = 'BATH' | 'RINSE' | 'WASTEWATER' | 'RAW_MATERIAL' | 'OTHER';
export type SampleStatus = 'REGISTERED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
export type AnalysisStatus = 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'APPROVED' | 'REJECTED';
export type Deviation = 'CRITICAL_LOW' | 'BELOW_MIN' | 'WITHIN_RANGE' | 'ABOVE_MAX' | 'CRITICAL_HIGH';
export type RecommendationType = 'INCREASE' | 'DECREASE' | 'MAINTAIN' | 'URGENT_ACTION';
export type Priority = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
export type ImportType = 'FULL' | 'CLIENTS_ONLY' | 'ANALYSES_ONLY' | 'PROCESSES_ONLY' | 'SAMPLES_ONLY';
export type ImportStatus = 'UPLOADED' | 'VALIDATING' | 'VALIDATION_FAILED' | 'IMPORTING' | 'COMPLETED' | 'PARTIALLY_COMPLETED' | 'FAILED';

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}
