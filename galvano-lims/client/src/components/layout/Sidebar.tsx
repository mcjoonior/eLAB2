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
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
}

type SidebarTheme = {
  aside: string;
  headerBorder: string;
  navActive: string;
  navInactive: string;
  adminLabel: string;
  footer: string;
  avatar: string;
  userName: string;
  userRole: string;
  collapseBtn: string;
  brandName: string;
  brandSub: string;
};

const sidebarThemes: Record<DashboardVariant, SidebarTheme> = {
  CLEAN: {
    aside: 'bg-card border-r border-border',
    headerBorder: 'border-b border-border',
    navActive: 'bg-primary text-primary-foreground',
    navInactive: 'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
    adminLabel: 'text-muted-foreground',
    footer: 'border-t border-border',
    avatar: 'bg-primary/10 text-primary',
    userName: 'text-foreground',
    userRole: 'text-muted-foreground',
    collapseBtn: 'text-muted-foreground hover:bg-accent hover:text-foreground',
    brandName: 'text-foreground',
    brandSub: 'text-muted-foreground',
  },
  MODERN: {
    aside: 'bg-gradient-to-b from-slate-900 via-blue-900 to-sky-800 text-slate-100 border-r border-slate-700/70 shadow-xl',
    headerBorder: 'border-b border-white/20',
    navActive: 'bg-gradient-to-r from-blue-500/80 to-cyan-500/80 text-white shadow-md',
    navInactive: 'text-slate-100/85 hover:bg-white/12 hover:text-white',
    adminLabel: 'text-slate-200/70',
    footer: 'border-t border-white/20 bg-white/5',
    avatar: 'bg-white/15 text-white',
    userName: 'text-white',
    userRole: 'text-slate-200/80',
    collapseBtn: 'text-slate-200/80 hover:bg-white/10 hover:text-white',
    brandName: 'text-white',
    brandSub: 'text-slate-300/70',
  },
  OCEAN: {
    aside: 'bg-gradient-to-b from-teal-900 via-cyan-900 to-blue-900 text-cyan-50 border-r border-cyan-800/70 shadow-xl',
    headerBorder: 'border-b border-white/20',
    navActive: 'bg-gradient-to-r from-teal-500/85 to-cyan-500/85 text-white shadow-md',
    navInactive: 'text-cyan-100/90 hover:bg-white/12 hover:text-white',
    adminLabel: 'text-cyan-200/75',
    footer: 'border-t border-white/20 bg-white/5',
    avatar: 'bg-white/15 text-white',
    userName: 'text-white',
    userRole: 'text-cyan-100/80',
    collapseBtn: 'text-cyan-200/80 hover:bg-white/10 hover:text-white',
    brandName: 'text-white',
    brandSub: 'text-cyan-200/70',
  },
  GRAPHITE: {
    aside: 'bg-gradient-to-b from-slate-900 via-zinc-900 to-gray-800 text-zinc-100 border-r border-zinc-700/70 shadow-xl',
    headerBorder: 'border-b border-white/20',
    navActive: 'bg-gradient-to-r from-zinc-600/90 to-slate-600/90 text-white shadow-md',
    navInactive: 'text-zinc-200/90 hover:bg-white/10 hover:text-white',
    adminLabel: 'text-zinc-300/75',
    footer: 'border-t border-white/20 bg-white/5',
    avatar: 'bg-white/15 text-white',
    userName: 'text-white',
    userRole: 'text-zinc-200/80',
    collapseBtn: 'text-zinc-300/80 hover:bg-white/10 hover:text-white',
    brandName: 'text-white',
    brandSub: 'text-zinc-300/70',
  },
  LIGHT_CONCEPT: {
    aside: 'bg-[#152032] text-[#8B9BB4] shadow-xl',
    headerBorder: 'border-b border-white/10',
    navActive: 'bg-white/10 text-white',
    navInactive: 'text-[#8B9BB4] hover:bg-white/8 hover:text-white',
    adminLabel: 'text-white/30',
    footer: 'border-t border-white/10',
    avatar: 'bg-gradient-to-br from-orange-400 to-pink-500 text-white',
    userName: 'text-white',
    userRole: 'text-white/45',
    collapseBtn: 'text-[#8B9BB4] hover:bg-white/8 hover:text-white',
    brandName: 'text-white',
    brandSub: 'text-white/50',
  },
};

export function Sidebar({ isOpen, onClose, isCollapsed, onToggleCollapse }: SidebarProps) {
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
  const logoUrl = branding?.logoUrl || null;
  const companyName = branding?.companyName || 'eLAB LIMS';

  const navItems = [
    { to: '/', icon: LayoutDashboard, label: t('nav.dashboard') },
    { to: '/analyses', icon: Microscope, label: t('nav.analyses') },
    { to: '/clients', icon: Users, label: t('nav.clients') },
    { to: '/samples', icon: TestTubes, label: t('nav.samples') },
    { to: '/processes', icon: FlaskConical, label: t('nav.processes') },
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

  const initials = `${user?.firstName?.[0] ?? ''}${user?.lastName?.[0] ?? ''}`;

  return (
    <>
      {/* Mobile backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={onClose}
        />
      )}

      <aside
        className={`
          fixed left-0 top-0 z-50 h-screen w-64 flex flex-col
          transition-all duration-200 ease-in-out
          lg:relative lg:z-auto lg:translate-x-0 lg:h-full
          ${isCollapsed ? 'lg:w-16' : 'lg:w-64'}
          ${isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
          ${theme.aside}
        `}
      >
        {/* Branding header */}
        <div className={`flex items-center gap-3 px-4 py-4 flex-shrink-0 ${theme.headerBorder} ${isCollapsed ? 'lg:justify-center lg:px-2' : ''}`}>
          <div className="h-16 w-16 flex-shrink-0 flex items-center justify-center overflow-hidden rounded-lg bg-white/10">
            {logoUrl ? (
              <img src={logoUrl} alt="Logo" className="h-14 w-14 object-contain" />
            ) : (
              <FlaskConical className="h-5 w-5 text-white/80" />
            )}
          </div>
          <div className={`min-w-0 flex-1 ${isCollapsed ? 'lg:hidden' : ''}`}>
            <p className={`text-sm font-bold leading-tight truncate ${theme.brandName}`}>{companyName}</p>
            <p className={`text-[11px] leading-tight ${theme.brandSub}`}>eLAB LIMS</p>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto py-3 px-2">
          <div className="space-y-0.5">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === '/'}
                onClick={onClose}
                title={isCollapsed ? item.label : undefined}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                    isCollapsed ? 'lg:justify-center lg:px-2' : ''
                  } ${isActive ? theme.navActive : theme.navInactive}`
                }
              >
                <item.icon className="h-4 w-4 flex-shrink-0" />
                <span className={`truncate ${isCollapsed ? 'lg:hidden' : ''}`}>{item.label}</span>
              </NavLink>
            ))}
          </div>

          {isAdmin && (
            <div className="mt-5">
              <p className={`px-3 mb-1.5 text-[10px] font-semibold uppercase tracking-wider ${theme.adminLabel} ${isCollapsed ? 'lg:hidden' : ''}`}>
                {t('nav.admin')}
              </p>
              <div className={`mx-2 my-2 h-px ${theme.headerBorder} ${isCollapsed ? 'hidden lg:block' : 'hidden'}`} />
              <div className="space-y-0.5">
                {adminItems.map((item) => (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    onClick={onClose}
                    title={isCollapsed ? item.label : undefined}
                    className={({ isActive }) =>
                      `flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                        isCollapsed ? 'lg:justify-center lg:px-2' : ''
                      } ${isActive ? theme.navActive : theme.navInactive}`
                    }
                  >
                    <item.icon className="h-4 w-4 flex-shrink-0" />
                    <span className={`truncate ${isCollapsed ? 'lg:hidden' : ''}`}>{item.label}</span>
                  </NavLink>
                ))}
              </div>
            </div>
          )}
        </nav>

        {/* Collapse toggle (desktop only) */}
        <div className={`hidden lg:block px-2 pb-1 flex-shrink-0 ${theme.footer}`}>
          <button
            onClick={onToggleCollapse}
            className={`w-full flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
              isCollapsed ? 'justify-center' : ''
            } ${theme.collapseBtn}`}
            title={isCollapsed ? 'Rozwiń menu' : 'Zwiń menu'}
          >
            {isCollapsed ? (
              <ChevronRight className="h-4 w-4 flex-shrink-0" />
            ) : (
              <>
                <ChevronLeft className="h-4 w-4 flex-shrink-0" />
                <span>Zwiń menu</span>
              </>
            )}
          </button>
        </div>

        {/* User footer */}
        <div className={`px-2 pb-3 pt-2 flex-shrink-0 ${theme.footer}`}>
          <div className={`flex items-center gap-3 px-2 ${isCollapsed ? 'lg:justify-center' : ''}`}>
            <div className={`h-8 w-8 flex-shrink-0 rounded-full flex items-center justify-center text-xs font-semibold ${theme.avatar}`}>
              {initials}
            </div>
            <div className={`flex-1 min-w-0 ${isCollapsed ? 'lg:hidden' : ''}`}>
              <p className={`text-sm font-medium truncate ${theme.userName}`}>
                {user?.firstName} {user?.lastName}
              </p>
              <p className={`text-[11px] uppercase tracking-wide truncate ${theme.userRole}`}>{user?.role}</p>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}
