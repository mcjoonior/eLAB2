import { useState, useEffect } from 'react';
import { NavLink } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '@/store/authStore';
import { getBranding, type Branding } from '@/services/adminService';
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
  Shield,
  Beaker,
  X,
} from 'lucide-react';

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

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

  const navItems = [
    { to: '/', icon: LayoutDashboard, label: t('nav.dashboard') },
    { to: '/clients', icon: Users, label: t('nav.clients') },
    { to: '/processes', icon: FlaskConical, label: t('nav.processes') },
    { to: '/samples', icon: TestTubes, label: t('nav.samples') },
    { to: '/analyses', icon: Microscope, label: t('nav.analyses') },
    { to: '/archive', icon: Archive, label: t('nav.archive') },
    { to: '/reports', icon: FileText, label: t('nav.reports') },
    ...(isAdmin ? [{ to: '/import', icon: Upload, label: t('nav.import') }] : []),
  ];

  const adminItems = [
    { to: '/admin/users', icon: Shield, label: t('nav.users') },
    { to: '/admin/settings', icon: Settings, label: t('nav.settings') },
    { to: '/admin/audit-log', icon: FileText, label: t('nav.auditLog') },
  ];

  const logoUrl = branding?.logoUrl || null;

  return (
    <>
      {/* Mobile overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={onClose}
        />
      )}

      <aside
        className={`fixed top-0 left-0 z-50 h-full w-64 bg-card border-r border-border transform transition-transform duration-200 ease-in-out lg:translate-x-0 lg:static lg:z-auto ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Header */}
        <div className="relative px-4 py-4 border-b border-border">
          <button onClick={onClose} className="lg:hidden absolute top-2 right-2 p-1 rounded hover:bg-accent">
            <X className="h-5 w-5" />
          </button>
          <div className="flex flex-col items-center gap-3">
            {logoUrl ? (
              <img src={logoUrl} alt="Logo" className="max-h-12 max-w-[180px] object-contain rounded" />
            ) : (
              <Beaker className="h-10 w-10 text-primary" />
            )}
            <h1 className="text-sm font-bold text-foreground leading-tight truncate text-center w-full">
              {branding?.companyName || 'eLAB LIMS'}
            </h1>
          </div>
        </div>

        {/* Navigation */}
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
                    isActive
                      ? 'bg-primary text-primary-foreground'
                      : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                  }`
                }
              >
                <item.icon className="h-4 w-4 flex-shrink-0" />
                {item.label}
              </NavLink>
            ))}
          </div>

          {/* Admin section */}
          {isAdmin && (
            <div className="mt-6">
              <p className="px-3 mb-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
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
                        isActive
                          ? 'bg-primary text-primary-foreground'
                          : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
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

        {/* User info at bottom */}
        <div className="p-4 border-t border-border">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-primary text-sm font-medium">
              {user?.firstName?.[0]}{user?.lastName?.[0]}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{user?.firstName} {user?.lastName}</p>
              <p className="text-xs text-muted-foreground truncate">{user?.role}</p>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}
