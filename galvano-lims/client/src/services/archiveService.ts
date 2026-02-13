import api from './api';
import type { PaginatedResponse, TrendDataPoint, Deviation } from '@/types';

export interface ArchiveAnalysisRow {
  id: string;
  date: string;
  analysisCode: string;
  clientName: string;
  processName: string;
  parameterName: string;
  value: number;
  measurementUncertainty?: number;
  min?: number;
  max?: number;
  deviation: Deviation;
}

export const archiveService = {
  async getAnalyses(params?: {
    page?: number; limit?: number; clientId?: string; processId?: string;
    dateFrom?: string; dateTo?: string; parameterName?: string;
  }): Promise<PaginatedResponse<ArchiveAnalysisRow>> {
    const response = await api.get('/archive/analyses', { params });
    const raw = response.data;

    // Flatten: each analysis result becomes its own row
    const flatRows: ArchiveAnalysisRow[] = [];
    for (const a of raw.data) {
      const base = {
        analysisCode: a.analysisCode,
        date: a.analysisDate,
        clientName: a.sample?.client?.companyName || '',
        processName: a.sample?.process?.name || '',
      };

      if (a.results && a.results.length > 0) {
        for (const r of a.results) {
          flatRows.push({
            id: r.id || a.id,
            ...base,
            parameterName: r.parameterName,
            value: Number(r.value),
            measurementUncertainty: r.measurementUncertainty != null ? Number(r.measurementUncertainty) : undefined,
            min: r.minReference != null ? Number(r.minReference) : undefined,
            max: r.maxReference != null ? Number(r.maxReference) : undefined,
            deviation: r.deviation,
          });
        }
      } else {
        flatRows.push({
          id: a.id,
          ...base,
          parameterName: '',
          value: 0,
          deviation: 'WITHIN_RANGE' as Deviation,
        });
      }
    }

    return {
      data: flatRows,
      pagination: raw.pagination,
    };
  },

  async getTrend(params: {
    clientId?: string; processId?: string; parameterName: string;
    dateFrom?: string; dateTo?: string; includeDrafts?: boolean;
  }): Promise<TrendDataPoint[]> {
    const response = await api.get('/archive/trend', { params });
    const raw = response.data;

    // Backend returns { parameterName, dataPoints, statistics }
    // Transform dataPoints to TrendDataPoint[]
    return (raw.dataPoints || []).map((dp: any) => ({
      date: dp.analysis?.analysisDate || '',
      value: typeof dp.value === 'number' ? dp.value : Number(dp.value),
      min: dp.minReference != null ? Number(dp.minReference) : undefined,
      max: dp.maxReference != null ? Number(dp.maxReference) : undefined,
      optimal: dp.optimalReference != null ? Number(dp.optimalReference) : undefined,
    }));
  },

  async exportCSV(params?: {
    clientId?: string; processId?: string; dateFrom?: string; dateTo?: string;
  }): Promise<string> {
    const response = await api.get('/archive/export/csv', { params, responseType: 'text' });
    return response.data;
  },
};
