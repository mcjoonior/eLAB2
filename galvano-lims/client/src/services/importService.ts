import api from './api';
import type { ImportJob, ImportTemplate, PaginatedResponse } from '@/types';

type FrontMappingConfig = {
  type?: string;
  columns?: Record<string, string>;
  importType?: string;
  columnMappings?: Array<{
    sourceColumn: string;
    targetField: string;
    transformation?: string;
    defaultValue?: string;
  }>;
  sourceSystem?: string;
  dateFormat?: string;
  decimalSeparator?: string;
  skipEmptyRows?: boolean;
  deduplication?: string;
  deduplicateBy?: string;
};

function toBackendMappingConfig(mappingConfig: FrontMappingConfig) {
  const importType = mappingConfig.importType ?? mappingConfig.type ?? 'FULL';

  const columnMappings = mappingConfig.columnMappings ?? Object.entries(mappingConfig.columns ?? {})
    .filter(([, targetField]) => !!targetField)
    .map(([sourceColumn, targetField]) => ({
      sourceColumn,
      targetField,
    }));

  return {
    importType,
    columnMappings,
    sourceSystem: mappingConfig.sourceSystem,
    dateFormat: mappingConfig.dateFormat,
    decimalSeparator: mappingConfig.decimalSeparator,
    skipEmptyRows: mappingConfig.skipEmptyRows ?? true,
    deduplicateBy: mappingConfig.deduplicateBy ?? mappingConfig.deduplication,
  };
}

function toFrontMappingConfig(mappingConfig: any) {
  if (!mappingConfig) return {};

  const columns: Record<string, string> = {};
  if (Array.isArray(mappingConfig.columnMappings)) {
    for (const cm of mappingConfig.columnMappings) {
      if (cm?.sourceColumn && cm?.targetField) {
        columns[cm.sourceColumn] = cm.targetField;
      }
    }
  }

  return {
    type: mappingConfig.importType,
    columns,
    dateFormat: mappingConfig.dateFormat,
    decimalSeparator: mappingConfig.decimalSeparator,
    deduplication: mappingConfig.deduplicateBy,
  };
}

export const importService = {
  async upload(file: File, sourceSystem?: string): Promise<{ jobId: string; preview: any[]; columns: string[] }> {
    const formData = new FormData();
    formData.append('file', file);
    if (sourceSystem) formData.append('sourceSystem', sourceSystem);
    const response = await api.post('/import/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return {
      jobId: response.data?.importJob?.id ?? '',
      preview: response.data?.file?.previewRows ?? [],
      columns: response.data?.file?.headers ?? [],
    };
  },

  async validate(jobId: string, mappingConfig: any): Promise<{
    ready: number; warnings: number; errors: any[];
  }> {
    const payload = toBackendMappingConfig(mappingConfig);
    const response = await api.post('/import/validate', {
      importJobId: jobId,
      ...payload,
    });
    const report = response.data?.validationReport ?? response.data;
    return {
      ready: report?.ready ?? 0,
      warnings: report?.warnings ?? 0,
      errors: report?.errors ?? [],
    };
  },

  async execute(jobId: string, mappingConfig: any): Promise<ImportJob> {
    const payload = toBackendMappingConfig(mappingConfig);
    const response = await api.post('/import/execute', {
      importJobId: jobId,
      mappingConfig: payload,
    });
    return response.data?.progress ?? response.data;
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
    const templates = Array.isArray(response.data) ? response.data : [];
    return templates.map((tpl: any) => ({
      ...tpl,
      mappingConfig: toFrontMappingConfig(tpl.mappingConfig),
    }));
  },

  async saveTemplate(data: Partial<ImportTemplate>): Promise<ImportTemplate> {
    const payload = {
      ...data,
      mappingConfig: toBackendMappingConfig((data.mappingConfig as FrontMappingConfig) ?? {}),
    };
    const response = await api.post('/import/templates', payload);
    return {
      ...response.data,
      mappingConfig: toFrontMappingConfig(response.data?.mappingConfig),
    };
  },
};
