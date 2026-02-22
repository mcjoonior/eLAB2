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

type KpiTone = 'blue' | 'amber' | 'violet' | 'emerald' | 'cyan';

type KpiCard = {
  key: string;
  title: string;
  value: number;
  subtitle?: string;
  icon: typeof ClipboardList;
  tone: KpiTone;
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

function getKpiStyles(tone: KpiTone, variant: DashboardVariant) {
  const cleanStyles: Record<KpiTone, { card: string; icon: string }> = {
    blue: {
      card: 'bg-blue-50 dark:bg-blue-950/60',
      icon: 'bg-blue-100 text-blue-600 dark:bg-blue-900/60 dark:text-blue-300',
    },
    amber: {
      card: 'bg-amber-50 dark:bg-amber-950/60',
      icon: 'bg-amber-100 text-amber-600 dark:bg-amber-900/60 dark:text-amber-300',
    },
    violet: {
      card: 'bg-violet-50 dark:bg-violet-950/60',
      icon: 'bg-violet-100 text-violet-600 dark:bg-violet-900/60 dark:text-violet-300',
    },
    emerald: {
      card: 'bg-emerald-50 dark:bg-emerald-950/60',
      icon: 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/60 dark:text-emerald-300',
    },
    cyan: {
      card: 'bg-cyan-50 dark:bg-cyan-950/60',
      icon: 'bg-cyan-100 text-cyan-600 dark:bg-cyan-900/60 dark:text-cyan-300',
    },
  };

  const modernStyles: Record<KpiTone, { card: string; icon: string }> = {
    blue: {
      card: 'bg-gradient-to-br from-blue-50 via-white to-blue-100 dark:from-blue-950/60 dark:via-gray-900 dark:to-blue-900/40 shadow-md',
      icon: 'bg-blue-500/15 text-blue-700 dark:text-blue-300',
    },
    amber: {
      card: 'bg-gradient-to-br from-amber-50 via-white to-yellow-100 dark:from-amber-950/60 dark:via-gray-900 dark:to-yellow-900/30 shadow-md',
      icon: 'bg-amber-500/15 text-amber-700 dark:text-amber-300',
    },
    violet: {
      card: 'bg-gradient-to-br from-violet-50 via-white to-fuchsia-100 dark:from-violet-950/60 dark:via-gray-900 dark:to-fuchsia-900/30 shadow-md',
      icon: 'bg-violet-500/15 text-violet-700 dark:text-violet-300',
    },
    emerald: {
      card: 'bg-gradient-to-br from-emerald-50 via-white to-teal-100 dark:from-emerald-950/60 dark:via-gray-900 dark:to-teal-900/30 shadow-md',
      icon: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300',
    },
    cyan: {
      card: 'bg-gradient-to-br from-cyan-50 via-white to-sky-100 dark:from-cyan-950/60 dark:via-gray-900 dark:to-sky-900/30 shadow-md',
      icon: 'bg-cyan-500/15 text-cyan-700 dark:text-cyan-300',
    },
  };

  const oceanStyles: Record<KpiTone, { card: string; icon: string }> = {
    blue: {
      card: 'bg-gradient-to-br from-cyan-50 via-white to-blue-100 dark:from-cyan-950/60 dark:via-gray-900 dark:to-blue-900/40 shadow-md',
      icon: 'bg-cyan-500/15 text-cyan-700 dark:text-cyan-300',
    },
    amber: {
      card: 'bg-gradient-to-br from-amber-50 via-white to-cyan-100 dark:from-amber-950/60 dark:via-gray-900 dark:to-cyan-900/30 shadow-md',
      icon: 'bg-amber-500/15 text-amber-700 dark:text-amber-300',
    },
    violet: {
      card: 'bg-gradient-to-br from-indigo-50 via-white to-cyan-100 dark:from-indigo-950/60 dark:via-gray-900 dark:to-cyan-900/30 shadow-md',
      icon: 'bg-indigo-500/15 text-indigo-700 dark:text-indigo-300',
    },
    emerald: {
      card: 'bg-gradient-to-br from-teal-50 via-white to-cyan-100 dark:from-teal-950/60 dark:via-gray-900 dark:to-cyan-900/30 shadow-md',
      icon: 'bg-teal-500/15 text-teal-700 dark:text-teal-300',
    },
    cyan: {
      card: 'bg-gradient-to-br from-sky-50 via-white to-cyan-100 dark:from-sky-950/60 dark:via-gray-900 dark:to-cyan-900/30 shadow-md',
      icon: 'bg-sky-500/15 text-sky-700 dark:text-sky-300',
    },
  };

  const graphiteStyles: Record<KpiTone, { card: string; icon: string }> = {
    blue: {
      card: 'bg-gradient-to-br from-zinc-100 via-white to-slate-100 dark:from-zinc-900/70 dark:via-gray-900 dark:to-slate-900/50 shadow-md',
      icon: 'bg-slate-500/15 text-slate-700 dark:text-slate-300',
    },
    amber: {
      card: 'bg-gradient-to-br from-zinc-100 via-white to-stone-100 dark:from-zinc-900/70 dark:via-gray-900 dark:to-stone-900/40 shadow-md',
      icon: 'bg-stone-500/15 text-stone-700 dark:text-stone-300',
    },
    violet: {
      card: 'bg-gradient-to-br from-zinc-100 via-white to-gray-100 dark:from-zinc-900/70 dark:via-gray-900 dark:to-gray-900/40 shadow-md',
      icon: 'bg-zinc-500/15 text-zinc-700 dark:text-zinc-300',
    },
    emerald: {
      card: 'bg-gradient-to-br from-slate-100 via-white to-zinc-100 dark:from-slate-900/70 dark:via-gray-900 dark:to-zinc-900/40 shadow-md',
      icon: 'bg-slate-500/15 text-slate-700 dark:text-slate-300',
    },
    cyan: {
      card: 'bg-gradient-to-br from-gray-100 via-white to-slate-100 dark:from-gray-900/70 dark:via-gray-900 dark:to-slate-900/40 shadow-md',
      icon: 'bg-gray-500/15 text-gray-700 dark:text-gray-300',
    },
  };

  const lightConceptStyles: Record<KpiTone, { card: string; icon: string }> = {
    blue: {
      card: 'bg-[#E4F4FB]',
      icon: 'bg-[#118AB2]/15 text-[#118AB2]',
    },
    amber: {
      card: 'bg-[#FFF3E8]',
      icon: 'bg-[#FF8C42]/15 text-[#FF8C42]',
    },
    violet: {
      card: 'bg-[#F0ECFF]',
      icon: 'bg-[#7B61FF]/15 text-[#7B61FF]',
    },
    emerald: {
      card: 'bg-[#E6FBF4]',
      icon: 'bg-[#06D6A0]/20 text-[#059669]',
    },
    cyan: {
      card: 'bg-[#FFF0F0]',
      icon: 'bg-[#FF6B6B]/15 text-[#FF6B6B]',
    },
  };

  if (variant === 'MODERN') return modernStyles[tone];
  if (variant === 'OCEAN') return oceanStyles[tone];
  if (variant === 'GRAPHITE') return graphiteStyles[tone];
  if (variant === 'LIGHT_CONCEPT') return lightConceptStyles[tone];
  return cleanStyles[tone];
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

  const isColorVariant = dashboardVariant !== 'CLEAN';
  const isLightConcept = dashboardVariant === 'LIGHT_CONCEPT';

  const wrapperClassByVariant: Record<DashboardVariant, string> = {
    CLEAN: 'space-y-6',
    MODERN: 'space-y-6 bg-gradient-to-br from-slate-50 via-blue-50/70 to-cyan-50 dark:from-gray-900 dark:via-gray-900 dark:to-gray-800 -m-4 md:-m-6 p-4 md:p-6 min-h-full',
    OCEAN: 'space-y-6 bg-gradient-to-br from-teal-50 via-cyan-50/70 to-sky-50 dark:from-slate-900 dark:via-cyan-950/60 dark:to-blue-950/60 -m-4 md:-m-6 p-4 md:p-6 min-h-full',
    GRAPHITE: 'space-y-6 bg-gradient-to-br from-zinc-100 via-slate-100/70 to-gray-100 dark:from-zinc-900 dark:via-gray-900 dark:to-slate-900 -m-4 md:-m-6 p-4 md:p-6 min-h-full',
    LIGHT_CONCEPT: 'space-y-6 bg-[#F6F4F0] -m-4 md:-m-6 p-4 md:p-6 min-h-full',
  };

  const kpis: KpiCard[] = [
    {
      key: 'due-today',
      title: t('dashboard.todoToday'),
      value: overview.kpis.dueTodayAnalyses,
      subtitle: `${overview.kpis.dueTodayAnalyses} ${t('dashboard.analysesShort')} • ${overview.kpis.dueTodaySamples} ${t('dashboard.samplesShort')}`,
      icon: ClipboardList,
      tone: 'blue',
    },
    {
      key: 'overdue',
      title: t('dashboard.overdue'),
      value: overview.kpis.overdueAnalyses,
      subtitle: `${overview.kpis.overdueAnalyses} ${t('dashboard.analysesShort')}`,
      icon: AlarmClock,
      tone: 'amber',
    },
    {
      key: 'samples-without-analyses',
      title: t('dashboard.samplesWithoutAnalyses'),
      value: overview.kpis.samplesWithoutAnalyses,
      subtitle: `${overview.kpis.samplesWithoutAnalyses} ${t('dashboard.samplesShort')}`,
      icon: FlaskConical,
      tone: 'violet',
    },
    {
      key: 'my-in-progress',
      title: t('dashboard.myInProgressAnalyses'),
      value: overview.kpis.myInProgressAnalyses,
      subtitle: `${overview.kpis.myInProgressAnalyses} ${t('dashboard.analysesShort')}`,
      icon: UserCog,
      tone: 'emerald',
    },
    {
      key: 'critical',
      title: t('dashboard.criticalDeviations'),
      value: overview.kpis.criticalDeviationAnalyses,
      subtitle: `${overview.kpis.criticalDeviationAnalyses} ${t('dashboard.analysesShort')}`,
      icon: TriangleAlert,
      tone: 'cyan',
    },
  ];

  const quickActions = overview.quickActions.filter((action) => {
    if (action.id === 'import') {
      return (user?.role || '').toUpperCase() === 'ADMIN';
    }
    return true;
  });

  const cardContainerClass = isColorVariant
    ? 'rounded-xl border border-slate-200/70 dark:border-gray-700/80 bg-white/85 dark:bg-gray-800/85 backdrop-blur-sm'
    : 'rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800';

  return (
    <div className={wrapperClassByVariant[dashboardVariant]}>
      <div className="flex items-center justify-between">
        <h1 className={isColorVariant ? 'text-3xl font-bold tracking-tight text-slate-900 dark:text-white' : 'text-2xl font-bold text-gray-900 dark:text-white'}>
          {t('dashboard.title')}
        </h1>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-4">
        {kpis.map((card) => {
          const Icon = card.icon;
          const styles = getKpiStyles(card.tone, dashboardVariant);
          return (
            <div
              key={card.key}
              className={`${styles.card} rounded-xl border p-4 ${
                isLightConcept
                  ? 'border-black/5 hover:-translate-y-0.5 hover:shadow-md transition-all'
                  : 'border-gray-200/80 dark:border-gray-700'
              }`}
            >
              <div className="flex items-start gap-3">
                <div className={`rounded-lg p-2 ${styles.icon}`}>
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
        <div className={`xl:col-span-9 ${cardContainerClass} shadow-sm`}>
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
                  className={isColorVariant
                    ? 'w-full text-left rounded-xl border border-gray-200 dark:border-gray-700 px-3 py-2.5 bg-white/70 dark:bg-gray-800/70 hover:bg-white dark:hover:bg-gray-800 transition-colors'
                    : 'w-full text-left rounded-lg border border-gray-200 dark:border-gray-700 px-3 py-2.5 hover:bg-gray-50 dark:hover:bg-gray-700/40 transition-colors'}
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

        <div className={`xl:col-span-3 ${cardContainerClass} shadow-sm`}>
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
                  className={isColorVariant
                    ? 'w-full flex items-center justify-between rounded-xl border border-gray-200 dark:border-gray-700 px-3 py-2.5 bg-white/75 dark:bg-gray-800/75 hover:bg-white dark:hover:bg-gray-800 transition-colors'
                    : 'w-full flex items-center justify-between rounded-lg border border-gray-200 dark:border-gray-700 px-3 py-2.5 hover:bg-gray-50 dark:hover:bg-gray-700/40 transition-colors'}
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

      <div className={`${cardContainerClass} shadow-sm overflow-hidden`}>
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
