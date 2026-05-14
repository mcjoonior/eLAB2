import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '@/store/authStore';
import { notificationService, getBranding, type Branding } from '@/services/adminService';
import { authService } from '@/services/authService';
import { GlobalSearchDropdown } from '@/components/common/GlobalSearchDropdown';
import { formatDateTime } from '@/utils/helpers';
import type { Notification, DashboardVariant } from '@/types';
import { Menu, Bell, LogOut } from 'lucide-react';

interface TopbarProps {
  onMenuClick: () => void;
}

export function Topbar({ onMenuClick }: TopbarProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();
  const [unreadCount, setUnreadCount] = useState(0);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const [branding, setBranding] = useState<Branding | null>(null);

  async function refreshNotifications() {
    try {
      const [count, list] = await Promise.all([
        notificationService.getUnreadCount(),
        notificationService.getAll({ page: 1, limit: 8, isRead: false }),
      ]);
      setUnreadCount(count);
      setNotifications(list.data);
    } catch {
      // silent
    }
  }

  useEffect(() => {
    refreshNotifications();
    const interval = setInterval(refreshNotifications, 30000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    getBranding()
      .then(setBranding)
      .catch(() => {});
  }, []);

  const handleLogout = async () => {
    try {
      await authService.logout();
    } catch { /* ignore */ }
    logout();
    navigate('/login');
  };

  async function handleMarkAsRead(id: string, link?: string) {
    try {
      await notificationService.markAsRead(id);
      await refreshNotifications();
      setShowNotifications(false);
      if (link) navigate(link);
    } catch {
      // silent
    }
  }

  async function handleMarkAllAsRead() {
    try {
      await notificationService.markAllAsRead();
      await refreshNotifications();
    } catch {
      // silent
    }
  }

  const variant: DashboardVariant = branding?.dashboardVariant || 'CLEAN';
  const isLightConcept = variant === 'LIGHT_CONCEPT';
  const initials = `${user?.firstName?.[0] ?? ''}${user?.lastName?.[0] ?? ''}`;

  return (
    <header className={`flex-shrink-0 h-14 z-20 flex items-center px-4 gap-3 ${
      isLightConcept
        ? 'border-b border-black/8 bg-[#F6F4F0]'
        : 'border-b border-border bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/60'
    }`}>
      {/* Mobile hamburger */}
      <button
        onClick={onMenuClick}
        className="lg:hidden p-1.5 rounded-md hover:bg-accent flex-shrink-0"
      >
        <Menu className="h-5 w-5" />
      </button>

      {/* Search */}
      <div className="flex-1 min-w-0 max-w-lg">
        <GlobalSearchDropdown />
      </div>

      <div className="flex-1" />

      {/* Right actions */}
      <div className="flex items-center gap-1 flex-shrink-0">
        {/* Notifications */}
        <div className="relative">
          <button
            onClick={() => {
              const next = !showNotifications;
              setShowNotifications(next);
              if (next) refreshNotifications();
            }}
            className="p-2 rounded-md hover:bg-accent text-muted-foreground relative"
          >
            <Bell className="h-4 w-4" />
            {unreadCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 h-4 w-4 rounded-full bg-destructive text-destructive-foreground text-[10px] flex items-center justify-center font-medium">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </button>

          {showNotifications && (
            <div className="absolute right-0 top-full mt-2 w-80 bg-card border border-border rounded-lg shadow-lg z-50">
              <div className="p-3 border-b border-border">
                <h3 className="text-sm font-semibold">Powiadomienia</h3>
              </div>
              <div className="max-h-64 overflow-y-auto p-2">
                {notifications.length === 0 ? (
                  <p className="text-sm text-muted-foreground p-3 text-center">Brak nowych powiadomień</p>
                ) : (
                  <div className="space-y-2">
                    {notifications.map((notification) => (
                      <button
                        key={notification.id}
                        onClick={() => handleMarkAsRead(notification.id, notification.link)}
                        className="w-full text-left rounded-md border border-border p-2 hover:bg-accent transition-colors"
                      >
                        <p className="text-sm font-medium text-foreground">{notification.title}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">{notification.message}</p>
                        <p className="text-[11px] text-muted-foreground mt-1">{formatDateTime(notification.createdAt)}</p>
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <div className="p-2 border-t border-border">
                <button
                  onClick={handleMarkAllAsRead}
                  className="w-full text-center text-sm text-primary hover:underline py-1"
                >
                  Oznacz wszystkie jako przeczytane
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Separator */}
        <div className="h-6 w-px bg-border mx-1" />

        {/* User */}
        <div className="flex items-center gap-2">
          <div className="hidden sm:flex flex-col items-end leading-tight">
            <span className="text-sm font-medium text-foreground">{user?.firstName} {user?.lastName}</span>
            <span className="text-[11px] uppercase tracking-wide text-muted-foreground">{user?.role}</span>
          </div>
          <div className={`h-8 w-8 rounded-full flex items-center justify-center text-xs font-semibold flex-shrink-0 ${
            isLightConcept
              ? 'bg-gradient-to-br from-orange-400 to-pink-500 text-white'
              : 'bg-primary/10 text-primary'
          }`}>
            {initials}
          </div>
          <button
            onClick={handleLogout}
            className="p-1.5 rounded-md hover:bg-accent text-muted-foreground"
            title={t('nav.logout')}
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    </header>
  );
}
