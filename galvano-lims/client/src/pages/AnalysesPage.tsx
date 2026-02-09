import { useState, useEffect, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Plus, Filter, X } from 'lucide-react';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import { Pagination } from '@/components/common/Pagination';
import { analysisService } from '@/services/analysisService';
import { sampleService } from '@/services/sampleService';
import {
  getAnalysisStatusColor,
  getAnalysisStatusLabel,
  formatDate,
} from '@/utils/helpers';
import type { Analysis, Sample, AnalysisStatus } from '@/types';

const ANALYSIS_STATUSES: AnalysisStatus[] = ['PENDING', 'IN_PROGRESS', 'COMPLETED', 'APPROVED', 'REJECTED'];

export default function AnalysesPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const [analyses, setAnalyses] = useState<Analysis[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Pagination
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const limit = 20;

  // Filters
  const [filterStatus, setFilterStatus] = useState<AnalysisStatus | ''>('');
  const [filterDateFrom, setFilterDateFrom] = useState('');
  const [filterDateTo, setFilterDateTo] = useState('');

  // Create dialog
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [samples, setSamples] = useState<Sample[]>([]);
  const [samplesLoading, setSamplesLoading] = useState(false);
  const [newAnalysis, setNewAnalysis] = useState({ sampleId: '', notes: '' });
  const [createLoading, setCreateLoading] = useState(false);
  const [createError, setCreateError] = useState('');

  useEffect(() => {
    fetchAnalyses();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, filterStatus, filterDateFrom, filterDateTo]);

  async function fetchAnalyses() {
    setLoading(true);
    setError('');
    try {
      const params: Record<string, any> = { page, limit };
      if (filterStatus) params.status = filterStatus;
      if (filterDateFrom) params.dateFrom = filterDateFrom;
      if (filterDateTo) params.dateTo = filterDateTo;

      const res = await analysisService.getAll(params);
      setAnalyses(res.data);
      setTotalPages(res.pagination.totalPages);
      setTotal(res.pagination.total);
    } catch {
      setError('Nie udało się pobrać listy analiz. Spróbuj ponownie.');
    } finally {
      setLoading(false);
    }
  }

  async function openCreateDialog() {
    setShowCreateDialog(true);
    setCreateError('');
    setNewAnalysis({ sampleId: '', notes: '' });
    setSamplesLoading(true);
    try {
      const res = await sampleService.getAll({ limit: 200, status: 'REGISTERED' });
      setSamples(res.data);
    } catch {
      setCreateError('Nie udało się pobrać listy próbek.');
    } finally {
      setSamplesLoading(false);
    }
  }

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    if (!newAnalysis.sampleId) {
      setCreateError('Wybór próbki jest wymagany.');
      return;
    }
    setCreateLoading(true);
    setCreateError('');
    try {
      await analysisService.create({
        sampleId: newAnalysis.sampleId,
        notes: newAnalysis.notes || undefined,
      });
      setShowCreateDialog(false);
      setPage(1);
      fetchAnalyses();
    } catch {
      setCreateError('Nie udało się utworzyć analizy. Spróbuj ponownie.');
    } finally {
      setCreateLoading(false);
    }
  }

  function resetFilters() {
    setFilterStatus('');
    setFilterDateFrom('');
    setFilterDateTo('');
    setPage(1);
  }

  const hasFilters = filterStatus || filterDateFrom || filterDateTo;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          Analizy
        </h1>
        <button
          onClick={openCreateDialog}
          className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-colors"
        >
          <Plus className="h-4 w-4" />
          Nowa analiza
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
        <div className="flex items-center gap-2 mb-3">
          <Filter className="h-4 w-4 text-gray-500" />
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{t('common.filter')}</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <select
            value={filterStatus}
            onChange={(e) => { setFilterStatus(e.target.value as AnalysisStatus | ''); setPage(1); }}
            className="block w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none"
          >
            <option value="">Wszystkie statusy</option>
            {ANALYSIS_STATUSES.map((s) => (
              <option key={s} value={s}>{getAnalysisStatusLabel(s)}</option>
            ))}
          </select>
          <input
            type="date"
            value={filterDateFrom}
            onChange={(e) => { setFilterDateFrom(e.target.value); setPage(1); }}
            className="block w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none"
            placeholder="Od"
          />
          <input
            type="date"
            value={filterDateTo}
            onChange={(e) => { setFilterDateTo(e.target.value); setPage(1); }}
            className="block w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none"
            placeholder="Do"
          />
        </div>
        {hasFilters && (
          <div className="mt-3 flex justify-end">
            <button
              onClick={resetFilters}
              className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
            >
              <X className="h-3 w-3" />
              {t('common.reset')}
            </button>
          </div>
        )}
      </div>

      {/* Error */}
      {error && (
        <div className="rounded-lg bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 p-4 text-sm text-red-700 dark:text-red-400">
          {error}
        </div>
      )}

      {/* Table */}
      {loading ? (
        <LoadingSpinner text={t('common.loading')} />
      ) : analyses.length === 0 ? (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-12 text-center">
          <p className="text-gray-500 dark:text-gray-400">Nie znaleziono analiz.</p>
        </div>
      ) : (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50">
                  <th className="text-left px-4 py-3 font-medium text-gray-700 dark:text-gray-300">Kod</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-700 dark:text-gray-300">Próbka</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-700 dark:text-gray-300">Klient</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-700 dark:text-gray-300">Proces</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-700 dark:text-gray-300">Status</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-700 dark:text-gray-300">Data</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-700 dark:text-gray-300">Wykonał</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-700 dark:text-gray-300">{t('common.actions')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {analyses.map((analysis) => (
                  <tr
                    key={analysis.id}
                    onClick={() => navigate(`/analyses/${analysis.id}`)}
                    className="hover:bg-gray-50 dark:hover:bg-gray-700/50 cursor-pointer transition-colors"
                  >
                    <td className="px-4 py-3 font-medium text-gray-900 dark:text-white">
                      {analysis.analysisCode}
                    </td>
                    <td className="px-4 py-3 text-gray-600 dark:text-gray-400">
                      {analysis.sample?.sampleCode || '-'}
                    </td>
                    <td className="px-4 py-3 text-gray-600 dark:text-gray-400">
                      {analysis.sample?.client?.companyName || '-'}
                    </td>
                    <td className="px-4 py-3 text-gray-600 dark:text-gray-400">
                      {analysis.sample?.process?.name || '-'}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${getAnalysisStatusColor(analysis.status)}`}>
                        {getAnalysisStatusLabel(analysis.status)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-600 dark:text-gray-400">
                      {formatDate(analysis.analysisDate)}
                    </td>
                    <td className="px-4 py-3 text-gray-600 dark:text-gray-400">
                      {analysis.performer
                        ? `${analysis.performer.firstName} ${analysis.performer.lastName}`
                        : '-'}
                    </td>
                    <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                      <button
                        onClick={() => navigate(`/analyses/${analysis.id}`)}
                        className="inline-flex items-center rounded-md px-2 py-1 text-xs font-medium text-blue-600 hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-900/30 transition-colors"
                      >
                        Szczegóły
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="border-t border-gray-200 dark:border-gray-700 px-4">
            <Pagination
              page={page}
              totalPages={totalPages}
              total={total}
              limit={limit}
              onPageChange={setPage}
            />
          </div>
        </div>
      )}

      {/* Create Dialog */}
      {showCreateDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="fixed inset-0 bg-black/50" onClick={() => setShowCreateDialog(false)} />
          <div className="relative z-10 w-full max-w-lg rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-xl p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                Nowa analiza
              </h2>
              <button
                onClick={() => setShowCreateDialog(false)}
                className="rounded-lg p-1 hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {createError && (
              <div className="mb-4 rounded-lg bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 p-3 text-sm text-red-700 dark:text-red-400">
                {createError}
              </div>
            )}

            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                  Próbka *
                </label>
                {samplesLoading ? (
                  <div className="text-sm text-gray-500">Ładowanie próbek...</div>
                ) : (
                  <select
                    value={newAnalysis.sampleId}
                    onChange={(e) => setNewAnalysis({ ...newAnalysis, sampleId: e.target.value })}
                    required
                    className="block w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2.5 text-sm text-gray-900 dark:text-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none"
                  >
                    <option value="">-- Wybierz próbkę --</option>
                    {samples.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.sampleCode} - {s.client?.companyName || 'Brak klienta'} ({s.process?.name || 'Brak procesu'})
                      </option>
                    ))}
                  </select>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                  Notatki
                </label>
                <textarea
                  value={newAnalysis.notes}
                  onChange={(e) => setNewAnalysis({ ...newAnalysis, notes: e.target.value })}
                  rows={3}
                  className="block w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2.5 text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none resize-none"
                  placeholder="Opcjonalne notatki..."
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCreateDialog(false)}
                  className="rounded-lg px-4 py-2.5 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                >
                  {t('common.cancel')}
                </button>
                <button
                  type="submit"
                  disabled={createLoading}
                  className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
                >
                  {createLoading && <div className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
                  Utwórz analizę
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
