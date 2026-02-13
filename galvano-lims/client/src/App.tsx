import { lazy, Suspense, useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from '@/store/authStore';
import { useThemeStore } from '@/store/themeStore';
import { AppLayout } from '@/components/layout/AppLayout';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';

// Lazy loaded pages
const LoginPage = lazy(() => import('@/pages/LoginPage'));
const DashboardPage = lazy(() => import('@/pages/DashboardPage'));
const ClientsPage = lazy(() => import('@/pages/ClientsPage'));
const ClientDetailPage = lazy(() => import('@/pages/ClientDetailPage'));
const ProcessesPage = lazy(() => import('@/pages/ProcessesPage'));
const ProcessDetailPage = lazy(() => import('@/pages/ProcessDetailPage'));
const SamplesPage = lazy(() => import('@/pages/SamplesPage'));
const SampleDetailPage = lazy(() => import('@/pages/SampleDetailPage'));
const AnalysesPage = lazy(() => import('@/pages/AnalysesPage'));
const AnalysisDetailPage = lazy(() => import('@/pages/AnalysisDetailPage'));
const ArchivePage = lazy(() => import('@/pages/ArchivePage'));
const ReportsPage = lazy(() => import('@/pages/ReportsPage'));
const ImportPage = lazy(() => import('@/pages/ImportPage'));
const AdminUsersPage = lazy(() => import('@/pages/AdminUsersPage'));
const AdminSettingsPage = lazy(() => import('@/pages/AdminSettingsPage'));
const AuditLogPage = lazy(() => import('@/pages/AuditLogPage'));

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function AdminRoute({ children }: { children: React.ReactNode }) {
  const user = useAuthStore((s) => s.user);
  if ((user?.role || '').toUpperCase() !== 'ADMIN') return <Navigate to="/" replace />;
  return <>{children}</>;
}

export default function App() {
  const { theme } = useThemeStore();

  useEffect(() => {
    const root = document.documentElement;
    root.classList.remove('light', 'dark');
    if (theme === 'system') {
      const systemTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
      root.classList.add(systemTheme);
    } else {
      root.classList.add(theme);
    }
  }, [theme]);

  return (
    <Suspense fallback={<div className="h-screen flex items-center justify-center"><LoadingSpinner size="lg" text="Ładowanie..." /></div>}>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route
          element={
            <ProtectedRoute>
              <AppLayout />
            </ProtectedRoute>
          }
        >
          <Route index element={<DashboardPage />} />
          <Route path="clients" element={<ClientsPage />} />
          <Route path="clients/:id" element={<ClientDetailPage />} />
          <Route path="processes" element={<ProcessesPage />} />
          <Route path="processes/:id" element={<ProcessDetailPage />} />
          <Route path="samples" element={<SamplesPage />} />
          <Route path="samples/:id" element={<SampleDetailPage />} />
          <Route path="analyses" element={<AnalysesPage />} />
          <Route path="analyses/:id" element={<AnalysisDetailPage />} />
          <Route path="archive" element={<ArchivePage />} />
          <Route path="reports" element={<ReportsPage />} />
          <Route path="import" element={<AdminRoute><ImportPage /></AdminRoute>} />
          <Route path="admin/users" element={<AdminRoute><AdminUsersPage /></AdminRoute>} />
          <Route path="admin/settings" element={<AdminRoute><AdminSettingsPage /></AdminRoute>} />
          <Route path="admin/audit-log" element={<AdminRoute><AuditLogPage /></AdminRoute>} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  );
}
