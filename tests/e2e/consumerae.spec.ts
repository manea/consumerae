import fs from 'node:fs';
import { expect, test, type Page } from '@playwright/test';

async function assertNoHorizontalOverflow(page: Page) {
  const dims = await page.evaluate(() => {
    const main = document.querySelector('main');
    const header = document.querySelector('header');
    const mainRect = main?.getBoundingClientRect();
    const headerRect = header?.getBoundingClientRect();
    return {
      scrollWidth: document.documentElement.scrollWidth,
      innerWidth: window.innerWidth,
      mainWidth: mainRect ? Math.ceil(mainRect.width) : 0,
      headerWidth: headerRect ? Math.ceil(headerRect.width) : 0,
    };
  });
  expect(dims.scrollWidth).toBeLessThanOrEqual(dims.innerWidth);
  expect(dims.mainWidth).toBeLessThanOrEqual(dims.innerWidth);
  expect(dims.headerWidth).toBeLessThanOrEqual(dims.innerWidth);
}

function buildCleanReceiptCsvBatch(): string {
  return [
    'case_id,merchant_or_item_en,channel,arabic_invoice,waiver_clause_text,defect_days_since_purchase,defect_remedy_honored,spare_part_kind,spare_part_days,warranty_repair_days,temp_substitute_provided,original_price_aed,discounted_price_aed,trn',
    'CASE-CLEAN-01,Verified UAE Electronic Store Item,uae_ecommerce_platform,true,UAE Statutory Return Notice,10,true,regular_continuous,4,5,true,1500,1500,100452819300003',
    'CASE-CLEAN-02,Verified Freezone B2C Smart Sensor,uae_freezone_b2c_supplier,true,Standard Warranty Policy,0,true,none,0,0,false,800,800,100452819300003',
  ].join('\n');
}

test.describe('ConsumerAE — UAE FL 15/2020, FDL 5/2023 & CR 66/2023 Consumer Protection E2E', () => {
  test('defaults to AR RTL Alabaster Consumer, toggles EN LTR Obsidian Watch, and persists across reload', async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on('pageerror', (err) => errors.push(err.message));
    page.on('console', (msg) => {
      if (msg.type() === 'error') errors.push(msg.text());
    });

    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/');

    await expect(page.locator('header')).toContainText('SQLite WAL');
    await expect(page.locator('html')).toHaveAttribute('lang', 'ar');
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'alabaster-consumer');
    await expect(page.locator('svg[role="img"]').first()).toBeVisible();
    await expect(page.getByTestId('status-badge')).toContainText('100/100');
    await expect(page.getByTestId('legal-disclaimer-banner')).toContainText('ولا تتبع وزارة الاقتصاد الإماراتية');
    await assertNoHorizontalOverflow(page);

    await page.screenshot({
      path: 'test-results/qa-screenshots/01-workspace-ar-alabaster-consumer.png',
      fullPage: true,
      animations: 'disabled',
    });

    await page.getByTestId('lang-toggle-btn').click();
    await page.getByTestId('theme-toggle-btn').click();

    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
    await expect(page.locator('html')).toHaveAttribute('dir', 'ltr');
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'obsidian-watch');
    await expect(page.getByTestId('legal-disclaimer-banner')).toContainText(
      'not affiliated with the UAE Ministry of Economy',
    );
    await assertNoHorizontalOverflow(page);

    await page.screenshot({
      path: 'test-results/qa-screenshots/02-workspace-en-obsidian-watch.png',
      fullPage: true,
      animations: 'disabled',
    });

    await page.reload();
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
    await expect(page.locator('html')).toHaveAttribute('dir', 'ltr');
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'obsidian-watch');

    expect(errors).toEqual([]);
  });

  test('evaluates Presets 1/2/3 & remediates Preset 3 into sealed CNS-2026-0001 with BOM CSV & /r/:code', async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on('pageerror', (err) => errors.push(err.message));
    page.on('console', (msg) => {
      if (msg.type() === 'error') errors.push(msg.text());
    });

    const expectedCode = 'CNS-2026-0001';

    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/');
    await page.getByTestId('lang-toggle-btn').click();
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');

    await page.getByTestId('preset-select').selectOption('preset-ready-compliant-retail');
    await expect(page.getByTestId('status-badge')).toContainText('READY');
    await expect(page.getByTestId('status-badge')).toContainText('100/100');

    await page.getByTestId('preset-select').selectOption('preset-conditional-spare-parts-delay');
    await expect(page.getByTestId('status-badge')).toContainText('CONDITIONAL');
    await expect(page.getByTestId('status-badge')).toContainText('85/100');
    await assertNoHorizontalOverflow(page);

    await page.screenshot({
      path: 'test-results/qa-screenshots/03-spare-parts-conditional-desktop.png',
      fullPage: true,
      animations: 'disabled',
    });

    await page.getByTestId('preset-select').selectOption('preset-blocked-repeat-no-arabic-art34-defect');
    await expect(page.getByTestId('status-badge')).toContainText('BLOCKED');
    await expect(page.getByTestId('status-badge')).toContainText('0/100');
    await expect(page.getByTestId('metric-fine-exposure')).toContainText('1,000,000');
    await expect(page.getByTestId('metric-fine-exposure')).toContainText('Closure');

    await page.getByTestId('trn-input').fill('100452819300003');
    await page.getByTestId('prior-offense-input').fill('0');
    await page.getByTestId('toggle-hasArabicInvoice').check();
    await page.getByTestId('toggle-invoiceIncludesCoreFields').check();
    await page.getByTestId('toggle-hasProhibitedWaiverClause').uncheck();
    await page
      .getByTestId('receipt-terms-textarea')
      .fill('Standard UAE Statutory Return & Warranty Coverage under FL 15/2020 and CR 66/2023.');
    await page.getByTestId('toggle-defectRemedyHonored').check();
    await page.getByTestId('toggle-priceDifferenceRefunded').check();
    await page.getByTestId('spare-part-days-input').fill('5');
    await page.getByTestId('toggle-temporarySubstituteProvided').check();
    await page.getByTestId('toggle-ecommerceArabicDisclosuresComplete').check();
    await page.getByTestId('toggle-complaintAndGrievanceWorkflowReady').check();

    await page.getByTestId('tab-csv').click();
    await page.getByTestId('receipt-csv-textarea').fill(buildCleanReceiptCsvBatch());

    await page.getByTestId('tab-dashboard').click();
    await expect(page.getByTestId('status-badge')).toContainText('READY');
    await expect(page.getByTestId('status-badge')).toContainText('100/100');

    await page.getByTestId('tab-vault').click();
    await page.getByTestId('save-dossier-btn').click();
    await expect(page.locator('main')).toContainText(expectedCode);

    await page.getByTestId(`finalize-dossier-${expectedCode}`).click();
    await expect(page.getByTestId(`finalize-dossier-${expectedCode}`)).toHaveCount(0);
    await expect(page.getByTestId(`open-public-${expectedCode}`)).toBeVisible();

    const dlPromise = page.waitForEvent('download');
    await page.getByTestId(`export-csv-${expectedCode}`).click();
    const dl = await dlPromise;
    expect(dl.suggestedFilename()).toContain('.csv');
    const dlPath = await dl.path();
    expect(dlPath).toBeTruthy();
    if (dlPath) {
      const bytes = fs.readFileSync(dlPath);
      expect(Array.from(bytes.slice(0, 3))).toEqual([0xef, 0xbb, 0xbf]);
    }

    await page.screenshot({
      path: 'test-results/qa-screenshots/04-sealed-dossier-desktop.png',
      fullPage: true,
      animations: 'disabled',
    });

    await page.getByTestId(`open-public-${expectedCode}`).click();
    await expect(page.locator('body')).toContainText(expectedCode);
    await expect(page.locator('body')).toContainText('FlashDeals Direct Trading FZ-LLC');
    await expect(page.getByTestId('public-view-count')).toContainText('1');

    await page.reload();
    await expect(page.locator('body')).toContainText(expectedCode);
    await expect(page.getByTestId('public-view-count')).toContainText('2');

    expect(errors).toEqual([]);
  });

  test('verifies mobile 390x844 responsiveness in AR Alabaster Consumer and EN Obsidian Watch with zero overflow', async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on('pageerror', (err) => errors.push(err.message));
    page.on('console', (msg) => {
      if (msg.type() === 'error') errors.push(msg.text());
    });

    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/');
    await expect(page.locator('svg[role="img"]').first()).toBeVisible();
    await assertNoHorizontalOverflow(page);

    await page.screenshot({
      path: 'test-results/qa-screenshots/05-mobile-ar-alabaster-consumer.png',
      fullPage: true,
      animations: 'disabled',
    });

    await page.getByTestId('lang-toggle-btn').click();
    await page.getByTestId('theme-toggle-btn').click();
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'obsidian-watch');
    await assertNoHorizontalOverflow(page);

    await page.screenshot({
      path: 'test-results/qa-screenshots/06-mobile-en-obsidian-watch.png',
      fullPage: true,
      animations: 'disabled',
    });

    expect(errors).toEqual([]);
  });
});
