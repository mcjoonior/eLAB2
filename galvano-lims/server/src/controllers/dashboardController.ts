import { Response, NextFunction } from 'express';
import { prisma } from '../index';
import { AuthenticatedRequest } from '../middleware/auth';

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
