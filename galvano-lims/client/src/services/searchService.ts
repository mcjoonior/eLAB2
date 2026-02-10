import api from './api';
import type { GlobalSearchResponse } from '@/types';

export const searchService = {
  async globalSearch(query: string, limit = 5): Promise<GlobalSearchResponse> {
    const response = await api.get('/search', { params: { q: query, limit } });
    return response.data;
  },
};
