import { Response, NextFunction } from 'express';
import { prisma } from '../index';
import { AuthenticatedRequest } from '../middleware/auth';

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function endOfDay(date: Date): Date {
  const d = startOfDay(date);
  d.setDate(d.getDate() + 1);
  return d;
}

function fullName(user?: { firstName: string; lastName: string } | null): string {
  if (!user) return 'brak';
  return `${user.firstName} ${user.lastName}`.trim();
}

// ============================================================
// GET /stats - Statystyki dashboard
// ============================================================

export const getStats = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekStart = new Date(todayStart);
    weekStart.setDate(weekStart.getDate() - weekStart.getDay() + 1); // poniedzialek
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    const [
      samplesToday,
      samplesWeek,
      samplesMonth,
      analysesInProgress,
      analysesCompleted,
      analysesApproved,
      criticalDeviations,
      totalClients,
      totalProcesses,
      pendingAnalyses,
    ] = await Promise.all([
      // Probki dzis
      prisma.sample.count({
        where: { createdAt: { gte: todayStart } },
      }),
      // Probki w tym tygodniu
      prisma.sample.count({
        where: { createdAt: { gte: weekStart } },
      }),
      // Probki w tym miesiacu
      prisma.sample.count({
        where: { createdAt: { gte: monthStart } },
      }),
      // Analizy w trakcie
      prisma.analysis.count({
        where: { status: 'IN_PROGRESS' },
      }),
      // Analizy zakonczone
      prisma.analysis.count({
        where: { status: 'COMPLETED' },
      }),
      // Analizy zatwierdzone
      prisma.analysis.count({
        where: { status: 'APPROVED' },
      }),
      // Krytyczne odchylenia (wyniki z CRITICAL_LOW lub CRITICAL_HIGH)
      prisma.analysisResult.count({
        where: {
          deviation: { in: ['CRITICAL_LOW', 'CRITICAL_HIGH'] },
          analysis: {
            status: { in: ['IN_PROGRESS', 'COMPLETED'] },
          },
        },
      }),
      // Laczna liczba aktywnych klientow
      prisma.client.count({
        where: { isActive: true },
      }),
      // Laczna liczba aktywnych procesow
      prisma.process.count({
        where: { isActive: true },
      }),
      // Analizy oczekujace
      prisma.analysis.count({
        where: { status: 'PENDING' },
      }),
    ]);

    res.json({
      samples: {
        today: samplesToday,
        week: samplesWeek,
        month: samplesMonth,
      },
      analyses: {
        pending: pendingAnalyses,
        inProgress: analysesInProgress,
        completed: analysesCompleted,
        approved: analysesApproved,
      },
      criticalDeviations,
      totalClients,
      totalProcesses,
    });
  } catch (error) {
    next(error);
  }
};

// ============================================================
// GET /overview - Kompletny model dashboardu
// ============================================================

export const getOverview = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const now = new Date();
    const todayStart = startOfDay(now);
    const tomorrowStart = endOfDay(now);

    const [
      dueTodayAnalyses,
      dueTodaySamples,
      overdueAnalyses,
      samplesWithoutAnalyses,
      myInProgressAnalyses,
      criticalDeviationGroups,
      overdueRows,
      noAnalysisRows,
      recentAnalyses,
    ] = await Promise.all([
      prisma.analysis.count({
        where: {
          status: { in: ['PENDING', 'IN_PROGRESS'] },
          analysisDate: { gte: todayStart, lt: tomorrowStart },
        },
      }),
      prisma.sample.count({
        where: {
          status: { in: ['REGISTERED', 'IN_PROGRESS'] },
          collectedAt: { gte: todayStart, lt: tomorrowStart },
        },
      }),
      prisma.analysis.count({
        where: {
          status: { in: ['PENDING', 'IN_PROGRESS'] },
          analysisDate: { lt: todayStart },
        },
      }),
      prisma.sample.count({
        where: {
          status: { in: ['REGISTERED', 'IN_PROGRESS'] },
          analyses: { none: {} },
        },
      }),
      prisma.analysis.count({
        where: {
          performedBy: req.user!.userId,
          status: 'IN_PROGRESS',
        },
      }),
      prisma.analysisResult.groupBy({
        by: ['analysisId'],
        where: {
          deviation: { in: ['CRITICAL_LOW', 'CRITICAL_HIGH'] },
          analysis: {
            status: { in: ['PENDING', 'IN_PROGRESS', 'COMPLETED'] },
          },
        },
      }),
      prisma.analysis.findMany({
        where: {
          status: { in: ['PENDING', 'IN_PROGRESS'] },
          analysisDate: { lt: todayStart },
        },
        include: {
          sample: {
            select: {
              sampleCode: true,
              client: { select: { companyName: true } },
            },
          },
        },
        orderBy: { analysisDate: 'asc' },
        take: 6,
      }),
      prisma.sample.findMany({
        where: {
          status: { in: ['REGISTERED', 'IN_PROGRESS'] },
          analyses: { none: {} },
        },
        include: {
          client: { select: { companyName: true } },
        },
        orderBy: { collectedAt: 'desc' },
        take: 6,
      }),
      prisma.analysis.findMany({
        take: 10,
        orderBy: { createdAt: 'desc' },
        include: {
          sample: {
            select: {
              id: true,
              sampleCode: true,
              client: { select: { companyName: true } },
            },
          },
          performer: { select: { firstName: true, lastName: true } },
        },
      }),
    ]);

    const attentionItems = [
      ...overdueRows.map((analysis) => ({
        id: `overdue-${analysis.id}`,
        type: 'OVERDUE',
        tag: 'Po terminie',
        message: `${analysis.analysisCode} - ${analysis.sample?.client?.companyName ?? 'Brak klienta'}`,
        details: `Opóźniona analiza`,
        date: analysis.analysisDate,
        link: `/analyses/${analysis.id}`,
      })),
      ...noAnalysisRows.map((sample) => ({
        id: `no-analysis-${sample.id}`,
        type: 'NO_ANALYSIS',
        tag: 'Bez analizy',
        message: `${sample.sampleCode} - ${sample.client?.companyName ?? 'Brak klienta'}`,
        details: 'Próbka nie ma przypisanej analizy',
        date: sample.collectedAt,
        link: `/samples/${sample.id}`,
      })),
    ]
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, 8);

    res.json({
      kpis: {
        dueTodayAnalyses,
        dueTodaySamples,
        overdueAnalyses,
        samplesWithoutAnalyses,
        myInProgressAnalyses,
        criticalDeviationAnalyses: criticalDeviationGroups.length,
      },
      attentionItems,
      recentAnalyses: recentAnalyses.map((analysis) => ({
        id: analysis.id,
        analysisCode: analysis.analysisCode,
        sampleCode: analysis.sample?.sampleCode ?? '—',
        clientName: analysis.sample?.client?.companyName ?? '—',
        analystName: fullName(analysis.performer),
        status: analysis.status,
        deadline: analysis.analysisDate,
        date: analysis.createdAt,
        link: `/analyses/${analysis.id}`,
      })),
      quickActions: [
        { id: 'add-sample', label: 'Dodaj próbkę', link: '/samples?new=1' },
        { id: 'add-analysis', label: 'Dodaj analizę', link: '/analyses?new=1' },
        { id: 'import', label: 'Import wyników', link: '/import' },
        { id: 'generate-report', label: 'Generuj raport', link: '/reports' },
      ],
    });
  } catch (error) {
    next(error);
  }
};

// ============================================================
// GET /recent-analyses - Ostatnie 10 analiz
// ============================================================

export const getRecentAnalyses = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const analyses = await prisma.analysis.findMany({
      take: 10,
      orderBy: { createdAt: 'desc' },
      include: {
        sample: {
          select: {
            id: true,
            sampleCode: true,
            sampleType: true,
            client: { select: { id: true, companyName: true } },
            process: { select: { id: true, name: true, processType: true } },
          },
        },
        performer: { select: { id: true, firstName: true, lastName: true } },
        approver: { select: { id: true, firstName: true, lastName: true } },
        _count: { select: { results: true, recommendations: true } },
      },
    });

    res.json(analyses);
  } catch (error) {
    next(error);
  }
};

// ============================================================
// GET /critical-alerts - Alerty krytycznych odchylen
// ============================================================

export const getCriticalAlerts = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const criticalResults = await prisma.analysisResult.findMany({
      where: {
        deviation: { in: ['CRITICAL_LOW', 'CRITICAL_HIGH'] },
        analysis: {
          status: { in: ['IN_PROGRESS', 'COMPLETED', 'PENDING'] },
        },
      },
      take: 20,
      orderBy: { createdAt: 'desc' },
      include: {
        analysis: {
          select: {
            id: true,
            analysisCode: true,
            status: true,
            analysisDate: true,
            sample: {
              select: {
                id: true,
                sampleCode: true,
                client: { select: { id: true, companyName: true } },
                process: { select: { id: true, name: true, processType: true } },
              },
            },
          },
        },
      },
    });

    const alerts = criticalResults.map((result) => ({
      id: result.id,
      parameterName: result.parameterName,
      value: result.value,
      unit: result.unit,
      minReference: result.minReference,
      maxReference: result.maxReference,
      deviation: result.deviation,
      deviationPercent: result.deviationPercent,
      analysis: result.analysis,
      createdAt: result.createdAt,
    }));

    res.json(alerts);
  } catch (error) {
    next(error);
  }
};
