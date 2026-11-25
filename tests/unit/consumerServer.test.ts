import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { createApp } from '../../server/app.mjs';
import { CONSUMERAE_TOOL_VERSION, CONSUMER_PRESETS } from '../../src/core/index.ts';

const createdServers: Array<{ close: () => Promise<void> }> = [];
const tempDirs: string[] = [];

async function startTempApp(options: Record<string, unknown> = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'consumerae-test-'));
  tempDirs.push(dir);
  const app = createApp({ dataDir: dir, ...options });
  const bound = await app.listen(0, '127.0.0.1');
  createdServers.push(app);
  return { app, url: bound.url, dir };
}

afterEach(async () => {
  while (createdServers.length > 0) {
    const inst = createdServers.pop();
    if (inst) await inst.close();
  }
  while (tempDirs.length > 0) {
    const d = tempDirs.pop();
    if (d) fs.rmSync(d, { recursive: true, force: true });
  }
});

describe('ConsumerAE SQLite WAL Server & HTTP API (v0.2.0)', () => {
  it('serves /health, /readyz WAL mode, and /api/presets with explicit UAE MoE/DET/ADDED disclaimers', async () => {
    const { url } = await startTempApp();

    const healthRes = await fetch(`${url}/health`);
    expect(healthRes.status).toBe(200);
    const health = (await healthRes.json()) as {
      ok: boolean;
      service: string;
      version: string;
      db: { journalMode: string };
    };
    expect(health.ok).toBe(true);
    expect(health.service).toBe('consumerae');
    expect(health.version).toBe(CONSUMERAE_TOOL_VERSION);
    expect(health.db.journalMode).toBe('wal');

    const readyRes = await fetch(`${url}/readyz`);
    expect(readyRes.status).toBe(200);
    const ready = (await readyRes.json()) as { ready: boolean; journalMode: string };
    expect(ready.ready).toBe(true);
    expect(ready.journalMode).toBe('wal');

    const presetsRes = await fetch(`${url}/api/presets`);
    expect(presetsRes.status).toBe(200);
    const presetsData = (await presetsRes.json()) as {
      toolName: string;
      presets: unknown[];
      controls: unknown[];
      legalDisclaimerEn: string;
      legalDisclaimerAr: string;
    };
    expect(presetsData.toolName).toBe('ConsumerAE');
    expect(presetsData.presets).toHaveLength(3);
    expect(presetsData.controls).toHaveLength(7);
    expect(presetsData.legalDisclaimerEn).toContain('not affiliated with the UAE Ministry of Economy');
    expect(presetsData.legalDisclaimerAr).toContain('لا تتبع وزارة الاقتصاد الإماراتية');
  });

  it('evaluates FL 15/2020 & CR 66/2023 presets, audits receipt CSV with CWE-1236 + BOM, and scores /api/assess', async () => {
    const { url } = await startTempApp();

    const p2Res = await fetch(`${url}/api/evaluate-obligations`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ presetId: CONSUMER_PRESETS[1].id }),
    });
    expect(p2Res.status).toBe(200);
    const p2Data = (await p2Res.json()) as {
      obligations: {
        sparePartsOrSubstituteGap: boolean;
        corporateEndUserProtected: boolean;
        penaltyTierCode: string;
        projectedMaximumFineAed: number;
      };
    };
    expect(p2Data.obligations.sparePartsOrSubstituteGap).toBe(true);
    expect(p2Data.obligations.corporateEndUserProtected).toBe(true);
    expect(p2Data.obligations.penaltyTierCode).toBe('administrative_fine_250k');
    expect(p2Data.obligations.projectedMaximumFineAed).toBe(250_000);

    const maliciousCsv = [
      'case_id,merchant_or_item_en,channel,arabic_invoice,waiver_clause_text,defect_days_since_purchase,defect_remedy_honored,spare_part_kind,spare_part_days,warranty_repair_days,temp_substitute_provided,original_price_aed,discounted_price_aed,trn',
      '"=HYPERLINK(""https://evil.example"",""CASE"")",Direct Deals FZ,uae_ecommerce_platform,false,No refund and البضاعة المباعة لا ترد ولا تستبدل,18,false,regular_continuous,22,12,false,1999,1599,100452819300003',
    ].join('\n');

    const auditRes = await fetch(`${url}/api/audit-receipts`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ csv: maliciousCsv }),
    });
    expect(auditRes.status).toBe(200);
    const auditData = (await auditRes.json()) as {
      audit: {
        totalRows: number;
        formulaInjectionSanitizedCount: number;
        violationRows: number;
        missingArabicInvoiceRows: number;
        art34ProhibitedClauseRows: number;
        sparePartOrSubstituteBreachRows: number;
        totalEstimatedExposureMaxAed: number;
      };
      exportedCsv: string;
    };
    expect(auditData.audit.totalRows).toBe(1);
    expect(auditData.audit.violationRows).toBe(1);
    expect(auditData.audit.missingArabicInvoiceRows).toBe(1);
    expect(auditData.audit.art34ProhibitedClauseRows).toBe(1);
    expect(auditData.audit.sparePartOrSubstituteBreachRows).toBe(1);
    expect(auditData.audit.formulaInjectionSanitizedCount).toBe(1);
    expect(auditData.audit.totalEstimatedExposureMaxAed).toBe(250_000);
    expect(auditData.exportedCsv.startsWith('\uFEFF')).toBe(true);
    expect(auditData.exportedCsv).toContain("'=HYPERLINK");

    const wireCsvRes = await fetch(`${url}/api/export/receipts-csv`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ csv: maliciousCsv }),
    });
    expect(wireCsvRes.status).toBe(200);
    expect(wireCsvRes.headers.get('content-type')).toContain('text/csv');
    const wireCsvBuf = Buffer.from(await wireCsvRes.arrayBuffer());
    expect(Array.from(wireCsvBuf.subarray(0, 3))).toEqual([0xef, 0xbb, 0xbf]);
    expect(wireCsvBuf.toString('utf8')).toContain("'=HYPERLINK");
    expect(wireCsvBuf.toString('utf8')).not.toContain("''=");

    const assessRes = await fetch(`${url}/api/assess`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ presetId: CONSUMER_PRESETS[2].id }),
    });
    expect(assessRes.status).toBe(200);
    const assessData = (await assessRes.json()) as {
      result: { readinessStatus: string; readinessScore: number; dossierSha256: string };
    };
    expect(assessData.result.readinessStatus).toBe('blocked');
    expect(assessData.result.readinessScore).toBe(0);
    expect(assessData.result.dossierSha256).toMatch(/^[a-f0-9]{64}$/);
  });

  it('persists profiles & dossiers, enforces 409 lock immutability, exports BOM CSV & AR/EN brief, and tracks public views', async () => {
    const { url } = await startTempApp();

    const profRes = await fetch(`${url}/api/profiles`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        merchantName: 'FlashDeals Direct Trading FZ-LLC',
        tradeTrn: '100452819300003',
        channel: 'uae_ecommerce_platform',
        sellsOnline: true,
        notes: 'Initial profile',
      }),
    });
    expect(profRes.status).toBe(201);
    const profData = (await profRes.json()) as { profile: { id: number } };

    const patchProf = await fetch(`${url}/api/profiles/${profData.profile.id}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ notes: 'Updated profile notes' }),
    });
    expect(patchProf.status).toBe(200);

    const createRes = await fetch(`${url}/api/dossiers`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        profileId: profData.profile.id,
        year: 2026,
        presetId: CONSUMER_PRESETS[2].id,
        title: 'UAE Repeat Consumer Breach Audit',
      }),
    });
    expect(createRes.status).toBe(201);
    const created = (await createRes.json()) as {
      item: { dossierCode: string; status: string; penaltyTierCode: string };
    };
    expect(created.item.dossierCode).toBe('CNS-2026-0001');
    expect(created.item.status).toBe('blocked');
    expect(created.item.penaltyTierCode).toBe('escalated_repeat_or_severe_1m_2m');

    const unlockedPublic = await fetch(`${url}/api/public/reports/${created.item.dossierCode}`);
    expect(unlockedPublic.status).toBe(404);

    const dupRes = await fetch(`${url}/api/dossiers/${created.item.dossierCode}/duplicate`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({}),
    });
    expect(dupRes.status).toBe(201);
    const dup = (await dupRes.json()) as { item: { dossierCode: string } };
    expect(dup.item.dossierCode).toBe('CNS-2026-0002');

    const delDupRes = await fetch(`${url}/api/dossiers/${dup.item.dossierCode}`, {
      method: 'DELETE',
    });
    expect(delDupRes.status).toBe(200);

    const finalizeRes = await fetch(`${url}/api/dossiers/${created.item.dossierCode}/finalize`, {
      method: 'POST',
    });
    expect(finalizeRes.status).toBe(200);
    const finalized = (await finalizeRes.json()) as {
      item: { lockedAt: string; publicSlug: string };
    };
    expect(finalized.item.lockedAt).toBeTruthy();
    expect(finalized.item.publicSlug).toMatch(/^cns-[a-f0-9]{12}$/);

    const lockedPatch = await fetch(`${url}/api/dossiers/${created.item.dossierCode}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ title: 'Attempted Tamper' }),
    });
    expect(lockedPatch.status).toBe(409);

    const lockedDelete = await fetch(`${url}/api/dossiers/${created.item.dossierCode}`, {
      method: 'DELETE',
    });
    expect(lockedDelete.status).toBe(409);

    const relockRes = await fetch(`${url}/api/dossiers/${created.item.dossierCode}/lock`, {
      method: 'POST',
    });
    expect(relockRes.status).toBe(409);

    const briefArRes = await fetch(
      `${url}/api/dossiers/${created.item.dossierCode}/brief.md?lang=ar`,
    );
    expect(briefArRes.status).toBe(200);
    expect(await briefArRes.text()).toContain('ملف جاهزية حماية المستهلك الإماراتي');

    const briefEnRes = await fetch(
      `${url}/api/dossiers/${created.item.dossierCode}/brief.md?lang=en`,
    );
    expect(briefEnRes.status).toBe(200);
    expect(await briefEnRes.text()).toContain('UAE Consumer Protection Readiness Brief');

    const summaryRes = await fetch(
      `${url}/api/dossiers/${created.item.dossierCode}/summary?lang=en`,
    );
    expect(summaryRes.status).toBe(200);
    const summaryData = (await summaryRes.json()) as {
      briefMarkdown: string;
      readinessScore: number;
      topControls: unknown[];
    };
    expect(summaryData.readinessScore).toBe(0);
    expect(summaryData.topControls).toHaveLength(7);

    const exportCsvRes = await fetch(
      `${url}/api/dossiers/${created.item.dossierCode}/export.csv`,
    );
    expect(exportCsvRes.status).toBe(200);
    const exportBuf = Buffer.from(await exportCsvRes.arrayBuffer());
    expect(Array.from(exportBuf.subarray(0, 3))).toEqual([0xef, 0xbb, 0xbf]);
    expect(exportBuf.toString('utf8')).toContain("'=CASE-301");

    const pub1 = await fetch(`${url}/api/public/reports/${finalized.item.publicSlug}`);
    expect(pub1.status).toBe(200);
    const pub1Data = (await pub1.json()) as {
      viewCount: number;
      report: { briefAr: string; briefEn: string };
    };
    expect(pub1Data.viewCount).toBe(1);
    expect(pub1Data.report.briefAr).toContain('CNS-2026-0001');
    expect(pub1Data.report.briefEn).toContain('CNS-2026-0001');

    const pub2 = await fetch(`${url}/api/public/reports/${created.item.dossierCode}`);
    expect(pub2.status).toBe(200);
    const pub2Data = (await pub2.json()) as { viewCount: number };
    expect(pub2Data.viewCount).toBe(2);
  });

  it('supports BASE_PATH=/consumerae prefix routing and injects window.__CONSUMERAE_BASE__', async () => {
    const { url } = await startTempApp({ basePath: '/consumerae' });

    const rootRes = await fetch(`${url}/`);
    expect(rootRes.status).toBe(200);
    const html = await rootRes.text();
    expect(html).toContain('window.__CONSUMERAE_BASE__="/consumerae"');

    const apiHealth = await fetch(`${url}/api/health`);
    expect(apiHealth.status).toBe(200);
    const body = (await apiHealth.json()) as { basePath: string; service: string };
    expect(body.basePath).toBe('/consumerae');
    expect(body.service).toBe('consumerae');
  });

  it('enforces 413 PAYLOAD_TOO_LARGE and 429 RATE_LIMIT_EXCEEDED safety guards', async () => {
    const { url: smallUrl } = await startTempApp({ maxBodyBytes: 128 });
    const tooLarge = await fetch(`${smallUrl}/api/assess`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ merchantName: 'X'.repeat(300) }),
    });
    expect(tooLarge.status).toBe(413);
    const largeErr = (await tooLarge.json()) as { error: string };
    expect(largeErr.error).toBe('PAYLOAD_TOO_LARGE');

    const { url: strictUrl } = await startTempApp({ rateLimitMax: 2, rateLimitWindowMs: 60_000 });
    expect((await fetch(`${strictUrl}/api/presets`)).status).toBe(200);
    expect((await fetch(`${strictUrl}/api/presets`)).status).toBe(200);
    const limited = await fetch(`${strictUrl}/api/presets`);
    expect(limited.status).toBe(429);
    const limitedErr = (await limited.json()) as { error: string };
    expect(limitedErr.error).toBe('RATE_LIMIT_EXCEEDED');
  });

  it('returns clear 400 validation errors and 404 for missing presets or dossiers', async () => {
    const { url } = await startTempApp();

    const badChannel = await fetch(`${url}/api/evaluate-obligations`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ channel: 'unknown_channel' }),
    });
    expect(badChannel.status).toBe(400);

    const missingMerchant = await fetch(`${url}/api/profiles`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ merchantName: '   ' }),
    });
    expect(missingMerchant.status).toBe(400);

    const badPreset = await fetch(`${url}/api/assess`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ presetId: 'preset-does-not-exist' }),
    });
    expect(badPreset.status).toBe(404);

    const missingDossier = await fetch(`${url}/api/dossiers/CNS-2026-9999`);
    expect(missingDossier.status).toBe(404);
  });
});
