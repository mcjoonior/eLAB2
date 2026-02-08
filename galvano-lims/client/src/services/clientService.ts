import api from './api';
import type { Client, PaginatedResponse } from '@/types';

export const clientService = {
  async getAll(params?: { page?: number; limit?: number; search?: string; isActive?: boolean }): Promise<PaginatedResponse<Client>> {
    const response = await api.get('/clients', { params });
    return response.data;
  },

  async getById(id: string): Promise<Client> {
    const response = await api.get(`/clients/${id}`);
    return response.data;
  },

  async create(data: Partial<Client>): Promise<Client> {
    const response = await api.post('/clients', data);
    return response.data;
  },

  async update(id: string, data: Partial<Client>): Promise<Client> {
    const response = await api.put(`/clients/${id}`, data);
    return response.data;
  },

  async delete(id: string): Promise<void> {
    await api.delete(`/clients/${id}`);
  },

  async exportCSV(): Promise<string> {
    const response = await api.get('/clients/export/csv', { responseType: 'text' });
    return response.data;
  },
};
