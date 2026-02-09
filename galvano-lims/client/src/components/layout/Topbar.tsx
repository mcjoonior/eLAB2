import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '@/store/authStore';
import { useThemeStore } from '@/store/themeStore';
import { notificationService } from '@/services/adminService';
import { authService } from '@/services/authService';
import { searchService } from '@/services/searchService';
import type { GlobalSearchResponse } from '@/types';
import {
  Menu,
  Bell,
  Sun,
  Moon,
  Globe,
  LogOut,
  Search,
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
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<GlobalSearchResponse['data']>({
    clients: [],
    samples: [],
    analyses: [],
    processAnalyses: [],
  });
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isSearchLoading, setIsSearchLoading] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const searchContainerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    notificationService.getUnreadCount().then(setUnreadCount).catch(() => {});
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchContainerRef.current && !searchContainerRef.current.contains(event.target as Node)) {
        setIsSearchOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    const query = searchQuery.trim();
    if (query.length < 2) {
      setSearchResults({ clients: [], samples: [], analyses: [], processAnalyses: [] });
      setIsSearchLoading(false);
      return () => {};
    }

    setIsSearchLoading(true);
    const handle = window.setTimeout(async () => {
      try {
        const response = await searchService.globalSearch(query, 6);
        setSearchResults(response.data);
      } catch {
        setSearchResults({ clients: [], samples: [], analyses: [], processAnalyses: [] });
      } finally {
        setIsSearchLoading(false);
      }
    }, 250);

    return () => window.clearTimeout(handle);
  }, [searchQuery]);

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

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setIsSearchOpen(true);
  };

  const hasAnyResults = Boolean(
    searchResults.clients.length ||
    searchResults.samples.length ||
    searchResults.analyses.length ||
    searchResults.processAnalyses.length
  );

  return (
    <header className="sticky top-0 z-30 h-16 border-b border-border bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/60">
      <div className="flex items-center justify-between h-full px-4">
        {/* Left */}
        <div className="flex items-center gap-4">
          <button
            onClick={onMenuClick}
            className="lg:hidden p-2 rounded-md hover:bg-accent"
          >
            <Menu className="h-5 w-5" />
          </button>

          {/* Search */}
          <form onSubmit={handleSearch} className="hidden md:flex items-center">
            <div className="relative" ref={searchContainerRef}>
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setIsSearchOpen(true);
                }}
                onFocus={() => setIsSearchOpen(true)}
                onKeyDown={(e) => {
                  if (e.key === 'Escape') {
                    setIsSearchOpen(false);
                  }
                }}
                placeholder={t('common.search')}
                className="h-9 w-64 pl-9 pr-4 rounded-md border border-input bg-background text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              />

              {isSearchOpen && searchQuery.trim().length >= 2 && (
                <div className="absolute left-0 top-full mt-2 w-96 rounded-md border border-border bg-popover text-popover-foreground shadow-lg">
                  <div className="max-h-96 overflow-y-auto p-2">
                    {isSearchLoading && (
                      <div className="px-3 py-2 text-sm text-muted-foreground">
                        {t('common.loading')}
                      </div>
                    )}

                    {!isSearchLoading && !hasAnyResults && (
                      <div className="px-3 py-2 text-sm text-muted-foreground">
                        {t('search.noResults')}
                      </div>
                    )}

                    {!isSearchLoading && hasAnyResults && (
                      <>
                        {searchResults.clients.length > 0 && (
                          <div className="py-1">
                            <div className="px-3 py-1 text-xs font-semibold uppercase text-muted-foreground">
                              {t('search.clients')}
                            </div>
                            {searchResults.clients.map((client) => (
                              <button
                                key={client.id}
                                type="button"
                                onClick={() => {
                                  setIsSearchOpen(false);
                                  setSearchQuery('');
                                  navigate(`/clients/${client.id}`);
                                }}
                                className="w-full text-left px-3 py-2 rounded-md hover:bg-accent"
                              >
                                <div className="text-sm font-medium">{client.companyName}</div>
                                <div className="text-xs text-muted-foreground">
                                  {client.nip ? `${t('clients.nip')}: ${client.nip}` : client.city || ''}
                                </div>
                              </button>
                            ))}
                          </div>
                        )}

                        {searchResults.samples.length > 0 && (
                          <div className="py-1">
                            <div className="px-3 py-1 text-xs font-semibold uppercase text-muted-foreground">
                              {t('search.samples')}
                            </div>
                            {searchResults.samples.map((sample) => (
                              <button
                                key={sample.id}
                                type="button"
                                onClick={() => {
                                  setIsSearchOpen(false);
                                  setSearchQuery('');
                                  navigate(`/samples/${sample.id}`);
                                }}
                                className="w-full text-left px-3 py-2 rounded-md hover:bg-accent"
                              >
                                <div className="text-sm font-medium">{sample.sampleCode}</div>
                                <div className="text-xs text-muted-foreground">
                                  {[sample.client?.companyName, sample.process?.name].filter(Boolean).join(' • ')}
                                </div>
                              </button>
                            ))}
                          </div>
                        )}

                        {searchResults.analyses.length > 0 && (
                          <div className="py-1">
                            <div className="px-3 py-1 text-xs font-semibold uppercase text-muted-foreground">
                              {t('search.analyses')}
                            </div>
                            {searchResults.analyses.map((analysis) => (
                              <button
                                key={analysis.id}
                                type="button"
                                onClick={() => {
                                  setIsSearchOpen(false);
                                  setSearchQuery('');
                                  navigate(`/analyses/${analysis.id}`);
                                }}
                                className="w-full text-left px-3 py-2 rounded-md hover:bg-accent"
                              >
                                <div className="text-sm font-medium">{analysis.analysisCode}</div>
                                <div className="text-xs text-muted-foreground">
                                  {[analysis.sample?.sampleCode, analysis.sample?.process?.name].filter(Boolean).join(' • ')}
                                </div>
                              </button>
                            ))}
                          </div>
                        )}

                        {searchResults.processAnalyses.length > 0 && (
                          <div className="py-1">
                            <div className="px-3 py-1 text-xs font-semibold uppercase text-muted-foreground">
                              {t('search.processAnalyses')}
                            </div>
                            {searchResults.processAnalyses.map((analysis) => (
                              <button
                                key={`${analysis.id}-process`}
                                type="button"
                                onClick={() => {
                                  setIsSearchOpen(false);
                                  setSearchQuery('');
                                  navigate(`/analyses/${analysis.id}`);
                                }}
                                className="w-full text-left px-3 py-2 rounded-md hover:bg-accent"
                              >
                                <div className="text-sm font-medium">{analysis.analysisCode}</div>
                                <div className="text-xs text-muted-foreground">
                                  {[analysis.sample?.process?.name, analysis.sample?.sampleCode].filter(Boolean).join(' • ')}
                                </div>
                              </button>
                            ))}
                          </div>
                        )}
                      </>
                    )}
                  </div>
                </div>
              )}
            </div>
          </form>
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
