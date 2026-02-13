import type { Deviation, Priority, SampleStatus, AnalysisStatus, AnalysisType, ProcessType, SampleType, RecommendationType } from '@/types';

export function cn(...classes: (string | undefined | false)[]) {
  return classes.filter(Boolean).join(' ');
}

export function getDeviationColor(deviation: Deviation): string {
  switch (deviation) {
    case 'WITHIN_RANGE':
      return 'text-green-600 bg-green-50 dark:text-green-400 dark:bg-green-950';
    case 'BELOW_MIN':
    case 'ABOVE_MAX':
      return 'text-yellow-600 bg-yellow-50 dark:text-yellow-400 dark:bg-yellow-950';
    case 'CRITICAL_LOW':
    case 'CRITICAL_HIGH':
      return 'text-red-600 bg-red-50 dark:text-red-400 dark:bg-red-950';
    default:
      return '';
  }
}

export function getDeviationBadgeColor(deviation: Deviation): string {
  switch (deviation) {
    case 'WITHIN_RANGE':
      return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
    case 'BELOW_MIN':
    case 'ABOVE_MAX':
      return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
    case 'CRITICAL_LOW':
    case 'CRITICAL_HIGH':
      return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
    default:
      return 'bg-gray-100 text-gray-800';
  }
}

export function getDeviationLabel(deviation: Deviation): string {
  const labels: Record<Deviation, string> = {
    WITHIN_RANGE: 'W normie',
    BELOW_MIN: 'Poniżej minimum',
    ABOVE_MAX: 'Powyżej maximum',
    CRITICAL_LOW: 'Krytycznie niski',
    CRITICAL_HIGH: 'Krytycznie wysoki',
  };
  return labels[deviation] || deviation;
}

export function getPriorityColor(priority: Priority): string {
  switch (priority) {
    case 'LOW':
      return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
    case 'MEDIUM':
      return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
    case 'HIGH':
      return 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200';
    case 'CRITICAL':
      return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
    default:
      return 'bg-gray-100 text-gray-800';
  }
}

export function getPriorityLabel(priority: Priority): string {
  const labels: Record<Priority, string> = {
    LOW: 'Niski',
    MEDIUM: 'Średni',
    HIGH: 'Wysoki',
    CRITICAL: 'Krytyczny',
  };
  return labels[priority] || priority;
}

export function getSampleStatusColor(status: SampleStatus): string {
  switch (status) {
    case 'REGISTERED':
      return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
    case 'IN_PROGRESS':
      return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
    case 'COMPLETED':
      return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
    case 'CANCELLED':
      return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200';
    default:
      return 'bg-gray-100 text-gray-800';
  }
}

export function getSampleStatusLabel(status: SampleStatus): string {
  const labels: Record<SampleStatus, string> = {
    REGISTERED: 'Zarejestrowana',
    IN_PROGRESS: 'W trakcie',
    COMPLETED: 'Zakończona',
    CANCELLED: 'Anulowana',
  };
  return labels[status] || status;
}

export function getAnalysisStatusColor(status: AnalysisStatus): string {
  switch (status) {
    case 'PENDING':
      return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200';
    case 'IN_PROGRESS':
      return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
    case 'COMPLETED':
      return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
    case 'APPROVED':
      return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
    case 'REJECTED':
      return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
    default:
      return 'bg-gray-100 text-gray-800';
  }
}

export function getAnalysisStatusLabel(status: AnalysisStatus): string {
  const labels: Record<AnalysisStatus, string> = {
    PENDING: 'Oczekująca',
    IN_PROGRESS: 'W trakcie',
    COMPLETED: 'Zakończona',
    APPROVED: 'Zatwierdzona',
    REJECTED: 'Odrzucona',
  };
  return labels[status] || status;
}

export function getAnalysisTypeLabel(type: AnalysisType): string {
  const labels: Record<AnalysisType, string> = {
    CHEMICAL: 'Analiza chemiczna',
    CORROSION_TEST: 'Test korozji',
    SURFACE_ANALYSIS: 'Analiza powierzchni',
  };
  return labels[type] || type;
}

export function getAnalysisTypeColor(type: AnalysisType): string {
  switch (type) {
    case 'CHEMICAL':
      return 'bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300';
    case 'CORROSION_TEST':
      return 'bg-orange-100 text-orange-800 dark:bg-orange-900/50 dark:text-orange-300';
    case 'SURFACE_ANALYSIS':
      return 'bg-purple-100 text-purple-800 dark:bg-purple-900/50 dark:text-purple-300';
    default:
      return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300';
  }
}

export function getProcessTypeLabel(type: ProcessType): string {
  const labels: Record<ProcessType, string> = {
    ZINC: 'Cynkowanie',
    NICKEL: 'Niklowanie',
    CHROME: 'Chromowanie',
    COPPER: 'Miedziowanie',
    TIN: 'Cynowanie',
    GOLD: 'Złocenie',
    SILVER: 'Srebrzenie',
    ANODIZING: 'Anodowanie',
    PASSIVATION: 'Pasywacja',
    OTHER: 'Inne',
  };
  return labels[type] || type;
}

export function getSampleTypeLabel(type: SampleType): string {
  const labels: Record<SampleType, string> = {
    BATH: 'Kąpiel',
    RINSE: 'Płukanka',
    WASTEWATER: 'Ściek',
    RAW_MATERIAL: 'Surowiec',
    OTHER: 'Inne',
  };
  return labels[type] || type;
}

export function getRecommendationTypeLabel(type: RecommendationType): string {
  const labels: Record<RecommendationType, string> = {
    INCREASE: 'Zwiększyć',
    DECREASE: 'Zmniejszyć',
    MAINTAIN: 'Utrzymać',
    URGENT_ACTION: 'Pilna akcja',
  };
  return labels[type] || type;
}

export function formatDate(date: string | Date): string {
  return new Date(date).toLocaleDateString('pl-PL', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
}

export function formatDateTime(date: string | Date): string {
  return new Date(date).toLocaleString('pl-PL', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function formatNumber(value: number | string, decimals = 2): string {
  const num = typeof value === 'string' ? parseFloat(value) : value;
  return isNaN(num) ? '-' : num.toFixed(decimals).replace('.', ',');
}

export function downloadCSV(data: string, filename: string) {
  const blob = new Blob(['\ufeff' + data], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  link.click();
  URL.revokeObjectURL(link.href);
}
