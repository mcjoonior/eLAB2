import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  TestTubes,
  Calendar,
  Microscope,
  AlertTriangle,
  CheckCircle,
  FlaskConical,
  Plus,
  ArrowRight,
} from 'lucide-react';
import { dashboardService } from '@/services/dashboardService';
import type { DashboardStats, Analysis } from '@/types';
import {
  getAnalysisStatusColor,
  getAnalysisStatusLabel,
  formatDate,
} from '@/utils/helpers';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';

interface CriticalAlert {
  id: string;
  parameterName: string;
  value: number;
  unit?: string;
  deviation: string;
  analysisId?: string;
  sampleCode?: string;
}

export default function DashboardPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [recentAnalyses, setRecentAnalyses] = useState<Analysis[]>([]);
  const [criticalAlerts, setCriticalAlerts] = useState<CriticalAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    async function fetchData() {
      try {
        setLoading(true);
        const [statsData, analysesData, alertsData] = await Promise.all([
          dashboardService.getStats(),
          dashboardService.getRecentAnalyses(),
          dashboardService.getCriticalAlerts(),
        ]);
        setStats(statsData);
        setRecentAnalyses(analysesData);
        setCriticalAlerts(alertsData);
      } catch (err: any) {
        setError(err?.response?.data?.message || t('common.errorOccurred'));
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [t]);

  if (loading) {
    return <LoadingSpinner size="lg" text={t('common.loading')} />;
  }

  if (error) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="rounded-lg bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 p-6 text-sm text-red-700 dark:text-red-400 max-w-md text-center">
          {error}
        </div>
      </div>
    );
  }

  const statCards = [
    {
      label: t('dashboard.samplesToday'),
      value: stats?.samplesToday ?? 0,
      icon: TestTubes,
      bg: 'bg-blue-50 dark:bg-blue-950',
      iconBg: 'bg-blue-100 dark:bg-blue-900',
      iconColor: 'text-blue-600 dark:text-blue-400',
      textColor: 'text-blue-900 dark:text-blue-100',
    },
    {
      label: t('dashboard.samplesThisWeek'),
      value: stats?.samplesThisWeek ?? 0,
      icon: Calendar,
      bg: 'bg-purple-50 dark:bg-purple-950',
      iconBg: 'bg-purple-100 dark:bg-purple-900',
      iconColor: 'text-purple-600 dark:text-purple-400',
      textColor: 'text-purple-900 dark:text-purple-100',
    },
    {
      label: t('dashboard.samplesThisMonth'),
      value: stats?.samplesThisMonth ?? 0,
      icon: Calendar,
      bg: 'bg-indigo-50 dark:bg-indigo-950',
      iconBg: 'bg-indigo-100 dark:bg-indigo-900',
      iconColor: 'text-indigo-600 dark:text-indigo-400',
      textColor: 'text-indigo-900 dark:text-indigo-100',
    },
    {
      label: t('dashboard.analysesInProgress'),
      value: stats?.analysesInProgress ?? 0,
      icon: Microscope,
      bg: 'bg-yellow-50 dark:bg-yellow-950',
      iconBg: 'bg-yellow-100 dark:bg-yellow-900',
      iconColor: 'text-yellow-600 dark:text-yellow-400',
      textColor: 'text-yellow-900 dark:text-yellow-100',
    },
    {
      label: t('dashboard.analysesCompleted'),
      value: stats?.analysesCompleted ?? 0,
      icon: CheckCircle,
      bg: 'bg-green-50 dark:bg-green-950',
      iconBg: 'bg-green-100 dark:bg-green-900',
      iconColor: 'text-green-600 dark:text-green-400',
      textColor: 'text-green-900 dark:text-green-100',
    },
    {
      label: t('dashboard.criticalDeviations'),
      value: stats?.criticalDeviations ?? 0,
      icon: AlertTriangle,
      bg: 'bg-red-50 dark:bg-red-950',
      iconBg: 'bg-red-100 dark:bg-red-900',
      iconColor: 'text-red-600 dark:text-red-400',
      textColor: 'text-red-900 dark:text-red-100',
    },
  ];

  return (
    <div className="space-y-6">
      {/* Page Title */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          {t('dashboard.title')}
        </h1>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        {statCards.map((card) => {
          const Icon = card.icon;
          return (
            <div
              key={card.label}
              className={`${card.bg} rounded-xl border border-gray-200 dark:border-gray-700 p-4`}
            >
              <div className="flex items-center gap-3">
                <div
                  className={`${card.iconBg} rounded-lg p-2 flex-shrink-0`}
                >
                  <Icon className={`h-5 w-5 ${card.iconColor}`} />
                </div>
                <div className="min-w-0">
                  <p className="text-2xl font-bold text-gray-900 dark:text-white">
                    {card.value}
                  </p>
                  <p
                    className={`text-xs font-medium ${card.textColor} truncate`}
                  >
                    {card.label}
                  </p>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Analyses Table - spans 2 columns */}
        <div className="lg:col-span-2 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm">
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
            <h2 className="text-base font-semibold text-gray-900 dark:text-white">
              {t('dashboard.recentAnalyses')}
            </h2>
            <Link
              to="/analyses"
              className="text-sm text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
            >
              {t('common.all')}
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>

          {recentAnalyses.length === 0 ? (
            <div className="px-6 py-10 text-center text-sm text-gray-500 dark:text-gray-400">
              {t('common.noData')}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 dark:border-gray-700">
                    <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      {t('analyses.analysisCode')}
                    </th>
                    <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      {t('analyses.sample')}
                    </th>
                    <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      {t('samples.client')}
                    </th>
                    <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      {t('common.status')}
                    </th>
                    <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      {t('common.date')}
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                  {recentAnalyses.map((analysis) => (
                    <tr
                      key={analysis.id}
                      onClick={() => navigate(`/analyses/${analysis.id}`)}
                      className="hover:bg-gray-50 dark:hover:bg-gray-750 cursor-pointer transition-colors"
                    >
                      <td className="px-6 py-3 font-medium text-gray-900 dark:text-white whitespace-nowrap">
                        {analysis.analysisCode}
                      </td>
                      <td className="px-6 py-3 text-gray-600 dark:text-gray-300 whitespace-nowrap">
                        {analysis.sample?.sampleCode ?? '—'}
                      </td>
                      <td className="px-6 py-3 text-gray-600 dark:text-gray-300 whitespace-nowrap">
                        {analysis.sample?.client?.companyName ?? '—'}
                      </td>
                      <td className="px-6 py-3 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${getAnalysisStatusColor(analysis.status)}`}
                        >
                          {getAnalysisStatusLabel(analysis.status)}
                        </span>
                      </td>
                      <td className="px-6 py-3 text-gray-500 dark:text-gray-400 whitespace-nowrap">
                        {formatDate(analysis.analysisDate)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Right Column: Alerts + Quick Actions */}
        <div className="space-y-6">
          {/* Critical Alerts */}
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm">
            <div className="flex items-center gap-2 px-6 py-4 border-b border-gray-200 dark:border-gray-700">
              <AlertTriangle className="h-4 w-4 text-red-500" />
              <h2 className="text-base font-semibold text-gray-900 dark:text-white">
                {t('dashboard.criticalAlerts')}
              </h2>
            </div>

            {criticalAlerts.length === 0 ? (
              <div className="px-6 py-8 text-center">
                <CheckCircle className="h-8 w-8 text-green-500 mx-auto mb-2" />
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {t('common.noData')}
                </p>
              </div>
            ) : (
              <ul className="divide-y divide-gray-100 dark:divide-gray-700 max-h-80 overflow-y-auto">
                {criticalAlerts.map((alert, idx) => (
                  <li
                    key={alert.id ?? idx}
                    className="px-6 py-3 hover:bg-gray-50 dark:hover:bg-gray-750 transition-colors cursor-pointer"
                    onClick={() =>
                      alert.analysisId &&
                      navigate(`/analyses/${alert.analysisId}`)
                    }
                  >
                    <div className="flex items-start gap-3">
                      <div className="mt-0.5 flex-shrink-0 h-2 w-2 rounded-full bg-red-500" />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                          {alert.parameterName}
                        </p>
                        <p className="text-xs text-red-600 dark:text-red-400 mt-0.5">
                          {alert.value}
                          {alert.unit ? ` ${alert.unit}` : ''} &mdash;{' '}
                          {alert.deviation}
                        </p>
                        {alert.sampleCode && (
                          <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
                            {alert.sampleCode}
                          </p>
                        )}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Quick Actions */}
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm">
            <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-base font-semibold text-gray-900 dark:text-white">
                {t('dashboard.quickActions')}
              </h2>
            </div>

            <div className="p-4 space-y-3">
              <Link
                to="/samples?new=1"
                className="flex items-center gap-3 w-full rounded-lg border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 px-4 py-3 text-sm font-medium text-gray-900 dark:text-white hover:bg-blue-50 dark:hover:bg-blue-900/30 hover:border-blue-300 dark:hover:border-blue-700 transition-colors"
              >
                <div className="flex items-center justify-center h-8 w-8 rounded-lg bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-400">
                  <Plus className="h-4 w-4" />
                </div>
                <div>
                  <span className="block">{t('dashboard.addSample')}</span>
                  <span className="block text-xs text-gray-500 dark:text-gray-400 font-normal">
                    {t('samples.addSample')}
                  </span>
                </div>
              </Link>

              <Link
                to="/analyses?new=1"
                className="flex items-center gap-3 w-full rounded-lg border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 px-4 py-3 text-sm font-medium text-gray-900 dark:text-white hover:bg-green-50 dark:hover:bg-green-900/30 hover:border-green-300 dark:hover:border-green-700 transition-colors"
              >
                <div className="flex items-center justify-center h-8 w-8 rounded-lg bg-green-100 dark:bg-green-900 text-green-600 dark:text-green-400">
                  <FlaskConical className="h-4 w-4" />
                </div>
                <div>
                  <span className="block">{t('dashboard.newAnalysis')}</span>
                  <span className="block text-xs text-gray-500 dark:text-gray-400 font-normal">
                    {t('analyses.addAnalysis')}
                  </span>
                </div>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
