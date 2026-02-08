import { useState, useEffect, useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Upload,
  ArrowRight,
  ArrowLeft,
  CheckCircle,
  AlertTriangle,
  XCircle,
  RotateCcw,
  Eye,
  FileSpreadsheet,
  Save,
  Loader2,
} from 'lucide-react';
import { importService } from '@/services/importService';
import type {
  ImportJob,
  ImportTemplate,
  ImportType,
  ImportStatus,
  MappingConfig,
  ValidationError,
} from '@/types';
import { formatDateTime } from '@/utils/helpers';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import { Pagination } from '@/components/common/Pagination';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const ACCEPTED_EXTENSIONS = '.csv,.tsv,.xlsx,.xls,.json,.xml';

const IMPORT_TYPES: ImportType[] = [
  'FULL',
  'CLIENTS_ONLY',
  'ANALYSES_ONLY',
  'PROCESSES_ONLY',
  'SAMPLES_ONLY',
];

const IMPORT_TYPE_LABELS: Record<ImportType, string> = {
  FULL: 'Pełny import',
  CLIENTS_ONLY: 'Tylko klienci',
  ANALYSES_ONLY: 'Tylko analizy',
  PROCESSES_ONLY: 'Tylko procesy',
  SAMPLES_ONLY: 'Tylko próbki',
};

const TARGET_FIELDS = [
  { value: '', label: 'Pomiń' },
  { value: 'client.companyName', label: 'Klient - Nazwa firmy' },
  { value: 'client.nip', label: 'Klient - NIP' },
  { value: 'client.address', label: 'Klient - Adres' },
  { value: 'client.city', label: 'Klient - Miasto' },
  { value: 'client.email', label: 'Klient - Email' },
  { value: 'client.phone', label: 'Klient - Telefon' },
  { value: 'client.contactPerson', label: 'Klient - Osoba kontaktowa' },
  { value: 'analysis.analysisDate', label: 'Analiza - Data' },
  { value: 'analysis.notes', label: 'Analiza - Notatki' },
  { value: 'process.name', label: 'Proces - Nazwa' },
  { value: 'process.processType', label: 'Proces - Typ' },
  { value: 'sample.sampleCode', label: 'Próbka - Kod' },
  { value: 'sample.sampleType', label: 'Próbka - Typ' },
  { value: 'sample.description', label: 'Próbka - Opis' },
  { value: 'sample.collectedAt', label: 'Próbka - Data pobrania' },
  { value: 'result.parameterName', label: 'Wynik - Parametr' },
  { value: 'result.value', label: 'Wynik - Wartość' },
  { value: 'result.unit', label: 'Wynik - Jednostka' },
  { value: 'result.minReference', label: 'Wynik - Min. referencja' },
  { value: 'result.maxReference', label: 'Wynik - Max. referencja' },
];

const DATE_FORMATS = [
  'DD.MM.YYYY',
  'YYYY-MM-DD',
  'DD/MM/YYYY',
  'DD/MM/YY',
  'MM/DD/YYYY',
  'YYYY/MM/DD',
];

const DEDUP_STRATEGIES = [
  { value: 'skip', label: 'Pomiń duplikaty' },
  { value: 'overwrite', label: 'Nadpisz istniejące' },
  { value: 'create_new', label: 'Utwórz nowe' },
];

const STEP_LABELS = [
  'Upload',
  'Mapowanie',
  'Transformacja',
  'Walidacja',
  'Import',
  'Podsumowanie',
];

function getImportStatusColor(status: ImportStatus): string {
  switch (status) {
    case 'COMPLETED':
      return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
    case 'FAILED':
      return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
    case 'IMPORTING':
    case 'VALIDATING':
      return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
    case 'PARTIALLY_COMPLETED':
      return 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200';
    case 'VALIDATION_FAILED':
      return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
    case 'UPLOADED':
    default:
      return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200';
  }
}

function getImportStatusLabel(status: ImportStatus): string {
  const labels: Record<ImportStatus, string> = {
    UPLOADED: 'Przesłano',
    VALIDATING: 'Walidacja',
    VALIDATION_FAILED: 'Błąd walidacji',
    IMPORTING: 'Importowanie',
    COMPLETED: 'Zakończono',
    PARTIALLY_COMPLETED: 'Częściowo',
    FAILED: 'Błąd',
  };
  return labels[status] || status;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function ImportPage() {
  const { t } = useTranslation();

  // -- wizard state --
  const [step, setStep] = useState(0);
  const [file, setFile] = useState<File | null>(null);
  const [sourceSystem, setSourceSystem] = useState('');
  const [importType, setImportType] = useState<ImportType>('FULL');
  const [jobId, setJobId] = useState('');
  const [previewData, setPreviewData] = useState<any[]>([]);
  const [sourceColumns, setSourceColumns] = useState<string[]>([]);
  const [columnMapping, setColumnMapping] = useState<Record<string, string>>({});
  const [templates, setTemplates] = useState<ImportTemplate[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState('');
  const [templateName, setTemplateName] = useState('');

  // transformation
  const [dateFormat, setDateFormat] = useState('DD.MM.YYYY');
  const [decimalSeparator, setDecimalSeparator] = useState('comma');
  const [dedupStrategy, setDedupStrategy] = useState('skip');
  const [defaultStatus, setDefaultStatus] = useState('COMPLETED');

  // validation
  const [validationResult, setValidationResult] = useState<{
    ready: number;
    warnings: number;
    errors: ValidationError[];
  } | null>(null);

  // import result
  const [importResult, setImportResult] = useState<ImportJob | null>(null);
  const [importProgress, setImportProgress] = useState(0);

  // UI state
  const [uploading, setUploading] = useState(false);
  const [validating, setValidating] = useState(false);
  const [executing, setExecuting] = useState(false);
  const [savingTemplate, setSavingTemplate] = useState(false);
  const [error, setError] = useState('');
  const [dragOver, setDragOver] = useState(false);

  // -- history --
  const [jobs, setJobs] = useState<ImportJob[]>([]);
  const [jobsLoading, setJobsLoading] = useState(true);
  const [jobsPage, setJobsPage] = useState(1);
  const [jobsTotal, setJobsTotal] = useState(0);
  const [jobsTotalPages, setJobsTotalPages] = useState(1);
  const jobsLimit = 10;

  const fileInputRef = useRef<HTMLInputElement>(null);

  // -----------------------------------------------------------------------
  // Data fetching
  // -----------------------------------------------------------------------

  const fetchJobs = useCallback(async () => {
    try {
      setJobsLoading(true);
      const res = await importService.getJobs({ page: jobsPage, limit: jobsLimit });
      setJobs(res.data);
      setJobsTotal(res.pagination.total);
      setJobsTotalPages(res.pagination.totalPages);
    } catch {
      // silent
    } finally {
      setJobsLoading(false);
    }
  }, [jobsPage]);

  useEffect(() => {
    fetchJobs();
  }, [fetchJobs]);

  useEffect(() => {
    async function loadTemplates() {
      try {
        const tpls = await importService.getTemplates();
        setTemplates(tpls);
      } catch {
        // silent
      }
    }
    loadTemplates();
  }, []);

  // -----------------------------------------------------------------------
  // Build mapping config
  // -----------------------------------------------------------------------

  function buildMappingConfig(): MappingConfig {
    return {
      type: importType,
      columns: columnMapping,
      dateFormat,
      decimalSeparator: decimalSeparator === 'comma' ? ',' : '.',
      deduplication: dedupStrategy,
      defaults: { status: defaultStatus },
    };
  }

  // -----------------------------------------------------------------------
  // Step 1 handlers
  // -----------------------------------------------------------------------

  async function handleFileUpload(f: File) {
    setFile(f);
    setError('');
    try {
      setUploading(true);
      const res = await importService.upload(f, sourceSystem || undefined);
      setJobId(res.jobId);
      setPreviewData(res.preview || []);
      setSourceColumns(res.columns || []);
      // init empty mapping
      const mapping: Record<string, string> = {};
      (res.columns || []).forEach((col: string) => {
        mapping[col] = '';
      });
      setColumnMapping(mapping);
    } catch (err: any) {
      setError(err?.response?.data?.message || t('common.errorOccurred'));
    } finally {
      setUploading(false);
    }
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files?.[0];
    if (f) handleFileUpload(f);
  }

  function handleFileInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (f) handleFileUpload(f);
  }

  // -----------------------------------------------------------------------
  // Step 2 handlers
  // -----------------------------------------------------------------------

  function applyTemplate(templateId: string) {
    setSelectedTemplate(templateId);
    const tpl = templates.find((t) => t.id === templateId);
    if (tpl?.mappingConfig?.columns) {
      setColumnMapping((prev) => {
        const next = { ...prev };
        Object.keys(tpl.mappingConfig.columns!).forEach((col) => {
          if (col in next) {
            next[col] = tpl.mappingConfig.columns![col];
          }
        });
        return next;
      });
      if (tpl.mappingConfig.dateFormat) setDateFormat(tpl.mappingConfig.dateFormat);
      if (tpl.mappingConfig.decimalSeparator)
        setDecimalSeparator(tpl.mappingConfig.decimalSeparator === ',' ? 'comma' : 'dot');
    }
  }

  async function handleSaveTemplate() {
    if (!templateName.trim()) return;
    try {
      setSavingTemplate(true);
      const saved = await importService.saveTemplate({
        name: templateName,
        mappingConfig: buildMappingConfig(),
        sourceSystem: sourceSystem || undefined,
        isPublic: true,
      });
      setTemplates((prev) => [...prev, saved]);
      setTemplateName('');
    } catch (err: any) {
      setError(err?.response?.data?.message || t('common.errorOccurred'));
    } finally {
      setSavingTemplate(false);
    }
  }

  // -----------------------------------------------------------------------
  // Step 4 - Validate
  // -----------------------------------------------------------------------

  async function handleValidate() {
    try {
      setValidating(true);
      setError('');
      const res = await importService.validate(jobId, buildMappingConfig());
      setValidationResult(res);
    } catch (err: any) {
      setError(err?.response?.data?.message || t('common.errorOccurred'));
    } finally {
      setValidating(false);
    }
  }

  useEffect(() => {
    if (step === 3) {
      handleValidate();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  // -----------------------------------------------------------------------
  // Step 5 - Execute
  // -----------------------------------------------------------------------

  async function handleExecute() {
    try {
      setExecuting(true);
      setError('');
      setStep(4); // step 5 = index 4
      // Simulate progress
      const progressInterval = setInterval(() => {
        setImportProgress((prev) => {
          if (prev >= 90) return prev;
          return prev + Math.random() * 15;
        });
      }, 500);

      const result = await importService.execute(jobId, buildMappingConfig());
      clearInterval(progressInterval);
      setImportProgress(100);
      setImportResult(result);
      setTimeout(() => {
        setStep(5); // step 6 = index 5
        setExecuting(false);
        fetchJobs();
      }, 600);
    } catch (err: any) {
      setExecuting(false);
      setError(err?.response?.data?.message || t('common.errorOccurred'));
    }
  }

  // -----------------------------------------------------------------------
  // Step 6 - Rollback
  // -----------------------------------------------------------------------

  async function handleRollback() {
    if (!importResult) return;
    try {
      await importService.rollback(importResult.id);
      fetchJobs();
      resetWizard();
    } catch (err: any) {
      setError(err?.response?.data?.message || t('common.errorOccurred'));
    }
  }

  async function handleRollbackJob(id: string) {
    try {
      await importService.rollback(id);
      fetchJobs();
    } catch (err: any) {
      setError(err?.response?.data?.message || t('common.errorOccurred'));
    }
  }

  // -----------------------------------------------------------------------
  // Reset wizard
  // -----------------------------------------------------------------------

  function resetWizard() {
    setStep(0);
    setFile(null);
    setSourceSystem('');
    setImportType('FULL');
    setJobId('');
    setPreviewData([]);
    setSourceColumns([]);
    setColumnMapping({});
    setSelectedTemplate('');
    setTemplateName('');
    setDateFormat('DD.MM.YYYY');
    setDecimalSeparator('comma');
    setDedupStrategy('skip');
    setDefaultStatus('COMPLETED');
    setValidationResult(null);
    setImportResult(null);
    setImportProgress(0);
    setError('');
  }

  // -----------------------------------------------------------------------
  // Render helpers
  // -----------------------------------------------------------------------

  const canGoNext = (): boolean => {
    switch (step) {
      case 0:
        return !!jobId && sourceColumns.length > 0;
      case 1:
        return Object.values(columnMapping).some((v) => v !== '');
      case 2:
        return true;
      case 3:
        return !!validationResult && validationResult.errors.filter((e) => e.severity === 'error').length === 0;
      default:
        return false;
    }
  };

  // -----------------------------------------------------------------------
  // Stepper
  // -----------------------------------------------------------------------

  function renderStepper() {
    return (
      <div className="flex items-center justify-between mb-8">
        {STEP_LABELS.map((label, i) => {
          const isActive = i === step;
          const isCompleted = i < step;
          return (
            <div key={label} className="flex items-center flex-1 last:flex-none">
              <div className="flex flex-col items-center">
                <div
                  className={`flex items-center justify-center w-10 h-10 rounded-full border-2 text-sm font-semibold transition-colors ${
                    isCompleted
                      ? 'border-green-500 bg-green-500 text-white'
                      : isActive
                        ? 'border-blue-500 bg-blue-500 text-white'
                        : 'border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-500 dark:text-gray-400'
                  }`}
                >
                  {isCompleted ? <CheckCircle className="h-5 w-5" /> : i + 1}
                </div>
                <span
                  className={`mt-2 text-xs font-medium whitespace-nowrap ${
                    isActive
                      ? 'text-blue-600 dark:text-blue-400'
                      : isCompleted
                        ? 'text-green-600 dark:text-green-400'
                        : 'text-gray-400 dark:text-gray-500'
                  }`}
                >
                  {label}
                </span>
              </div>
              {i < STEP_LABELS.length - 1 && (
                <div
                  className={`flex-1 h-0.5 mx-3 mt-[-1rem] ${
                    i < step
                      ? 'bg-green-500'
                      : 'bg-gray-200 dark:bg-gray-700'
                  }`}
                />
              )}
            </div>
          );
        })}
      </div>
    );
  }

  // -----------------------------------------------------------------------
  // Step 1 - Upload
  // -----------------------------------------------------------------------

  function renderStep1() {
    return (
      <div className="space-y-6">
        {/* Drag and drop zone */}
        <div
          className={`border-2 border-dashed rounded-xl p-10 text-center transition-colors cursor-pointer ${
            dragOver
              ? 'border-blue-500 bg-blue-50 dark:bg-blue-950'
              : 'border-gray-300 dark:border-gray-600 hover:border-blue-400 dark:hover:border-blue-500 bg-gray-50 dark:bg-gray-800'
          }`}
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept={ACCEPTED_EXTENSIONS}
            className="hidden"
            onChange={handleFileInputChange}
          />
          <Upload className="h-12 w-12 mx-auto text-gray-400 dark:text-gray-500 mb-4" />
          <p className="text-lg font-medium text-gray-700 dark:text-gray-300">
            Przeciągnij i upuść plik tutaj
          </p>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            lub kliknij, aby wybrać plik
          </p>
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-3">
            Obsługiwane formaty: CSV, TSV, XLSX, XLS, JSON, XML
          </p>
          {file && (
            <div className="mt-4 inline-flex items-center gap-2 bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 rounded-lg px-4 py-2 text-sm">
              <FileSpreadsheet className="h-4 w-4" />
              {file.name} ({(file.size / 1024).toFixed(1)} KB)
            </div>
          )}
          {uploading && (
            <div className="mt-4">
              <Loader2 className="h-6 w-6 animate-spin mx-auto text-blue-500" />
              <p className="text-sm text-gray-500 mt-2">Przesyłanie pliku...</p>
            </div>
          )}
        </div>

        {/* Source system & import type */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              System źródłowy
            </label>
            <input
              type="text"
              value={sourceSystem}
              onChange={(e) => setSourceSystem(e.target.value)}
              placeholder="np. StarLIMS, Excel, inny system"
              className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Typ importu
            </label>
            <select
              value={importType}
              onChange={(e) => setImportType(e.target.value as ImportType)}
              className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              {IMPORT_TYPES.map((it) => (
                <option key={it} value={it}>
                  {IMPORT_TYPE_LABELS[it]}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Preview table */}
        {previewData.length > 0 && (
          <div>
            <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Podgląd danych (pierwsze {Math.min(previewData.length, 10)} wierszy)
            </h3>
            <div className="overflow-x-auto border border-gray-200 dark:border-gray-700 rounded-lg">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-gray-50 dark:bg-gray-800">
                    {sourceColumns.map((col) => (
                      <th
                        key={col}
                        className="text-left px-3 py-2 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider whitespace-nowrap"
                      >
                        {col}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                  {previewData.slice(0, 10).map((row, ri) => (
                    <tr key={ri} className="hover:bg-gray-50 dark:hover:bg-gray-750">
                      {sourceColumns.map((col) => (
                        <td
                          key={col}
                          className="px-3 py-1.5 text-gray-700 dark:text-gray-300 whitespace-nowrap max-w-[200px] truncate"
                        >
                          {row[col] ?? ''}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    );
  }

  // -----------------------------------------------------------------------
  // Step 2 - Column mapping
  // -----------------------------------------------------------------------

  function renderStep2() {
    return (
      <div className="space-y-6">
        {/* Template selector */}
        <div className="flex items-end gap-4">
          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Szablon mapowania
            </label>
            <select
              value={selectedTemplate}
              onChange={(e) => applyTemplate(e.target.value)}
              className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="">-- Wybierz szablon --</option>
              {templates.map((tpl) => (
                <option key={tpl.id} value={tpl.id}>
                  {tpl.name}
                </option>
              ))}
            </select>
          </div>
          <div className="flex items-end gap-2">
            <input
              type="text"
              value={templateName}
              onChange={(e) => setTemplateName(e.target.value)}
              placeholder="Nazwa szablonu"
              className="rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
            <button
              onClick={handleSaveTemplate}
              disabled={!templateName.trim() || savingTemplate}
              className="inline-flex items-center gap-2 rounded-lg bg-gray-100 dark:bg-gray-700 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600 disabled:opacity-50 transition-colors"
            >
              <Save className="h-4 w-4" />
              Zapisz jako szablon
            </button>
          </div>
        </div>

        {/* Column mapping table */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left: mapping form */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
              Mapowanie kolumn
            </h3>
            <div className="space-y-2 max-h-[500px] overflow-y-auto pr-2">
              {sourceColumns.map((col) => (
                <div key={col} className="flex items-center gap-3">
                  <div className="flex-1 bg-gray-50 dark:bg-gray-800 rounded-lg px-3 py-2 text-sm text-gray-700 dark:text-gray-300 font-mono truncate border border-gray-200 dark:border-gray-700">
                    {col}
                  </div>
                  <ArrowRight className="h-4 w-4 text-gray-400 flex-shrink-0" />
                  <select
                    value={columnMapping[col] || ''}
                    onChange={(e) =>
                      setColumnMapping((prev) => ({ ...prev, [col]: e.target.value }))
                    }
                    className="flex-1 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    {TARGET_FIELDS.map((tf) => (
                      <option key={tf.value} value={tf.value}>
                        {tf.label}
                      </option>
                    ))}
                  </select>
                </div>
              ))}
            </div>
          </div>

          {/* Right: preview of mapped data */}
          <div>
            <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
              Podgląd mapowania (3 pierwsze wiersze)
            </h3>
            <div className="space-y-3">
              {previewData.slice(0, 3).map((row, ri) => (
                <div
                  key={ri}
                  className="bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4"
                >
                  <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-2">
                    Wiersz {ri + 1}
                  </p>
                  <div className="space-y-1">
                    {sourceColumns
                      .filter((col) => columnMapping[col])
                      .map((col) => (
                        <div key={col} className="flex items-baseline gap-2 text-sm">
                          <span className="text-gray-500 dark:text-gray-400 text-xs min-w-[160px]">
                            {TARGET_FIELDS.find((f) => f.value === columnMapping[col])?.label}:
                          </span>
                          <span className="text-gray-900 dark:text-white font-medium">
                            {row[col] ?? '—'}
                          </span>
                        </div>
                      ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // -----------------------------------------------------------------------
  // Step 3 - Transformation
  // -----------------------------------------------------------------------

  function renderStep3() {
    return (
      <div className="max-w-2xl space-y-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Format daty
          </label>
          <select
            value={dateFormat}
            onChange={(e) => setDateFormat(e.target.value)}
            className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            {DATE_FORMATS.map((fmt) => (
              <option key={fmt} value={fmt}>
                {fmt}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Separator dziesiętny
          </label>
          <div className="flex gap-4">
            <label className="inline-flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300 cursor-pointer">
              <input
                type="radio"
                name="decimalSep"
                value="comma"
                checked={decimalSeparator === 'comma'}
                onChange={() => setDecimalSeparator('comma')}
                className="text-blue-500 focus:ring-blue-500"
              />
              Przecinek (1,23)
            </label>
            <label className="inline-flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300 cursor-pointer">
              <input
                type="radio"
                name="decimalSep"
                value="dot"
                checked={decimalSeparator === 'dot'}
                onChange={() => setDecimalSeparator('dot')}
                className="text-blue-500 focus:ring-blue-500"
              />
              Kropka (1.23)
            </label>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Strategia deduplikacji
          </label>
          <select
            value={dedupStrategy}
            onChange={(e) => setDedupStrategy(e.target.value)}
            className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            {DEDUP_STRATEGIES.map((ds) => (
              <option key={ds.value} value={ds.value}>
                {ds.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Domyślny status (dla danych historycznych)
          </label>
          <select
            value={defaultStatus}
            onChange={(e) => setDefaultStatus(e.target.value)}
            className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="COMPLETED">Zakończona (COMPLETED)</option>
            <option value="APPROVED">Zatwierdzona (APPROVED)</option>
            <option value="IN_PROGRESS">W trakcie (IN_PROGRESS)</option>
            <option value="PENDING">Oczekująca (PENDING)</option>
          </select>
        </div>
      </div>
    );
  }

  // -----------------------------------------------------------------------
  // Step 4 - Validation
  // -----------------------------------------------------------------------

  function renderStep4() {
    if (validating) {
      return <LoadingSpinner size="lg" text="Walidacja danych..." />;
    }

    if (!validationResult) {
      return (
        <div className="text-center py-8 text-sm text-gray-500 dark:text-gray-400">
          Nie udało się przeprowadzić walidacji.
        </div>
      );
    }

    const errorCount = validationResult.errors.filter((e) => e.severity === 'error').length;
    const warningCount = validationResult.warnings;

    return (
      <div className="space-y-6">
        {/* Result cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 rounded-xl p-5 text-center">
            <CheckCircle className="h-8 w-8 text-green-500 mx-auto mb-2" />
            <p className="text-2xl font-bold text-green-700 dark:text-green-300">
              {validationResult.ready}
            </p>
            <p className="text-sm text-green-600 dark:text-green-400">Gotowe do importu</p>
          </div>
          <div className="bg-yellow-50 dark:bg-yellow-950 border border-yellow-200 dark:border-yellow-800 rounded-xl p-5 text-center">
            <AlertTriangle className="h-8 w-8 text-yellow-500 mx-auto mb-2" />
            <p className="text-2xl font-bold text-yellow-700 dark:text-yellow-300">
              {warningCount}
            </p>
            <p className="text-sm text-yellow-600 dark:text-yellow-400">Ostrzeżenia</p>
          </div>
          <div className="bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-xl p-5 text-center">
            <XCircle className="h-8 w-8 text-red-500 mx-auto mb-2" />
            <p className="text-2xl font-bold text-red-700 dark:text-red-300">{errorCount}</p>
            <p className="text-sm text-red-600 dark:text-red-400">Błędy</p>
          </div>
        </div>

        {/* Errors table */}
        {validationResult.errors.length > 0 && (
          <div>
            <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
              Szczegóły błędów i ostrzeżeń
            </h3>
            <div className="overflow-x-auto border border-gray-200 dark:border-gray-700 rounded-lg">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
                    <th className="text-left px-4 py-2 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                      Typ
                    </th>
                    <th className="text-left px-4 py-2 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                      Wiersz
                    </th>
                    <th className="text-left px-4 py-2 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                      Kolumna
                    </th>
                    <th className="text-left px-4 py-2 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                      Opis błędu
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                  {validationResult.errors.map((err, i) => (
                    <tr key={i} className="hover:bg-gray-50 dark:hover:bg-gray-750">
                      <td className="px-4 py-2">
                        <span
                          className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                            err.severity === 'error'
                              ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
                              : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'
                          }`}
                        >
                          {err.severity === 'error' ? 'Błąd' : 'Ostrzeżenie'}
                        </span>
                      </td>
                      <td className="px-4 py-2 text-gray-700 dark:text-gray-300 font-mono">
                        {err.row}
                      </td>
                      <td className="px-4 py-2 text-gray-700 dark:text-gray-300 font-mono">
                        {err.column}
                      </td>
                      <td className="px-4 py-2 text-gray-700 dark:text-gray-300">{err.message}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Action buttons */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => setStep(1)}
            className="inline-flex items-center gap-2 rounded-lg border border-gray-300 dark:border-gray-600 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Wstecz (popraw mapowanie)
          </button>
          <button
            onClick={handleExecute}
            disabled={errorCount > 0}
            className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-6 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <ArrowRight className="h-4 w-4" />
            Wykonaj import
          </button>
        </div>
      </div>
    );
  }

  // -----------------------------------------------------------------------
  // Step 5 - Import execution
  // -----------------------------------------------------------------------

  function renderStep5() {
    return (
      <div className="flex flex-col items-center justify-center py-16 space-y-6">
        <Loader2 className="h-16 w-16 animate-spin text-blue-500" />
        <p className="text-lg font-medium text-gray-700 dark:text-gray-300">Trwa import...</p>
        <div className="w-full max-w-md">
          <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
            <div
              className="h-full bg-blue-500 rounded-full transition-all duration-500 ease-out"
              style={{ width: `${Math.min(importProgress, 100)}%` }}
            />
          </div>
          <p className="text-sm text-gray-500 dark:text-gray-400 text-center mt-2">
            {Math.round(importProgress)}%
          </p>
        </div>
        <p className="text-sm text-gray-400 dark:text-gray-500">
          Proszę nie zamykać tej strony...
        </p>
      </div>
    );
  }

  // -----------------------------------------------------------------------
  // Step 6 - Summary
  // -----------------------------------------------------------------------

  function renderStep6() {
    if (!importResult) {
      return (
        <div className="text-center py-8 text-sm text-gray-500 dark:text-gray-400">
          Brak wyników importu.
        </div>
      );
    }

    return (
      <div className="space-y-6">
        <div className="text-center mb-4">
          <CheckCircle className="h-16 w-16 text-green-500 mx-auto mb-3" />
          <h3 className="text-xl font-bold text-gray-900 dark:text-white">Import zakończony</h3>
        </div>

        {/* Result cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 rounded-xl p-5 text-center">
            <p className="text-3xl font-bold text-green-700 dark:text-green-300">
              {importResult.importedRecords}
            </p>
            <p className="text-sm text-green-600 dark:text-green-400 mt-1">Zaimportowano</p>
          </div>
          <div className="bg-yellow-50 dark:bg-yellow-950 border border-yellow-200 dark:border-yellow-800 rounded-xl p-5 text-center">
            <p className="text-3xl font-bold text-yellow-700 dark:text-yellow-300">
              {importResult.skippedRecords}
            </p>
            <p className="text-sm text-yellow-600 dark:text-yellow-400 mt-1">Pominięto</p>
          </div>
          <div className="bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-xl p-5 text-center">
            <p className="text-3xl font-bold text-red-700 dark:text-red-300">
              {importResult.errorRecords}
            </p>
            <p className="text-sm text-red-600 dark:text-red-400 mt-1">Błędy</p>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-center gap-4">
          <button
            onClick={handleRollback}
            className="inline-flex items-center gap-2 rounded-lg border border-red-300 dark:border-red-700 text-red-600 dark:text-red-400 px-4 py-2 text-sm font-medium hover:bg-red-50 dark:hover:bg-red-950 transition-colors"
          >
            <RotateCcw className="h-4 w-4" />
            Cofnij import
          </button>
          <button
            onClick={resetWizard}
            className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-6 py-2 text-sm font-medium text-white hover:bg-blue-700 transition-colors"
          >
            Zakończ
          </button>
        </div>
      </div>
    );
  }

  // -----------------------------------------------------------------------
  // Current step content
  // -----------------------------------------------------------------------

  function renderStepContent() {
    switch (step) {
      case 0:
        return renderStep1();
      case 1:
        return renderStep2();
      case 2:
        return renderStep3();
      case 3:
        return renderStep4();
      case 4:
        return renderStep5();
      case 5:
        return renderStep6();
      default:
        return null;
    }
  }

  // -----------------------------------------------------------------------
  // Main render
  // -----------------------------------------------------------------------

  return (
    <div className="space-y-8">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Import danych</h1>
      </div>

      {/* Wizard section */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm">
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-base font-semibold text-gray-900 dark:text-white">Nowy import</h2>
        </div>
        <div className="p-6">
          {renderStepper()}

          {error && (
            <div className="mb-6 rounded-lg bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 p-4 text-sm text-red-700 dark:text-red-400">
              {error}
            </div>
          )}

          {renderStepContent()}

          {/* Navigation buttons (steps 0-2) */}
          {step <= 2 && (
            <div className="flex items-center justify-between mt-8 pt-6 border-t border-gray-200 dark:border-gray-700">
              <button
                onClick={() => setStep((s) => Math.max(0, s - 1))}
                disabled={step === 0}
                className="inline-flex items-center gap-2 rounded-lg border border-gray-300 dark:border-gray-600 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <ArrowLeft className="h-4 w-4" />
                Wstecz
              </button>
              <button
                onClick={() => setStep((s) => s + 1)}
                disabled={!canGoNext()}
                className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-6 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Dalej
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Import history section */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm">
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-base font-semibold text-gray-900 dark:text-white">
            Historia importów
          </h2>
        </div>

        {jobsLoading ? (
          <LoadingSpinner size="md" text={t('common.loading')} />
        ) : jobs.length === 0 ? (
          <div className="px-6 py-10 text-center text-sm text-gray-500 dark:text-gray-400">
            Brak historii importów.
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 dark:border-gray-700">
                    <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Kod
                    </th>
                    <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      System źródłowy
                    </th>
                    <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Typ
                    </th>
                    <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Rekordy
                    </th>
                    <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Data
                    </th>
                    <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Akcje
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                  {jobs.map((job) => (
                    <tr key={job.id} className="hover:bg-gray-50 dark:hover:bg-gray-750">
                      <td className="px-6 py-3 font-medium text-gray-900 dark:text-white whitespace-nowrap">
                        {job.importCode}
                      </td>
                      <td className="px-6 py-3 text-gray-600 dark:text-gray-300 whitespace-nowrap">
                        {job.sourceSystem || '—'}
                      </td>
                      <td className="px-6 py-3 text-gray-600 dark:text-gray-300 whitespace-nowrap">
                        {IMPORT_TYPE_LABELS[job.importType] || job.importType}
                      </td>
                      <td className="px-6 py-3 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${getImportStatusColor(job.status)}`}
                        >
                          {getImportStatusLabel(job.status)}
                        </span>
                      </td>
                      <td className="px-6 py-3 text-gray-600 dark:text-gray-300 whitespace-nowrap">
                        {job.importedRecords}/{job.totalRecords}
                      </td>
                      <td className="px-6 py-3 text-gray-500 dark:text-gray-400 whitespace-nowrap">
                        {formatDateTime(job.createdAt)}
                      </td>
                      <td className="px-6 py-3 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => {
                              /* View details - could navigate or open modal */
                            }}
                            className="inline-flex items-center gap-1 text-xs text-blue-600 dark:text-blue-400 hover:underline"
                          >
                            <Eye className="h-3.5 w-3.5" />
                            Szczegóły
                          </button>
                          {(job.status === 'COMPLETED' || job.status === 'PARTIALLY_COMPLETED') && (
                            <button
                              onClick={() => handleRollbackJob(job.id)}
                              className="inline-flex items-center gap-1 text-xs text-red-600 dark:text-red-400 hover:underline"
                            >
                              <RotateCcw className="h-3.5 w-3.5" />
                              Cofnij
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="px-6 py-2 border-t border-gray-200 dark:border-gray-700">
              <Pagination
                page={jobsPage}
                totalPages={jobsTotalPages}
                total={jobsTotal}
                limit={jobsLimit}
                onPageChange={setJobsPage}
              />
            </div>
          </>
        )}
      </div>
    </div>
  );
}
