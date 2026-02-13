import { useState, useEffect, useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
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
import {
  Search,
  RotateCcw,
  Download,
  TrendingUp,
  Table as TableIcon,
} from 'lucide-react';
import { archiveService, type ArchiveAnalysisRow } from '@/services/archiveService';
import { clientService } from '@/services/clientService';
import { processService } from '@/services/processService';
import type {
  Client,
  Process,
  ProcessParameter,
  TrendDataPoint,
} from '@/types';
import {
  getDeviationBadgeColor,
  getDeviationLabel,
  formatDate,
  formatNumber,
  downloadCSV,
} from '@/utils/helpers';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import { Pagination } from '@/components/common/Pagination';

type TabKey = 'trend' | 'table';

interface Filters {
  clientId: string;
  processId: string;
  parameterName: string;
  dateFrom: string;
  dateTo: string;
}

const INITIAL_FILTERS: Filters = {
  clientId: '',
  processId: '',
  parameterName: '',
  dateFrom: '',
  dateTo: '',
};

export default function ArchivePage() {
  const { t } = useTranslation();

  // --- Filter state ---
  const [filters, setFilters] = useState<Filters>(INITIAL_FILTERS);
  const [activeTab, setActiveTab] = useState<TabKey>('trend');

  // --- Dropdown options ---
  const [clients, setClients] = useState<Client[]>([]);
  const [processes, setProcesses] = useState<Process[]>([]);
  const [parameters, setParameters] = useState<ProcessParameter[]>([]);

  // --- Data ---
  const [trendData, setTrendData] = useState<TrendDataPoint[]>([]);
  const [analyses, setAnalyses] = useState<ArchiveAnalysisRow[]>([]);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 0,
  });

  // --- UI state ---
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [exporting, setExporting] = useState(false);

  const chartRef = useRef<HTMLDivElement>(null);

  // -------------------------------------------------------
  // Load dropdown data
  // -------------------------------------------------------
  useEffect(() => {
    async function loadDropdowns() {
      try {
        const [clientsRes, processesRes] = await Promise.all([
          clientService.getAll({ limit: 500, isActive: true }),
          processService.getAll({ limit: 500, isActive: true }),
        ]);
        setClients(clientsRes.data);
        setProcesses(processesRes.data);
      } catch {
        // silently fail — dropdowns will be empty
      }
    }
    loadDropdowns();
  }, []);

  // --- Populate parameters when process changes ---
  useEffect(() => {
    if (!filters.processId) {
      setParameters([]);
      return;
    }
    async function loadParams() {
      try {
        const process = await processService.getById(filters.processId);
        setParameters(process.parameters ?? []);
      } catch {
        setParameters([]);
      }
    }
    loadParams();
  }, [filters.processId]);

  // -------------------------------------------------------
  // Fetch data based on active tab
  // -------------------------------------------------------
  const fetchData = useCallback(
    async (page = 1) => {
      setLoading(true);
      setError('');
      try {
        const params = {
          clientId: filters.clientId || undefined,
          processId: filters.processId || undefined,
          parameterName: filters.parameterName || undefined,
          dateFrom: filters.dateFrom || undefined,
          dateTo: filters.dateTo || undefined,
        };

        if (activeTab === 'trend') {
          if (!params.parameterName) {
            setTrendData([]);
            setLoading(false);
            return;
          }
          const data = await archiveService.getTrend(
            params as { parameterName: string } & typeof params,
          );
          setTrendData(data);
        } else if (activeTab === 'table') {
          const res = await archiveService.getAnalyses({
            ...params,
            page,
            limit: pagination.limit,
          });
          setAnalyses(res.data);
          setPagination(res.pagination);
        }
      } catch (err: any) {
        setError(err?.response?.data?.message || t('common.errorOccurred'));
      } finally {
        setLoading(false);
      }
    },
    [filters, activeTab, pagination.limit, t],
  );

  // Fetch on tab change or filter apply
  useEffect(() => {
    fetchData(1);
  }, [activeTab]); // eslint-disable-line react-hooks/exhaustive-deps

  // -------------------------------------------------------
  // Handlers
  // -------------------------------------------------------
  function handleFilter() {
    fetchData(1);
  }

  function handleReset() {
    setFilters(INITIAL_FILTERS);
    setParameters([]);
    setTrendData([]);
    setAnalyses([]);
  }

  function handlePageChange(page: number) {
    fetchData(page);
  }

  async function handleExportCSV() {
    setExporting(true);
    try {
      const csv = await archiveService.exportCSV({
        clientId: filters.clientId || undefined,
        processId: filters.processId || undefined,
        dateFrom: filters.dateFrom || undefined,
        dateTo: filters.dateTo || undefined,
      });
      downloadCSV(csv, `archiwum_analiz_${new Date().toISOString().slice(0, 10)}.csv`);
    } catch (err: any) {
      setError(err?.response?.data?.message || t('common.errorOccurred'));
    } finally {
      setExporting(false);
    }
  }

  function handleExportChart() {
    if (!chartRef.current) return;
    const svg = chartRef.current.querySelector('svg');
    if (!svg) return;

    const svgData = new XMLSerializer().serializeToString(svg);
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const img = new Image();

    img.onload = () => {
      canvas.width = img.width;
      canvas.height = img.height;
      ctx?.drawImage(img, 0, 0);
      const link = document.createElement('a');
      link.download = `trend_${filters.parameterName || 'chart'}_${new Date().toISOString().slice(0, 10)}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    };

    img.src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svgData)));
  }

  // -------------------------------------------------------
  // Tab config
  // -------------------------------------------------------
  const tabs: { key: TabKey; label: string; icon: typeof TrendingUp }[] = [
    { key: 'trend', label: 'Trend', icon: TrendingUp },
    { key: 'table', label: 'Tabela', icon: TableIcon },
  ];

  // -------------------------------------------------------
  // Reference values for trend chart
  // -------------------------------------------------------
  const trendMin = trendData.length > 0 ? trendData[0].min : undefined;
  const trendMax = trendData.length > 0 ? trendData[0].max : undefined;
  const trendOptimal = trendData.length > 0 ? trendData[0].optimal : undefined;

  // -------------------------------------------------------
  // Render
  // -------------------------------------------------------
  return (
    <div className="space-y-6">
      {/* Page Title */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          {t('archive.title')}
        </h1>
      </div>

      {/* Filter Panel */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm p-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          {/* Client */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
              {t('samples.client')}
            </label>
            <select
              value={filters.clientId}
              onChange={(e) =>
                setFilters((f) => ({ ...f, clientId: e.target.value }))
              }
              className="block w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none transition-colors"
            >
              <option value="">{t('common.all')}</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.companyName}
                </option>
              ))}
            </select>
          </div>

          {/* Process */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
              {t('samples.process')}
            </label>
            <select
              value={filters.processId}
              onChange={(e) =>
                setFilters((f) => ({
                  ...f,
                  processId: e.target.value,
                  parameterName: '',
                }))
              }
              className="block w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none transition-colors"
            >
              <option value="">{t('common.all')}</option>
              {processes.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>

          {/* Parameter */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
              {t('analyses.parameter')}
            </label>
            <select
              value={filters.parameterName}
              onChange={(e) =>
                setFilters((f) => ({ ...f, parameterName: e.target.value }))
              }
              disabled={parameters.length === 0}
              className="block w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <option value="">{t('archive.selectParameter')}</option>
              {parameters.map((p) => (
                <option key={p.id} value={p.parameterName}>
                  {p.parameterName} [{p.unit}]
                </option>
              ))}
            </select>
          </div>

          {/* Date From */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
              {t('archive.from')}
            </label>
            <input
              type="date"
              value={filters.dateFrom}
              onChange={(e) =>
                setFilters((f) => ({ ...f, dateFrom: e.target.value }))
              }
              className="block w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none transition-colors"
            />
          </div>

          {/* Date To */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
              {t('archive.to')}
            </label>
            <input
              type="date"
              value={filters.dateTo}
              onChange={(e) =>
                setFilters((f) => ({ ...f, dateTo: e.target.value }))
              }
              className="block w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none transition-colors"
            />
          </div>
        </div>

        {/* Filter Buttons */}
        <div className="flex items-center gap-3 mt-4">
          <button
            onClick={handleFilter}
            className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-colors"
          >
            <Search className="h-4 w-4" />
            {t('common.filter')}
          </button>
          <button
            onClick={handleReset}
            className="inline-flex items-center gap-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-colors"
          >
            <RotateCcw className="h-4 w-4" />
            {t('common.reset')}
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm">
        <div className="border-b border-gray-200 dark:border-gray-700">
          <nav className="flex -mb-px px-6" aria-label="Tabs">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.key;
              return (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                    isActive
                      ? 'border-blue-600 text-blue-600 dark:border-blue-400 dark:text-blue-400'
                      : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:border-gray-300 dark:hover:border-gray-600'
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  {tab.label}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Error */}
        {error && (
          <div className="mx-6 mt-4 rounded-lg bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 p-3 text-sm text-red-700 dark:text-red-400">
            {error}
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div className="py-12">
            <LoadingSpinner size="lg" text={t('common.loading')} />
          </div>
        )}

        {/* ====================== TREND TAB ====================== */}
        {!loading && activeTab === 'trend' && (
          <div className="p-6">
            {!filters.parameterName ? (
              <div className="text-center py-12 text-sm text-gray-500 dark:text-gray-400">
                {t('archive.selectParameter')}
              </div>
            ) : trendData.length === 0 ? (
              <div className="text-center py-12 text-sm text-gray-500 dark:text-gray-400">
                {t('common.noData')}
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-base font-semibold text-gray-900 dark:text-white">
                    {t('archive.trend')}: {filters.parameterName}
                  </h3>
                  <button
                    onClick={handleExportChart}
                    className="inline-flex items-center gap-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-1.5 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors"
                  >
                    <Download className="h-4 w-4" />
                    {t('archive.exportChart')}
                  </button>
                </div>

                <div ref={chartRef} className="w-full h-[400px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart
                      data={trendData}
                      margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                      <XAxis
                        dataKey="date"
                        tickFormatter={(v: string) => formatDate(v)}
                        tick={{ fontSize: 12 }}
                        stroke="#9ca3af"
                      />
                      <YAxis tick={{ fontSize: 12 }} stroke="#9ca3af" />
                      <Tooltip
                        labelFormatter={(v: string) => formatDate(v)}
                        formatter={(value: number) => [formatNumber(value), '']}
                        contentStyle={{
                          backgroundColor: '#fff',
                          border: '1px solid #e5e7eb',
                          borderRadius: '8px',
                          fontSize: '12px',
                        }}
                      />
                      <Legend />

                      {/* Reference lines */}
                      {trendMin != null && (
                        <ReferenceLine
                          y={trendMin}
                          stroke="#dc2626"
                          strokeDasharray="6 4"
                          label={{
                            value: `Min: ${formatNumber(trendMin)}`,
                            position: 'insideTopRight',
                            fill: '#dc2626',
                            fontSize: 11,
                          }}
                        />
                      )}
                      {trendMax != null && (
                        <ReferenceLine
                          y={trendMax}
                          stroke="#dc2626"
                          strokeDasharray="6 4"
                          label={{
                            value: `Max: ${formatNumber(trendMax)}`,
                            position: 'insideBottomRight',
                            fill: '#dc2626',
                            fontSize: 11,
                          }}
                        />
                      )}
                      {trendOptimal != null && (
                        <ReferenceLine
                          y={trendOptimal}
                          stroke="#16a34a"
                          strokeDasharray="6 4"
                          label={{
                            value: `Opt: ${formatNumber(trendOptimal)}`,
                            position: 'insideTopLeft',
                            fill: '#16a34a',
                            fontSize: 11,
                          }}
                        />
                      )}

                      {/* Value line */}
                      <Line
                        type="monotone"
                        dataKey="value"
                        stroke="#2563eb"
                        strokeWidth={2}
                        dot={{ r: 3, fill: '#2563eb' }}
                        activeDot={{ r: 5 }}
                        name={filters.parameterName}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </>
            )}
          </div>
        )}

        {/* ===================== TABLE TAB ====================== */}
        {!loading && activeTab === 'table' && (
          <div className="p-6">
            {/* Export button */}
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-semibold text-gray-900 dark:text-white">
                {t('archive.title')}
              </h3>
              <button
                onClick={handleExportCSV}
                disabled={exporting}
                className="inline-flex items-center gap-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-1.5 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <Download className="h-4 w-4" />
                {t('archive.exportCSV')}
              </button>
            </div>

            {analyses.length === 0 ? (
              <div className="text-center py-12 text-sm text-gray-500 dark:text-gray-400">
                {t('common.noData')}
              </div>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-100 dark:border-gray-700">
                        <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                          {t('common.date')}
                        </th>
                        <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                          {t('analyses.analysisCode')}
                        </th>
                        <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                          {t('samples.client')}
                        </th>
                        <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                          {t('samples.process')}
                        </th>
                        <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                          {t('analyses.parameter')}
                        </th>
                        <th className="text-right px-4 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                          {t('analyses.value')}
                        </th>
                        <th className="text-right px-4 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                          Niepewność
                        </th>
                        <th className="text-right px-4 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                          {t('analyses.min')}
                        </th>
                        <th className="text-right px-4 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                          {t('analyses.max')}
                        </th>
                        <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                          {t('analyses.deviation')}
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                      {analyses.map((row) => (
                        <tr
                          key={row.id}
                          className="hover:bg-gray-50 dark:hover:bg-gray-750 transition-colors"
                        >
                          <td className="px-4 py-3 text-gray-600 dark:text-gray-300 whitespace-nowrap">
                            {formatDate(row.date)}
                          </td>
                          <td className="px-4 py-3 font-medium text-gray-900 dark:text-white whitespace-nowrap">
                            {row.analysisCode}
                          </td>
                          <td className="px-4 py-3 text-gray-600 dark:text-gray-300 whitespace-nowrap">
                            {row.clientName}
                          </td>
                          <td className="px-4 py-3 text-gray-600 dark:text-gray-300 whitespace-nowrap">
                            {row.processName}
                          </td>
                          <td className="px-4 py-3 text-gray-600 dark:text-gray-300 whitespace-nowrap">
                            {row.parameterName}
                          </td>
                          <td className="px-4 py-3 text-right font-mono text-gray-900 dark:text-white whitespace-nowrap">
                            {formatNumber(row.value)}
                          </td>
                          <td className="px-4 py-3 text-right font-mono text-gray-500 dark:text-gray-400 whitespace-nowrap">
                            {row.measurementUncertainty != null ? `±${formatNumber(row.measurementUncertainty)}` : '—'}
                          </td>
                          <td className="px-4 py-3 text-right font-mono text-gray-500 dark:text-gray-400 whitespace-nowrap">
                            {row.min != null ? formatNumber(row.min) : '—'}
                          </td>
                          <td className="px-4 py-3 text-right font-mono text-gray-500 dark:text-gray-400 whitespace-nowrap">
                            {row.max != null ? formatNumber(row.max) : '—'}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            <span
                              className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${getDeviationBadgeColor(row.deviation)}`}
                            >
                              {getDeviationLabel(row.deviation)}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Pagination */}
                <Pagination
                  page={pagination.page}
                  totalPages={pagination.totalPages}
                  total={pagination.total}
                  limit={pagination.limit}
                  onPageChange={handlePageChange}
                />
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
