import api from './api';
import type { Client, PaginatedResponse } from '@/types';

export interface GusLookupResponse {
  source: 'GUS';
  data: {
    companyName: string;
    nip: string;
    address: string;
    city: string;
    postalCode: string;
    country: string;
  };
  meta?: {
    regon?: string;
    krs?: string;
    type?: string;
    silosId?: string;
  };
}

export const clientService = {
  async getAll(params?: { page?: number; limit?: number; search?: string; isActive?: boolean | 'all' }): Promise<PaginatedResponse<Client>> {
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

  async lookupByNipInGus(nip: string): Promise<GusLookupResponse> {
    const response = await api.post('/clients/lookup-gus', { nip });
    return response.data;
  },

  async update(id: string, data: Partial<Client>): Promise<Client> {
    const response = await api.put(`/clients/${id}`, data);
    return response.data;
  },

  async delete(id: string): Promise<void> {
    await api.delete(`/clients/${id}`);
  },

  async deletePermanent(id: string): Promise<void> {
    await api.delete(`/clients/${id}/permanent`);
  },

  async exportCSV(): Promise<string> {
    const response = await api.get('/clients/export/csv', { responseType: 'text' });
    return response.data;
  },
};
