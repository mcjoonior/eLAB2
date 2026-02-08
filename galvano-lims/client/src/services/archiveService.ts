import api from './api';
import type { Analysis, PaginatedResponse, TrendDataPoint } from '@/types';

export const archiveService = {
  async getAnalyses(params?: {
    page?: number; limit?: number; clientId?: string; processId?: string;
    dateFrom?: string; dateTo?: string; parameterName?: string;
  }): Promise<PaginatedResponse<Analysis>> {
    const response = await api.get('/archive/analyses', { params });
    return response.data;
  },

  async getTrend(params: {
    clientId?: string; processId?: string; parameterName: string;
    dateFrom?: string; dateTo?: string;
  }): Promise<TrendDataPoint[]> {
    const response = await api.get('/archive/trend', { params });
    return response.data;
  },

  async getDeviations(params?: {
    clientId?: string; processId?: string; dateFrom?: string; dateTo?: string;
  }): Promise<any[]> {
    const response = await api.get('/archive/deviations', { params });
    return response.data;
  },

  async exportCSV(params?: {
    clientId?: string; processId?: string; dateFrom?: string; dateTo?: string;
  }): Promise<string> {
    const response = await api.get('/archive/export/csv', { params, responseType: 'text' });
    return response.data;
  },
};
