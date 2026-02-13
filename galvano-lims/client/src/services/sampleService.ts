import api from './api';
import type { Sample, PaginatedResponse, SampleStatus } from '@/types';

export interface AssignableUser {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  role: string;
}

export const sampleService = {
  async getAll(params?: {
    page?: number; limit?: number; status?: SampleStatus;
    clientId?: string; processId?: string; dateFrom?: string; dateTo?: string;
  }): Promise<PaginatedResponse<Sample>> {
    const response = await api.get('/samples', { params });
    return response.data;
  },

  async getById(id: string): Promise<Sample> {
    const response = await api.get(`/samples/${id}`);
    return response.data;
  },

  async getAssignableUsers(): Promise<AssignableUser[]> {
    const response = await api.get('/samples/assignees');
    return response.data;
  },

  async create(data: Partial<Sample>): Promise<Sample> {
    const response = await api.post('/samples', data);
    return response.data;
  },

  async update(id: string, data: Partial<Sample>): Promise<Sample> {
    const response = await api.put(`/samples/${id}`, data);
    return response.data;
  },

  async changeStatus(id: string, status: SampleStatus): Promise<Sample> {
    const response = await api.patch(`/samples/${id}/status`, { status });
    return response.data;
  },
};
