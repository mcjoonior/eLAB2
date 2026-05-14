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
import { getBranding } from '@/services/adminService';
import { useAuthStore } from '@/store/authStore';
import type { DashboardOverview, DashboardVariant } from '@/types';
import { getAnalysisStatusColor, getAnalysisStatusLabel, formatDate, formatDateTime } from '@/utils/helpers';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';

type KpiTone = 'red' | 'amber' | 'blue' | 'emerald' | 'violet';

type KpiCard = {
  key: string;
  title: string;
  value: number;
  icon: typeof ClipboardList;
  tone: KpiTone;
};

const actionIcons: Record<string, typeof Plus> = {
  'add-sample': Plus,
  'add-analysis': ClipboardList,
  import: FileSpreadsheet,
  'generate-report': FileText,
};

const toneStyles: Record<KpiTone, { card: string; icon: string; iconBg: string }> = {
  red: {
    card: 'border-red-200 dark:border-red-800/60',
    icon: 'text-red-600 dark:text-red-400',
    iconBg: 'bg-red-100 dark:bg-red-900/40',
  },
  amber: {
    card: 'border-amber-200 dark:border-amber-800/60',
    icon: 'text-amber-600 dark:text-amber-400',
    iconBg: 'bg-amber-100 dark:bg-amber-900/40',
  },
  blue: {
    card: 'border-blue-200 dark:border-blue-800/60',
    icon: 'text-blue-600 dark:text-blue-400',
    iconBg: 'bg-blue-100 dark:bg-blue-900/40',
  },
  emerald: {
    card: 'border-emerald-200 dark:border-emerald-800/60',
    icon: 'text-emerald-600 dark:text-emerald-400',
    iconBg: 'bg-emerald-100 dark:bg-emerald-900/40',
  },
  violet: {
    card: 'border-violet-200 dark:border-violet-800/60',
    icon: 'text-violet-600 dark:text-violet-400',
    iconBg: 'bg-violet-100 dark:bg-violet-900/40',
  },
};

function getOverdueDays(dateStr: string): number {
  const date = new Date(dateStr);
  const now = new Date();
  date.setHours(0, 0, 0, 0);
  now.setHours(0, 0, 0, 0);
  return Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
}

function OverdueLabel({ dateStr, type }: { dateStr: string; type: string }) {
  if (type !== 'OVERDUE') return null;
  const days = getOverdueDays(dateStr);
  if (days <= 0) return <span className="text-xs text-amber-600 dark:text-amber-400 font-medium">Dziś upływa termin</span>;
  return (
    <span className="text-xs text-red-600 dark:text-red-400 font-medium">
      {days} {days === 1 ? 'dzień' : 'dni'} po terminie
    </span>
  );
}

export default function DashboardPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const [overview, setOverview] = useState<DashboardOverview | null>(null);
  const [dashboardVariant, setDashboardVariant] = useState<DashboardVariant>('CLEAN');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    async function fetchData() {
      try {
        setLoading(true);
        const [overviewData, branding] = await Promise.all([
          dashboardService.getOverview(),
          getBranding(),
        ]);
        setOverview(overviewData);
        setDashboardVariant(branding.dashboardVariant || 'CLEAN');
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

  const isLightConcept = dashboardVariant === 'LIGHT_CONCEPT';

  const kpis: KpiCard[] = [
    {
      key: 'overdue',
      title: t('dashboard.overdue'),
      value: overview.kpis.overdueAnalyses,
      icon: AlarmClock,
      tone: 'red',
    },
    {
      key: 'critical',
      title: t('dashboard.criticalDeviations'),
      value: overview.kpis.criticalDeviationAnalyses,
      icon: TriangleAlert,
      tone: 'amber',
    },
    {
      key: 'due-today',
      title: t('dashboard.todoToday'),
      value: overview.kpis.dueTodayAnalyses,
      icon: ClipboardList,
      tone: 'blue',
    },
    {
      key: 'samples-without-analyses',
      title: t('dashboard.samplesWithoutAnalyses'),
      value: overview.kpis.samplesWithoutAnalyses,
      icon: FlaskConical,
      tone: 'violet',
    },
    {
      key: 'my-in-progress',
      title: t('dashboard.myInProgressAnalyses'),
      value: overview.kpis.myInProgressAnalyses,
      icon: UserCog,
      tone: 'emerald',
    },
  ];

  const quickActions = overview.quickActions.filter((action) => {
    if (action.id === 'import') return (user?.role || '').toUpperCase() === 'ADMIN';
    return true;
  });

  const cardBase = 'rounded-xl border bg-white dark:bg-gray-800 shadow-sm';

  return (
    <div className="space-y-5">
      {/* Page header */}
      <div>
        <h1 className="text-xl font-bold text-gray-900 dark:text-white">{t('dashboard.title')}</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">Przegląd najważniejszych informacji w laboratorium</p>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-5 gap-3">
        {kpis.map((card) => {
          const Icon = card.icon;
          const s = toneStyles[card.tone];
          return (
            <div
              key={card.key}
              className={`${cardBase} ${s.card} p-4 ${isLightConcept ? 'hover:-translate-y-0.5 hover:shadow-md transition-all' : ''}`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-gray-500 dark:text-gray-400 leading-tight">{card.title}</p>
                  <p className="mt-1.5 text-3xl font-bold text-gray-900 dark:text-white">{card.value}</p>
                </div>
                <div className={`rounded-lg p-2 flex-shrink-0 ${s.iconBg}`}>
                  <Icon className={`h-4 w-4 ${s.icon}`} />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Main content row */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-4">
        {/* Attention items */}
        <div className={`xl:col-span-9 ${cardBase}`}>
          <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-100 dark:border-gray-700">
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-semibold text-gray-900 dark:text-white">{t('dashboard.needsAttention')}</h2>
              {overview.attentionItems.length > 0 && (
                <span className="inline-flex items-center justify-center h-5 min-w-[20px] px-1.5 rounded-full bg-red-500 text-white text-[10px] font-bold">
                  {overview.attentionItems.length}
                </span>
              )}
            </div>
            <Link to="/analyses" className="inline-flex items-center gap-1 text-blue-600 dark:text-blue-400 text-xs font-medium hover:underline">
              {t('dashboard.viewAll')}
              <ChevronRight className="h-3.5 w-3.5" />
            </Link>
          </div>
          <div className="p-3 space-y-1.5">
            {overview.attentionItems.length === 0 ? (
              <div className="rounded-lg border border-gray-100 dark:border-gray-700 p-4 text-sm text-gray-400 dark:text-gray-500 text-center">
                {t('common.noData')}
              </div>
            ) : (
              overview.attentionItems.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between gap-3 rounded-lg border border-gray-100 dark:border-gray-700 px-3.5 py-2.5 hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span className={`flex-shrink-0 inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                      item.type === 'OVERDUE'
                        ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300'
                        : 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300'
                    }`}>
                      {item.tag}
                    </span>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">{item.message}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{item.details}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 flex-shrink-0">
                    <OverdueLabel dateStr={item.date} type={item.type} />
                    <button
                      onClick={() => navigate(item.link)}
                      className="text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline whitespace-nowrap"
                    >
                      Otwórz
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Quick actions */}
        <div className={`xl:col-span-3 ${cardBase}`}>
          <div className="px-5 py-3.5 border-b border-gray-100 dark:border-gray-700">
            <h2 className="text-sm font-semibold text-gray-900 dark:text-white">{t('dashboard.quickActions')}</h2>
          </div>
          <div className="p-3 space-y-1">
            {quickActions.map((action) => {
              const Icon = actionIcons[action.id] || ChevronRight;
              const isAddAction = action.id === 'add-sample' || action.id === 'add-analysis';
              return (
                <button
                  key={action.id}
                  onClick={() => navigate(action.link)}
                  className="w-full flex items-center justify-between rounded-lg border border-gray-100 dark:border-gray-700 px-3.5 py-2.5 hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors group"
                >
                  <span className="inline-flex items-center gap-2.5 text-sm font-medium text-gray-700 dark:text-gray-200">
                    <Icon className={`h-4 w-4 flex-shrink-0 ${isAddAction ? 'text-blue-500' : 'text-gray-400 dark:text-gray-500'}`} />
                    {isAddAction ? `+ ${action.label}` : action.label}
                  </span>
                  <ChevronRight className="h-3.5 w-3.5 text-gray-300 dark:text-gray-600 group-hover:text-gray-400 transition-colors" />
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Recent analyses */}
      <div className={`${cardBase} overflow-hidden`}>
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-100 dark:border-gray-700">
          <h2 className="text-sm font-semibold text-gray-900 dark:text-white">{t('dashboard.recentAnalyses')}</h2>
          <Link to="/analyses" className="inline-flex items-center gap-1 text-blue-600 dark:text-blue-400 text-xs font-medium hover:underline">
            {t('dashboard.viewAll')}
            <ChevronRight className="h-3.5 w-3.5" />
          </Link>
        </div>

        {overview.recentAnalyses.length === 0 ? (
          <div className="px-6 py-10 text-center text-sm text-gray-400 dark:text-gray-500">{t('common.noData')}</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-700/20">
                  <th className="text-left px-5 py-2.5 text-[11px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider">{t('analyses.analysisCode')}</th>
                  <th className="text-left px-5 py-2.5 text-[11px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider">{t('analyses.sample')}</th>
                  <th className="text-left px-5 py-2.5 text-[11px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider">{t('samples.client')}</th>
                  <th className="text-left px-5 py-2.5 text-[11px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider">{t('dashboard.analyst')}</th>
                  <th className="text-left px-5 py-2.5 text-[11px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider">{t('common.status')}</th>
                  <th className="text-left px-5 py-2.5 text-[11px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider">{t('dashboard.deadline')}</th>
                  <th className="text-left px-5 py-2.5 text-[11px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider">{t('common.date')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 dark:divide-gray-700/50">
                {overview.recentAnalyses.map((analysis) => (
                  <tr
                    key={analysis.id}
                    onClick={() => navigate(analysis.link)}
                    className="hover:bg-gray-50 dark:hover:bg-gray-700/20 cursor-pointer transition-colors"
                  >
                    <td className="px-5 py-3 font-semibold text-gray-900 dark:text-white whitespace-nowrap text-xs">{analysis.analysisCode}</td>
                    <td className="px-5 py-3 text-gray-600 dark:text-gray-300 whitespace-nowrap text-xs">{analysis.sampleCode}</td>
                    <td className="px-5 py-3 text-gray-600 dark:text-gray-300 whitespace-nowrap text-xs">{analysis.clientName}</td>
                    <td className="px-5 py-3 text-gray-600 dark:text-gray-300 whitespace-nowrap text-xs">{analysis.analystName}</td>
                    <td className="px-5 py-3 whitespace-nowrap">
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ${getAnalysisStatusColor(analysis.status)}`}>
                        {getAnalysisStatusLabel(analysis.status)}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-gray-600 dark:text-gray-300 whitespace-nowrap text-xs">{formatDate(analysis.deadline)}</td>
                    <td className="px-5 py-3 text-gray-400 dark:text-gray-500 whitespace-nowrap text-xs">{formatDateTime(analysis.date)}</td>
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
