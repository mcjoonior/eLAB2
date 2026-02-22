import { useState } from 'react';
import { useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Sidebar } from './Sidebar';
import { Topbar } from './Topbar';
import { getBranding } from '@/services/adminService';
import { useThemeStore } from '@/store/themeStore';

export function AppLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { setTheme } = useThemeStore();
  const { i18n } = useTranslation();

  useEffect(() => {
    getBranding()
      .then((branding) => {
        setTheme(branding.themeMode === 'DARK' ? 'dark' : 'light');
        const nextLanguage = branding.appLanguage === 'EN' ? 'en' : 'pl';
        if (i18n.language !== nextLanguage) {
          i18n.changeLanguage(nextLanguage);
        }
      })
      .catch(() => {});
  }, [setTheme, i18n]);

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-background">
      <Topbar onMenuClick={() => setSidebarOpen(true)} />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
        <main className="flex-1 overflow-y-auto p-4 md:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
