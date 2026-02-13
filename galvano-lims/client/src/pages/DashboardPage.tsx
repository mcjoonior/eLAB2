import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  ClipboardList,
  AlarmClock,
  FlaskConical,
  UserCog,
  TriangleAlert,
  ChevronRight,
  Plus,
  FileSpreadsheet,
  FileText,
} from 'lucide-react';
import { dashboardService } from '@/services/dashboardService';
import { useAuthStore } from '@/store/authStore';
import type { DashboardOverview } from '@/types';
import { getAnalysisStatusColor, getAnalysisStatusLabel, formatDate, formatDateTime } from '@/utils/helpers';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';

type KpiCard = {
  key: string;
  title: string;
  value: number;
  subtitle?: string;
  icon: typeof ClipboardList;
  classes: string;
  iconClasses: string;
};

const attentionTagClasses: Record<string, string> = {
  OVERDUE: 'bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-200',
  NO_ANALYSIS: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200',
};

const actionIcons: Record<string, typeof Plus> = {
  'add-sample': Plus,
  'add-analysis': ClipboardList,
  import: FileSpreadsheet,
  'generate-report': FileText,
};

export default function DashboardPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const [overview, setOverview] = useState<DashboardOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    async function fetchData() {
      try {
        setLoading(true);
        const data = await dashboardService.getOverview();
        setOverview(data);
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

  if (error || !overview) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="rounded-lg bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 p-6 text-sm text-red-700 dark:text-red-400 max-w-md text-center">
          {error || t('common.errorOccurred')}
        </div>
      </div>
    );
  }

  const kpis: KpiCard[] = [
    {
      key: 'due-today',
      title: t('dashboard.todoToday'),
      value: overview.kpis.dueTodayAnalyses,
      subtitle: `${overview.kpis.dueTodayAnalyses} ${t('dashboard.analysesShort')} • ${overview.kpis.dueTodaySamples} ${t('dashboard.samplesShort')}`,
      icon: ClipboardList,
      classes: 'bg-blue-50 dark:bg-blue-950/60',
      iconClasses: 'bg-blue-100 text-blue-600 dark:bg-blue-900/60 dark:text-blue-300',
    },
    {
      key: 'overdue',
      title: t('dashboard.overdue'),
      value: overview.kpis.overdueAnalyses,
      subtitle: `${overview.kpis.overdueAnalyses} ${t('dashboard.analysesShort')}`,
      icon: AlarmClock,
      classes: 'bg-amber-50 dark:bg-amber-950/60',
      iconClasses: 'bg-amber-100 text-amber-600 dark:bg-amber-900/60 dark:text-amber-300',
    },
    {
      key: 'samples-without-analyses',
      title: t('dashboard.samplesWithoutAnalyses'),
      value: overview.kpis.samplesWithoutAnalyses,
      subtitle: `${overview.kpis.samplesWithoutAnalyses} ${t('dashboard.samplesShort')}`,
      icon: FlaskConical,
      classes: 'bg-violet-50 dark:bg-violet-950/60',
      iconClasses: 'bg-violet-100 text-violet-600 dark:bg-violet-900/60 dark:text-violet-300',
    },
    {
      key: 'my-in-progress',
      title: t('dashboard.myInProgressAnalyses'),
      value: overview.kpis.myInProgressAnalyses,
      subtitle: `${overview.kpis.myInProgressAnalyses} ${t('dashboard.analysesShort')}`,
      icon: UserCog,
      classes: 'bg-emerald-50 dark:bg-emerald-950/60',
      iconClasses: 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/60 dark:text-emerald-300',
    },
    {
      key: 'critical',
      title: t('dashboard.criticalDeviations'),
      value: overview.kpis.criticalDeviationAnalyses,
      subtitle: `${overview.kpis.criticalDeviationAnalyses} ${t('dashboard.analysesShort')}`,
      icon: TriangleAlert,
      classes: 'bg-cyan-50 dark:bg-cyan-950/60',
      iconClasses: 'bg-cyan-100 text-cyan-600 dark:bg-cyan-900/60 dark:text-cyan-300',
    },
  ];

  const quickActions = overview.quickActions.filter((action) => {
    if (action.id === 'import') {
      return (user?.role || '').toUpperCase() === 'ADMIN';
    }
    return true;
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{t('dashboard.title')}</h1>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-4">
        {kpis.map((card) => {
          const Icon = card.icon;
          return (
            <div key={card.key} className={`${card.classes} rounded-xl border border-gray-200 dark:border-gray-700 p-4`}>
              <div className="flex items-start gap-3">
                <div className={`rounded-lg p-2 ${card.iconClasses}`}>
                  <Icon className="h-4 w-4" />
                </div>
                <div className="min-w-0">
                  <p className="text-base font-semibold text-gray-900 dark:text-white leading-tight">{card.title}</p>
                  <p className="mt-1 text-3xl font-bold text-gray-900 dark:text-white">{card.value}</p>
                  {card.subtitle && <p className="mt-0.5 text-sm text-gray-600 dark:text-gray-300">{card.subtitle}</p>}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-4">
        <div className="xl:col-span-9 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm">
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 dark:border-gray-700">
            <h2 className="text-2xl font-semibold text-gray-900 dark:text-white">{t('dashboard.needsAttention')}</h2>
            <Link to="/analyses" className="inline-flex items-center gap-1 text-blue-600 dark:text-blue-400 text-sm font-medium hover:underline">
              {t('dashboard.viewAll')}
              <ChevronRight className="h-4 w-4" />
            </Link>
          </div>
          <div className="p-4 space-y-2">
            {overview.attentionItems.length === 0 ? (
              <div className="rounded-lg border border-gray-200 dark:border-gray-700 p-4 text-sm text-gray-500 dark:text-gray-400">
                {t('common.noData')}
              </div>
            ) : (
              overview.attentionItems.map((item) => (
                <button
                  key={item.id}
                  onClick={() => navigate(item.link)}
                  className="w-full text-left rounded-lg border border-gray-200 dark:border-gray-700 px-3 py-2.5 hover:bg-gray-50 dark:hover:bg-gray-700/40 transition-colors"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <span
                        className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${attentionTagClasses[item.type] || 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-200'}`}
                      >
                        {item.tag}
                      </span>
                      <p className="mt-1 text-base font-semibold text-gray-900 dark:text-white truncate">{item.message}</p>
                      <p className="text-sm text-gray-600 dark:text-gray-300">{item.details}</p>
                    </div>
                    <div className="text-sm text-gray-500 dark:text-gray-400 whitespace-nowrap">{formatDate(item.date)}</div>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>

        <div className="xl:col-span-3 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm">
          <div className="px-5 py-4 border-b border-gray-200 dark:border-gray-700">
            <h2 className="text-2xl font-semibold text-gray-900 dark:text-white">{t('dashboard.quickActions')}</h2>
          </div>
          <div className="p-4 space-y-2">
            {quickActions.map((action) => {
              const Icon = actionIcons[action.id] || ChevronRight;
              return (
                <button
                  key={action.id}
                  onClick={() => navigate(action.link)}
                  className="w-full flex items-center justify-between rounded-lg border border-gray-200 dark:border-gray-700 px-3 py-2.5 hover:bg-gray-50 dark:hover:bg-gray-700/40 transition-colors"
                >
                  <span className="inline-flex items-center gap-2 text-base font-semibold text-gray-900 dark:text-white">
                    <Icon className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                    {action.label}
                  </span>
                  <ChevronRight className="h-4 w-4 text-gray-400" />
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-2xl font-semibold text-gray-900 dark:text-white">{t('dashboard.recentAnalyses')}</h2>
          <Link to="/analyses" className="inline-flex items-center gap-1 text-blue-600 dark:text-blue-400 text-sm font-medium hover:underline">
            {t('dashboard.viewAll')}
            <ChevronRight className="h-4 w-4" />
          </Link>
        </div>

        {overview.recentAnalyses.length === 0 ? (
          <div className="px-6 py-10 text-center text-sm text-gray-500 dark:text-gray-400">{t('common.noData')}</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 dark:border-gray-700">
                  <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">{t('analyses.analysisCode')}</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">{t('analyses.sample')}</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">{t('samples.client')}</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">{t('dashboard.analyst')}</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">{t('common.status')}</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">{t('dashboard.deadline')}</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">{t('common.date')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                {overview.recentAnalyses.map((analysis) => (
                  <tr
                    key={analysis.id}
                    onClick={() => navigate(analysis.link)}
                    className="hover:bg-gray-50 dark:hover:bg-gray-750 cursor-pointer transition-colors"
                  >
                    <td className="px-5 py-3 font-semibold text-gray-900 dark:text-white whitespace-nowrap">{analysis.analysisCode}</td>
                    <td className="px-5 py-3 text-gray-700 dark:text-gray-200 whitespace-nowrap">{analysis.sampleCode}</td>
                    <td className="px-5 py-3 text-gray-700 dark:text-gray-200 whitespace-nowrap">{analysis.clientName}</td>
                    <td className="px-5 py-3 text-gray-700 dark:text-gray-200 whitespace-nowrap">{analysis.analystName}</td>
                    <td className="px-5 py-3 whitespace-nowrap">
                      <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${getAnalysisStatusColor(analysis.status)}`}>
                        {getAnalysisStatusLabel(analysis.status)}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-gray-700 dark:text-gray-200 whitespace-nowrap">{formatDate(analysis.deadline)}</td>
                    <td className="px-5 py-3 text-gray-500 dark:text-gray-400 whitespace-nowrap">{formatDateTime(analysis.date)}</td>
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
