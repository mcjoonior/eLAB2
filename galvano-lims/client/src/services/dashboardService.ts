import api from './api';
import type { DashboardStats, Analysis } from '@/types';

export const dashboardService = {
  async getStats(): Promise<DashboardStats> {
    const response = await api.get('/dashboard/stats');
    return response.data;
  },

  async getRecentAnalyses(): Promise<Analysis[]> {
    const response = await api.get('/dashboard/recent-analyses');
    return response.data;
  },

  async getCriticalAlerts(): Promise<any[]> {
    const response = await api.get('/dashboard/critical-alerts');
    return response.data;
  },
};
