import { useState, useEffect, type FormEvent } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, Plus, FlaskConical, Clock, User, FileText, Edit2, Save, X, Trash2, Copy } from 'lucide-react';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import { sampleService } from '@/services/sampleService';
import { processService } from '@/services/processService';
import { orderService } from '@/services/orderService';
import { useAuthStore } from '@/store/authStore';
import {
  getSampleStatusColor,
  getSampleStatusLabel,
  getSampleTypeLabel,
  getAnalysisStatusColor,
  getAnalysisStatusLabel,
  formatDate,
  formatDateTime,
} from '@/utils/helpers';
import type { Sample, SampleStatus, AnalysisStatus, Process, SampleType, Order } from '@/types';

const VALID_NEXT_SAMPLE_STATUSES: Record<SampleStatus, SampleStatus[]> = {
  REGISTERED: ['IN_PROGRESS', 'CANCELLED'],
  IN_PROGRESS: ['COMPLETED', 'CANCELLED'],
  COMPLETED: [],
  CANCELLED: [],
};

const SAMPLE_TYPES: SampleType[] = ['BATH', 'RINSE', 'WASTEWATER', 'RAW_MATERIAL', 'OTHER'];

export default function SampleDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { t } = useTranslation();
  const navigate = useNavigate();

  const user = useAuthStore((s) => s.user);
  const isAdmin = user?.role === 'ADMIN';

  const [sample, setSample] = useState<Sample | null>(null);
  const [processes, setProcesses] = useState<Process[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [statusLoading, setStatusLoading] = useState(false);

  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const [showCopyDialog, setShowCopyDialog] = useState(false);
  const [copyOrders, setCopyOrders] = useState<Order[]>([]);
  const [copyOrderId, setCopyOrderId] = useState('');
  const [copyCollectedAt, setCopyCollectedAt] = useState(new Date().toISOString().slice(0, 10));
  const [copying, setCopying] = useState(false);
  const [copyError, setCopyError] = useState('');

  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState({
    collectedAt: '',
    sampleType: 'BATH' as SampleType,
    description: '',
    processId: '',
  });
  const [editLoading, setEditLoading] = useState(false);
  const [editError, setEditError] = useState('');

  useEffect(() => {
    if (id) {
      fetchSample();
      fetchProcesses();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function fetchSample() {
    setLoading(true);
    setError('');
    try {
      const data = await sampleService.getById(id!);
      setSample(data);
    } catch {
      setError('Nie udało się pobrać danych próbki.');
    } finally {
      setLoading(false);
    }
  }

  async function fetchProcesses() {
    try {
      const res = await processService.getAll({ limit: 200, isActive: true });
      setProcesses(res.data);
    } catch {
      // nieistotny błąd
    }
  }

  async function openCopyDialog() {
    setCopyOrderId('');
    setCopyCollectedAt(new Date().toISOString().slice(0, 10));
    setCopyError('');
    setShowCopyDialog(true);
    try {
      const res = await orderService.getAll({ limit: 200 });
      setCopyOrders(res.data.filter((o) => ['NEW', 'IN_PROGRESS'].includes(o.status)));
    } catch {
      setCopyError('Nie udało się pobrać listy zleceń.');
    }
  }

  async function handleCopy(e: FormEvent) {
    e.preventDefault();
    if (!sample || !copyOrderId) return;
    setCopying(true);
    setCopyError('');
    try {
      const created = await sampleService.create({
        orderId: copyOrderId,
        clientId: sample.clientId,
        processId: sample.process?.id || (sample as any).processId,
        sampleType: sample.sampleType as SampleType,
        description: sample.description || undefined,
        collectedAt: copyCollectedAt,
      });
      setShowCopyDialog(false);
      navigate(`/samples/${created.id}`);
    } catch {
      setCopyError('Nie udało się skopiować próbki. Sprawdź czy klient pasuje do zlecenia.');
    } finally {
      setCopying(false);
    }
  }

  async function handleDelete() {
    if (!sample) return;
    setDeleting(true);
    try {
      await sampleService.delete(sample.id);
      navigate('/samples');
    } catch {
      setError('Nie udało się usunąć próbki. Upewnij się, że próbka nie ma przypisanych analiz.');
      setConfirmDelete(false);
    } finally {
      setDeleting(false);
    }
  }

  function openEdit() {
    if (!sample) return;
    setEditForm({
      collectedAt: sample.collectedAt
        ? new Date(sample.collectedAt).toISOString().slice(0, 10)
        : '',
      sampleType: sample.sampleType as SampleType,
      description: sample.description || '',
      processId: sample.process?.id || '',
    });
    setEditError('');
    setEditing(true);
  }

  async function handleSaveEdit(e: FormEvent) {
    e.preventDefault();
    if (!sample) return;
    setEditLoading(true);
    setEditError('');
    try {
      const updated = await sampleService.update(sample.id, {
        collectedAt: editForm.collectedAt
          ? new Date(editForm.collectedAt).toISOString()
          : undefined,
        sampleType: editForm.sampleType,
        description: editForm.description || null,
        processId: editForm.processId || undefined,
      } as any);
      setSample(updated);
      setEditing(false);
    } catch {
      setEditError('Nie udało się zapisać zmian. Spróbuj ponownie.');
    } finally {
      setEditLoading(false);
    }
  }

  async function handleStatusChange(newStatus: SampleStatus) {
    if (!sample) return;
    setStatusLoading(true);
    try {
      const updated = await sampleService.changeStatus(sample.id, newStatus);
      setSample(updated);
    } catch {
      setError('Nie udało się zmienić statusu próbki.');
    } finally {
      setStatusLoading(false);
    }
  }

  async function handleCreateAnalysis() {
    if (!sample) return;
    navigate(`/analyses?sampleId=${sample.id}`);
  }

  if (loading) {
    return <LoadingSpinner text={t('common.loading')} />;
  }

  if (error && !sample) {
    return (
      <div className="space-y-4">
        <button
          onClick={() => navigate('/samples')}
          className="inline-flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          {t('common.back')}
        </button>
        <div className="rounded-lg bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 p-4 text-sm text-red-700 dark:text-red-400">
          {error}
        </div>
      </div>
    );
  }

  if (!sample) return null;

  const validNextStatuses = VALID_NEXT_SAMPLE_STATUSES[sample.status];
  const analyses = sample.analyses || [];

  return (
    <div className="space-y-6">
      {/* Navigation */}
      <button
        onClick={() => navigate('/samples')}
        className="inline-flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        {t('common.back')}
      </button>

      {/* Error */}
      {error && (
        <div className="rounded-lg bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 p-4 text-sm text-red-700 dark:text-red-400">
          {error}
        </div>
      )}

      {/* Sample Info Card */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
        <div className="flex items-start justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              {sample.sampleCode}
            </h1>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              {t('samples.sampleCode')}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className={`inline-flex items-center rounded-full px-3 py-1 text-sm font-medium ${getSampleStatusColor(sample.status)}`}>
              {getSampleStatusLabel(sample.status)}
            </span>
            {!editing && (
              <>
                <button
                  onClick={openEdit}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 dark:border-gray-600 px-3 py-1.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                >
                  <Edit2 className="h-3.5 w-3.5" />
                  {t('common.edit')}
                </button>
                <button
                  onClick={openCopyDialog}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 dark:border-gray-600 px-3 py-1.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                >
                  <Copy className="h-3.5 w-3.5" />
                  Kopiuj do zlecenia
                </button>
                {isAdmin && (
                  <button
                    onClick={() => setConfirmDelete(true)}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-red-300 dark:border-red-800 px-3 py-1.5 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    Usuń
                  </button>
                )}
              </>
            )}
          </div>
        </div>

        {/* Edit form */}
        {editing ? (
          <form onSubmit={handleSaveEdit} className="space-y-4">
            {editError && (
              <div className="rounded-lg bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 p-3 text-sm text-red-700 dark:text-red-400">
                {editError}
              </div>
            )}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-500 dark:text-gray-400">
                  {t('samples.collectedAt')} *
                </label>
                <input
                  type="date"
                  value={editForm.collectedAt}
                  onChange={(e) => setEditForm((f) => ({ ...f, collectedAt: e.target.value }))}
                  required
                  className="block w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-500 dark:text-gray-400">
                  {t('samples.sampleType')} *
                </label>
                <select
                  value={editForm.sampleType}
                  onChange={(e) => setEditForm((f) => ({ ...f, sampleType: e.target.value as SampleType }))}
                  required
                  className="block w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none"
                >
                  {SAMPLE_TYPES.map((st) => (
                    <option key={st} value={st}>{getSampleTypeLabel(st)}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-500 dark:text-gray-400">
                  {t('samples.process')}
                </label>
                <select
                  value={editForm.processId}
                  onChange={(e) => setEditForm((f) => ({ ...f, processId: e.target.value }))}
                  className="block w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none"
                >
                  <option value="">-- bez zmiany --</option>
                  {processes.map((p) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>
              <div className="sm:col-span-2">
                <label className="mb-1 block text-xs font-medium text-gray-500 dark:text-gray-400">
                  {t('samples.description')}
                </label>
                <textarea
                  value={editForm.description}
                  onChange={(e) => setEditForm((f) => ({ ...f, description: e.target.value }))}
                  rows={3}
                  className="block w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none resize-none"
                  placeholder="Opcjonalny opis próbki..."
                />
              </div>
            </div>
            <div className="flex items-center justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setEditing(false)}
                className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              >
                <X className="h-4 w-4" />
                {t('common.cancel')}
              </button>
              <button
                type="submit"
                disabled={editLoading}
                className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60 transition-colors"
              >
                <Save className="h-4 w-4" />
                {editLoading ? t('common.loading') : t('common.save')}
              </button>
            </div>
          </form>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              <div className="flex items-start gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-100 dark:bg-blue-900/30">
                  <User className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                </div>
                <div>
                  <p className="text-xs font-medium text-gray-500 dark:text-gray-400">{t('samples.client')}</p>
                  <p className="text-sm font-semibold text-gray-900 dark:text-white">
                    {sample.client?.companyName || '-'}
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-purple-100 dark:bg-purple-900/30">
                  <FlaskConical className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                </div>
                <div>
                  <p className="text-xs font-medium text-gray-500 dark:text-gray-400">{t('samples.process')}</p>
                  <p className="text-sm font-semibold text-gray-900 dark:text-white">
                    {sample.process?.name || '-'}
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-green-100 dark:bg-green-900/30">
                  <FileText className="h-4 w-4 text-green-600 dark:text-green-400" />
                </div>
                <div>
                  <p className="text-xs font-medium text-gray-500 dark:text-gray-400">{t('samples.sampleType')}</p>
                  <p className="text-sm font-semibold text-gray-900 dark:text-white">
                    {getSampleTypeLabel(sample.sampleType)}
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-orange-100 dark:bg-orange-900/30">
                  <Clock className="h-4 w-4 text-orange-600 dark:text-orange-400" />
                </div>
                <div>
                  <p className="text-xs font-medium text-gray-500 dark:text-gray-400">{t('samples.collectedAt')}</p>
                  <p className="text-sm font-semibold text-gray-900 dark:text-white">
                    {formatDateTime(sample.collectedAt)}
                  </p>
                </div>
              </div>

              {sample.collector && (
                <div className="flex items-start gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gray-100 dark:bg-gray-700">
                    <User className="h-4 w-4 text-gray-600 dark:text-gray-400" />
                  </div>
                  <div>
                    <p className="text-xs font-medium text-gray-500 dark:text-gray-400">{t('samples.collectedBy')}</p>
                    <p className="text-sm font-semibold text-gray-900 dark:text-white">
                      {sample.collector.firstName} {sample.collector.lastName}
                    </p>
                  </div>
                </div>
              )}
            </div>

            {sample.description && (
              <div className="mt-6 pt-4 border-t border-gray-200 dark:border-gray-700">
                <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">{t('samples.description')}</p>
                <p className="text-sm text-gray-700 dark:text-gray-300">{sample.description}</p>
              </div>
            )}
          </>
        )}

        {/* Status Workflow Buttons */}
        {!editing && validNextStatuses.length > 0 && (
          <div className="mt-6 pt-4 border-t border-gray-200 dark:border-gray-700">
            <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-3">{t('samples.changeStatus')}</p>
            <div className="flex items-center gap-2">
              {validNextStatuses.map((nextStatus) => (
                <button
                  key={nextStatus}
                  onClick={() => handleStatusChange(nextStatus)}
                  disabled={statusLoading}
                  className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors disabled:opacity-60 disabled:cursor-not-allowed ${
                    nextStatus === 'CANCELLED'
                      ? 'border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                      : nextStatus === 'COMPLETED'
                        ? 'bg-green-600 text-white hover:bg-green-700'
                        : 'bg-blue-600 text-white hover:bg-blue-700'
                  }`}
                >
                  {getSampleStatusLabel(nextStatus)}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Analyses Section */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between p-6 pb-4">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            {t('analyses.title')}
          </h2>
          <button
            onClick={handleCreateAnalysis}
            className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500/50 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
          >
            <Plus className="h-4 w-4" />
            {t('analyses.addAnalysis')}
          </button>
        </div>

        {analyses.length === 0 ? (
          <div className="px-6 pb-6">
            <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-8">
              {t('analyses.noAnalyses')}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-t border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50">
                  <th className="text-left px-6 py-3 font-medium text-gray-700 dark:text-gray-300">{t('analyses.analysisCode')}</th>
                  <th className="text-left px-6 py-3 font-medium text-gray-700 dark:text-gray-300">{t('analyses.status')}</th>
                  <th className="text-left px-6 py-3 font-medium text-gray-700 dark:text-gray-300">{t('analyses.analysisDate')}</th>
                  <th className="text-left px-6 py-3 font-medium text-gray-700 dark:text-gray-300">{t('analyses.performedBy')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {analyses.map((analysis) => (
                  <tr
                    key={analysis.id}
                    onClick={() => navigate(`/analyses/${analysis.id}`)}
                    className="hover:bg-gray-50 dark:hover:bg-gray-700/50 cursor-pointer transition-colors"
                  >
                    <td className="px-6 py-3 font-medium text-gray-900 dark:text-white">
                      {analysis.analysisCode}
                    </td>
                    <td className="px-6 py-3">
                      <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${getAnalysisStatusColor(analysis.status as AnalysisStatus)}`}>
                        {getAnalysisStatusLabel(analysis.status as AnalysisStatus)}
                      </span>
                    </td>
                    <td className="px-6 py-3 text-gray-600 dark:text-gray-400">
                      {formatDate(analysis.analysisDate)}
                    </td>
                    <td className="px-6 py-3 text-gray-600 dark:text-gray-400">
                      {analysis.performer
                        ? `${analysis.performer.firstName} ${analysis.performer.lastName}`
                        : '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Copy to order dialog */}
      {showCopyDialog && sample && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/50" onClick={() => setShowCopyDialog(false)} />
          <div className="relative z-10 w-full max-w-md rounded-xl border border-gray-200 bg-white p-6 shadow-xl dark:border-gray-700 dark:bg-gray-800">
            <h3 className="mb-1 text-base font-semibold text-gray-900 dark:text-white">Kopiuj próbkę do zlecenia</h3>
            <p className="mb-4 text-sm text-gray-500 dark:text-gray-400">
              Zostanie utworzona nowa próbka z tymi samymi parametrami ({sample.sampleType}, {sample.process?.name}) przypisana do wybranego zlecenia.
            </p>
            {copyError && (
              <div className="mb-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-950/30 dark:text-red-400">
                {copyError}
              </div>
            )}
            <form onSubmit={handleCopy} className="space-y-4">
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-500 dark:text-gray-400">Docelowe zlecenie *</label>
                <select
                  value={copyOrderId}
                  onChange={(e) => setCopyOrderId(e.target.value)}
                  required
                  className="block w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none"
                >
                  <option value="">-- Wybierz zlecenie --</option>
                  {copyOrders.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.orderCode} – {o.client?.companyName || o.clientId}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-500 dark:text-gray-400">Data poboru próbki *</label>
                <input
                  type="date"
                  value={copyCollectedAt}
                  onChange={(e) => setCopyCollectedAt(e.target.value)}
                  required
                  className="block w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none"
                />
              </div>
              <div className="flex justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setShowCopyDialog(false)}
                  className="rounded-lg px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700"
                >
                  Anuluj
                </button>
                <button
                  type="submit"
                  disabled={copying}
                  className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
                >
                  {copying && <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />}
                  Utwórz kopię
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Confirm delete dialog */}
      {confirmDelete && sample && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/50" onClick={() => setConfirmDelete(false)} />
          <div className="relative z-10 w-full max-w-sm rounded-xl border border-gray-200 bg-white p-6 shadow-xl dark:border-gray-700 dark:bg-gray-800">
            <h3 className="mb-2 text-base font-semibold text-gray-900 dark:text-white">Usuń próbkę</h3>
            <p className="mb-4 text-sm text-gray-600 dark:text-gray-400">
              Czy na pewno chcesz usunąć próbkę <strong>{sample.sampleCode}</strong>? Próbka nie może mieć przypisanych analiz. Tej operacji nie można cofnąć.
            </p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setConfirmDelete(false)}
                className="rounded-lg px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700"
              >
                Anuluj
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-60"
              >
                {deleting && <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />}
                Usuń
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
