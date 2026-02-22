import { useState } from 'react';
import { useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { Topbar } from './Topbar';
import { getBranding } from '@/services/adminService';
import { useThemeStore } from '@/store/themeStore';

export function AppLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { setTheme } = useThemeStore();

  useEffect(() => {
    getBranding()
      .then((branding) => {
        setTheme(branding.themeMode === 'DARK' ? 'dark' : 'light');
      })
      .catch(() => {});
  }, [setTheme]);

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
