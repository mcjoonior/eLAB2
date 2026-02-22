import { useState, useEffect } from 'react';
import { NavLink } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '@/store/authStore';
import { getBranding, type Branding } from '@/services/adminService';
import type { DashboardVariant } from '@/types';
import {
  LayoutDashboard,
  Users,
  FlaskConical,
  TestTubes,
  Microscope,
  Archive,
  FileText,
  Upload,
  Settings,
  Tags,
  Shield,
  Wrench,
  ClipboardList,
  X,
} from 'lucide-react';

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

type SidebarTheme = {
  aside: string;
  headerBorder: string;
  closeHover: string;
  navActive: string;
  navInactive: string;
  adminLabel: string;
  footer: string;
  avatar: string;
  userName: string;
  userRole: string;
};

const sidebarThemes: Record<DashboardVariant, SidebarTheme> = {
  CLEAN: {
    aside: 'bg-card border-r border-border',
    headerBorder: 'border-b border-border',
    closeHover: 'hover:bg-accent',
    navActive: 'bg-primary text-primary-foreground',
    navInactive: 'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
    adminLabel: 'text-muted-foreground',
    footer: 'border-t border-border',
    avatar: 'bg-primary/10 text-primary',
    userName: 'text-foreground',
    userRole: 'text-muted-foreground',
  },
  MODERN: {
    aside: 'bg-gradient-to-b from-slate-900 via-blue-900 to-sky-800 text-slate-100 border-r border-slate-700/70 shadow-xl',
    headerBorder: 'border-b border-white/20',
    closeHover: 'hover:bg-white/15',
    navActive: 'bg-gradient-to-r from-blue-500/80 to-cyan-500/80 text-white shadow-md',
    navInactive: 'text-slate-100/85 hover:bg-white/12 hover:text-white',
    adminLabel: 'text-slate-200/70',
    footer: 'border-t border-white/20 bg-white/5',
    avatar: 'bg-white/15 text-white',
    userName: 'text-white',
    userRole: 'text-slate-200/80',
  },
  OCEAN: {
    aside: 'bg-gradient-to-b from-teal-900 via-cyan-900 to-blue-900 text-cyan-50 border-r border-cyan-800/70 shadow-xl',
    headerBorder: 'border-b border-white/20',
    closeHover: 'hover:bg-white/15',
    navActive: 'bg-gradient-to-r from-teal-500/85 to-cyan-500/85 text-white shadow-md',
    navInactive: 'text-cyan-100/90 hover:bg-white/12 hover:text-white',
    adminLabel: 'text-cyan-200/75',
    footer: 'border-t border-white/20 bg-white/5',
    avatar: 'bg-white/15 text-white',
    userName: 'text-white',
    userRole: 'text-cyan-100/80',
  },
  GRAPHITE: {
    aside: 'bg-gradient-to-b from-slate-900 via-zinc-900 to-gray-800 text-zinc-100 border-r border-zinc-700/70 shadow-xl',
    headerBorder: 'border-b border-white/20',
    closeHover: 'hover:bg-white/15',
    navActive: 'bg-gradient-to-r from-zinc-600/90 to-slate-600/90 text-white shadow-md',
    navInactive: 'text-zinc-200/90 hover:bg-white/10 hover:text-white',
    adminLabel: 'text-zinc-300/75',
    footer: 'border-t border-white/20 bg-white/5',
    avatar: 'bg-white/15 text-white',
    userName: 'text-white',
    userRole: 'text-zinc-200/80',
  },
};

export function Sidebar({ isOpen, onClose }: SidebarProps) {
  const { t } = useTranslation();
  const user = useAuthStore((s) => s.user);
  const isAdmin = (user?.role || '').toUpperCase() === 'ADMIN';
  const [branding, setBranding] = useState<Branding | null>(null);

  useEffect(() => {
    getBranding()
      .then(setBranding)
      .catch(() => {});
  }, []);

  const variant: DashboardVariant = branding?.dashboardVariant || 'CLEAN';
  const theme = sidebarThemes[variant];

  const navItems = [
    { to: '/', icon: LayoutDashboard, label: t('nav.dashboard') },
    { to: '/clients', icon: Users, label: t('nav.clients') },
    { to: '/processes', icon: FlaskConical, label: t('nav.processes') },
    { to: '/samples', icon: TestTubes, label: t('nav.samples') },
    { to: '/analyses', icon: Microscope, label: t('nav.analyses') },
    { to: '/orders', icon: ClipboardList, label: t('nav.orders') },
    { to: '/archive', icon: Archive, label: t('nav.archive') },
    { to: '/reports', icon: FileText, label: t('nav.reports') },
    { to: '/devices', icon: Wrench, label: t('nav.devices') },
    ...(isAdmin ? [{ to: '/import', icon: Upload, label: t('nav.import') }] : []),
  ];

  const adminItems = [
    { to: '/admin/price-list', icon: Tags, label: t('nav.priceList') },
    { to: '/admin/users', icon: Shield, label: t('nav.users') },
    { to: '/admin/settings', icon: Settings, label: t('nav.settings') },
    { to: '/admin/audit-log', icon: FileText, label: t('nav.auditLog') },
  ];

  return (
    <>
      {isOpen && (
        <div
          className="fixed inset-x-0 bottom-0 top-16 bg-black/50 z-40 lg:hidden"
          onClick={onClose}
        />
      )}

      <aside
        className={`fixed left-0 top-16 z-50 h-[calc(100vh-4rem)] w-64 transform transition-transform duration-200 ease-in-out lg:relative lg:top-0 lg:h-full lg:translate-x-0 lg:static lg:z-auto ${theme.aside} ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className={`relative px-4 py-3 lg:hidden ${theme.headerBorder}`}>
          <button
            onClick={onClose}
            className={`absolute top-2 right-2 p-1 rounded ${theme.closeHover}`}
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto py-4 px-3">
          <div className="space-y-1">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === '/'}
                onClick={onClose}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                    isActive ? theme.navActive : theme.navInactive
                  }`
                }
              >
                <item.icon className="h-4 w-4 flex-shrink-0" />
                {item.label}
              </NavLink>
            ))}
          </div>

          {isAdmin && (
            <div className="mt-6">
              <p className={`px-3 mb-2 text-xs font-semibold uppercase tracking-wider ${theme.adminLabel}`}>
                {t('nav.admin')}
              </p>
              <div className="space-y-1">
                {adminItems.map((item) => (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    onClick={onClose}
                    className={({ isActive }) =>
                      `flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                        isActive ? theme.navActive : theme.navInactive
                      }`
                    }
                  >
                    <item.icon className="h-4 w-4 flex-shrink-0" />
                    {item.label}
                  </NavLink>
                ))}
              </div>
            </div>
          )}
        </nav>

        <div className={`p-4 ${theme.footer}`}>
          <div className="flex items-center gap-3">
            <div className={`h-8 w-8 rounded-full flex items-center justify-center text-sm font-medium ${theme.avatar}`}>
              {user?.firstName?.[0]}{user?.lastName?.[0]}
            </div>
            <div className="flex-1 min-w-0">
              <p className={`text-sm font-medium truncate ${theme.userName}`}>
                {user?.firstName} {user?.lastName}
              </p>
              <p className={`text-xs truncate ${theme.userRole}`}>{user?.role}</p>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}
