import { useState, useEffect, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Plus, Filter, Edit2, ChevronDown, X } from 'lucide-react';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import { Pagination } from '@/components/common/Pagination';
import { sampleService } from '@/services/sampleService';
import { clientService } from '@/services/clientService';
import { processService } from '@/services/processService';
import {
  getSampleStatusColor,
  getSampleStatusLabel,
  getSampleTypeLabel,
  formatDate,
} from '@/utils/helpers';
import type {
  Sample,
  Client,
  Process,
  SampleStatus,
  SampleType,
} from '@/types';

const SAMPLE_STATUSES: SampleStatus[] = ['REGISTERED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'];
const SAMPLE_TYPES: SampleType[] = ['BATH', 'RINSE', 'WASTEWATER', 'RAW_MATERIAL', 'OTHER'];

const VALID_NEXT_STATUSES: Record<SampleStatus, SampleStatus[]> = {
  REGISTERED: ['IN_PROGRESS', 'CANCELLED'],
  IN_PROGRESS: ['COMPLETED', 'CANCELLED'],
  COMPLETED: [],
  CANCELLED: [],
};

export default function SamplesPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();

  // Data
  const [samples, setSamples] = useState<Sample[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [processes, setProcesses] = useState<Process[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Pagination
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const limit = 20;

  // Filters
  const [filterStatus, setFilterStatus] = useState<SampleStatus | ''>('');
  const [filterClientId, setFilterClientId] = useState('');
  const [filterProcessId, setFilterProcessId] = useState('');
  const [filterDateFrom, setFilterDateFrom] = useState('');
  const [filterDateTo, setFilterDateTo] = useState('');

  // Dialog
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [createLoading, setCreateLoading] = useState(false);
  const [createError, setCreateError] = useState('');
  const [newSample, setNewSample] = useState({
    clientId: '',
    processId: '',
    sampleType: 'BATH' as SampleType,
    description: '',
    collectedAt: new Date().toISOString().slice(0, 10),
  });

  // Status change dropdown
  const [statusDropdownId, setStatusDropdownId] = useState<string | null>(null);

  // Fetch reference data
  useEffect(() => {
    async function loadReferenceData() {
      try {
        const [clientsRes, processesRes] = await Promise.all([
          clientService.getAll({ limit: 200, isActive: true }),
          processService.getAll({ limit: 200, isActive: true }),
        ]);
        setClients(clientsRes.data);
        setProcesses(processesRes.data);
      } catch {
        // Reference data loading failure is not critical
      }
    }
    loadReferenceData();
  }, []);

  // Fetch samples
  useEffect(() => {
    fetchSamples();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, filterStatus, filterClientId, filterProcessId, filterDateFrom, filterDateTo]);

  async function fetchSamples() {
    setLoading(true);
    setError('');
    try {
      const params: Record<string, any> = { page, limit };
      if (filterStatus) params.status = filterStatus;
      if (filterClientId) params.clientId = filterClientId;
      if (filterProcessId) params.processId = filterProcessId;
      if (filterDateFrom) params.dateFrom = filterDateFrom;
      if (filterDateTo) params.dateTo = filterDateTo;

      const res = await sampleService.getAll(params);
      setSamples(res.data);
      setTotalPages(res.pagination.totalPages);
      setTotal(res.pagination.total);
    } catch {
      setError('Nie udało się pobrać listy próbek. Spróbuj ponownie.');
    } finally {
      setLoading(false);
    }
  }

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    if (!newSample.clientId || !newSample.processId) {
      setCreateError('Klient i proces są wymagane.');
      return;
    }
    setCreateLoading(true);
    setCreateError('');
    try {
      await sampleService.create({
        clientId: newSample.clientId,
        processId: newSample.processId,
        sampleType: newSample.sampleType,
        description: newSample.description || undefined,
        collectedAt: newSample.collectedAt,
      });
      setShowCreateDialog(false);
      setNewSample({
        clientId: '',
        processId: '',
        sampleType: 'BATH',
        description: '',
        collectedAt: new Date().toISOString().slice(0, 10),
      });
      setPage(1);
      fetchSamples();
    } catch {
      setCreateError('Nie udało się zarejestrować próbki. Spróbuj ponownie.');
    } finally {
      setCreateLoading(false);
    }
  }

  async function handleStatusChange(sampleId: string, newStatus: SampleStatus) {
    setStatusDropdownId(null);
    try {
      await sampleService.changeStatus(sampleId, newStatus);
      fetchSamples();
    } catch {
      setError('Nie udało się zmienić statusu próbki.');
    }
  }

  function resetFilters() {
    setFilterStatus('');
    setFilterClientId('');
    setFilterProcessId('');
    setFilterDateFrom('');
    setFilterDateTo('');
    setPage(1);
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          {t('samples.title')}
        </h1>
        <button
          onClick={() => setShowCreateDialog(true)}
          className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-colors"
        >
          <Plus className="h-4 w-4" />
          {t('samples.addSample')}
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
        <div className="flex items-center gap-2 mb-3">
          <Filter className="h-4 w-4 text-gray-500" />
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{t('common.filter')}</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          {/* Status filter */}
          <select
            value={filterStatus}
            onChange={(e) => { setFilterStatus(e.target.value as SampleStatus | ''); setPage(1); }}
            className="block w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none"
          >
            <option value="">{t('common.all')} - {t('samples.status')}</option>
            {SAMPLE_STATUSES.map((s) => (
              <option key={s} value={s}>{getSampleStatusLabel(s)}</option>
            ))}
          </select>

          {/* Client filter */}
          <select
            value={filterClientId}
            onChange={(e) => { setFilterClientId(e.target.value); setPage(1); }}
            className="block w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none"
          >
            <option value="">{t('common.all')} - {t('samples.client')}</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>{c.companyName}</option>
            ))}
          </select>

          {/* Process filter */}
          <select
            value={filterProcessId}
            onChange={(e) => { setFilterProcessId(e.target.value); setPage(1); }}
            className="block w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none"
          >
            <option value="">{t('common.all')} - {t('samples.process')}</option>
            {processes.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>

          {/* Date range */}
          <input
            type="date"
            value={filterDateFrom}
            onChange={(e) => { setFilterDateFrom(e.target.value); setPage(1); }}
            placeholder="Od"
            className="block w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none"
          />
          <input
            type="date"
            value={filterDateTo}
            onChange={(e) => { setFilterDateTo(e.target.value); setPage(1); }}
            placeholder="Do"
            className="block w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none"
          />
        </div>
        {(filterStatus || filterClientId || filterProcessId || filterDateFrom || filterDateTo) && (
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
      ) : samples.length === 0 ? (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-12 text-center">
          <p className="text-gray-500 dark:text-gray-400">{t('samples.noSamples')}</p>
        </div>
      ) : (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50">
                  <th className="text-left px-4 py-3 font-medium text-gray-700 dark:text-gray-300">{t('samples.sampleCode')}</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-700 dark:text-gray-300">{t('samples.client')}</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-700 dark:text-gray-300">{t('samples.process')}</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-700 dark:text-gray-300">{t('samples.sampleType')}</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-700 dark:text-gray-300">{t('samples.status')}</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-700 dark:text-gray-300">{t('samples.collectedAt')}</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-700 dark:text-gray-300">{t('common.actions')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {samples.map((sample) => (
                  <tr
                    key={sample.id}
                    onClick={() => navigate(`/samples/${sample.id}`)}
                    className="hover:bg-gray-50 dark:hover:bg-gray-700/50 cursor-pointer transition-colors"
                  >
                    <td className="px-4 py-3 font-medium text-gray-900 dark:text-white">
                      {sample.sampleCode}
                    </td>
                    <td className="px-4 py-3 text-gray-600 dark:text-gray-400">
                      {sample.client?.companyName || '-'}
                    </td>
                    <td className="px-4 py-3 text-gray-600 dark:text-gray-400">
                      {sample.process?.name || '-'}
                    </td>
                    <td className="px-4 py-3 text-gray-600 dark:text-gray-400">
                      {getSampleTypeLabel(sample.sampleType)}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${getSampleStatusColor(sample.status)}`}>
                        {getSampleStatusLabel(sample.status)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-600 dark:text-gray-400">
                      {formatDate(sample.collectedAt)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-2" onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={() => navigate(`/samples/${sample.id}`)}
                          className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-blue-600 hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-900/30 transition-colors"
                        >
                          <Edit2 className="h-3 w-3" />
                          {t('common.edit')}
                        </button>
                        {VALID_NEXT_STATUSES[sample.status].length > 0 && (
                          <div className="relative">
                            <button
                              onClick={() => setStatusDropdownId(statusDropdownId === sample.id ? null : sample.id)}
                              className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700 transition-colors"
                            >
                              {t('samples.changeStatus')}
                              <ChevronDown className="h-3 w-3" />
                            </button>
                            {statusDropdownId === sample.id && (
                              <div className="absolute right-0 top-full z-10 mt-1 w-44 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-lg py-1">
                                {VALID_NEXT_STATUSES[sample.status].map((nextStatus) => (
                                  <button
                                    key={nextStatus}
                                    onClick={() => handleStatusChange(sample.id, nextStatus)}
                                    className="block w-full text-left px-3 py-2 text-xs hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300"
                                  >
                                    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${getSampleStatusColor(nextStatus)}`}>
                                      {getSampleStatusLabel(nextStatus)}
                                    </span>
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
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
          <div
            className="fixed inset-0 bg-black/50"
            onClick={() => setShowCreateDialog(false)}
          />
          <div className="relative z-10 w-full max-w-lg rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-xl p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                {t('samples.addSample')}
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
              {/* Client */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                  {t('samples.client')} *
                </label>
                <select
                  value={newSample.clientId}
                  onChange={(e) => setNewSample({ ...newSample, clientId: e.target.value })}
                  required
                  className="block w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2.5 text-sm text-gray-900 dark:text-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none"
                >
                  <option value="">-- Wybierz klienta --</option>
                  {clients.map((c) => (
                    <option key={c.id} value={c.id}>{c.companyName}</option>
                  ))}
                </select>
              </div>

              {/* Process */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                  {t('samples.process')} *
                </label>
                <select
                  value={newSample.processId}
                  onChange={(e) => setNewSample({ ...newSample, processId: e.target.value })}
                  required
                  className="block w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2.5 text-sm text-gray-900 dark:text-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none"
                >
                  <option value="">-- Wybierz proces --</option>
                  {processes.map((p) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>

              {/* Sample Type */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                  {t('samples.sampleType')} *
                </label>
                <select
                  value={newSample.sampleType}
                  onChange={(e) => setNewSample({ ...newSample, sampleType: e.target.value as SampleType })}
                  required
                  className="block w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2.5 text-sm text-gray-900 dark:text-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none"
                >
                  {SAMPLE_TYPES.map((st) => (
                    <option key={st} value={st}>{getSampleTypeLabel(st)}</option>
                  ))}
                </select>
              </div>

              {/* Collected At */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                  {t('samples.collectedAt')} *
                </label>
                <input
                  type="date"
                  value={newSample.collectedAt}
                  onChange={(e) => setNewSample({ ...newSample, collectedAt: e.target.value })}
                  required
                  className="block w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2.5 text-sm text-gray-900 dark:text-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none"
                />
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                  {t('samples.description')}
                </label>
                <textarea
                  value={newSample.description}
                  onChange={(e) => setNewSample({ ...newSample, description: e.target.value })}
                  rows={3}
                  className="block w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2.5 text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none resize-none"
                  placeholder="Opcjonalny opis próbki..."
                />
              </div>

              {/* Actions */}
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
                  className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500/50 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
                >
                  {createLoading && <div className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
                  {t('samples.addSample')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
