import api from './api';
import type { AnalysisPriceListItem, PaginatedResponse } from '@/types';

export interface CreatePriceListItemPayload {
  code: string;
  name: string;
  analysisType: string;
  description?: string;
  unit?: string;
  priceNet: number;
  currency?: string;
  isActive?: boolean;
  effectiveFrom: string;
  effectiveTo?: string | null;
}

export const priceListService = {
  async getAll(params?: {
    page?: number;
    limit?: number;
    analysisType?: string;
    isActive?: boolean;
    currency?: string;
    asOf?: string;
  }): Promise<PaginatedResponse<AnalysisPriceListItem>> {
    const response = await api.get('/price-list', { params });
    return response.data;
  },

  async create(payload: CreatePriceListItemPayload): Promise<AnalysisPriceListItem> {
    const response = await api.post('/price-list', payload);
    return response.data;
  },

  async update(id: string, payload: Partial<CreatePriceListItemPayload>): Promise<AnalysisPriceListItem> {
    const response = await api.put(`/price-list/${id}`, payload);
    return response.data;
  },
};
