import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { adminService } from '@/services/adminService';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import { Pagination } from '@/components/common/Pagination';
import type { AuditLog } from '@/types';
import { formatDateTime } from '@/utils/helpers';
import { FileText, Filter, RotateCcw } from 'lucide-react';

const ACTION_LABELS: Record<string, string> = {
  LOGIN: 'Logowanie', LOGOUT: 'Wylogowanie', CREATE: 'Utworzenie', UPDATE: 'Aktualizacja',
  DELETE: 'Usunięcie', APPROVE: 'Zatwierdzenie', REJECT: 'Odrzucenie', IMPORT: 'Import',
  EXPORT: 'Eksport', SEND_EMAIL: 'Wysłanie emaila', GENERATE_REPORT: 'Generowanie raportu',
};

const ENTITY_LABELS: Record<string, string> = {
  USER: 'Użytkownik', CLIENT: 'Klient', PROCESS: 'Proces', SAMPLE: 'Próbka',
  ANALYSIS: 'Analiza', REPORT: 'Raport', IMPORT_JOB: 'Zadanie importu', SETTINGS: 'Ustawienia',
};

export default function AuditLogPage() {
  const { t } = useTranslation();
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [total, setTotal] = useState(0);
  const [filters, setFilters] = useState({ action: '', entityType: '', dateFrom: '', dateTo: '' });

  useEffect(() => { fetchLogs(); }, [page, filters]);

  async function fetchLogs() {
    setLoading(true);
    try {
      const params: any = { page, limit: 25 };
      if (filters.action) params.action = filters.action;
      if (filters.entityType) params.entityType = filters.entityType;
      if (filters.dateFrom) params.dateFrom = filters.dateFrom;
      if (filters.dateTo) params.dateTo = filters.dateTo;
      const data = await adminService.getAuditLogs(params);
      setLogs(data.data);
      setTotalPages(data.pagination.totalPages);
      setTotal(data.pagination.total);
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }

  function resetFilters() {
    setFilters({ action: '', entityType: '', dateFrom: '', dateTo: '' });
    setPage(1);
  }

  function getActionColor(action: string): string {
    switch (action) {
      case 'CREATE': return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
      case 'UPDATE': return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
      case 'DELETE': return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
      case 'APPROVE': return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200';
      case 'LOGIN': return 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200';
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200';
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <FileText className="h-6 w-6 text-primary" />
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{t('admin.auditLog')}</h1>
      </div>

      {/* Filters */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
        <div className="flex items-center gap-2 mb-3">
          <Filter className="h-4 w-4 text-gray-500" />
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Filtry</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          <select value={filters.action} onChange={(e) => { setFilters({ ...filters, action: e.target.value }); setPage(1); }}
            className="rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none">
            <option value="">Wszystkie akcje</option>
            {Object.entries(ACTION_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
          <select value={filters.entityType} onChange={(e) => { setFilters({ ...filters, entityType: e.target.value }); setPage(1); }}
            className="rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none">
            <option value="">Wszystkie typy</option>
            {Object.entries(ENTITY_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
          <input type="date" value={filters.dateFrom} onChange={(e) => { setFilters({ ...filters, dateFrom: e.target.value }); setPage(1); }}
            className="rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none" />
          <input type="date" value={filters.dateTo} onChange={(e) => { setFilters({ ...filters, dateTo: e.target.value }); setPage(1); }}
            className="rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none" />
          <button onClick={resetFilters} className="inline-flex items-center justify-center gap-2 rounded-lg border border-gray-300 dark:border-gray-600 px-3 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700">
            <RotateCcw className="h-4 w-4" /> Resetuj
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
        {loading ? <LoadingSpinner text="Ładowanie logów..." /> : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50">
                    <th className="text-left px-4 py-3 font-medium text-gray-700 dark:text-gray-300">Data</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-700 dark:text-gray-300">Użytkownik</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-700 dark:text-gray-300">Akcja</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-700 dark:text-gray-300">Typ encji</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-700 dark:text-gray-300">ID encji</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-700 dark:text-gray-300">Szczegóły</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-700 dark:text-gray-300">IP</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                  {logs.length === 0 ? (
                    <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-500 dark:text-gray-400">Brak logów do wyświetlenia.</td></tr>
                  ) : logs.map((log) => (
                    <tr key={log.id} className="hover:bg-gray-50 dark:hover:bg-gray-900/30">
                      <td className="px-4 py-3 text-gray-600 dark:text-gray-400 whitespace-nowrap">{formatDateTime(log.createdAt)}</td>
                      <td className="px-4 py-3 text-gray-900 dark:text-white">
                        {log.user ? `${log.user.firstName} ${log.user.lastName}` : log.userId || '-'}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${getActionColor(log.action)}`}>
                          {ACTION_LABELS[log.action] || log.action}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-700 dark:text-gray-300">{ENTITY_LABELS[log.entityType] || log.entityType}</td>
                      <td className="px-4 py-3 text-gray-500 dark:text-gray-400 font-mono text-xs">{log.entityId ? log.entityId.substring(0, 8) + '...' : '-'}</td>
                      <td className="px-4 py-3 text-gray-500 dark:text-gray-400 text-xs max-w-48 truncate">
                        {log.details ? JSON.stringify(log.details).substring(0, 60) : '-'}
                      </td>
                      <td className="px-4 py-3 text-gray-500 dark:text-gray-400 font-mono text-xs">{log.ipAddress || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination page={page} totalPages={totalPages} total={total} limit={25} onPageChange={setPage} />
          </>
        )}
      </div>
    </div>
  );
}
