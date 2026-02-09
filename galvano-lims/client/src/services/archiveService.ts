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
  min?: number;
  max?: number;
  deviation: Deviation;
}

export interface DeviationData {
  parameterName: string;
  withinRange: number;
  belowMin: number;
  aboveMax: number;
  criticalLow: number;
  criticalHigh: number;
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
    dateFrom?: string; dateTo?: string;
  }): Promise<TrendDataPoint[]> {
    const response = await api.get('/archive/trend', { params });
    const raw = response.data;

    // Backend returns { parameterName, dataPoints, statistics }
    // Transform dataPoints to TrendDataPoint[]
    return (raw.dataPoints || []).map((dp: any) => ({
      date: dp.analysis?.analysisDate || '',
      value: Number(dp.value),
      min: dp.minReference != null ? Number(dp.minReference) : undefined,
      max: dp.maxReference != null ? Number(dp.maxReference) : undefined,
      optimal: dp.optimalReference != null ? Number(dp.optimalReference) : undefined,
    }));
  },

  async getDeviations(params?: {
    clientId?: string; processId?: string; dateFrom?: string; dateTo?: string;
  }): Promise<DeviationData[]> {
    const response = await api.get('/archive/deviations', { params });
    const raw = response.data;

    // Backend returns { summary, parameterBreakdown }
    // Transform parameterBreakdown to DeviationData[]
    return (raw.parameterBreakdown || []).map((p: any) => ({
      parameterName: p.parameterName,
      withinRange: p.deviations?.WITHIN_RANGE || 0,
      belowMin: p.deviations?.BELOW_MIN || 0,
      aboveMax: p.deviations?.ABOVE_MAX || 0,
      criticalLow: p.deviations?.CRITICAL_LOW || 0,
      criticalHigh: p.deviations?.CRITICAL_HIGH || 0,
    }));
  },

  async exportCSV(params?: {
    clientId?: string; processId?: string; dateFrom?: string; dateTo?: string;
  }): Promise<string> {
    const response = await api.get('/archive/export/csv', { params, responseType: 'text' });
    return response.data;
  },
};
