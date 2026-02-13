import api from './api';
import type { Report, PaginatedResponse } from '@/types';

export const reportService = {
  async getAll(params?: { page?: number; limit?: number }): Promise<PaginatedResponse<Report>> {
    const response = await api.get('/reports', { params });
    return response.data;
  },

  async getById(id: string): Promise<Report> {
    const response = await api.get(`/reports/${id}`);
    return response.data;
  },

  async generate(analysisId: string): Promise<Report> {
    const response = await api.post(`/reports/generate/${analysisId}`);
    return response.data;
  },

  async download(id: string): Promise<Blob> {
    const response = await api.get(`/reports/${id}/download`, { responseType: 'blob' });
    return response.data;
  },

  async sendEmail(id: string, email?: string): Promise<void> {
    await api.post(`/reports/${id}/send-email`, { recipientEmail: email });
  },

  async delete(id: string): Promise<void> {
    await api.delete(`/reports/${id}`);
  },
};
