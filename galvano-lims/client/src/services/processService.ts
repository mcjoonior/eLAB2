import api from './api';
import type { Process, PaginatedResponse, ProcessType, ProcessTypeDefinition } from '@/types';

export const processService = {
  async getAll(params?: { page?: number; limit?: number; processType?: ProcessType; isActive?: boolean }): Promise<PaginatedResponse<Process>> {
    const response = await api.get('/processes', { params });
    return response.data;
  },

  async getTypes(params?: { all?: boolean }): Promise<ProcessTypeDefinition[]> {
    const response = await api.get('/processes/types', { params });
    return response.data;
  },

  async createType(data: { code: string; name: string; isActive?: boolean; sortOrder?: number }): Promise<ProcessTypeDefinition> {
    const response = await api.post('/processes/types', data);
    return response.data;
  },

  async updateType(id: string, data: Partial<{ code: string; name: string; isActive: boolean; sortOrder: number }>): Promise<ProcessTypeDefinition> {
    const response = await api.put(`/processes/types/${id}`, data);
    return response.data;
  },

  async deleteType(id: string): Promise<void> {
    await api.delete(`/processes/types/${id}`);
  },

  async getById(id: string): Promise<Process> {
    const response = await api.get(`/processes/${id}`);
    return response.data;
  },

  async create(data: Partial<Process>): Promise<Process> {
    const response = await api.post('/processes', data);
    return response.data;
  },

  async update(id: string, data: Partial<Process>): Promise<Process> {
    const response = await api.put(`/processes/${id}`, data);
    return response.data;
  },

  async clone(id: string, newName: string): Promise<Process> {
    const response = await api.post(`/processes/${id}/clone`, { name: newName });
    return response.data;
  },

  async delete(id: string): Promise<void> {
    await api.delete(`/processes/${id}`);
  },
};
