import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Search, Building2, TestTube2, FlaskConical, Cog, Loader2 } from 'lucide-react';
import { globalSearch, type GlobalSearchResults } from '@/services/searchService';
import {
  getAnalysisStatusColor,
  getAnalysisStatusLabel,
  getSampleStatusColor,
  getSampleStatusLabel,
  formatDate,
} from '@/utils/helpers';
import type { AnalysisStatus, SampleStatus } from '@/types';

export function GlobalSearchDropdown() {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const [query, setQuery] = useState('');
  const [results, setResults] = useState<GlobalSearchResults | null>(null);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);

  const wrapperRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const latestQuery = useRef('');

  // Flatten results for keyboard navigation
  const flatItems = useCallback((): Array<{ type: string; id: string; path: string }> => {
    if (!results) return [];
    const items: Array<{ type: string; id: string; path: string }> = [];
    for (const c of results.clients) items.push({ type: 'client', id: c.id, path: `/clients/${c.id}` });
    for (const s of results.samples) items.push({ type: 'sample', id: s.id, path: `/samples/${s.id}` });
    for (const a of results.analyses) items.push({ type: 'analysis', id: a.id, path: `/analyses/${a.id}` });
    for (const p of results.processes) items.push({ type: 'process', id: p.id, path: `/processes/${p.id}` });
    return items;
  }, [results]);

  // Debounced search
  useEffect(() => {
    latestQuery.current = query;

    if (query.length < 2) {
      setResults(null);
      setOpen(false);
      setActiveIndex(-1);
      return;
    }

    const timer = setTimeout(async () => {
      if (latestQuery.current !== query) return;
      setLoading(true);
      try {
        const data = await globalSearch(query);
        if (latestQuery.current === query) {
          setResults(data);
          setOpen(true);
          setActiveIndex(-1);
        }
      } catch {
        // silently fail
      } finally {
        if (latestQuery.current === query) setLoading(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [query]);

  // Click outside to close
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  function goTo(path: string) {
    setOpen(false);
    setQuery('');
    setResults(null);
    navigate(path);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    const items = flatItems();
    if (!open || items.length === 0) {
      if (e.key === 'Escape') {
        setOpen(false);
        inputRef.current?.blur();
      }
      return;
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((i) => (i < items.length - 1 ? i + 1 : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((i) => (i > 0 ? i - 1 : items.length - 1));
    } else if (e.key === 'Enter' && activeIndex >= 0) {
      e.preventDefault();
      goTo(items[activeIndex].path);
    } else if (e.key === 'Escape') {
      setOpen(false);
      inputRef.current?.blur();
    }
  }

  const totalResults = results
    ? results.clients.length + results.samples.length + results.analyses.length + results.processes.length
    : 0;

  // Track running index for keyboard nav highlighting
  let runningIndex = 0;

  return (
    <div ref={wrapperRef} className="relative w-full">
      {/* Search input */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
        {loading && (
          <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 animate-spin" />
        )}
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => { if (results && query.length >= 2) setOpen(true); }}
          onKeyDown={handleKeyDown}
          placeholder={t('search.placeholder')}
          className="block w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 pl-10 pr-10 py-2 text-sm text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none transition-colors"
        />
      </div>

      {/* Dropdown */}
      {open && results && (
        <div className="absolute z-50 mt-1 w-full bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-lg max-h-[28rem] overflow-y-auto">
          {totalResults === 0 ? (
            <div className="px-4 py-6 text-center text-sm text-gray-500 dark:text-gray-400">
              {t('search.noResults')} &ldquo;{query}&rdquo;
            </div>
          ) : (
            <>
              {/* Clients */}
              {results.clients.length > 0 && (
                <Section icon={Building2} label={t('search.clients')}>
                  {results.clients.map((c) => {
                    const idx = runningIndex++;
                    return (
                      <ResultItem key={c.id} active={idx === activeIndex} onClick={() => goTo(`/clients/${c.id}`)}>
                        <span className="font-medium text-gray-900 dark:text-white">{c.companyName}</span>
                        <span className="text-xs text-gray-500 dark:text-gray-400 ml-2">
                          {[c.nip, c.city].filter(Boolean).join(' · ')}
                        </span>
                      </ResultItem>
                    );
                  })}
                </Section>
              )}

              {/* Samples */}
              {results.samples.length > 0 && (
                <Section icon={TestTube2} label={t('search.samples')}>
                  {results.samples.map((s) => {
                    const idx = runningIndex++;
                    return (
                      <ResultItem key={s.id} active={idx === activeIndex} onClick={() => goTo(`/samples/${s.id}`)}>
                        <span className="font-medium text-gray-900 dark:text-white">{s.sampleCode}</span>
                        <span className={`ml-2 inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-medium ${getSampleStatusColor(s.status as SampleStatus)}`}>
                          {getSampleStatusLabel(s.status as SampleStatus)}
                        </span>
                        {s.client && (
                          <span className="text-xs text-gray-500 dark:text-gray-400 ml-2">{s.client.companyName}</span>
                        )}
                      </ResultItem>
                    );
                  })}
                </Section>
              )}

              {/* Analyses */}
              {results.analyses.length > 0 && (
                <Section icon={FlaskConical} label={t('search.analyses')}>
                  {results.analyses.map((a) => {
                    const idx = runningIndex++;
                    return (
                      <ResultItem key={a.id} active={idx === activeIndex} onClick={() => goTo(`/analyses/${a.id}`)}>
                        <span className="font-medium text-gray-900 dark:text-white">{a.analysisCode}</span>
                        <span className={`ml-2 inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-medium ${getAnalysisStatusColor(a.status as AnalysisStatus)}`}>
                          {getAnalysisStatusLabel(a.status as AnalysisStatus)}
                        </span>
                        <span className="text-xs text-gray-500 dark:text-gray-400 ml-2">
                          {a.sample?.client?.companyName}
                          {a.sample?.process && ` · ${a.sample.process.name}`}
                        </span>
                      </ResultItem>
                    );
                  })}
                </Section>
              )}

              {/* Processes */}
              {results.processes.length > 0 && (
                <Section icon={Cog} label={t('search.processes')}>
                  {results.processes.map((p) => {
                    const idx = runningIndex++;
                    return (
                      <ResultItem key={p.id} active={idx === activeIndex} onClick={() => goTo(`/processes/${p.id}`)}>
                        <span className="font-medium text-gray-900 dark:text-white">{p.name}</span>
                        <span className="ml-2 inline-flex items-center rounded-full bg-gray-100 dark:bg-gray-700 px-1.5 py-0.5 text-[10px] font-medium text-gray-600 dark:text-gray-300">
                          {p.processType}
                        </span>
                      </ResultItem>
                    );
                  })}
                </Section>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

// --- Sub-components ---

function Section({ icon: Icon, label, children }: { icon: any; label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="flex items-center gap-2 px-3 py-2 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider bg-gray-50 dark:bg-gray-900/50 sticky top-0">
        <Icon className="h-3.5 w-3.5" />
        {label}
      </div>
      {children}
    </div>
  );
}

function ResultItem({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full flex items-center flex-wrap gap-y-0.5 px-4 py-2.5 text-left text-sm cursor-pointer transition-colors ${
        active
          ? 'bg-blue-50 dark:bg-blue-900/30'
          : 'hover:bg-gray-50 dark:hover:bg-gray-700/50'
      }`}
    >
      {children}
    </button>
  );
}
