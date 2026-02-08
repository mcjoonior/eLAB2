import { prisma } from '../index';
import {
  ImportStatus,
  ImportType,
  ProcessType,
  SampleType,
  SampleStatus,
  AnalysisStatus,
  Deviation,
  Prisma,
} from '@prisma/client';
import { parse as csvParse } from 'csv-parse/sync';
import * as XLSX from 'xlsx';
import { parseStringPromise } from 'xml2js';
import * as chardet from 'chardet';
import * as iconv from 'iconv-lite';
import * as stringSimilarity from 'string-similarity';
import * as fs from 'fs';
import * as path from 'path';

// ============================================================
// TYPY
// ============================================================

export interface ParsedRow {
  [key: string]: string | number | null;
}

export interface ParsedFile {
  headers: string[];
  rows: ParsedRow[];
  totalRows: number;
  detectedEncoding: string;
  detectedSeparator?: string;
}

export interface ColumnMapping {
  sourceColumn: string;
  targetField: string;
  transformation?: string;
  defaultValue?: string;
}

export interface MappingConfig {
  importType: ImportType;
  sourceSystem?: string;
  columnMappings: ColumnMapping[];
  enumMappings?: Record<string, Record<string, string>>;
  dateFormat?: string;
  decimalSeparator?: string;
  skipEmptyRows?: boolean;
  deduplicateBy?: string;
}

export interface ValidationError {
  row: number;
  column: string;
  message: string;
  value?: string | number | null;
  severity: 'error' | 'warning';
}

export interface ValidationReport {
  ready: number;
  warnings: number;
  errors: ValidationError[];
  totalRows: number;
  summary: string;
}

export interface ImportProgress {
  totalRecords: number;
  importedRecords: number;
  skippedRecords: number;
  errorRecords: number;
  errors: ValidationError[];
}

export interface AutoMappingSuggestion {
  sourceColumn: string;
  suggestedTarget: string;
  confidence: number;
}

// ============================================================
// STALE
// ============================================================

/** Znane pola docelowe z polskimi aliasami do fuzzy matchingu */
const TARGET_FIELDS_ALIASES: Record<string, string[]> = {
  'client.companyName': ['klient', 'firma', 'nazwa firmy', 'company', 'nazwa klienta', 'kontrahent'],
  'client.nip': ['nip', 'numer nip', 'tax id', 'regon'],
  'client.address': ['adres', 'address', 'ulica'],
  'client.city': ['miasto', 'city', 'miejscowość'],
  'client.postalCode': ['kod pocztowy', 'postal code', 'zip'],
  'client.contactPerson': ['osoba kontaktowa', 'kontakt', 'contact person'],
  'client.email': ['email klienta', 'client email', 'e-mail'],
  'client.phone': ['telefon', 'phone', 'tel'],
  'process.name': ['proces', 'process', 'nazwa procesu', 'linia', 'kąpiel'],
  'process.processType': ['typ procesu', 'process type', 'rodzaj', 'typ'],
  'sample.sampleCode': ['kod próbki', 'sample code', 'nr próbki', 'numer próbki', 'próbka'],
  'sample.sampleType': ['typ próbki', 'sample type', 'rodzaj próbki'],
  'sample.description': ['opis próbki', 'sample description', 'opis'],
  'sample.collectedAt': ['data pobrania', 'collection date', 'data pobrania próbki'],
  'sample.legacyCode': ['stary kod', 'legacy code', 'kod archiwalny', 'stary numer'],
  'analysis.analysisDate': ['data analizy', 'analysis date', 'data badania', 'data'],
  'analysis.notes': ['uwagi', 'notatki', 'notes', 'komentarz'],
  'analysis.legacyCode': ['stary kod analizy', 'legacy analysis code'],
  'result.parameterName': ['parametr', 'parameter', 'nazwa parametru', 'wskaźnik', 'oznaczenie'],
  'result.value': ['wynik', 'wartość', 'value', 'result', 'pomiar'],
  'result.unit': ['jednostka', 'unit', 'jedn'],
  'result.minReference': ['min', 'minimum', 'dolna granica', 'wartość min'],
  'result.maxReference': ['max', 'maksimum', 'górna granica', 'wartość max'],
};

/** Mapowanie typów procesów z polskich nazw */
const PROCESS_TYPE_MAP: Record<string, ProcessType> = {
  'cynkowanie': ProcessType.ZINC,
  'cynk': ProcessType.ZINC,
  'zinc': ProcessType.ZINC,
  'niklowanie': ProcessType.NICKEL,
  'nikiel': ProcessType.NICKEL,
  'nickel': ProcessType.NICKEL,
  'chromowanie': ProcessType.CHROME,
  'chrom': ProcessType.CHROME,
  'chrome': ProcessType.CHROME,
  'miedziowanie': ProcessType.COPPER,
  'miedź': ProcessType.COPPER,
  'copper': ProcessType.COPPER,
  'cynowanie': ProcessType.TIN,
  'cyna': ProcessType.TIN,
  'tin': ProcessType.TIN,
  'złocenie': ProcessType.GOLD,
  'złoto': ProcessType.GOLD,
  'gold': ProcessType.GOLD,
  'srebrzenie': ProcessType.SILVER,
  'srebro': ProcessType.SILVER,
  'silver': ProcessType.SILVER,
  'anodowanie': ProcessType.ANODIZING,
  'anodizing': ProcessType.ANODIZING,
  'eloksalowanie': ProcessType.ANODIZING,
  'pasywacja': ProcessType.PASSIVATION,
  'passivation': ProcessType.PASSIVATION,
  'inne': ProcessType.OTHER,
  'other': ProcessType.OTHER,
};

/** Mapowanie typów próbek */
const SAMPLE_TYPE_MAP: Record<string, SampleType> = {
  'kąpiel': SampleType.BATH,
  'kapiel': SampleType.BATH,
  'bath': SampleType.BATH,
  'roztwór': SampleType.BATH,
  'płukanie': SampleType.RINSE,
  'plukanie': SampleType.RINSE,
  'rinse': SampleType.RINSE,
  'płuczka': SampleType.RINSE,
  'ścieki': SampleType.WASTEWATER,
  'scieki': SampleType.WASTEWATER,
  'wastewater': SampleType.WASTEWATER,
  'surowiec': SampleType.RAW_MATERIAL,
  'raw_material': SampleType.RAW_MATERIAL,
  'inne': SampleType.OTHER,
  'other': SampleType.OTHER,
};

// ============================================================
// PARSOWANIE PLIKÓW
// ============================================================

/**
 * Odczytaj plik i wykryj kodowanie, zwróć treść jako UTF-8 string.
 */
function readFileWithEncoding(filePath: string): { content: string; encoding: string } {
  const rawBuffer = fs.readFileSync(filePath);

  // Wykryj kodowanie (ważne dla polskich znaków: UTF-8, Windows-1250, ISO-8859-2)
  const detected = chardet.detect(rawBuffer);
  const encoding = detected || 'utf-8';

  // Lista kodowań wspieranych przez iconv-lite
  const normalizedEncoding = normalizeEncoding(encoding);

  let content: string;
  try {
    content = iconv.decode(rawBuffer, normalizedEncoding);
  } catch {
    // Fallback do UTF-8
    content = iconv.decode(rawBuffer, 'utf-8');
  }

  // Usuń BOM jeśli istnieje
  if (content.charCodeAt(0) === 0xFEFF) {
    content = content.slice(1);
  }

  return { content, encoding: normalizedEncoding };
}

/**
 * Normalizacja nazwy kodowania do formatu akceptowanego przez iconv-lite.
 */
function normalizeEncoding(encoding: string): string {
  const lower = encoding.toLowerCase().replace(/[^a-z0-9]/g, '');

  if (lower.includes('utf8') || lower.includes('utf-8')) return 'utf-8';
  if (lower.includes('1250') || lower.includes('cp1250')) return 'windows-1250';
  if (lower.includes('88592') || lower.includes('latin2')) return 'iso-8859-2';
  if (lower.includes('1252') || lower.includes('cp1252')) return 'windows-1252';
  if (lower.includes('88591') || lower.includes('latin1')) return 'iso-8859-1';
  if (lower.includes('ascii')) return 'ascii';

  return encoding;
}

/**
 * Auto-wykrywanie separatora CSV (przecinek, średnik, tab).
 */
function detectCsvSeparator(content: string): string {
  const firstLines = content.split('\n').slice(0, 5).join('\n');

  const separators = [';', ',', '\t', '|'];
  let bestSep = ';';
  let bestCount = 0;

  for (const sep of separators) {
    const count = (firstLines.match(new RegExp(`\\${sep}`, 'g')) || []).length;
    if (count > bestCount) {
      bestCount = count;
      bestSep = sep;
    }
  }

  return bestSep;
}

/**
 * Parsuj plik CSV/TSV.
 */
export function parseCsvFile(filePath: string): ParsedFile {
  const { content, encoding } = readFileWithEncoding(filePath);
  const separator = detectCsvSeparator(content);

  const records = csvParse(content, {
    delimiter: separator,
    columns: true,
    skip_empty_lines: true,
    trim: true,
    relax_column_count: true,
    relax_quotes: true,
  }) as ParsedRow[];

  const headers = records.length > 0 ? Object.keys(records[0]) : [];

  return {
    headers,
    rows: records,
    totalRows: records.length,
    detectedEncoding: encoding,
    detectedSeparator: separator === '\t' ? 'TAB' : separator,
  };
}

/**
 * Parsuj plik Excel (.xlsx, .xls).
 */
export function parseExcelFile(filePath: string): ParsedFile {
  const workbook = XLSX.readFile(filePath, {
    type: 'file',
    cellDates: true,
    codepage: 65001, // UTF-8
  });

  // Użyj pierwszego arkusza
  const firstSheetName = workbook.SheetNames[0];
  if (!firstSheetName) {
    throw new Error('Plik Excel nie zawiera żadnych arkuszy');
  }

  const worksheet = workbook.Sheets[firstSheetName];
  const jsonData = XLSX.utils.sheet_to_json<ParsedRow>(worksheet, {
    defval: null,
    raw: false,
  });

  const headers = jsonData.length > 0 ? Object.keys(jsonData[0]) : [];

  return {
    headers,
    rows: jsonData,
    totalRows: jsonData.length,
    detectedEncoding: 'utf-8',
  };
}

/**
 * Parsuj plik JSON.
 */
export function parseJsonFile(filePath: string): ParsedFile {
  const { content, encoding } = readFileWithEncoding(filePath);
  const parsed = JSON.parse(content);

  let rows: ParsedRow[];
  if (Array.isArray(parsed)) {
    rows = parsed;
  } else if (parsed.data && Array.isArray(parsed.data)) {
    rows = parsed.data;
  } else if (parsed.records && Array.isArray(parsed.records)) {
    rows = parsed.records;
  } else {
    // Spróbuj znaleźć pierwszą tablicę w obiekcie
    const arrayKey = Object.keys(parsed).find((k) => Array.isArray(parsed[k]));
    if (arrayKey) {
      rows = parsed[arrayKey];
    } else {
      rows = [parsed];
    }
  }

  const headers = rows.length > 0 ? Object.keys(rows[0]) : [];

  return {
    headers,
    rows,
    totalRows: rows.length,
    detectedEncoding: encoding,
  };
}

/**
 * Parsuj plik XML.
 */
export async function parseXmlFile(filePath: string): Promise<ParsedFile> {
  const { content, encoding } = readFileWithEncoding(filePath);

  const result = await parseStringPromise(content, {
    explicitArray: false,
    mergeAttrs: true,
    trim: true,
  });

  // Szukaj tablicy rekordów w strukturze XML
  let rows: ParsedRow[] = [];
  const rootKey = Object.keys(result)[0];
  const root = result[rootKey];

  if (root) {
    // Szukaj pierwszej tablicy potomnych elementów
    const childKeys = Object.keys(root);
    for (const key of childKeys) {
      const child = root[key];
      if (Array.isArray(child)) {
        rows = child.map((item: any) => flattenObject(item));
        break;
      } else if (typeof child === 'object' && child !== null) {
        // Sprawdź czy obiekt zawiera tablicę
        const innerKeys = Object.keys(child);
        for (const ik of innerKeys) {
          if (Array.isArray(child[ik])) {
            rows = child[ik].map((item: any) => flattenObject(item));
            break;
          }
        }
        if (rows.length > 0) break;

        // Jeśli to pojedynczy element, potraktuj go jako jeden wiersz
        rows = [flattenObject(child)];
      }
    }

    // Jeśli root sam jest płaski - potraktuj jako jeden wiersz
    if (rows.length === 0 && typeof root === 'object') {
      rows = [flattenObject(root)];
    }
  }

  const headers = rows.length > 0 ? Object.keys(rows[0]) : [];

  return {
    headers,
    rows,
    totalRows: rows.length,
    detectedEncoding: encoding,
  };
}

/**
 * Spłaszczenie zagnieżdżonego obiektu XML do płaskiego.
 */
function flattenObject(obj: any, prefix = ''): ParsedRow {
  const result: ParsedRow = {};

  for (const key of Object.keys(obj)) {
    const fullKey = prefix ? `${prefix}.${key}` : key;
    const value = obj[key];

    if (value === null || value === undefined) {
      result[fullKey] = null;
    } else if (typeof value === 'object' && !Array.isArray(value)) {
      const nested = flattenObject(value, fullKey);
      Object.assign(result, nested);
    } else if (Array.isArray(value)) {
      // Pomijamy tablice zagnieżdżone w spłaszczeniu
      result[fullKey] = JSON.stringify(value);
    } else {
      result[fullKey] = value;
    }
  }

  return result;
}

/**
 * Parsuj plik na podstawie rozszerzenia.
 */
export async function parseFile(filePath: string, originalName: string): Promise<ParsedFile> {
  const ext = path.extname(originalName).toLowerCase();

  switch (ext) {
    case '.csv':
    case '.tsv':
      return parseCsvFile(filePath);
    case '.xlsx':
    case '.xls':
      return parseExcelFile(filePath);
    case '.json':
      return parseJsonFile(filePath);
    case '.xml':
      return await parseXmlFile(filePath);
    default:
      throw new Error(`Nieobsługiwany format pliku: ${ext}. Obsługiwane formaty: CSV, TSV, XLSX, XLS, JSON, XML`);
  }
}

// ============================================================
// AUTO-MAPOWANIE KOLUMN (FUZZY MATCHING)
// ============================================================

/**
 * Sugeruj mapowanie kolumn na podstawie fuzzy matchingu nazw.
 */
export function suggestColumnMappings(sourceHeaders: string[]): AutoMappingSuggestion[] {
  const suggestions: AutoMappingSuggestion[] = [];

  for (const header of sourceHeaders) {
    const headerLower = header.toLowerCase().trim();
    let bestMatch = '';
    let bestScore = 0;

    for (const [targetField, aliases] of Object.entries(TARGET_FIELDS_ALIASES)) {
      // Bezpośrednie porównanie z aliasami
      for (const alias of aliases) {
        const score = stringSimilarity.compareTwoStrings(headerLower, alias.toLowerCase());
        if (score > bestScore) {
          bestScore = score;
          bestMatch = targetField;
        }
      }

      // Porównanie z nazwą pola docelowego
      const fieldName = targetField.split('.').pop() || '';
      const fieldScore = stringSimilarity.compareTwoStrings(headerLower, fieldName.toLowerCase());
      if (fieldScore > bestScore) {
        bestScore = fieldScore;
        bestMatch = targetField;
      }
    }

    if (bestScore >= 0.3) {
      suggestions.push({
        sourceColumn: header,
        suggestedTarget: bestMatch,
        confidence: Math.round(bestScore * 100),
      });
    }
  }

  return suggestions;
}

// ============================================================
// TRANSFORMACJE DANYCH
// ============================================================

/**
 * Konwersja daty z różnych formatów do ISO string.
 */
function parseDate(value: string | number | null, dateFormat?: string): Date | null {
  if (value === null || value === undefined || value === '') return null;

  const str = String(value).trim();

  // Próbuj zinterpretować jako datę w różnych formatach
  const patterns: Array<{ regex: RegExp; groups: string[] }> = [
    { regex: /^(\d{4})-(\d{1,2})-(\d{1,2})/, groups: ['year', 'month', 'day'] },
    { regex: /^(\d{1,2})\.(\d{1,2})\.(\d{4})/, groups: ['day', 'month', 'year'] },
    { regex: /^(\d{1,2})\.(\d{1,2})\.(\d{2})$/, groups: ['day', 'month', 'shortYear'] },
    { regex: /^(\d{1,2})\/(\d{1,2})\/(\d{4})/, groups: ['day', 'month', 'year'] },
    { regex: /^(\d{1,2})\/(\d{1,2})\/(\d{2})$/, groups: ['day', 'month', 'shortYear'] },
    { regex: /^(\d{1,2})-(\d{1,2})-(\d{4})/, groups: ['day', 'month', 'year'] },
    { regex: /^(\d{1,2})-(\d{1,2})-(\d{2})$/, groups: ['day', 'month', 'shortYear'] },
  ];

  // Jeśli podano format, wybierz odpowiedni wzorzec
  if (dateFormat) {
    const fmt = dateFormat.toUpperCase();
    if (fmt.startsWith('YYYY')) {
      // YYYY-MM-DD - domyślna kolejność
    } else if (fmt.startsWith('DD')) {
      // DD.MM.YYYY - europejski format
    } else if (fmt.startsWith('MM')) {
      // MM/DD/YYYY - ameryka
      patterns.unshift(
        { regex: /^(\d{1,2})\/(\d{1,2})\/(\d{4})/, groups: ['month', 'day', 'year'] },
        { regex: /^(\d{1,2})\.(\d{1,2})\.(\d{4})/, groups: ['month', 'day', 'year'] },
      );
    }
  }

  for (const pattern of patterns) {
    const match = str.match(pattern.regex);
    if (match) {
      const parts: Record<string, number> = {};
      pattern.groups.forEach((g, i) => {
        parts[g] = parseInt(match[i + 1], 10);
      });

      let year = parts.year || 0;
      if (parts.shortYear !== undefined) {
        year = parts.shortYear >= 70 ? 1900 + parts.shortYear : 2000 + parts.shortYear;
      }

      const month = (parts.month || 1) - 1;
      const day = parts.day || 1;

      const date = new Date(year, month, day);
      if (!isNaN(date.getTime())) {
        return date;
      }
    }
  }

  // Ostatnia próba - natywny parser JS
  const native = new Date(str);
  if (!isNaN(native.getTime())) {
    return native;
  }

  return null;
}

/**
 * Konwersja separatora dziesiętnego (przecinek → kropka).
 */
function parseDecimalValue(value: string | number | null, decimalSeparator?: string): number | null {
  if (value === null || value === undefined || value === '') return null;

  if (typeof value === 'number') return value;

  let str = String(value).trim();

  // Usuń spacje w środku (np. "1 234,56")
  str = str.replace(/\s/g, '');

  // Zamień separator dziesiętny na kropkę
  if (decimalSeparator === ',' || str.includes(',')) {
    // Sprawdź czy jest to format "1.234,56" (europejski z separatorem tysięcy)
    if (str.includes('.') && str.includes(',') && str.lastIndexOf(',') > str.lastIndexOf('.')) {
      str = str.replace(/\./g, '').replace(',', '.');
    } else if (str.includes(',')) {
      str = str.replace(',', '.');
    }
  }

  const num = parseFloat(str);
  return isNaN(num) ? null : num;
}

/**
 * Mapuj wartość enum procesu.
 */
function mapProcessType(value: string | null, customMapping?: Record<string, string>): ProcessType {
  if (!value) return ProcessType.OTHER;

  const lower = value.toLowerCase().trim();

  // Najpierw sprawdź mapowanie niestandardowe
  if (customMapping) {
    const mapped = customMapping[lower] || customMapping[value];
    if (mapped && Object.values(ProcessType).includes(mapped as ProcessType)) {
      return mapped as ProcessType;
    }
  }

  // Wbudowane mapowanie
  return PROCESS_TYPE_MAP[lower] || ProcessType.OTHER;
}

/**
 * Mapuj wartość enum typu próbki.
 */
function mapSampleType(value: string | null, customMapping?: Record<string, string>): SampleType {
  if (!value) return SampleType.BATH;

  const lower = value.toLowerCase().trim();

  if (customMapping) {
    const mapped = customMapping[lower] || customMapping[value];
    if (mapped && Object.values(SampleType).includes(mapped as SampleType)) {
      return mapped as SampleType;
    }
  }

  return SAMPLE_TYPE_MAP[lower] || SampleType.OTHER;
}

/**
 * Pobierz wartość z wiersza na podstawie mapowania kolumny.
 */
function getRowValue(row: ParsedRow, mapping: ColumnMapping): string | number | null {
  const raw = row[mapping.sourceColumn];

  if (raw === null || raw === undefined || raw === '') {
    return mapping.defaultValue !== undefined ? mapping.defaultValue : null;
  }

  // Zastosuj transformację
  if (mapping.transformation) {
    switch (mapping.transformation) {
      case 'uppercase':
        return String(raw).toUpperCase();
      case 'lowercase':
        return String(raw).toLowerCase();
      case 'trim':
        return String(raw).trim();
      default:
        return raw;
    }
  }

  return raw;
}

// ============================================================
// GENEROWANIE KODÓW
// ============================================================

/**
 * Generuj kod importu w formacie IMP-YYYYMM-XXXX.
 */
export async function generateImportCode(): Promise<string> {
  const now = new Date();
  const yearMonth = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`;
  const prefix = `IMP-${yearMonth}-`;

  const lastJob = await prisma.importJob.findFirst({
    where: {
      importCode: { startsWith: prefix },
    },
    orderBy: { importCode: 'desc' },
  });

  let nextNumber = 1;
  if (lastJob) {
    const lastNumber = parseInt(lastJob.importCode.split('-').pop() || '0', 10);
    nextNumber = lastNumber + 1;
  }

  return `${prefix}${String(nextNumber).padStart(4, '0')}`;
}

/**
 * Generuj kod próbki w formacie PRB-YYYYMM-XXXX.
 */
async function generateSampleCode(): Promise<string> {
  const now = new Date();
  const yearMonth = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`;
  const prefix = `PRB-${yearMonth}-`;

  const lastSample = await prisma.sample.findFirst({
    where: {
      sampleCode: { startsWith: prefix },
    },
    orderBy: { sampleCode: 'desc' },
  });

  let nextNumber = 1;
  if (lastSample) {
    const lastNumber = parseInt(lastSample.sampleCode.split('-').pop() || '0', 10);
    nextNumber = lastNumber + 1;
  }

  return `${prefix}${String(nextNumber).padStart(4, '0')}`;
}

/**
 * Generuj kod analizy w formacie ANL-YYYYMM-XXXX.
 */
async function generateAnalysisCode(): Promise<string> {
  const now = new Date();
  const yearMonth = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`;
  const prefix = `ANL-${yearMonth}-`;

  const lastAnalysis = await prisma.analysis.findFirst({
    where: {
      analysisCode: { startsWith: prefix },
    },
    orderBy: { analysisCode: 'desc' },
  });

  let nextNumber = 1;
  if (lastAnalysis) {
    const lastNumber = parseInt(lastAnalysis.analysisCode.split('-').pop() || '0', 10);
    nextNumber = lastNumber + 1;
  }

  return `${prefix}${String(nextNumber).padStart(4, '0')}`;
}

// ============================================================
// WALIDACJA (DRY RUN)
// ============================================================

/**
 * Waliduj dane z mapowaniem (dry run - nie zapisuje do bazy).
 */
export async function validateImportData(
  rows: ParsedRow[],
  mappingConfig: MappingConfig
): Promise<ValidationReport> {
  const errors: ValidationError[] = [];
  let ready = 0;
  let warnings = 0;

  const { columnMappings, importType, decimalSeparator, dateFormat, skipEmptyRows } = mappingConfig;

  // Zbuduj mapę kolumn docelowych → mapowań
  const fieldMap = new Map<string, ColumnMapping>();
  for (const cm of columnMappings) {
    fieldMap.set(cm.targetField, cm);
  }

  // Zbiory do sprawdzania duplikatów
  const seenNips = new Set<string>();
  const seenLegacyCodes = new Set<string>();
  const seenSampleCodes = new Set<string>();

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const rowNum = i + 2; // +2 bo wiersz 1 to nagłówki, indeksujemy od 1
    let rowHasError = false;
    let rowHasWarning = false;

    // Sprawdź czy wiersz jest pusty
    if (skipEmptyRows !== false) {
      const allEmpty = Object.values(row).every(
        (v) => v === null || v === undefined || String(v).trim() === ''
      );
      if (allEmpty) continue;
    }

    // --- Walidacja klienta ---
    if (importType === 'FULL' || importType === 'CLIENTS_ONLY') {
      const companyMapping = fieldMap.get('client.companyName');
      if (companyMapping) {
        const val = getRowValue(row, companyMapping);
        if (!val || String(val).trim() === '') {
          errors.push({
            row: rowNum,
            column: companyMapping.sourceColumn,
            message: 'Nazwa firmy jest wymagana',
            value: val,
            severity: 'error',
          });
          rowHasError = true;
        }
      } else if (importType === 'CLIENTS_ONLY') {
        errors.push({
          row: rowNum,
          column: '-',
          message: 'Brak mapowania dla nazwy firmy (client.companyName)',
          severity: 'error',
        });
        rowHasError = true;
      }

      // NIP - sprawdź duplikaty
      const nipMapping = fieldMap.get('client.nip');
      if (nipMapping) {
        const nipVal = getRowValue(row, nipMapping);
        if (nipVal) {
          const nipStr = String(nipVal).replace(/[^0-9]/g, '');
          if (nipStr.length > 0 && nipStr.length !== 10) {
            errors.push({
              row: rowNum,
              column: nipMapping.sourceColumn,
              message: `Nieprawidłowy format NIP (oczekiwano 10 cyfr, otrzymano ${nipStr.length})`,
              value: nipVal,
              severity: 'warning',
            });
            rowHasWarning = true;
          }
          if (seenNips.has(nipStr)) {
            errors.push({
              row: rowNum,
              column: nipMapping.sourceColumn,
              message: `Duplikat NIP w importowanym pliku: ${nipStr}`,
              value: nipVal,
              severity: 'warning',
            });
            rowHasWarning = true;
          }
          if (nipStr.length > 0) {
            seenNips.add(nipStr);
          }

          // Sprawdź czy NIP istnieje już w bazie
          if (nipStr.length === 10) {
            const existing = await prisma.client.findUnique({ where: { nip: nipStr } });
            if (existing) {
              errors.push({
                row: rowNum,
                column: nipMapping.sourceColumn,
                message: `Klient z NIP ${nipStr} już istnieje w bazie (${existing.companyName}). Zostanie zaktualizowany.`,
                value: nipVal,
                severity: 'warning',
              });
              rowHasWarning = true;
            }
          }
        }
      }
    }

    // --- Walidacja próbki ---
    if (importType === 'FULL' || importType === 'SAMPLES_ONLY') {
      const legacyMapping = fieldMap.get('sample.legacyCode');
      if (legacyMapping) {
        const legacyVal = getRowValue(row, legacyMapping);
        if (legacyVal) {
          const legacyStr = String(legacyVal).trim();
          if (seenLegacyCodes.has(legacyStr)) {
            errors.push({
              row: rowNum,
              column: legacyMapping.sourceColumn,
              message: `Duplikat kodu próbki w pliku: ${legacyStr}`,
              value: legacyVal,
              severity: 'warning',
            });
            rowHasWarning = true;
          }
          seenLegacyCodes.add(legacyStr);

          // Sprawdź w bazie
          const existingSample = await prisma.sample.findFirst({ where: { legacyCode: legacyStr } });
          if (existingSample) {
            errors.push({
              row: rowNum,
              column: legacyMapping.sourceColumn,
              message: `Próbka z kodem ${legacyStr} już istnieje w bazie. Wiersz zostanie pominięty.`,
              value: legacyVal,
              severity: 'warning',
            });
            rowHasWarning = true;
          }
        }
      }

      const sampleCodeMapping = fieldMap.get('sample.sampleCode');
      if (sampleCodeMapping) {
        const scVal = getRowValue(row, sampleCodeMapping);
        if (scVal) {
          const scStr = String(scVal).trim();
          if (seenSampleCodes.has(scStr)) {
            errors.push({
              row: rowNum,
              column: sampleCodeMapping.sourceColumn,
              message: `Duplikat kodu próbki w pliku: ${scStr}`,
              value: scVal,
              severity: 'warning',
            });
            rowHasWarning = true;
          }
          seenSampleCodes.add(scStr);
        }
      }
    }

    // --- Walidacja analizy ---
    if (importType === 'FULL' || importType === 'ANALYSES_ONLY') {
      const dateMapping = fieldMap.get('analysis.analysisDate');
      if (dateMapping) {
        const dateVal = getRowValue(row, dateMapping);
        if (dateVal) {
          const parsed = parseDate(dateVal, dateFormat);
          if (!parsed) {
            errors.push({
              row: rowNum,
              column: dateMapping.sourceColumn,
              message: `Nie udało się zinterpretować daty: "${dateVal}"`,
              value: dateVal,
              severity: 'error',
            });
            rowHasError = true;
          } else if (parsed > new Date()) {
            errors.push({
              row: rowNum,
              column: dateMapping.sourceColumn,
              message: `Data analizy jest w przyszłości: "${dateVal}"`,
              value: dateVal,
              severity: 'warning',
            });
            rowHasWarning = true;
          }
        }
      }

      // Walidacja wyników numerycznych
      const valueMapping = fieldMap.get('result.value');
      if (valueMapping) {
        const numVal = getRowValue(row, valueMapping);
        if (numVal !== null && numVal !== '') {
          const parsed = parseDecimalValue(numVal, decimalSeparator);
          if (parsed === null) {
            errors.push({
              row: rowNum,
              column: valueMapping.sourceColumn,
              message: `Nie udało się zinterpretować wartości liczbowej: "${numVal}"`,
              value: numVal,
              severity: 'error',
            });
            rowHasError = true;
          }
        }
      }

      // Walidacja parametru
      const paramMapping = fieldMap.get('result.parameterName');
      if (paramMapping) {
        const paramVal = getRowValue(row, paramMapping);
        if (!paramVal || String(paramVal).trim() === '') {
          // Sprawdź czy wiersz zawiera dane wyników
          if (valueMapping && getRowValue(row, valueMapping)) {
            errors.push({
              row: rowNum,
              column: paramMapping.sourceColumn,
              message: 'Nazwa parametru jest wymagana gdy podana jest wartość wyniku',
              value: paramVal,
              severity: 'error',
            });
            rowHasError = true;
          }
        }
      }

      // Walidacja referencji min/max
      const minMapping = fieldMap.get('result.minReference');
      const maxMapping = fieldMap.get('result.maxReference');
      if (minMapping && maxMapping) {
        const minVal = parseDecimalValue(getRowValue(row, minMapping), decimalSeparator);
        const maxVal = parseDecimalValue(getRowValue(row, maxMapping), decimalSeparator);
        if (minVal !== null && maxVal !== null && minVal > maxVal) {
          errors.push({
            row: rowNum,
            column: minMapping.sourceColumn,
            message: `Wartość minimalna (${minVal}) jest większa od maksymalnej (${maxVal})`,
            value: minVal,
            severity: 'warning',
          });
          rowHasWarning = true;
        }
      }
    }

    if (rowHasError) {
      // Nie liczymy jako gotowy
    } else {
      ready++;
    }
    if (rowHasWarning) warnings++;
  }

  const errorCount = errors.filter((e) => e.severity === 'error').length;

  return {
    ready,
    warnings,
    errors,
    totalRows: rows.length,
    summary: errorCount > 0
      ? `Znaleziono ${errorCount} błędów krytycznych i ${warnings} ostrzeżeń. Napraw błędy przed importem.`
      : warnings > 0
      ? `Dane gotowe do importu z ${warnings} ostrzeżeniami. ${ready} wierszy zostanie zaimportowanych.`
      : `Wszystkie ${ready} wierszy gotowe do importu bez błędów.`,
  };
}

// ============================================================
// WYKONANIE IMPORTU
// ============================================================

/**
 * Znajdź lub utwórz klienta na podstawie NIP lub dopasowania nazwy.
 */
async function findOrCreateClient(
  tx: Prisma.TransactionClient,
  companyName: string,
  nip: string | null,
  extraData: Record<string, any>,
  userId: string,
  importJobId: string
): Promise<string> {
  // 1) Szukaj po NIP jeśli podany
  if (nip) {
    const cleanNip = nip.replace(/[^0-9]/g, '');
    if (cleanNip.length === 10) {
      const existing = await tx.client.findUnique({ where: { nip: cleanNip } });
      if (existing) {
        // Aktualizuj dane klienta jeśli są nowe
        await tx.client.update({
          where: { id: existing.id },
          data: {
            ...(extraData.address && !existing.address ? { address: extraData.address } : {}),
            ...(extraData.city && !existing.city ? { city: extraData.city } : {}),
            ...(extraData.postalCode && !existing.postalCode ? { postalCode: extraData.postalCode } : {}),
            ...(extraData.contactPerson && !existing.contactPerson ? { contactPerson: extraData.contactPerson } : {}),
            ...(extraData.email && !existing.email ? { email: extraData.email } : {}),
            ...(extraData.phone && !existing.phone ? { phone: extraData.phone } : {}),
          },
        });
        return existing.id;
      }
    }
  }

  // 2) Szukaj po nazwie firmy (fuzzy matching)
  const allClients = await tx.client.findMany({
    where: { isActive: true },
    select: { id: true, companyName: true },
  });

  if (allClients.length > 0) {
    const clientNames = allClients.map((c) => c.companyName);
    const matches = stringSimilarity.findBestMatch(companyName, clientNames);

    if (matches.bestMatch.rating >= 0.85) {
      const matchedClient = allClients[matches.bestMatchIndex];
      return matchedClient.id;
    }
  }

  // 3) Utwórz nowego klienta
  const newClient = await tx.client.create({
    data: {
      companyName: companyName.trim(),
      nip: nip ? nip.replace(/[^0-9]/g, '') || null : null,
      address: extraData.address || null,
      city: extraData.city || null,
      postalCode: extraData.postalCode || null,
      contactPerson: extraData.contactPerson || null,
      email: extraData.email || null,
      phone: extraData.phone || null,
      legacyCode: extraData.legacyCode || null,
    },
  });

  // Wpis audytowy
  await tx.auditLog.create({
    data: {
      userId,
      action: 'IMPORT_CREATE',
      entityType: 'CLIENT',
      entityId: newClient.id,
      details: { importJobId, companyName: newClient.companyName },
    },
  });

  return newClient.id;
}

/**
 * Znajdź lub utwórz proces.
 */
async function findOrCreateProcess(
  tx: Prisma.TransactionClient,
  processName: string,
  processType: ProcessType,
  clientId: string | null,
  userId: string,
  importJobId: string
): Promise<string> {
  // Szukaj istniejącego procesu
  const existing = await tx.process.findFirst({
    where: {
      name: { equals: processName, mode: 'insensitive' },
      processType,
      ...(clientId ? { clientId } : {}),
    },
  });

  if (existing) return existing.id;

  // Utwórz nowy
  const newProcess = await tx.process.create({
    data: {
      name: processName.trim(),
      processType,
      clientId,
    },
  });

  await tx.auditLog.create({
    data: {
      userId,
      action: 'IMPORT_CREATE',
      entityType: 'PROCESS',
      entityId: newProcess.id,
      details: { importJobId, name: newProcess.name, processType },
    },
  });

  return newProcess.id;
}

/**
 * Oblicz odchylenie od zakresu referencyjnego.
 */
function calculateDeviation(value: number, min: number | null, max: number | null): { deviation: Deviation; deviationPercent: number | null } {
  if (min === null && max === null) {
    return { deviation: Deviation.WITHIN_RANGE, deviationPercent: null };
  }

  if (min !== null && max !== null) {
    const range = max - min;
    const optimal = (min + max) / 2;

    if (value < min) {
      const diff = min - value;
      const percent = range > 0 ? (diff / range) * 100 : 0;
      return {
        deviation: percent > 50 ? Deviation.CRITICAL_LOW : Deviation.BELOW_MIN,
        deviationPercent: -percent,
      };
    }

    if (value > max) {
      const diff = value - max;
      const percent = range > 0 ? (diff / range) * 100 : 0;
      return {
        deviation: percent > 50 ? Deviation.CRITICAL_HIGH : Deviation.ABOVE_MAX,
        deviationPercent: percent,
      };
    }

    const deviationPercent = optimal !== 0 ? ((value - optimal) / optimal) * 100 : 0;
    return { deviation: Deviation.WITHIN_RANGE, deviationPercent };
  }

  if (min !== null && value < min) {
    return { deviation: Deviation.BELOW_MIN, deviationPercent: null };
  }

  if (max !== null && value > max) {
    return { deviation: Deviation.ABOVE_MAX, deviationPercent: null };
  }

  return { deviation: Deviation.WITHIN_RANGE, deviationPercent: null };
}

/**
 * Wykonaj import danych do bazy w transakcji.
 */
export async function executeImport(
  importJobId: string,
  rows: ParsedRow[],
  mappingConfig: MappingConfig,
  userId: string
): Promise<ImportProgress> {
  const progress: ImportProgress = {
    totalRecords: rows.length,
    importedRecords: 0,
    skippedRecords: 0,
    errorRecords: 0,
    errors: [],
  };

  const { columnMappings, importType, decimalSeparator, dateFormat, enumMappings } = mappingConfig;

  // Zbuduj mapę pól
  const fieldMap = new Map<string, ColumnMapping>();
  for (const cm of columnMappings) {
    fieldMap.set(cm.targetField, cm);
  }

  // Zaktualizuj status na IMPORTING
  await prisma.importJob.update({
    where: { id: importJobId },
    data: { status: ImportStatus.IMPORTING, startedAt: new Date() },
  });

  // Licznik kodów dla generowania w trakcie transakcji
  let sampleCodeCounter = 0;
  let analysisCodeCounter = 0;

  // Pobierz aktualne najwyższe numery kodów raz
  const now = new Date();
  const yearMonth = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`;

  const lastSample = await prisma.sample.findFirst({
    where: { sampleCode: { startsWith: `PRB-${yearMonth}-` } },
    orderBy: { sampleCode: 'desc' },
  });
  let sampleBaseNumber = lastSample
    ? parseInt(lastSample.sampleCode.split('-').pop() || '0', 10)
    : 0;

  const lastAnalysis = await prisma.analysis.findFirst({
    where: { analysisCode: { startsWith: `ANL-${yearMonth}-` } },
    orderBy: { analysisCode: 'desc' },
  });
  let analysisBaseNumber = lastAnalysis
    ? parseInt(lastAnalysis.analysisCode.split('-').pop() || '0', 10)
    : 0;

  try {
    await prisma.$transaction(async (tx) => {
      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        const rowNum = i + 2;

        try {
          // Sprawdź czy wiersz jest pusty
          const allEmpty = Object.values(row).every(
            (v) => v === null || v === undefined || String(v).trim() === ''
          );
          if (allEmpty) {
            progress.skippedRecords++;
            continue;
          }

          let clientId: string | null = null;
          let processId: string | null = null;
          let sampleId: string | null = null;
          let analysisId: string | null = null;

          // ========= KLIENT =========
          if (importType === 'FULL' || importType === 'CLIENTS_ONLY') {
            const companyMapping = fieldMap.get('client.companyName');
            if (companyMapping) {
              const companyName = getRowValue(row, companyMapping);
              if (companyName && String(companyName).trim()) {
                const nipMapping = fieldMap.get('client.nip');
                const nipVal = nipMapping ? getRowValue(row, nipMapping) : null;

                const extraData: Record<string, any> = {};
                for (const [field, mapping] of fieldMap) {
                  if (field.startsWith('client.') && field !== 'client.companyName' && field !== 'client.nip') {
                    const key = field.replace('client.', '');
                    extraData[key] = getRowValue(row, mapping);
                  }
                }

                clientId = await findOrCreateClient(
                  tx,
                  String(companyName).trim(),
                  nipVal ? String(nipVal) : null,
                  extraData,
                  userId,
                  importJobId
                );
              }
            }
          }

          // ========= PROCES =========
          if (importType === 'FULL' || importType === 'PROCESSES_ONLY') {
            const processMapping = fieldMap.get('process.name');
            const processTypeMapping = fieldMap.get('process.processType');

            if (processMapping) {
              const processName = getRowValue(row, processMapping);
              if (processName && String(processName).trim()) {
                const processTypeVal = processTypeMapping
                  ? getRowValue(row, processTypeMapping)
                  : null;
                const processType = mapProcessType(
                  processTypeVal ? String(processTypeVal) : null,
                  enumMappings?.processType
                );

                processId = await findOrCreateProcess(
                  tx,
                  String(processName).trim(),
                  processType,
                  clientId,
                  userId,
                  importJobId
                );
              }
            }
          }

          // ========= PRÓBKA =========
          if ((importType === 'FULL' || importType === 'SAMPLES_ONLY') && (clientId || importType === 'SAMPLES_ONLY')) {
            // Sprawdź duplikat po legacyCode
            const legacyMapping = fieldMap.get('sample.legacyCode');
            const sampleCodeMapping = fieldMap.get('sample.sampleCode');

            let existingSampleId: string | null = null;

            if (legacyMapping) {
              const legacyVal = getRowValue(row, legacyMapping);
              if (legacyVal) {
                const existingSample = await tx.sample.findFirst({
                  where: { legacyCode: String(legacyVal).trim() },
                });
                if (existingSample) {
                  existingSampleId = existingSample.id;
                  sampleId = existingSample.id;
                  // Przeskocz tworzenie próbki - dodaj analizę do istniejącej
                }
              }
            }

            if (!existingSampleId) {
              // Potrzebujemy clientId i processId
              if (!clientId && importType === 'SAMPLES_ONLY') {
                // Spróbuj pobrać ID z pierwszego aktywnego klienta
                const firstClient = await tx.client.findFirst({ where: { isActive: true } });
                if (firstClient) clientId = firstClient.id;
              }

              if (!processId) {
                // Spróbuj pobrać ID z pierwszego aktywnego procesu
                const firstProcess = await tx.process.findFirst({ where: { isActive: true } });
                if (firstProcess) processId = firstProcess.id;
              }

              if (clientId && processId) {
                sampleCodeCounter++;
                const sampleCode = `PRB-${yearMonth}-${String(sampleBaseNumber + sampleCodeCounter).padStart(4, '0')}`;

                const legacyCode = legacyMapping
                  ? getRowValue(row, legacyMapping)
                  : (sampleCodeMapping ? getRowValue(row, sampleCodeMapping) : null);

                const collectedAtMapping = fieldMap.get('sample.collectedAt');
                const collectedAt = collectedAtMapping
                  ? parseDate(getRowValue(row, collectedAtMapping), dateFormat)
                  : new Date();

                const sampleTypeMapping = fieldMap.get('sample.sampleType');
                const sampleTypeVal = sampleTypeMapping
                  ? getRowValue(row, sampleTypeMapping)
                  : null;
                const sampleType = mapSampleType(
                  sampleTypeVal ? String(sampleTypeVal) : null,
                  enumMappings?.sampleType
                );

                const descMapping = fieldMap.get('sample.description');
                const description = descMapping ? getRowValue(row, descMapping) : null;

                const newSample = await tx.sample.create({
                  data: {
                    sampleCode,
                    clientId,
                    processId,
                    collectedAt: collectedAt || new Date(),
                    sampleType,
                    description: description ? String(description) : null,
                    status: SampleStatus.COMPLETED,
                    legacyCode: legacyCode ? String(legacyCode).trim() : null,
                  },
                });

                sampleId = newSample.id;

                await tx.auditLog.create({
                  data: {
                    userId,
                    action: 'IMPORT_CREATE',
                    entityType: 'SAMPLE',
                    entityId: newSample.id,
                    details: { importJobId, sampleCode, legacyCode },
                  },
                });
              }
            }
          }

          // ========= ANALIZA I WYNIKI =========
          if ((importType === 'FULL' || importType === 'ANALYSES_ONLY') && sampleId) {
            const dateMapping = fieldMap.get('analysis.analysisDate');
            const analysisDate = dateMapping
              ? parseDate(getRowValue(row, dateMapping), dateFormat)
              : new Date();

            const notesMapping = fieldMap.get('analysis.notes');
            const notes = notesMapping ? getRowValue(row, notesMapping) : null;

            const legacyAnalysisMapping = fieldMap.get('analysis.legacyCode');
            const analysisLegacyCode = legacyAnalysisMapping
              ? getRowValue(row, legacyAnalysisMapping)
              : null;

            // Sprawdź czy mamy dane wyników do importu
            const paramMapping = fieldMap.get('result.parameterName');
            const valueMapping = fieldMap.get('result.value');

            const hasResultData = paramMapping && valueMapping &&
              getRowValue(row, paramMapping) && getRowValue(row, valueMapping) !== null;

            if (hasResultData || notes) {
              analysisCodeCounter++;
              const analysisCode = `ANL-${yearMonth}-${String(analysisBaseNumber + analysisCodeCounter).padStart(4, '0')}`;

              const newAnalysis = await tx.analysis.create({
                data: {
                  analysisCode,
                  sampleId,
                  performedBy: userId,
                  analysisDate: analysisDate || new Date(),
                  status: AnalysisStatus.COMPLETED,
                  notes: notes ? String(notes) : null,
                  legacyCode: analysisLegacyCode ? String(analysisLegacyCode).trim() : null,
                },
              });

              analysisId = newAnalysis.id;

              await tx.auditLog.create({
                data: {
                  userId,
                  action: 'IMPORT_CREATE',
                  entityType: 'ANALYSIS',
                  entityId: newAnalysis.id,
                  details: { importJobId, analysisCode, sampleId },
                },
              });

              // ========= WYNIKI ANALIZY =========
              if (paramMapping && valueMapping) {
                const paramVal = getRowValue(row, paramMapping);
                const numVal = getRowValue(row, valueMapping);

                if (paramVal && numVal !== null) {
                  const paramName = String(paramVal).trim();
                  const value = parseDecimalValue(numVal, decimalSeparator);

                  if (value !== null) {
                    const unitMapping = fieldMap.get('result.unit');
                    const unit = unitMapping ? String(getRowValue(row, unitMapping) || 'mg/l') : 'mg/l';

                    const minMapping = fieldMap.get('result.minReference');
                    const maxMapping = fieldMap.get('result.maxReference');
                    const optimalMapping = fieldMap.get('result.optimalReference');

                    const minRef = minMapping ? parseDecimalValue(getRowValue(row, minMapping), decimalSeparator) : null;
                    const maxRef = maxMapping ? parseDecimalValue(getRowValue(row, maxMapping), decimalSeparator) : null;
                    const optimalRef = optimalMapping ? parseDecimalValue(getRowValue(row, optimalMapping), decimalSeparator) : null;

                    const { deviation, deviationPercent } = calculateDeviation(value, minRef, maxRef);

                    const newResult = await tx.analysisResult.create({
                      data: {
                        analysisId: newAnalysis.id,
                        parameterName: paramName,
                        unit,
                        value: new Prisma.Decimal(value),
                        minReference: minRef !== null ? new Prisma.Decimal(minRef) : null,
                        maxReference: maxRef !== null ? new Prisma.Decimal(maxRef) : null,
                        optimalReference: optimalRef !== null ? new Prisma.Decimal(optimalRef) : null,
                        deviation,
                        deviationPercent: deviationPercent !== null ? new Prisma.Decimal(deviationPercent) : null,
                      },
                    });

                    await tx.auditLog.create({
                      data: {
                        userId,
                        action: 'IMPORT_CREATE',
                        entityType: 'ANALYSIS_RESULT',
                        entityId: newResult.id,
                        details: { importJobId, analysisId: newAnalysis.id, parameterName: paramName, value },
                      },
                    });
                  }
                }
              }
            }
          }

          progress.importedRecords++;
        } catch (rowError: any) {
          progress.errorRecords++;
          progress.errors.push({
            row: rowNum,
            column: '-',
            message: `Błąd importu wiersza: ${rowError.message || 'Nieznany błąd'}`,
            severity: 'error',
          });

          // Dla transakcji - jeśli jest błąd, rzuć wyjątek aby wycofać
          // Ale najpierw spróbujemy kontynuować (skip wiersz)
          // Hmm - w transakcji Prisma nie można "skip" - albo wszystko albo nic.
          // Tutaj robimy podejście: kontynuujemy, a na końcu raportujemy.
          // Jeśli za dużo błędów - przerwij
          if (progress.errorRecords > Math.max(10, rows.length * 0.1)) {
            throw new Error(
              `Za dużo błędów importu (${progress.errorRecords}). Import przerwany. Ostatni błąd: ${rowError.message}`
            );
          }
        }
      }
    }, {
      maxWait: 60000,
      timeout: 300000, // 5 minut
    });

    // Zaktualizuj status na COMPLETED lub PARTIALLY_COMPLETED
    const finalStatus = progress.errorRecords > 0
      ? ImportStatus.PARTIALLY_COMPLETED
      : ImportStatus.COMPLETED;

    await prisma.importJob.update({
      where: { id: importJobId },
      data: {
        status: finalStatus,
        totalRecords: progress.totalRecords,
        importedRecords: progress.importedRecords,
        skippedRecords: progress.skippedRecords,
        errorRecords: progress.errorRecords,
        validationErrors: progress.errors.length > 0 ? progress.errors as any : null,
        completedAt: new Date(),
      },
    });

    // Wpis audytowy podsumowania
    await prisma.auditLog.create({
      data: {
        userId,
        action: 'IMPORT_COMPLETE',
        entityType: 'IMPORT_JOB',
        entityId: importJobId,
        details: {
          status: finalStatus,
          totalRecords: progress.totalRecords,
          importedRecords: progress.importedRecords,
          skippedRecords: progress.skippedRecords,
          errorRecords: progress.errorRecords,
        },
      },
    });
  } catch (error: any) {
    // Import nie powiódł się
    await prisma.importJob.update({
      where: { id: importJobId },
      data: {
        status: ImportStatus.FAILED,
        totalRecords: progress.totalRecords,
        importedRecords: progress.importedRecords,
        skippedRecords: progress.skippedRecords,
        errorRecords: progress.errorRecords,
        validationErrors: [
          ...progress.errors,
          { row: 0, column: '-', message: error.message, severity: 'error' },
        ] as any,
        completedAt: new Date(),
      },
    });

    await prisma.auditLog.create({
      data: {
        userId,
        action: 'IMPORT_FAILED',
        entityType: 'IMPORT_JOB',
        entityId: importJobId,
        details: { error: error.message },
      },
    });

    throw error;
  }

  return progress;
}

// ============================================================
// ROLLBACK
// ============================================================

/**
 * Wycofaj import - usuń wszystkie encje utworzone przez dany ImportJob.
 */
export async function rollbackImport(importJobId: string, userId: string): Promise<{
  deleted: Record<string, number>;
}> {
  // Sprawdź czy job istnieje
  const job = await prisma.importJob.findUnique({ where: { id: importJobId } });
  if (!job) {
    throw new Error('Nie znaleziono zadania importu o podanym ID');
  }

  if (job.status !== ImportStatus.COMPLETED && job.status !== ImportStatus.PARTIALLY_COMPLETED) {
    throw new Error(`Nie można wycofać importu o statusie: ${job.status}. Tylko zakończone importy mogą być wycofane.`);
  }

  // Pobierz wszystkie wpisy audytowe dla tego importu (IMPORT_CREATE)
  const auditLogs = await prisma.auditLog.findMany({
    where: {
      action: 'IMPORT_CREATE',
      details: {
        path: ['importJobId'],
        equals: importJobId,
      },
    },
    orderBy: { createdAt: 'desc' }, // Odwrotna kolejność - usuwamy od końca
  });

  const deleted: Record<string, number> = {
    ANALYSIS_RESULT: 0,
    ANALYSIS: 0,
    SAMPLE: 0,
    PROCESS: 0,
    CLIENT: 0,
  };

  // Grupuj po typie encji i zachowaj kolejność usuwania
  const entityOrder: string[] = ['ANALYSIS_RESULT', 'ANALYSIS', 'SAMPLE', 'PROCESS', 'CLIENT'];

  await prisma.$transaction(async (tx) => {
    for (const entityType of entityOrder) {
      const logsForType = auditLogs.filter((l) => l.entityType === entityType);

      for (const log of logsForType) {
        if (!log.entityId) continue;

        try {
          switch (entityType) {
            case 'ANALYSIS_RESULT':
              await tx.analysisResult.delete({ where: { id: log.entityId } });
              deleted.ANALYSIS_RESULT++;
              break;
            case 'ANALYSIS':
              // Najpierw usuń wyniki (cascade powinno zadziałać, ale na wszelki wypadek)
              await tx.analysisResult.deleteMany({ where: { analysisId: log.entityId } });
              await tx.recommendation.deleteMany({ where: { analysisId: log.entityId } });
              await tx.analysis.delete({ where: { id: log.entityId } });
              deleted.ANALYSIS++;
              break;
            case 'SAMPLE':
              // Sprawdź czy próbka nie ma analiz stworzonych poza importem
              const otherAnalyses = await tx.analysis.findFirst({
                where: {
                  sampleId: log.entityId,
                  NOT: {
                    id: {
                      in: logsForType
                        .filter((l) => l.entityType === 'ANALYSIS' && l.entityId)
                        .map((l) => l.entityId!),
                    },
                  },
                },
              });

              if (!otherAnalyses) {
                await tx.sample.delete({ where: { id: log.entityId } });
                deleted.SAMPLE++;
              }
              break;
            case 'PROCESS':
              // Sprawdź czy proces nie ma próbek spoza importu
              const otherSamples = await tx.sample.findFirst({
                where: { processId: log.entityId },
              });
              if (!otherSamples) {
                await tx.processParameter.deleteMany({ where: { processId: log.entityId } });
                await tx.process.delete({ where: { id: log.entityId } });
                deleted.PROCESS++;
              }
              break;
            case 'CLIENT':
              // Sprawdź czy klient nie ma próbek lub procesów spoza importu
              const clientSamples = await tx.sample.findFirst({
                where: { clientId: log.entityId },
              });
              const clientProcesses = await tx.process.findFirst({
                where: { clientId: log.entityId },
              });
              if (!clientSamples && !clientProcesses) {
                await tx.client.delete({ where: { id: log.entityId } });
                deleted.CLIENT++;
              }
              break;
          }
        } catch (deleteError: any) {
          // Jeśli encja już nie istnieje, kontynuuj
          if (deleteError.code !== 'P2025') {
            console.error(`Błąd usuwania ${entityType} ${log.entityId}:`, deleteError.message);
          }
        }
      }
    }

    // Zaktualizuj status ImportJob
    await tx.importJob.update({
      where: { id: importJobId },
      data: {
        status: ImportStatus.FAILED, // Oznacz jako cofnięty
        notes: `Import wycofany przez użytkownika. Usunięto: ${JSON.stringify(deleted)}`,
      },
    });

    // Wpis audytowy
    await tx.auditLog.create({
      data: {
        userId,
        action: 'IMPORT_ROLLBACK',
        entityType: 'IMPORT_JOB',
        entityId: importJobId,
        details: { deleted },
      },
    });
  }, {
    maxWait: 60000,
    timeout: 300000,
  });

  return { deleted };
}

// ============================================================
// SZABLONY IMPORTU
// ============================================================

/**
 * Pobierz listę szablonów importu.
 */
export async function getImportTemplates(userId: string): Promise<any[]> {
  const templates = await prisma.importTemplate.findMany({
    where: {
      OR: [
        { createdBy: userId },
        { isPublic: true },
      ],
    },
    orderBy: { updatedAt: 'desc' },
  });

  return templates;
}

/**
 * Utwórz szablon importu.
 */
export async function createImportTemplate(
  name: string,
  description: string | null,
  mappingConfig: MappingConfig,
  sourceSystem: string | null,
  isPublic: boolean,
  userId: string
): Promise<any> {
  const template = await prisma.importTemplate.create({
    data: {
      name,
      description,
      mappingConfig: mappingConfig as any,
      sourceSystem,
      isPublic,
      createdBy: userId,
    },
  });

  return template;
}

// ============================================================
// ZADANIA IMPORTU
// ============================================================

/**
 * Pobierz listę zadań importu z paginacją.
 */
export async function getImportJobs(
  page: number = 1,
  limit: number = 20,
  status?: ImportStatus
): Promise<{ jobs: any[]; total: number; page: number; totalPages: number }> {
  const where: Prisma.ImportJobWhereInput = status ? { status } : {};

  const [jobs, total] = await Promise.all([
    prisma.importJob.findMany({
      where,
      include: {
        importer: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
      },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.importJob.count({ where }),
  ]);

  return {
    jobs,
    total,
    page,
    totalPages: Math.ceil(total / limit),
  };
}

/**
 * Pobierz szczegóły zadania importu.
 */
export async function getImportJobById(id: string): Promise<any> {
  const job = await prisma.importJob.findUnique({
    where: { id },
    include: {
      importer: {
        select: { id: true, firstName: true, lastName: true, email: true },
      },
    },
  });

  if (!job) {
    throw new Error('Nie znaleziono zadania importu o podanym ID');
  }

  // Pobierz powiązane wpisy audytowe
  const auditLogs = await prisma.auditLog.findMany({
    where: {
      action: { startsWith: 'IMPORT_' },
      details: {
        path: ['importJobId'],
        equals: id,
      },
    },
    orderBy: { createdAt: 'desc' },
    take: 100,
  });

  // Policz utworzone encje
  const createdEntities: Record<string, number> = {};
  for (const log of auditLogs) {
    if (log.action === 'IMPORT_CREATE') {
      createdEntities[log.entityType] = (createdEntities[log.entityType] || 0) + 1;
    }
  }

  return {
    ...job,
    createdEntities,
    recentAuditLogs: auditLogs.slice(0, 20),
  };
}
