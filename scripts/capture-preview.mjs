// One-shot screenshotter for README preview. Loads the dashboard, picks
// July 2025, waits for charts to settle, and writes docs/preview.png.
import puppeteer from 'puppeteer';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outPath = path.resolve(__dirname, '..', 'docs', 'preview.png');

const TARGET_YEAR = '2025';
const TARGET_MONTH_HE = 'יולי';
const URL = 'http://localhost:5173/monitor';

const browser = await puppeteer.launch({
  headless: 'new',
  defaultViewport: { width: 1440, height: 1800, deviceScaleFactor: 2 },
});

try {
  const page = await browser.newPage();
  await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 30000 });

  // Wait until at least one metric card has rendered — proxy for "data loaded".
  await page.waitForFunction(
    () => document.body.innerText.includes('סה״כ') || document.body.innerText.includes('סה"כ'),
    { timeout: 30000 }
  );

  // Helper: open a Radix Select trigger that currently shows `currentText`,
  // then click the option whose text matches `optionText`.
  const pickFromSelect = async (currentText, optionText) => {
    const trigger = await page.evaluateHandle((t) => {
      const triggers = Array.from(document.querySelectorAll('[role="combobox"]'));
      return triggers.find((el) => el.textContent?.trim() === t) || null;
    }, currentText);
    if (!trigger || (await trigger.evaluate((el) => el === null))) {
      throw new Error(`No Select trigger matching "${currentText}"`);
    }
    await trigger.asElement().click();
    await page.waitForSelector('[role="listbox"] [role="option"]', { timeout: 5000 });
    await page.evaluate((t) => {
      const opt = Array.from(document.querySelectorAll('[role="option"]'))
        .find((el) => el.textContent?.trim() === t);
      if (!opt) throw new Error('option not found: ' + t);
      opt.click();
    }, optionText);
    await new Promise((r) => setTimeout(r, 250));
  };

  // Default year is the latest in the data — flip to 2025.
  // Determine the current year-trigger label by reading combobox values.
  const currentYearLabel = await page.evaluate(() => {
    const triggers = Array.from(document.querySelectorAll('[role="combobox"]'));
    // Heuristic: a 4-digit year string.
    const yearTrigger = triggers.find((el) => /^\d{4}$/.test(el.textContent?.trim() || ''));
    return yearTrigger?.textContent?.trim() || null;
  });
  if (!currentYearLabel) throw new Error('Could not find year trigger');
  if (currentYearLabel !== TARGET_YEAR) {
    await pickFromSelect(currentYearLabel, TARGET_YEAR);
  }

  // Now pick the month.
  const currentMonthLabel = await page.evaluate(() => {
    const triggers = Array.from(document.querySelectorAll('[role="combobox"]'));
    const months = ['ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני', 'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר'];
    const monthTrigger = triggers.find((el) => months.includes(el.textContent?.trim() || ''));
    return monthTrigger?.textContent?.trim() || null;
  });
  if (currentMonthLabel && currentMonthLabel !== TARGET_MONTH_HE) {
    await pickFromSelect(currentMonthLabel, TARGET_MONTH_HE);
  }

  // Give charts/animations time to settle.
  await new Promise((r) => setTimeout(r, 1500));

  await page.screenshot({ path: outPath, fullPage: true });
  console.log('Wrote', outPath);
} finally {
  await browser.close();
}
