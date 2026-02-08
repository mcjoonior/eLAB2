import api from './api';
import type { ImportJob, ImportTemplate, PaginatedResponse } from '@/types';

export const importService = {
  async upload(file: File, sourceSystem?: string): Promise<{ jobId: string; preview: any[]; columns: string[] }> {
    const formData = new FormData();
    formData.append('file', file);
    if (sourceSystem) formData.append('sourceSystem', sourceSystem);
    const response = await api.post('/import/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
  },

  async validate(jobId: string, mappingConfig: any): Promise<{
    ready: number; warnings: number; errors: any[];
  }> {
    const response = await api.post('/import/validate', { jobId, mappingConfig });
    return response.data;
  },

  async execute(jobId: string, mappingConfig: any): Promise<ImportJob> {
    const response = await api.post('/import/execute', { jobId, mappingConfig });
    return response.data;
  },

  async getJobs(params?: { page?: number; limit?: number }): Promise<PaginatedResponse<ImportJob>> {
    const response = await api.get('/import/jobs', { params });
    return response.data;
  },

  async getJob(id: string): Promise<ImportJob> {
    const response = await api.get(`/import/jobs/${id}`);
    return response.data;
  },

  async rollback(id: string): Promise<void> {
    await api.post(`/import/jobs/${id}/rollback`);
  },

  async getTemplates(): Promise<ImportTemplate[]> {
    const response = await api.get('/import/templates');
    return response.data;
  },

  async saveTemplate(data: Partial<ImportTemplate>): Promise<ImportTemplate> {
    const response = await api.post('/import/templates', data);
    return response.data;
  },
};
