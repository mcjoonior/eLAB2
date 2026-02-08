import api from './api';
import type { Analysis, AnalysisResult, Recommendation, PaginatedResponse, AnalysisStatus } from '@/types';

export const analysisService = {
  async getAll(params?: {
    page?: number; limit?: number; status?: AnalysisStatus;
    sampleId?: string; performedBy?: string; dateFrom?: string; dateTo?: string;
  }): Promise<PaginatedResponse<Analysis>> {
    const response = await api.get('/analyses', { params });
    return response.data;
  },

  async getById(id: string): Promise<Analysis> {
    const response = await api.get(`/analyses/${id}`);
    return response.data;
  },

  async create(data: { sampleId: string; notes?: string }): Promise<Analysis> {
    const response = await api.post('/analyses', data);
    return response.data;
  },

  async update(id: string, data: Partial<Analysis>): Promise<Analysis> {
    const response = await api.put(`/analyses/${id}`, data);
    return response.data;
  },

  async changeStatus(id: string, status: AnalysisStatus): Promise<Analysis> {
    const response = await api.patch(`/analyses/${id}/status`, { status });
    return response.data;
  },

  async approve(id: string): Promise<Analysis> {
    const response = await api.patch(`/analyses/${id}/approve`);
    return response.data;
  },

  async saveResults(id: string, results: Partial<AnalysisResult>[]): Promise<AnalysisResult[]> {
    const response = await api.post(`/analyses/${id}/results`, { results });
    return response.data;
  },

  async addRecommendation(id: string, data: Partial<Recommendation>): Promise<Recommendation> {
    const response = await api.post(`/analyses/${id}/recommendations`, data);
    return response.data;
  },

  async getRecommendations(id: string): Promise<Recommendation[]> {
    const response = await api.get(`/analyses/${id}/recommendations`);
    return response.data;
  },
};
