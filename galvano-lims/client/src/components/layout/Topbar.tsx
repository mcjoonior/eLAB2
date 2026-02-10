import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '@/store/authStore';
import { useThemeStore } from '@/store/themeStore';
import { notificationService } from '@/services/adminService';
import { authService } from '@/services/authService';
import { GlobalSearchDropdown } from '@/components/common/GlobalSearchDropdown';
import {
  Menu,
  Bell,
  Sun,
  Moon,
  Globe,
  LogOut,
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
  const [showNotifications, setShowNotifications] = useState(false);

  useEffect(() => {
    notificationService.getUnreadCount().then(setUnreadCount).catch(() => {});
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
              onClick={() => setShowNotifications(!showNotifications)}
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
                  {unreadCount === 0 ? (
                    <p className="text-sm text-muted-foreground p-3 text-center">Brak nowych powiadomień</p>
                  ) : (
                    <p className="text-sm text-muted-foreground p-3 text-center">
                      {unreadCount} nieprzeczytanych
                    </p>
                  )}
                </div>
                <div className="p-2 border-t border-border">
                  <button
                    onClick={() => { setShowNotifications(false); navigate('/notifications'); }}
                    className="w-full text-center text-sm text-primary hover:underline py-1"
                  >
                    Zobacz wszystkie
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
