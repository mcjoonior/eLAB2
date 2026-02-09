import { useState, useEffect, type FormEvent } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  ArrowLeft,
  Save,
  FileText,
  Send,
  CheckCircle,
  Plus,
  AlertTriangle,
} from 'lucide-react';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import { analysisService } from '@/services/analysisService';
import { reportService } from '@/services/reportService';
import { useAuthStore } from '@/store/authStore';
import {
  getAnalysisStatusColor,
  getAnalysisStatusLabel,
  getDeviationColor,
  getDeviationBadgeColor,
  getDeviationLabel,
  getPriorityColor,
  getPriorityLabel,
  getRecommendationTypeLabel,
  formatDate,
  formatDateTime,
  formatNumber,
} from '@/utils/helpers';
import type {
  Analysis,
  AnalysisResult,
  Recommendation,
  Deviation,
  Priority,
  RecommendationType,
} from '@/types';

const PRIORITIES: Priority[] = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];
const RECOMMENDATION_TYPES: RecommendationType[] = ['INCREASE', 'DECREASE', 'MAINTAIN', 'URGENT_ACTION'];

function getRowBgColor(deviation: Deviation): string {
  switch (deviation) {
    case 'WITHIN_RANGE':
      return 'bg-green-50/50 dark:bg-green-950/20';
    case 'BELOW_MIN':
    case 'ABOVE_MAX':
      return 'bg-yellow-50/50 dark:bg-yellow-950/20';
    case 'CRITICAL_LOW':
    case 'CRITICAL_HIGH':
      return 'bg-red-50/50 dark:bg-red-950/20';
    default:
      return '';
  }
}

export default function AnalysisDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const user = useAuthStore((s) => s.user);

  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Results editing
  const [resultValues, setResultValues] = useState<Record<string, string>>({});
  const [savingResults, setSavingResults] = useState(false);
  const [resultSuccess, setResultSuccess] = useState('');
  const [resultError, setResultError] = useState('');

  // Recommendations
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [showRecommendationForm, setShowRecommendationForm] = useState(false);
  const [recForm, setRecForm] = useState({
    parameterName: '',
    recommendationType: 'MAINTAIN' as RecommendationType,
    description: '',
    priority: 'MEDIUM' as Priority,
    currentValue: '',
    targetValue: '',
  });
  const [addingRecommendation, setAddingRecommendation] = useState(false);
  const [recError, setRecError] = useState('');

  // Report actions
  const [generatingReport, setGeneratingReport] = useState(false);
  const [sendingReport, setSendingReport] = useState(false);
  const [approvingAnalysis, setApprovingAnalysis] = useState(false);
  const [actionSuccess, setActionSuccess] = useState('');
  const [actionError, setActionError] = useState('');

  useEffect(() => {
    if (id) {
      fetchAnalysis();
      fetchRecommendations();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function fetchAnalysis() {
    setLoading(true);
    setError('');
    try {
      const data = await analysisService.getById(id!);
      setAnalysis(data);
      // Initialize result values
      if (data.results) {
        const values: Record<string, string> = {};
        data.results.forEach((r) => {
          values[r.id] = r.value != null ? String(r.value) : '';
        });
        setResultValues(values);
      }
    } catch {
      setError('Nie udało się pobrać szczegółów analizy.');
    } finally {
      setLoading(false);
    }
  }

  async function fetchRecommendations() {
    try {
      const recs = await analysisService.getRecommendations(id!);
      setRecommendations(recs);
    } catch {
      // Non-critical
    }
  }

  const isEditable = analysis && (analysis.status === 'PENDING' || analysis.status === 'IN_PROGRESS');
  const isAdmin = user?.role === 'ADMIN';
  const canApprove = isAdmin && analysis?.status === 'COMPLETED';

  async function handleSaveResults(e: FormEvent) {
    e.preventDefault();
    if (!analysis?.results) return;
    setSavingResults(true);
    setResultError('');
    setResultSuccess('');
    try {
      const resultsToSave = analysis.results.map((r) => ({
        id: r.id,
        parameterName: r.parameterName,
        unit: r.unit,
        value: resultValues[r.id] ? parseFloat(resultValues[r.id]) : r.value,
        minReference: r.minReference,
        maxReference: r.maxReference,
        optimalReference: r.optimalReference,
      }));
      await analysisService.saveResults(id!, resultsToSave);
      await fetchAnalysis();
      setResultSuccess('Wyniki zostały zapisane pomyślnie.');
      setTimeout(() => setResultSuccess(''), 3000);
    } catch {
      setResultError('Nie udało się zapisać wyników. Spróbuj ponownie.');
    } finally {
      setSavingResults(false);
    }
  }

  async function handleAddRecommendation(e: FormEvent) {
    e.preventDefault();
    if (!recForm.description.trim()) {
      setRecError('Opis rekomendacji jest wymagany.');
      return;
    }
    setAddingRecommendation(true);
    setRecError('');
    try {
      await analysisService.addRecommendation(id!, {
        parameterName: recForm.parameterName || undefined,
        recommendationType: recForm.recommendationType,
        description: recForm.description.trim(),
        priority: recForm.priority,
        currentValue: recForm.currentValue ? parseFloat(recForm.currentValue) : undefined,
        targetValue: recForm.targetValue ? parseFloat(recForm.targetValue) : undefined,
      });
      setShowRecommendationForm(false);
      setRecForm({
        parameterName: '',
        recommendationType: 'MAINTAIN',
        description: '',
        priority: 'MEDIUM',
        currentValue: '',
        targetValue: '',
      });
      fetchRecommendations();
    } catch {
      setRecError('Nie udało się dodać rekomendacji.');
    } finally {
      setAddingRecommendation(false);
    }
  }

  async function handleGenerateReport() {
    setGeneratingReport(true);
    setActionError('');
    setActionSuccess('');
    try {
      await reportService.generate(id!);
      setActionSuccess('Raport został wygenerowany pomyślnie.');
      setTimeout(() => setActionSuccess(''), 3000);
      fetchAnalysis();
    } catch {
      setActionError('Nie udało się wygenerować raportu.');
    } finally {
      setGeneratingReport(false);
    }
  }

  async function handleSendReport() {
    if (!analysis?.reports || analysis.reports.length === 0) {
      setActionError('Najpierw wygeneruj raport.');
      return;
    }
    setSendingReport(true);
    setActionError('');
    setActionSuccess('');
    try {
      const latestReport = analysis.reports[analysis.reports.length - 1];
      await reportService.sendEmail(latestReport.id);
      setActionSuccess('Raport został wysłany do klienta.');
      setTimeout(() => setActionSuccess(''), 3000);
      fetchAnalysis();
    } catch {
      setActionError('Nie udało się wysłać raportu.');
    } finally {
      setSendingReport(false);
    }
  }

  async function handleApprove() {
    setApprovingAnalysis(true);
    setActionError('');
    setActionSuccess('');
    try {
      await analysisService.approve(id!);
      setActionSuccess('Analiza została zatwierdzona.');
      setTimeout(() => setActionSuccess(''), 3000);
      fetchAnalysis();
    } catch {
      setActionError('Nie udało się zatwierdzić analizy.');
    } finally {
      setApprovingAnalysis(false);
    }
  }

  if (loading) {
    return <LoadingSpinner text="Ładowanie analizy..." />;
  }

  if (error || !analysis) {
    return (
      <div className="space-y-4">
        <button
          onClick={() => navigate('/analyses')}
          className="inline-flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white"
        >
          <ArrowLeft className="h-4 w-4" />
          Powrót do listy analiz
        </button>
        <div className="rounded-lg bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 p-4 text-sm text-red-700 dark:text-red-400">
          {error || 'Nie znaleziono analizy.'}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Back button */}
      <button
        onClick={() => navigate('/analyses')}
        className="inline-flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        Powrót do listy analiz
      </button>

      {/* Action messages */}
      {actionSuccess && (
        <div className="rounded-lg bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-800 p-4 text-sm text-green-700 dark:text-green-400">
          {actionSuccess}
        </div>
      )}
      {actionError && (
        <div className="rounded-lg bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 p-4 text-sm text-red-700 dark:text-red-400">
          {actionError}
        </div>
      )}

      {/* Header card */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
        <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                {analysis.analysisCode}
              </h1>
              <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-medium ${getAnalysisStatusColor(analysis.status)}`}>
                {getAnalysisStatusLabel(analysis.status)}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-sm">
              <div>
                <span className="text-gray-500 dark:text-gray-400">Próbka:</span>
                <p className="font-medium text-gray-900 dark:text-white">
                  {analysis.sample?.sampleCode || '-'}
                </p>
              </div>
              <div>
                <span className="text-gray-500 dark:text-gray-400">Klient:</span>
                <p className="font-medium text-gray-900 dark:text-white">
                  {analysis.sample?.client?.companyName || '-'}
                </p>
              </div>
              <div>
                <span className="text-gray-500 dark:text-gray-400">Proces:</span>
                <p className="font-medium text-gray-900 dark:text-white">
                  {analysis.sample?.process?.name || '-'}
                </p>
              </div>
              <div>
                <span className="text-gray-500 dark:text-gray-400">Data analizy:</span>
                <p className="font-medium text-gray-900 dark:text-white">
                  {formatDate(analysis.analysisDate)}
                </p>
              </div>
              <div>
                <span className="text-gray-500 dark:text-gray-400">Wykonał:</span>
                <p className="font-medium text-gray-900 dark:text-white">
                  {analysis.performer
                    ? `${analysis.performer.firstName} ${analysis.performer.lastName}`
                    : '-'}
                </p>
              </div>
              {analysis.approver && (
                <div>
                  <span className="text-gray-500 dark:text-gray-400">Zatwierdził:</span>
                  <p className="font-medium text-gray-900 dark:text-white">
                    {analysis.approver.firstName} {analysis.approver.lastName}
                  </p>
                </div>
              )}
              {analysis.approvedAt && (
                <div>
                  <span className="text-gray-500 dark:text-gray-400">Data zatwierdzenia:</span>
                  <p className="font-medium text-gray-900 dark:text-white">
                    {formatDateTime(analysis.approvedAt)}
                  </p>
                </div>
              )}
            </div>

            {analysis.notes && (
              <div className="mt-2">
                <span className="text-sm text-gray-500 dark:text-gray-400">Notatki:</span>
                <p className="text-sm text-gray-700 dark:text-gray-300">{analysis.notes}</p>
              </div>
            )}
          </div>

          {/* Action buttons */}
          <div className="flex flex-wrap gap-2">
            <button
              onClick={handleGenerateReport}
              disabled={generatingReport}
              className="inline-flex items-center gap-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
            >
              {generatingReport ? (
                <div className="h-4 w-4 border-2 border-gray-400 border-t-gray-700 rounded-full animate-spin" />
              ) : (
                <FileText className="h-4 w-4" />
              )}
              Generuj raport
            </button>
            <button
              onClick={handleSendReport}
              disabled={sendingReport || !analysis.reports?.length}
              className="inline-flex items-center gap-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
            >
              {sendingReport ? (
                <div className="h-4 w-4 border-2 border-gray-400 border-t-gray-700 rounded-full animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
              Wyślij raport
            </button>
            {canApprove && (
              <button
                onClick={handleApprove}
                disabled={approvingAnalysis}
                className="inline-flex items-center gap-2 rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-green-700 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
              >
                {approvingAnalysis ? (
                  <div className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <CheckCircle className="h-4 w-4" />
                )}
                Zatwierdź
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Results table */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            Wyniki analizy
          </h2>
          {isEditable && (
            <span className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1">
              <AlertTriangle className="h-3 w-3" />
              Wartości można edytować
            </span>
          )}
        </div>

        {resultSuccess && (
          <div className="mx-6 mt-4 rounded-lg bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-800 p-3 text-sm text-green-700 dark:text-green-400">
            {resultSuccess}
          </div>
        )}
        {resultError && (
          <div className="mx-6 mt-4 rounded-lg bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 p-3 text-sm text-red-700 dark:text-red-400">
            {resultError}
          </div>
        )}

        {!analysis.results || analysis.results.length === 0 ? (
          <div className="p-6 text-center text-sm text-gray-500 dark:text-gray-400">
            Brak wyników dla tej analizy.
          </div>
        ) : (
          <form onSubmit={handleSaveResults}>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50">
                    <th className="text-left px-4 py-3 font-medium text-gray-700 dark:text-gray-300">Parametr</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-700 dark:text-gray-300">Jednostka</th>
                    <th className="text-right px-4 py-3 font-medium text-gray-700 dark:text-gray-300">Wartość</th>
                    <th className="text-right px-4 py-3 font-medium text-gray-700 dark:text-gray-300">Min</th>
                    <th className="text-right px-4 py-3 font-medium text-gray-700 dark:text-gray-300">Max</th>
                    <th className="text-right px-4 py-3 font-medium text-gray-700 dark:text-gray-300">Optimum</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-700 dark:text-gray-300">Odchylenie</th>
                    <th className="text-right px-4 py-3 font-medium text-gray-700 dark:text-gray-300">%</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                  {analysis.results.map((result) => (
                    <tr
                      key={result.id}
                      className={`transition-colors ${getRowBgColor(result.deviation)}`}
                    >
                      <td className="px-4 py-3 font-medium text-gray-900 dark:text-white">
                        {result.parameterName}
                      </td>
                      <td className="px-4 py-3 text-gray-600 dark:text-gray-400">
                        {result.unit}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {isEditable ? (
                          <input
                            type="number"
                            step="any"
                            value={resultValues[result.id] ?? ''}
                            onChange={(e) =>
                              setResultValues((prev) => ({
                                ...prev,
                                [result.id]: e.target.value,
                              }))
                            }
                            className="w-24 text-right rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-2 py-1 text-sm text-gray-900 dark:text-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500/20 focus:outline-none"
                          />
                        ) : (
                          <span className="font-medium text-gray-900 dark:text-white">
                            {formatNumber(result.value)}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right text-gray-600 dark:text-gray-400">
                        {result.minReference != null ? formatNumber(result.minReference) : '-'}
                      </td>
                      <td className="px-4 py-3 text-right text-gray-600 dark:text-gray-400">
                        {result.maxReference != null ? formatNumber(result.maxReference) : '-'}
                      </td>
                      <td className="px-4 py-3 text-right text-gray-600 dark:text-gray-400">
                        {result.optimalReference != null ? formatNumber(result.optimalReference) : '-'}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${getDeviationBadgeColor(result.deviation)}`}>
                          {getDeviationLabel(result.deviation)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className={getDeviationColor(result.deviation)}>
                          {result.deviationPercent != null
                            ? `${formatNumber(result.deviationPercent)}%`
                            : '-'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {isEditable && (
              <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 flex justify-end">
                <button
                  type="submit"
                  disabled={savingResults}
                  className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
                >
                  {savingResults ? (
                    <div className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <Save className="h-4 w-4" />
                  )}
                  Zapisz wyniki
                </button>
              </div>
            )}
          </form>
        )}
      </div>

      {/* Recommendations section */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            Rekomendacje ({recommendations.length})
          </h2>
          <button
            onClick={() => setShowRecommendationForm(!showRecommendationForm)}
            className="inline-flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
          >
            <Plus className="h-4 w-4" />
            Dodaj rekomendację
          </button>
        </div>

        {/* Add recommendation form */}
        {showRecommendationForm && (
          <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50">
            {recError && (
              <div className="mb-3 rounded-lg bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 p-3 text-sm text-red-700 dark:text-red-400">
                {recError}
              </div>
            )}
            <form onSubmit={handleAddRecommendation} className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                    Parametr
                  </label>
                  <input
                    type="text"
                    value={recForm.parameterName}
                    onChange={(e) => setRecForm({ ...recForm, parameterName: e.target.value })}
                    placeholder="Nazwa parametru"
                    className="block w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                    Typ rekomendacji
                  </label>
                  <select
                    value={recForm.recommendationType}
                    onChange={(e) => setRecForm({ ...recForm, recommendationType: e.target.value as RecommendationType })}
                    className="block w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none"
                  >
                    {RECOMMENDATION_TYPES.map((rt) => (
                      <option key={rt} value={rt}>{getRecommendationTypeLabel(rt)}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                    Priorytet
                  </label>
                  <select
                    value={recForm.priority}
                    onChange={(e) => setRecForm({ ...recForm, priority: e.target.value as Priority })}
                    className="block w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none"
                  >
                    {PRIORITIES.map((p) => (
                      <option key={p} value={p}>{getPriorityLabel(p)}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                    Wartość aktualna
                  </label>
                  <input
                    type="number"
                    step="any"
                    value={recForm.currentValue}
                    onChange={(e) => setRecForm({ ...recForm, currentValue: e.target.value })}
                    className="block w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                    Wartość docelowa
                  </label>
                  <input
                    type="number"
                    step="any"
                    value={recForm.targetValue}
                    onChange={(e) => setRecForm({ ...recForm, targetValue: e.target.value })}
                    className="block w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                  Opis *
                </label>
                <textarea
                  value={recForm.description}
                  onChange={(e) => setRecForm({ ...recForm, description: e.target.value })}
                  rows={2}
                  required
                  placeholder="Opis rekomendacji..."
                  className="block w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none resize-none"
                />
              </div>
              <div className="flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowRecommendationForm(false)}
                  className="rounded-lg px-3 py-1.5 text-sm font-medium text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                >
                  {t('common.cancel')}
                </button>
                <button
                  type="submit"
                  disabled={addingRecommendation}
                  className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
                >
                  {addingRecommendation && <div className="h-3 w-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
                  Dodaj
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Recommendations list */}
        {recommendations.length === 0 ? (
          <div className="p-6 text-center text-sm text-gray-500 dark:text-gray-400">
            Brak rekomendacji dla tej analizy.
          </div>
        ) : (
          <div className="divide-y divide-gray-200 dark:divide-gray-700">
            {recommendations.map((rec) => (
              <div key={rec.id} className="px-6 py-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${getPriorityColor(rec.priority)}`}>
                        {getPriorityLabel(rec.priority)}
                      </span>
                      <span className="text-xs text-gray-500 dark:text-gray-400">
                        {getRecommendationTypeLabel(rec.recommendationType)}
                      </span>
                      {rec.parameterName && (
                        <span className="text-xs font-medium text-gray-700 dark:text-gray-300">
                          {rec.parameterName}
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-700 dark:text-gray-300">{rec.description}</p>
                    <div className="mt-1 flex items-center gap-4 text-xs text-gray-500 dark:text-gray-400">
                      {rec.currentValue != null && (
                        <span>Aktualna: {formatNumber(rec.currentValue)}</span>
                      )}
                      {rec.targetValue != null && (
                        <span>Docelowa: {formatNumber(rec.targetValue)}</span>
                      )}
                      <span>
                        {rec.creator
                          ? `${rec.creator.firstName} ${rec.creator.lastName}`
                          : '-'}
                        {' '}&middot;{' '}{formatDateTime(rec.createdAt)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
