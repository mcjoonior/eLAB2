import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '@/store/authStore';
import { useThemeStore } from '@/store/themeStore';
import { notificationService } from '@/services/adminService';
import { authService } from '@/services/authService';
import { GlobalSearchDropdown } from '@/components/common/GlobalSearchDropdown';
import { formatDateTime } from '@/utils/helpers';
import type { Notification } from '@/types';
import {
  Menu,
  Bell,
  Sun,
  Moon,
  Globe,
  LogOut,
  Plus,
  TestTube2,
  FlaskConical,
} from 'lucide-react';

interface TopbarProps {
  onMenuClick: () => void;
}

export function Topbar({ onMenuClick }: TopbarProps) {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();
  const { theme, setTheme } = useThemeStore();
  const [unreadCount, setUnreadCount] = useState(0);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showQuickActions, setShowQuickActions] = useState(false);
  const quickActionsRef = useRef<HTMLDivElement>(null);

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

  // Click outside to close quick actions
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (quickActionsRef.current && !quickActionsRef.current.contains(e.target as Node)) {
        setShowQuickActions(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const handleLogout = async () => {
    try {
      await authService.logout();
    } catch { /* ignore */ }
    logout();
    navigate('/login');
  };

  const toggleTheme = () => {
    setTheme(theme === 'dark' ? 'light' : 'dark');
  };

  const toggleLanguage = () => {
    i18n.changeLanguage(i18n.language === 'pl' ? 'en' : 'pl');
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

  return (
    <header className="sticky top-0 z-30 h-16 border-b border-border bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/60">
      <div className="flex items-center justify-between h-full px-4">
        {/* Left */}
        <div className="flex items-center gap-4 flex-1 min-w-0">
          <button
            onClick={onMenuClick}
            className="lg:hidden p-2 rounded-md hover:bg-accent flex-shrink-0"
          >
            <Menu className="h-5 w-5" />
          </button>

          {/* Global Search */}
          <div className="hidden md:block w-full max-w-md">
            <GlobalSearchDropdown />
          </div>
        </div>

        {/* Right */}
        <div className="flex items-center gap-2">
          {/* Quick Actions */}
          <div className="relative" ref={quickActionsRef}>
            <button
              onClick={() => setShowQuickActions(!showQuickActions)}
              className="p-1.5 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
              title={t('dashboard.quickActions')}
            >
              <Plus className="h-4 w-4" />
            </button>

            {showQuickActions && (
              <div className="absolute right-0 top-full mt-2 w-56 bg-card border border-border rounded-lg shadow-lg py-1 z-50">
                <button
                  onClick={() => { setShowQuickActions(false); navigate('/samples?new=1'); }}
                  className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-foreground hover:bg-accent transition-colors"
                >
                  <TestTube2 className="h-4 w-4 text-blue-500" />
                  {t('dashboard.addSample')}
                </button>
                <button
                  onClick={() => { setShowQuickActions(false); navigate('/analyses?new=1'); }}
                  className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-foreground hover:bg-accent transition-colors"
                >
                  <FlaskConical className="h-4 w-4 text-green-500" />
                  {t('dashboard.newAnalysis')}
                </button>
              </div>
            )}
          </div>

          {/* Language toggle */}
          <button
            onClick={toggleLanguage}
            className="p-2 rounded-md hover:bg-accent text-muted-foreground"
            title={t('common.language')}
          >
            <Globe className="h-4 w-4" />
            <span className="ml-1 text-xs font-medium">{i18n.language.toUpperCase()}</span>
          </button>

          {/* Theme toggle */}
          <button
            onClick={toggleTheme}
            className="p-2 rounded-md hover:bg-accent text-muted-foreground"
            title={theme === 'dark' ? t('common.lightMode') : t('common.darkMode')}
          >
            {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </button>

          {/* Notifications */}
          <div className="relative">
            <button
              onClick={() => {
                const next = !showNotifications;
                setShowNotifications(next);
                if (next) {
                  refreshNotifications();
                }
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
              <div className="absolute right-0 top-full mt-2 w-80 bg-card border border-border rounded-lg shadow-lg">
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

          {/* User menu */}
          <div className="flex items-center gap-2 ml-2 pl-2 border-l border-border">
            <span className="text-sm text-muted-foreground hidden sm:inline">
              {user?.firstName} {user?.lastName}
            </span>
            <button
              onClick={handleLogout}
              className="p-2 rounded-md hover:bg-accent text-muted-foreground"
              title={t('nav.logout')}
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}
