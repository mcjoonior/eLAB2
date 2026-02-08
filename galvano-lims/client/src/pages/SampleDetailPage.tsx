import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, Plus, FlaskConical, Clock, User, FileText } from 'lucide-react';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import { sampleService } from '@/services/sampleService';
import { analysisService } from '@/services/analysisService';
import {
  getSampleStatusColor,
  getSampleStatusLabel,
  getSampleTypeLabel,
  getAnalysisStatusColor,
  getAnalysisStatusLabel,
  formatDate,
  formatDateTime,
} from '@/utils/helpers';
import type { Sample, SampleStatus, AnalysisStatus } from '@/types';

const VALID_NEXT_SAMPLE_STATUSES: Record<SampleStatus, SampleStatus[]> = {
  REGISTERED: ['IN_PROGRESS', 'CANCELLED'],
  IN_PROGRESS: ['COMPLETED', 'CANCELLED'],
  COMPLETED: [],
  CANCELLED: [],
};

export default function SampleDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { t } = useTranslation();
  const navigate = useNavigate();

  const [sample, setSample] = useState<Sample | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [statusLoading, setStatusLoading] = useState(false);
  const [createAnalysisLoading, setCreateAnalysisLoading] = useState(false);

  useEffect(() => {
    if (id) fetchSample();
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
    setCreateAnalysisLoading(true);
    try {
      const analysis = await analysisService.create({ sampleId: sample.id });
      navigate(`/analyses/${analysis.id}`);
    } catch {
      setError('Nie udało się utworzyć analizy dla tej próbki.');
    } finally {
      setCreateAnalysisLoading(false);
    }
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
          <span className={`inline-flex items-center rounded-full px-3 py-1 text-sm font-medium ${getSampleStatusColor(sample.status)}`}>
            {getSampleStatusLabel(sample.status)}
          </span>
        </div>

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

        {/* Status Workflow Buttons */}
        {validNextStatuses.length > 0 && (
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
            disabled={createAnalysisLoading}
            className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500/50 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
          >
            {createAnalysisLoading ? (
              <div className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <Plus className="h-4 w-4" />
            )}
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
    </div>
  );
}
