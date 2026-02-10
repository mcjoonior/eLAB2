import api from './api';

export interface GlobalSearchResults {
  clients: Array<{
    id: string;
    companyName: string;
    nip?: string;
    contactPerson?: string;
    city?: string;
  }>;
  samples: Array<{
    id: string;
    sampleCode: string;
    status: string;
    sampleType: string;
    client?: { id: string; companyName: string };
  }>;
  analyses: Array<{
    id: string;
    analysisCode: string;
    status: string;
    analysisDate: string;
    sample?: {
      id: string;
      sampleCode: string;
      client?: { companyName: string };
      process?: { id: string; name: string };
    };
  }>;
  processes: Array<{
    id: string;
    name: string;
    processType: string;
    description?: string;
  }>;
}

export async function globalSearch(q: string, limit = 5): Promise<GlobalSearchResults> {
  const response = await api.get('/search', { params: { q, limit } });
  return response.data;
}
