import { parseStringPromise } from 'xml2js';

const GUS_NAMESPACE = 'http://CIS/BIR/PUBL/2014/07';
const GUS_DATA_CONTRACT_NAMESPACE = 'http://CIS/BIR/PUBL/2014/07/DataContract';
const DEFAULT_GUS_URL = 'https://wyszukiwarkaregontest.stat.gov.pl/wsBIR/UslugaBIRzewnPubl.svc';
const DEFAULT_TIMEOUT_MS = 12000;

interface GusSearchRecord {
  regon?: string;
  nip?: string;
  krs?: string;
  type?: string;
  silosId?: string;
}

interface GusAddress {
  street?: string;
  buildingNumber?: string;
  apartmentNumber?: string;
  postalCode?: string;
  city?: string;
}

export interface GusCompanyData {
  companyName: string;
  nip: string;
  address?: string;
  city?: string;
  postalCode?: string;
  country: string;
  regon?: string;
  krs?: string;
  type?: string;
  silosId?: string;
}

interface GusLookupResult {
  record: GusSearchRecord;
  data: GusCompanyData;
}

let sessionId: string | null = null;
let sessionValidUntil = 0;

function localName(key: string): string {
  const idx = key.indexOf(':');
  return idx >= 0 ? key.slice(idx + 1) : key;
}

function buildSoapEnvelope(methodName: string, bodyInnerXml: string): string {
  return [
    '<?xml version="1.0" encoding="utf-8"?>',
    `<soap:Envelope xmlns:soap="http://www.w3.org/2003/05/soap-envelope" xmlns:ns="${GUS_NAMESPACE}" xmlns:dat="${GUS_DATA_CONTRACT_NAMESPACE}">`,
    '  <soap:Header xmlns:wsa="http://www.w3.org/2005/08/addressing">',
    `    <wsa:Action>${GUS_NAMESPACE}/IUslugaBIRzewnPubl/${methodName}</wsa:Action>`,
    `    <wsa:To>${getGusUrl()}</wsa:To>`,
    '  </soap:Header>',
    '  <soap:Body>',
    `    <ns:${methodName}>`,
    bodyInnerXml,
    `    </ns:${methodName}>`,
    '  </soap:Body>',
    '</soap:Envelope>',
  ].join('\n');
}

function getGusUrl(): string {
  return process.env.GUS_BIR_URL || DEFAULT_GUS_URL;
}

function getGusKey(): string {
  return process.env.GUS_BIR_KEY || 'abcde12345abcde12345';
}

function getTimeoutMs(): number {
  const raw = process.env.GUS_TIMEOUT_MS;
  const parsed = raw ? parseInt(raw, 10) : NaN;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_TIMEOUT_MS;
}

function isEnabled(): boolean {
  const flag = (process.env.GUS_ENABLED || 'true').toLowerCase();
  return !['0', 'false', 'no', 'off'].includes(flag);
}

async function parseXml(xml: string): Promise<any> {
  return parseStringPromise(xml, {
    explicitArray: false,
    trim: true,
    explicitRoot: true,
    mergeAttrs: true,
  });
}

function extractSoapEnvelope(rawBody: string): string {
  if (!rawBody) return rawBody;

  const envelopeMatch = rawBody.match(/<[^>]*Envelope[\s\S]*<\/[^>]*Envelope>/i);
  if (envelopeMatch && envelopeMatch[0]) {
    return envelopeMatch[0];
  }

  return rawBody;
}

function findNodeByLocalName(node: any, targetName: string): any {
  if (node == null) return undefined;
  if (typeof node !== 'object') return undefined;

  for (const [key, value] of Object.entries(node)) {
    if (localName(key) === targetName) return value;
  }

  for (const value of Object.values(node)) {
    if (Array.isArray(value)) {
      for (const item of value) {
        const found = findNodeByLocalName(item, targetName);
        if (found !== undefined) return found;
      }
    } else if (typeof value === 'object' && value !== null) {
      const found = findNodeByLocalName(value, targetName);
      if (found !== undefined) return found;
    }
  }

  return undefined;
}

function deepCollectObjects(node: any, out: any[] = []): any[] {
  if (node == null) return out;
  if (Array.isArray(node)) {
    node.forEach((entry) => deepCollectObjects(entry, out));
    return out;
  }
  if (typeof node !== 'object') return out;
  out.push(node);
  Object.values(node).forEach((value) => deepCollectObjects(value, out));
  return out;
}

function readText(obj: any, keyCandidates: string[]): string | undefined {
  if (!obj || typeof obj !== 'object') return undefined;

  const byLocalName = new Map<string, string>();
  for (const [key, value] of Object.entries(obj)) {
    if (value == null) continue;
    if (typeof value === 'string') {
      byLocalName.set(localName(key), value.trim());
    } else if (typeof value === 'number') {
      byLocalName.set(localName(key), String(value));
    }
  }

  for (const candidate of keyCandidates) {
    const val = byLocalName.get(candidate);
    if (val) return val;
  }
  return undefined;
}

function normalizeAddress(address: GusAddress): string | undefined {
  const streetParts = [address.street, address.buildingNumber, address.apartmentNumber ? `/${address.apartmentNumber}` : '']
    .filter(Boolean)
    .join(' ')
    .replace(/\s+\/\s+/g, '/')
    .trim();

  return streetParts || undefined;
}

function pickReportName(record: GusSearchRecord): string | null {
  const type = (record.type || '').toUpperCase();
  const silosId = `${record.silosId || ''}`;

  if (type === 'P' && silosId === '6') return 'BIR12OsPrawna';
  if (type === 'F' && silosId === '1') return 'BIR12OsFizycznaDzialalnoscCeidg';
  if (type === 'F' && silosId === '2') return 'BIR12OsFizycznaDzialalnoscRolnicza';
  if (type === 'F' && silosId === '3') return 'BIR12OsFizycznaDzialalnoscPozostala';
  if (type === 'F') return 'BIR12OsFizycznaDzialalnoscCeidg';

  return null;
}

async function callSoapMethod(methodName: string, bodyInnerXml: string, sid?: string): Promise<string> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), getTimeoutMs());

  try {
    const response = await fetch(getGusUrl(), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/soap+xml; charset=utf-8',
        ...(sid ? { sid } : {}),
      },
      body: buildSoapEnvelope(methodName, bodyInnerXml),
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`BIR request failed with status ${response.status}`);
    }

    const raw = await response.text();
    const xml = extractSoapEnvelope(raw);
    const parsed = await parseXml(xml);
    const resultNode = findNodeByLocalName(parsed, `${methodName}Result`);
    if (typeof resultNode === 'string') {
      return resultNode.trim();
    }

    return '';
  } finally {
    clearTimeout(timeout);
  }
}

async function ensureSession(): Promise<string> {
  const now = Date.now();
  if (sessionId && now < sessionValidUntil) {
    return sessionId;
  }

  const sid = await callSoapMethod('Zaloguj', `<ns:pKluczUzytkownika>${getGusKey()}</ns:pKluczUzytkownika>`);
  if (!sid) {
    throw new Error('Nie udało się uzyskać sesji GUS BIR');
  }

  sessionId = sid;
  sessionValidUntil = now + 55 * 60 * 1000;
  return sid;
}

async function callWithSession(methodName: string, bodyInnerXml: string): Promise<string> {
  let sid = await ensureSession();
  let result = await callSoapMethod(methodName, bodyInnerXml, sid);

  if (result) return result;

  // Retry once with refreshed session (common when sid expires).
  sessionId = null;
  sessionValidUntil = 0;
  sid = await ensureSession();
  result = await callSoapMethod(methodName, bodyInnerXml, sid);
  return result;
}

function mapSearchRecord(row: any): GusSearchRecord {
  return {
    regon: readText(row, ['Regon', 'regon']),
    nip: readText(row, ['Nip', 'nip']),
    krs: readText(row, ['Krs', 'krs']),
    type: readText(row, ['Typ', 'typ']),
    silosId: readText(row, ['SilosID', 'silos', 'SilosId']),
  };
}

function mapReportAddress(row: any): GusAddress {
  return {
    street: readText(row, ['praw_adSiedzUlica_Nazwa', 'praw_adSiedzUlica', 'fiz_adSiedzUlica_Nazwa', 'fiz_adSiedzUlica']),
    buildingNumber: readText(row, ['praw_adSiedzNumerNieruchomosci', 'fiz_adSiedzNumerNieruchomosci']),
    apartmentNumber: readText(row, ['praw_adSiedzNumerLokalu', 'fiz_adSiedzNumerLokalu']),
    postalCode: readText(row, ['praw_adSiedzKodPocztowy', 'fiz_adSiedzKodPocztowy']),
    city: readText(row, ['praw_adSiedzMiejscowoscPoczty_Nazwa', 'praw_adSiedzMiejscowosc_Nazwa', 'fiz_adSiedzMiejscowoscPoczty_Nazwa', 'fiz_adSiedzMiejscowosc_Nazwa']),
  };
}

function mapCompanyName(primaryRow: any, fallbackRow?: any): string | undefined {
  return (
    readText(primaryRow, ['praw_nazwa', 'fiz_nazwa', 'fiz_nazwaSkrocona']) ||
    readText(fallbackRow, ['fiz_nazwa', 'fiz_nazwaSkrocona', 'praw_nazwa'])
  );
}

async function parseEmbeddedRows(xmlPayload: string): Promise<any[]> {
  if (!xmlPayload || !xmlPayload.trim()) return [];
  try {
    const parsed = await parseXml(xmlPayload);
    const candidates = deepCollectObjects(parsed);
    return candidates.filter((obj) => {
      const keys = Object.keys(obj).map(localName);
      const joined = keys.join('|');
      return (
        keys.includes('Regon') ||
        keys.includes('Nip') ||
        keys.includes('Typ') ||
        keys.includes('praw_nazwa') ||
        keys.includes('fiz_nazwa') ||
        joined.includes('_adSiedz')
      );
    });
  } catch {
    return [];
  }
}

async function searchByNip(nip: string): Promise<GusSearchRecord[]> {
  const searchResult = await callWithSession(
    'DaneSzukajPodmioty',
    `<ns:pParametryWyszukiwania><dat:Nip>${nip}</dat:Nip></ns:pParametryWyszukiwania>`
  );

  if (!searchResult) return [];
  const rows = await parseEmbeddedRows(searchResult);
  return rows.map(mapSearchRecord).filter((r) => !!(r.regon || r.nip));
}

async function fetchReport(regon: string, reportName: string): Promise<any | null> {
  const reportResult = await callWithSession(
    'DanePobierzPelnyRaport',
    `<ns:pRegon>${regon}</ns:pRegon><ns:pNazwaRaportu>${reportName}</ns:pNazwaRaportu>`
  );
  if (!reportResult) return null;

  const rows = await parseEmbeddedRows(reportResult);
  if (!rows.length) return null;
  return rows[0];
}

export async function lookupCompanyByNipInGus(rawNip: string): Promise<GusLookupResult | null> {
  if (!isEnabled()) {
    throw new Error('Integracja GUS jest wyłączona');
  }

  const nip = rawNip.replace(/\D/g, '');
  const records = await searchByNip(nip);
  if (!records.length) return null;

  const selected = records[0];
  if (!selected.regon) return null;

  const reportName = pickReportName(selected);
  if (!reportName) return null;

  const primaryReport = await fetchReport(selected.regon, reportName);
  if (!primaryReport) return null;

  const fallbackReport = selected.type?.toUpperCase() === 'F'
    ? await fetchReport(selected.regon, 'BIR12OsFizycznaDaneOgolne')
    : null;

  const address = mapReportAddress(primaryReport);
  const companyName = mapCompanyName(primaryReport, fallbackReport || undefined);

  if (!companyName) return null;

  const mapped: GusCompanyData = {
    companyName,
    nip,
    address: normalizeAddress(address),
    city: address.city,
    postalCode: address.postalCode,
    country: 'Polska',
    regon: selected.regon,
    krs: selected.krs,
    type: selected.type,
    silosId: selected.silosId,
  };

  return {
    record: selected,
    data: mapped,
  };
}
