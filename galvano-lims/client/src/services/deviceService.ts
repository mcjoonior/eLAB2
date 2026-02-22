import api from './api';
import type {
  LabDevice,
  DeviceMaintenanceLog,
  DeviceStatus,
  MaintenanceResult,
  PaginatedResponse,
} from '@/types';

export interface UpcomingMaintenanceResponse {
  windowDays: number;
  count: number;
  data: LabDevice[];
}

export interface DeviceListParams {
  page?: number;
  limit?: number;
  status?: DeviceStatus;
  search?: string;
  overdueOnly?: boolean;
  dueWithinDays?: number;
  sortBy?: 'code' | 'name' | 'status' | 'nextCalibrationAt' | 'nextInspectionAt' | 'createdAt';
  sortOrder?: 'asc' | 'desc';
}

export interface CreateDevicePayload {
  code: string;
  name: string;
  deviceType: string;
  manufacturer?: string;
  model?: string;
  serialNumber?: string;
  location?: string;
  status?: DeviceStatus;
  requiresCalibration?: boolean;
  requiresInspection?: boolean;
  calibrationIntervalDays?: number | null;
  inspectionIntervalDays?: number | null;
  lastCalibrationAt?: string | null;
  lastInspectionAt?: string | null;
  responsibleUserId?: string | null;
  notes?: string | null;
}

export interface CreateMaintenanceLogPayload {
  maintenanceType: 'CALIBRATION' | 'INSPECTION' | 'SERVICE';
  performedAt?: string;
  result?: MaintenanceResult;
  certificateNumber?: string;
  certificatePath?: string;
  notes?: string;
  performedBy?: string;
  nextDueAt?: string | null;
}

export const deviceService = {
  async getAll(params?: DeviceListParams): Promise<PaginatedResponse<LabDevice>> {
    const response = await api.get('/devices', { params });
    return response.data;
  },

  async getById(id: string): Promise<LabDevice> {
    const response = await api.get(`/devices/${id}`);
    return response.data;
  },

  async getUpcomingMaintenance(days = 30): Promise<UpcomingMaintenanceResponse> {
    const response = await api.get('/devices/upcoming-maintenance', {
      params: { days },
    });
    return response.data;
  },

  async create(payload: CreateDevicePayload): Promise<LabDevice> {
    const response = await api.post('/devices', payload);
    return response.data;
  },

  async update(id: string, payload: Partial<CreateDevicePayload>): Promise<LabDevice> {
    const response = await api.put(`/devices/${id}`, payload);
    return response.data;
  },

  async createMaintenanceLog(id: string, payload: CreateMaintenanceLogPayload): Promise<DeviceMaintenanceLog> {
    const response = await api.post(`/devices/${id}/maintenance-logs`, payload);
    return response.data;
  },
};
