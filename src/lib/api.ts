import {
  assessConsumerReadiness,
  buildConsumerBriefMarkdown,
  canonicalizeDossierPayload,
  exportReceiptAuditCsv,
  formatSafeCsvCell,
} from '../core/index.ts';
import type { AssessmentInput, AssessmentResult } from '../core/types.ts';
import { withBase } from './basePath.ts';
import type { Locale } from './i18n.ts';

export type ApiMode = 'server' | 'local';

export interface ConsumerDossierRecord {
  id: number | string;
  profileId: number | string | null;
  dossierCode: string;
  title: string;
  merchantName: string;
  tradeTrn: string;
  channel: AssessmentInput['channel'];
  penaltyTierCode: AssessmentResult['obligations']['penaltyTierCode'];
  projectedMinFineAed: number;
  projectedMaxFineAed: number;
  temporaryClosureRisk: boolean;
  licenseRevocationRisk: boolean;
  status: AssessmentResult['readinessStatus'];
  readinessScore: number;
  blockersCount: number;
  canonicalText: string;
  dossierSha256: string;
  publicSlug: string | null;
  lockedAt: string | null;
  createdAt: string;
  updatedAt: string;
  input: AssessmentInput;
  result: AssessmentResult;
}

export interface PublicConsumerReport {
  viewCount: number;
  lastViewedAt: string;
  report: {
    dossierCode: string;
    publicSlug: string;
    merchantName: string;
    tradeTrn: string;
    channel: AssessmentInput['channel'];
    penaltyTierCode: AssessmentResult['obligations']['penaltyTierCode'];
    status: AssessmentResult['readinessStatus'];
    readinessScore: number;
    lockedAt: string;
    dossierSha256: string;
    legalDisclaimerEn: string;
    legalDisclaimerAr: string;
    obligations: AssessmentResult['obligations'];
    briefAr: string;
    briefEn: string;
  };
}

const LS_DOSSIERS = 'consumerae.v1.dossiers';
const LS_SEQ = 'consumerae.v1.seq';
const LS_VIEWS = 'consumerae.v1.views';

function readLocalList<T>(key: string): T[] {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T[]) : [];
  } catch {
    return [];
  }
}

function writeLocalList<T>(key: string, items: T[]): void {
  localStorage.setItem(key, JSON.stringify(items));
}

function allocateLocalDossierCode(): string {
  const year = new Date().getUTCFullYear();
  let seqMap: Record<string, number> = {};
  try {
    const raw = localStorage.getItem(LS_SEQ);
    seqMap = raw ? (JSON.parse(raw) as Record<string, number>) : {};
  } catch {
    seqMap = {};
  }
  const next = Number(seqMap[String(year)] ?? 0) + 1;
  seqMap[String(year)] = next;
  localStorage.setItem(LS_SEQ, JSON.stringify(seqMap));
  return `CNS-${year}-${String(next).padStart(4, '0')}`;
}

function makeLocalSlug(dossierCode: string): string {
  return `cns-${dossierCode.toLowerCase().replace(/[^a-z0-9]/g, '')}`;
}

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  const payload = (await res.json().catch(() => ({}))) as { message?: string };
  if (!res.ok) {
    throw new Error(payload.message || `HTTP ${res.status}`);
  }
  return payload as T;
}

export async function detectServerMode(): Promise<ApiMode> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 1600);
    const res = await fetch(withBase('/health'), {
      cache: 'no-store',
      signal: controller.signal,
    });
    clearTimeout(timeout);
    if (!res.ok) return 'local';
    const data = (await res.json()) as { ok?: boolean; service?: string };
    return data.ok && data.service === 'consumerae' ? 'server' : 'local';
  } catch {
    return 'local';
  }
}

export async function listDossiers(mode: ApiMode): Promise<ConsumerDossierRecord[]> {
  if (mode === 'server') {
    const data = await fetchJson<{ items?: ConsumerDossierRecord[] }>(
      withBase('/api/dossiers?limit=50'),
    );
    return Array.isArray(data.items) ? data.items : [];
  }
  return readLocalList<ConsumerDossierRecord>(LS_DOSSIERS).sort((a, b) =>
    b.updatedAt.localeCompare(a.updatedAt),
  );
}

export async function saveDossier(
  mode: ApiMode,
  input: AssessmentInput,
  title?: string,
): Promise<ConsumerDossierRecord> {
  if (mode === 'server') {
    const data = await fetchJson<{ item: ConsumerDossierRecord }>(withBase('/api/dossiers'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: title?.trim() || input.merchantName,
        input,
      }),
    });
    return data.item;
  }

  const assessed = await assessConsumerReadiness(input);
  const dossierCode = allocateLocalDossierCode();
  const now = new Date().toISOString();
  const canonicalText = canonicalizeDossierPayload({ ...assessed, dossierSha256: undefined });
  const blockersCount = assessed.controls.filter((c) => !c.passed).length;

  const record: ConsumerDossierRecord = {
    id: dossierCode,
    profileId: null,
    dossierCode,
    title: title?.trim() || `${input.merchantName} — ${assessed.obligations.penaltyTierCode}`,
    merchantName: input.merchantName,
    tradeTrn: input.tradeTrn || '',
    channel: input.channel,
    penaltyTierCode: assessed.obligations.penaltyTierCode,
    projectedMinFineAed: assessed.obligations.projectedMinimumFineAed,
    projectedMaxFineAed: assessed.obligations.projectedMaximumFineAed,
    temporaryClosureRisk: assessed.obligations.temporaryClosureRisk,
    licenseRevocationRisk: assessed.obligations.licenseRevocationRisk,
    status: assessed.readinessStatus,
    readinessScore: assessed.readinessScore,
    blockersCount,
    canonicalText,
    dossierSha256: assessed.dossierSha256,
    publicSlug: null,
    lockedAt: null,
    createdAt: now,
    updatedAt: now,
    input,
    result: assessed,
  };
  const items = readLocalList<ConsumerDossierRecord>(LS_DOSSIERS);
  writeLocalList(LS_DOSSIERS, [record, ...items]);
  return record;
}

export async function duplicateDossier(
  mode: ApiMode,
  dossierCode: string,
): Promise<ConsumerDossierRecord> {
  if (mode === 'server') {
    const data = await fetchJson<{ item: ConsumerDossierRecord }>(
      withBase(`/api/dossiers/${encodeURIComponent(dossierCode)}/duplicate`),
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      },
    );
    return data.item;
  }

  const items = readLocalList<ConsumerDossierRecord>(LS_DOSSIERS);
  const existing = items.find((item) => item.dossierCode === dossierCode);
  if (!existing) throw new Error(`Dossier ${dossierCode} not found.`);
  return saveDossier(mode, existing.input, `${existing.title} (Copy)`);
}

export async function deleteDossier(mode: ApiMode, dossierCode: string): Promise<void> {
  if (mode === 'server') {
    await fetchJson<{ ok: boolean }>(withBase(`/api/dossiers/${encodeURIComponent(dossierCode)}`), {
      method: 'DELETE',
    });
    return;
  }

  const items = readLocalList<ConsumerDossierRecord>(LS_DOSSIERS);
  const target = items.find((i) => i.dossierCode === dossierCode);
  if (target?.lockedAt) {
    throw new Error('Sealed dossier cannot be deleted.');
  }
  writeLocalList(
    LS_DOSSIERS,
    items.filter((i) => i.dossierCode !== dossierCode),
  );
}

export async function finalizeDossier(
  mode: ApiMode,
  dossierCode: string,
): Promise<ConsumerDossierRecord> {
  if (mode === 'server') {
    const data = await fetchJson<{ item: ConsumerDossierRecord }>(
      withBase(`/api/dossiers/${encodeURIComponent(dossierCode)}/finalize`),
      { method: 'POST' },
    );
    return data.item;
  }

  const items = readLocalList<ConsumerDossierRecord>(LS_DOSSIERS);
  const idx = items.findIndex((i) => i.dossierCode === dossierCode);
  if (idx === -1) throw new Error(`Dossier ${dossierCode} not found.`);
  const target = items[idx]!;
  if (target.lockedAt) {
    throw new Error('Dossier is already cryptographically sealed.');
  }
  const assessed = await assessConsumerReadiness(target.input);
  const now = new Date().toISOString();
  const updated: ConsumerDossierRecord = {
    ...target,
    penaltyTierCode: assessed.obligations.penaltyTierCode,
    projectedMinFineAed: assessed.obligations.projectedMinimumFineAed,
    projectedMaxFineAed: assessed.obligations.projectedMaximumFineAed,
    temporaryClosureRisk: assessed.obligations.temporaryClosureRisk,
    licenseRevocationRisk: assessed.obligations.licenseRevocationRisk,
    status: assessed.readinessStatus,
    readinessScore: assessed.readinessScore,
    blockersCount: assessed.controls.filter((c) => !c.passed).length,
    canonicalText: canonicalizeDossierPayload({ ...assessed, dossierSha256: undefined }),
    dossierSha256: assessed.dossierSha256,
    publicSlug: target.publicSlug || makeLocalSlug(target.dossierCode),
    lockedAt: now,
    updatedAt: now,
    result: assessed,
  };
  items[idx] = updated;
  writeLocalList(LS_DOSSIERS, items);
  return updated;
}

export async function fetchBriefMarkdown(
  mode: ApiMode,
  record: ConsumerDossierRecord,
  locale: Locale,
): Promise<string> {
  if (mode === 'server') {
    const res = await fetch(
      withBase(`/api/dossiers/${encodeURIComponent(record.dossierCode)}/brief.md?lang=${locale}`),
      { cache: 'no-store' },
    );
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.text();
  }
  return buildConsumerBriefMarkdown(
    record.input,
    record.result,
    record.dossierCode,
    record.dossierSha256,
    locale,
  );
}

export async function fetchExportCsv(
  mode: ApiMode,
  record: ConsumerDossierRecord,
): Promise<{ filename: string; content: string | Blob }> {
  const filename = `${record.dossierCode}.receipts-audit.csv`;
  if (mode === 'server') {
    const res = await fetch(
      withBase(`/api/dossiers/${encodeURIComponent(record.dossierCode)}/export.csv`),
      { cache: 'no-store' },
    );
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return {
      filename,
      content: new Blob([await res.arrayBuffer()], { type: 'text/csv;charset=utf-8' }),
    };
  }

  if (record.result.csvAudit && record.result.csvAudit.rows.length > 0) {
    return { filename, content: exportReceiptAuditCsv(record.result.csvAudit) };
  }

  const header = [
    'dossier_code',
    'merchant_name',
    'trade_trn',
    'channel',
    'penalty_tier_code',
    'projected_min_fine_aed',
    'projected_max_fine_aed',
    'temporary_closure_risk',
    'license_revocation_risk',
    'status',
    'readiness_score',
    'dossier_sha256',
  ]
    .map((h) => formatSafeCsvCell(h).cell)
    .join(',');

  const row = [
    record.dossierCode,
    record.merchantName,
    record.tradeTrn,
    record.channel,
    record.penaltyTierCode,
    record.projectedMinFineAed,
    record.projectedMaxFineAed,
    record.temporaryClosureRisk,
    record.licenseRevocationRisk,
    record.status,
    record.readinessScore,
    record.dossierSha256,
  ]
    .map((v) => formatSafeCsvCell(v).cell)
    .join(',');

  return { filename, content: `\uFEFF${header}\r\n${row}\r\n` };
}

export async function fetchPublicReport(
  mode: ApiMode,
  slugOrCode: string,
): Promise<PublicConsumerReport> {
  if (mode === 'server') {
    return fetchJson<PublicConsumerReport>(
      withBase(`/api/public/reports/${encodeURIComponent(slugOrCode)}`),
    );
  }

  const items = readLocalList<ConsumerDossierRecord>(LS_DOSSIERS);
  const found = items.find(
    (item) =>
      Boolean(item.lockedAt) &&
      (item.publicSlug === slugOrCode || item.dossierCode === slugOrCode),
  );
  if (!found || !found.lockedAt) {
    throw new Error(`Published sealed ConsumerAE report "${slugOrCode}" was not found.`);
  }

  let viewMap: Record<string, { count: number; lastViewedAt: string }> = {};
  try {
    const raw = localStorage.getItem(LS_VIEWS);
    viewMap = raw ? (JSON.parse(raw) as Record<string, { count: number; lastViewedAt: string }>) : {};
  } catch {
    viewMap = {};
  }
  const prev = viewMap[found.dossierCode]?.count ?? 0;
  const now = new Date().toISOString();
  const nextCount = prev + 1;
  viewMap[found.dossierCode] = { count: nextCount, lastViewedAt: now };
  localStorage.setItem(LS_VIEWS, JSON.stringify(viewMap));

  return {
    viewCount: nextCount,
    lastViewedAt: now,
    report: {
      dossierCode: found.dossierCode,
      publicSlug: found.publicSlug || makeLocalSlug(found.dossierCode),
      merchantName: found.merchantName,
      tradeTrn: found.tradeTrn,
      channel: found.channel,
      penaltyTierCode: found.penaltyTierCode,
      status: found.status,
      readinessScore: found.readinessScore,
      lockedAt: found.lockedAt,
      dossierSha256: found.dossierSha256,
      legalDisclaimerEn: found.result.disclaimerEn,
      legalDisclaimerAr: found.result.disclaimerAr,
      obligations: found.result.obligations,
      briefAr: buildConsumerBriefMarkdown(
        found.input,
        found.result,
        found.dossierCode,
        found.dossierSha256,
        'ar',
      ),
      briefEn: buildConsumerBriefMarkdown(
        found.input,
        found.result,
        found.dossierCode,
        found.dossierSha256,
        'en',
      ),
    },
  };
}
