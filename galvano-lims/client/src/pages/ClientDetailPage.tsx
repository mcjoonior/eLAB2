import { useState, useEffect, useMemo, type FormEvent } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, Pencil, X, Building2, MapPin, User, Mail, Phone, FileText, TrendingUp } from 'lucide-react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ReferenceLine,
  ResponsiveContainer,
} from 'recharts';
import { clientService } from '@/services/clientService';
import { sampleService } from '@/services/sampleService';
import { analysisService } from '@/services/analysisService';
import { archiveService } from '@/services/archiveService';
import { processService } from '@/services/processService';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import { formatDate, formatNumber, getSampleStatusLabel, getSampleStatusColor, getAnalysisStatusLabel, getAnalysisStatusColor, getProcessTypeLabel } from '@/utils/helpers';
import type { Client, Sample, Analysis, Process, ProcessParameter, TrendDataPoint } from '@/types';

type Tab = 'samples' | 'analyses' | 'trends';

interface ClientForm {
  companyName: string;
  nip: string;
  address: string;
  city: string;
  postalCode: string;
  country: string;
  contactPerson: string;
  email: string;
  phone: string;
  notes: string;
}

export default function ClientDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { t } = useTranslation();
  const navigate = useNavigate();

  const [client, setClient] = useState<Client | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [activeTab, setActiveTab] = useState<Tab>('samples');
  const [samples, setSamples] = useState<Sample[]>([]);
  const [analyses, setAnalyses] = useState<Analysis[]>([]);
  const [clientProcesses, setClientProcesses] = useState<Process[]>([]);
  const [samplesLoading, setSamplesLoading] = useState(false);
  const [analysesLoading, setAnalysesLoading] = useState(false);
  const [trendLoading, setTrendLoading] = useState(false);
  const [trendError, setTrendError] = useState('');

  const [selectedProcessId, setSelectedProcessId] = useState('');
  const [selectedParameterName, setSelectedParameterName] = useState('');
  const [trendDateFrom, setTrendDateFrom] = useState('');
  const [trendDateTo, setTrendDateTo] = useState('');
  const [processParameters, setProcessParameters] = useState<ProcessParameter[]>([]);
  const [trendData, setTrendData] = useState<TrendDataPoint[]>([]);

  // Edit dialog
  const [editOpen, setEditOpen] = useState(false);
  const [form, setForm] = useState<ClientForm>({
    companyName: '', nip: '', address: '', city: '', postalCode: '',
    country: 'Polska', contactPerson: '', email: '', phone: '', notes: '',
  });
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');

  async function fetchClient() {
    if (!id) return;
    setLoading(true);
    setError('');
    try {
      const data = await clientService.getById(id);
      setClient(data);
    } catch {
      setError(t('common.errorOccurred'));
    } finally {
      setLoading(false);
    }
  }

  async function fetchSamples() {
    if (!id) return;
    setSamplesLoading(true);
    try {
      const res = await sampleService.getAll({ clientId: id, limit: 100 });
      setSamples(res.data);
      const processMap = new Map<string, Process>();
      res.data.forEach((sample) => {
        if (sample.process) processMap.set(sample.process.id, sample.process);
      });
      setClientProcesses(Array.from(processMap.values()));
    } catch {
      // silent
    } finally {
      setSamplesLoading(false);
    }
  }

  async function fetchAnalyses() {
    if (!id) return;
    setAnalysesLoading(true);
    try {
      // Fetch samples first, then get analyses for each sample
      const samplesRes = await sampleService.getAll({ clientId: id, limit: 100 });
      const allAnalyses: Analysis[] = [];
      for (const sample of samplesRes.data) {
        try {
          const analysesRes = await analysisService.getAll({ sampleId: sample.id, limit: 100 });
          allAnalyses.push(...analysesRes.data);
        } catch {
          // skip failed fetches
        }
      }
      setAnalyses(allAnalyses);
    } catch {
      // silent
    } finally {
      setAnalysesLoading(false);
    }
  }

  useEffect(() => {
    fetchClient();
    fetchSamples();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  useEffect(() => {
    if (activeTab === 'analyses' && analyses.length === 0 && !analysesLoading) {
      fetchAnalyses();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  useEffect(() => {
    async function loadProcessParameters() {
      if (!selectedProcessId) {
        setProcessParameters([]);
        setSelectedParameterName('');
        return;
      }
      try {
        const process = await processService.getById(selectedProcessId);
        setProcessParameters(process.parameters || []);
      } catch {
        setProcessParameters([]);
      }
    }
    loadProcessParameters();
  }, [selectedProcessId]);

  const trendMin = useMemo(() => (trendData.length > 0 ? trendData[0].min : undefined), [trendData]);
  const trendMax = useMemo(() => (trendData.length > 0 ? trendData[0].max : undefined), [trendData]);
  const trendOptimal = useMemo(() => (trendData.length > 0 ? trendData[0].optimal : undefined), [trendData]);

  async function handleFetchTrend() {
    if (!id || !selectedProcessId || !selectedParameterName) return;
    setTrendLoading(true);
    setTrendError('');
    try {
      const data = await archiveService.getTrend({
        clientId: id,
        processId: selectedProcessId,
        parameterName: selectedParameterName,
        dateFrom: trendDateFrom || undefined,
        dateTo: trendDateTo || undefined,
        includeDrafts: true,
      });
      setTrendData(data);
    } catch {
      setTrendError('Nie udało się pobrać danych trendu.');
      setTrendData([]);
    } finally {
      setTrendLoading(false);
    }
  }

  function openEdit() {
    if (!client) return;
    setForm({
      companyName: client.companyName,
      nip: client.nip || '',
      address: client.address || '',
      city: client.city || '',
      postalCode: client.postalCode || '',
      country: client.country || 'Polska',
      contactPerson: client.contactPerson || '',
      email: client.email || '',
      phone: client.phone || '',
      notes: client.notes || '',
    });
    setFormError('');
    setEditOpen(true);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!id || !form.companyName.trim()) {
      setFormError(t('common.required'));
      return;
    }
    setSaving(true);
    setFormError('');
    try {
      const updated = await clientService.update(id, form);
      setClient(updated);
      setEditOpen(false);
    } catch {
      setFormError(t('common.errorOccurred'));
    } finally {
      setSaving(false);
    }
  }

  function updateField(field: keyof ClientForm, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  if (loading) {
    return <LoadingSpinner text={t('common.loading')} />;
  }

  if (error || !client) {
    return (
      <div className="space-y-4">
        <button
          onClick={() => navigate('/clients')}
          className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
        >
          <ArrowLeft className="h-4 w-4" />
          {t('common.back')}
        </button>
        <div className="rounded-lg bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 p-4 text-sm text-red-700 dark:text-red-400">
          {error || t('common.errorOccurred')}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Back nav */}
      <button
        onClick={() => navigate('/clients')}
        className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        {t('common.back')}
      </button>

      {/* Client info card */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              {client.companyName}
            </h1>
            {client.nip && (
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                {t('clients.nip')}: {client.nip}
              </p>
            )}
          </div>
          <button
            onClick={openEdit}
            className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 transition-colors self-start"
          >
            <Pencil className="h-4 w-4" />
            {t('common.edit')}
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {/* Address */}
          {(client.address || client.city || client.postalCode) && (
            <div className="flex items-start gap-3">
              <MapPin className="h-5 w-5 text-gray-400 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                  {t('clients.address')}
                </p>
                <p className="text-sm text-gray-900 dark:text-white mt-0.5">
                  {client.address}
                  {client.postalCode || client.city
                    ? `, ${client.postalCode || ''} ${client.city || ''}`.trim()
                    : ''}
                </p>
                {client.country && (
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    {client.country}
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Contact person */}
          {client.contactPerson && (
            <div className="flex items-start gap-3">
              <User className="h-5 w-5 text-gray-400 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                  {t('clients.contactPerson')}
                </p>
                <p className="text-sm text-gray-900 dark:text-white mt-0.5">
                  {client.contactPerson}
                </p>
              </div>
            </div>
          )}

          {/* Email */}
          {client.email && (
            <div className="flex items-start gap-3">
              <Mail className="h-5 w-5 text-gray-400 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                  {t('clients.email')}
                </p>
                <p className="text-sm text-gray-900 dark:text-white mt-0.5">
                  {client.email}
                </p>
              </div>
            </div>
          )}

          {/* Phone */}
          {client.phone && (
            <div className="flex items-start gap-3">
              <Phone className="h-5 w-5 text-gray-400 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                  {t('clients.phone')}
                </p>
                <p className="text-sm text-gray-900 dark:text-white mt-0.5">
                  {client.phone}
                </p>
              </div>
            </div>
          )}

          {/* Notes */}
          {client.notes && (
            <div className="flex items-start gap-3 sm:col-span-2">
              <FileText className="h-5 w-5 text-gray-400 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                  {t('clients.notes')}
                </p>
                <p className="text-sm text-gray-900 dark:text-white mt-0.5 whitespace-pre-wrap">
                  {client.notes}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Dates */}
        <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700 flex items-center gap-6 text-xs text-gray-400 dark:text-gray-500">
          <span>{t('common.createdAt')}: {formatDate(client.createdAt)}</span>
          <span>{t('common.updatedAt')}: {formatDate(client.updatedAt)}</span>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200 dark:border-gray-700">
        <nav className="flex gap-6">
          <button
            onClick={() => setActiveTab('samples')}
            className={`pb-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'samples'
                ? 'border-blue-600 text-blue-600 dark:text-blue-400 dark:border-blue-400'
                : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
            }`}
          >
            {t('samples.title')}
          </button>
          <button
            onClick={() => setActiveTab('analyses')}
            className={`pb-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'analyses'
                ? 'border-blue-600 text-blue-600 dark:text-blue-400 dark:border-blue-400'
                : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
            }`}
          >
            {t('analyses.title')}
          </button>
          <button
            onClick={() => setActiveTab('trends')}
            className={`pb-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'trends'
                ? 'border-blue-600 text-blue-600 dark:text-blue-400 dark:border-blue-400'
                : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
            }`}
          >
            Trendy parametrów
          </button>
        </nav>
      </div>

      {/* Tab content */}
      {activeTab === 'samples' && (
        <>
          {samplesLoading ? (
            <LoadingSpinner size="sm" text={t('common.loading')} />
          ) : samples.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-gray-500 dark:text-gray-400">{t('samples.noSamples')}</p>
            </div>
          ) : (
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead>
                    <tr className="border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
                      <th className="px-4 py-3 font-medium text-gray-500 dark:text-gray-400">
                        {t('samples.sampleCode')}
                      </th>
                      <th className="px-4 py-3 font-medium text-gray-500 dark:text-gray-400">
                        {t('samples.process')}
                      </th>
                      <th className="px-4 py-3 font-medium text-gray-500 dark:text-gray-400">
                        {t('common.status')}
                      </th>
                      <th className="px-4 py-3 font-medium text-gray-500 dark:text-gray-400">
                        {t('common.date')}
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                    {samples.map((sample) => (
                      <tr
                        key={sample.id}
                        onClick={() => navigate(`/samples/${sample.id}`)}
                        className="hover:bg-gray-50 dark:hover:bg-gray-700/50 cursor-pointer transition-colors"
                      >
                        <td className="px-4 py-3 font-medium text-blue-600 dark:text-blue-400">
                          {sample.sampleCode}
                        </td>
                        <td className="px-4 py-3 text-gray-600 dark:text-gray-300">
                          {sample.process ? `${sample.process.name} (${getProcessTypeLabel(sample.process.processType)})` : '-'}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${getSampleStatusColor(sample.status)}`}>
                            {getSampleStatusLabel(sample.status)}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-gray-600 dark:text-gray-300">
                          {formatDate(sample.collectedAt)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}

      {activeTab === 'analyses' && (
        <>
          {analysesLoading ? (
            <LoadingSpinner size="sm" text={t('common.loading')} />
          ) : analyses.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-gray-500 dark:text-gray-400">{t('analyses.noAnalyses')}</p>
            </div>
          ) : (
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead>
                    <tr className="border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
                      <th className="px-4 py-3 font-medium text-gray-500 dark:text-gray-400">
                        {t('analyses.analysisCode')}
                      </th>
                      <th className="px-4 py-3 font-medium text-gray-500 dark:text-gray-400">
                        {t('common.status')}
                      </th>
                      <th className="px-4 py-3 font-medium text-gray-500 dark:text-gray-400">
                        {t('common.date')}
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                    {analyses.map((analysis) => (
                      <tr
                        key={analysis.id}
                        onClick={() => navigate(`/analyses/${analysis.id}`)}
                        className="hover:bg-gray-50 dark:hover:bg-gray-700/50 cursor-pointer transition-colors"
                      >
                        <td className="px-4 py-3 font-medium text-blue-600 dark:text-blue-400">
                          {analysis.analysisCode}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${getAnalysisStatusColor(analysis.status)}`}>
                            {getAnalysisStatusLabel(analysis.status)}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-gray-600 dark:text-gray-300">
                          {formatDate(analysis.analysisDate)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}

      {activeTab === 'trends' && (
        <div className="space-y-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                  Proces
                </label>
                <select
                  value={selectedProcessId}
                  onChange={(e) => {
                    setSelectedProcessId(e.target.value);
                    setSelectedParameterName('');
                    setTrendData([]);
                  }}
                  className="block w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none"
                >
                  <option value="">Wybierz proces</option>
                  {clientProcesses.map((process) => (
                    <option key={process.id} value={process.id}>{process.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                  Parametr
                </label>
                <select
                  value={selectedParameterName}
                  onChange={(e) => setSelectedParameterName(e.target.value)}
                  disabled={!selectedProcessId || processParameters.length === 0}
                  className="block w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none disabled:opacity-50"
                >
                  <option value="">Wybierz parametr</option>
                  {processParameters.map((parameter) => (
                    <option key={parameter.id} value={parameter.parameterName}>
                      {parameter.parameterName} [{parameter.unit}]
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                  Od
                </label>
                <input
                  type="date"
                  value={trendDateFrom}
                  onChange={(e) => setTrendDateFrom(e.target.value)}
                  className="block w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                  Do
                </label>
                <input
                  type="date"
                  value={trendDateTo}
                  onChange={(e) => setTrendDateTo(e.target.value)}
                  className="block w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none"
                />
              </div>

              <div className="flex items-end">
                <button
                  onClick={handleFetchTrend}
                  disabled={trendLoading || !selectedProcessId || !selectedParameterName}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  <TrendingUp className="h-4 w-4" />
                  Pokaż wykres
                </button>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4">
            {trendError && (
              <div className="mb-4 rounded-lg bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 p-3 text-sm text-red-700 dark:text-red-400">
                {trendError}
              </div>
            )}

            {trendLoading ? (
              <LoadingSpinner size="sm" text={t('common.loading')} />
            ) : trendData.length === 0 ? (
              <div className="text-center py-8 text-sm text-gray-500 dark:text-gray-400">
                Brak danych trendu dla wybranych filtrów.
              </div>
            ) : (
              <div className="w-full h-[380px]">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={trendData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis
                      dataKey="date"
                      tickFormatter={(value: string) => formatDate(value)}
                      tick={{ fontSize: 12 }}
                      stroke="#9ca3af"
                    />
                    <YAxis tick={{ fontSize: 12 }} stroke="#9ca3af" />
                    <Tooltip
                      labelFormatter={(value: string) => formatDate(value)}
                      formatter={(value: number) => [formatNumber(value), selectedParameterName]}
                    />
                    <Legend />
                    {trendMin != null && <ReferenceLine y={trendMin} stroke="#dc2626" strokeDasharray="6 4" />}
                    {trendMax != null && <ReferenceLine y={trendMax} stroke="#dc2626" strokeDasharray="6 4" />}
                    {trendOptimal != null && <ReferenceLine y={trendOptimal} stroke="#16a34a" strokeDasharray="6 4" />}
                    <Line
                      type="monotone"
                      dataKey="value"
                      stroke="#2563eb"
                      strokeWidth={2}
                      dot={{ r: 3, fill: '#2563eb' }}
                      activeDot={{ r: 5 }}
                      name={selectedParameterName}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Edit dialog */}
      {editOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl border border-gray-200 dark:border-gray-700 w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                {t('clients.editClient')}
              </h2>
              <button
                onClick={() => setEditOpen(false)}
                className="p-1.5 rounded-md text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              {formError && (
                <div className="rounded-lg bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 p-3 text-sm text-red-700 dark:text-red-400">
                  {formError}
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    {t('clients.companyName')} *
                  </label>
                  <input
                    type="text"
                    required
                    value={form.companyName}
                    onChange={(e) => updateField('companyName', e.target.value)}
                    className="block w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none transition-colors"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    {t('clients.nip')}
                  </label>
                  <input
                    type="text"
                    value={form.nip}
                    onChange={(e) => updateField('nip', e.target.value)}
                    className="block w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none transition-colors"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    {t('clients.address')}
                  </label>
                  <input
                    type="text"
                    value={form.address}
                    onChange={(e) => updateField('address', e.target.value)}
                    className="block w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none transition-colors"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    {t('clients.city')}
                  </label>
                  <input
                    type="text"
                    value={form.city}
                    onChange={(e) => updateField('city', e.target.value)}
                    className="block w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none transition-colors"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    {t('clients.postalCode')}
                  </label>
                  <input
                    type="text"
                    value={form.postalCode}
                    onChange={(e) => updateField('postalCode', e.target.value)}
                    className="block w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none transition-colors"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    {t('clients.country')}
                  </label>
                  <input
                    type="text"
                    value={form.country}
                    onChange={(e) => updateField('country', e.target.value)}
                    className="block w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none transition-colors"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    {t('clients.contactPerson')}
                  </label>
                  <input
                    type="text"
                    value={form.contactPerson}
                    onChange={(e) => updateField('contactPerson', e.target.value)}
                    className="block w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none transition-colors"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    {t('clients.email')}
                  </label>
                  <input
                    type="email"
                    value={form.email}
                    onChange={(e) => updateField('email', e.target.value)}
                    className="block w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none transition-colors"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    {t('clients.phone')}
                  </label>
                  <input
                    type="tel"
                    value={form.phone}
                    onChange={(e) => updateField('phone', e.target.value)}
                    className="block w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none transition-colors"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    {t('clients.notes')}
                  </label>
                  <textarea
                    value={form.notes}
                    onChange={(e) => updateField('notes', e.target.value)}
                    rows={3}
                    className="block w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none transition-colors resize-none"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
                <button
                  type="button"
                  onClick={() => setEditOpen(false)}
                  className="rounded-lg border border-gray-300 dark:border-gray-600 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                >
                  {t('common.cancel')}
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
                >
                  {saving ? t('common.loading') : t('common.save')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
