import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve('bogatka-field-8f3c7d');
const required = [
  'v23.js',
  'decision-core-v340.js',
  'decision-ui-v340.js',
  'decision-v340.css',
  'compare-v340.js',
  'compare-v340.css',
  'suite-core-v400.js',
  'suite-ui-v400.js',
  'suite-v400.css',
  'archive-label-v400.js',
  'backup-v400.js',
  'cloud-archive-v400.js',
  'address-fix-v400.js',
  'viewer-extra-v400.js',
  'report-v400.js',
  'access-version-v400.js',
  'selftest-v400.js',
  'auth-signup-fix-v31.js',
  'reset/index.html',
  'reset/reset.js',
  'sw.js',
  'sw-v340.js',
  'report/index.html',
  'report/app.js',
  'report/style.css',
  'report/fix-v400.js',
  'IMPLEMENTATION-4.0.md',
];

const failures = [];
const read = file => fs.readFileSync(path.join(root, file), 'utf8');

for (const file of required) {
  if (!fs.existsSync(path.join(root, file))) failures.push(`Missing required file: ${file}`);
}

if (!failures.length) {
  const loader = read('v23.js');
  for (const file of ['decision-core-v340.js','suite-core-v400.js','decision-ui-v340.js','compare-v340.js','suite-ui-v400.js','archive-label-v400.js','backup-v400.js','report-v400.js','access-version-v400.js']) {
    if (!loader.includes(file)) failures.push(`v23.js does not load ${file}`);
  }

  const backup = read('backup-v400.js');
  for (const file of ['cloud-archive-v400.js','address-fix-v400.js','viewer-extra-v400.js','selftest-v400.js']) {
    if (!backup.includes(file)) failures.push(`backup-v400.js does not load ${file}`);
  }

  const serviceWorker = read('sw-v340.js');
  for (const file of ['suite-core-v400.js','suite-ui-v400.js','archive-label-v400.js','backup-v400.js','cloud-archive-v400.js','address-fix-v400.js','viewer-extra-v400.js','report-v400.js','selftest-v400.js','reset/index.html','reset/reset.js']) {
    if (!serviceWorker.includes(file)) failures.push(`Service Worker does not cache ${file}`);
  }

  const decision = read('decision-core-v340.js');
  const weightsMatch = decision.match(/const WEIGHTS=\{([^}]+)\}/);
  if (!weightsMatch) failures.push('Cannot locate weighted score configuration');
  else {
    const values = [...weightsMatch[1].matchAll(/:\s*(\d+(?:\.\d+)?)/g)].map(match => Number(match[1]));
    const total = values.reduce((sum, value) => sum + value, 0);
    if (total !== 100) failures.push(`Weighted score total is ${total}, expected 100`);
  }

  const suite = read('suite-core-v400.js');
  for (const symbol of ['calculateEconomy','photoPlanFor','findAddressDuplicate','archiveLocation','addComment','addTask','ensureLaunchProject']) {
    if (!suite.includes(symbol)) failures.push(`suite-core-v400.js is missing ${symbol}`);
  }

  const archive = read('archive-label-v400.js');
  for (const marker of ['installAutoRent','installArchiveAwareClear','installCollaborationMerge','viewer-mode-v400']) {
    if (!archive.includes(marker)) failures.push(`archive-label-v400.js is missing ${marker}`);
  }

  const cloudArchive = read('cloud-archive-v400.js');
  for (const marker of ['archived_at','cloudFetchRemoteWithArchive','cloudPushLocationsWithArchive','BogatkaCloudArchive']) {
    if (!cloudArchive.includes(marker)) failures.push(`cloud-archive-v400.js is missing ${marker}`);
  }

  const addressFix = read('address-fix-v400.js');
  for (const marker of ['STOP_WORDS','normalizeAddress','saveLocationFromModalFixed','BogatkaAddressFix']) {
    if (!addressFix.includes(marker)) failures.push(`address-fix-v400.js is missing ${marker}`);
  }

  const viewer = read('viewer-extra-v400.js');
  for (const marker of ['[data-global]','[data-location-card] button','.photo-add','.photo-delete']) {
    if (!viewer.includes(marker)) failures.push(`viewer-extra-v400.js is missing ${marker}`);
  }

  const report = read('report-v400.js');
  for (const marker of ['economyHtml','stopHtml','photoPlanHtml','taskHtml','launchHtml','executiveTable']) {
    if (!report.includes(marker)) failures.push(`report-v400.js is missing ${marker}`);
  }

  const publicReport = read('report/app.js');
  for (const marker of ['renderComparison','renderEconomy','renderPhotoPlan','renderTasksComments','renderLaunch']) {
    if (!publicReport.includes(marker)) failures.push(`Public report is missing ${marker}`);
  }

  const signup = read('auth-signup-fix-v31.js');
  const reset = read('reset/reset.js');
  if (!signup.includes('length<12') || !signup.includes('\\p{L}')) failures.push('Signup password policy is weaker than required');
  if (!reset.includes('length<12') || !reset.includes("APP_URL='../?v=400'")) failures.push('Recovery password policy or return URL is outdated');

  const versionFiles = ['v22.js','v23.js','access-version-v400.js','backup-v400.js'];
  for (const file of versionFiles) {
    if (!read(file).includes('4.0.0') && !read(file).includes('v=400')) failures.push(`${file} is not aligned with version 4.0.0`);
  }
}

if (failures.length) {
  console.error('Bogatka validation failed:');
  failures.forEach(failure => console.error(`- ${failure}`));
  process.exit(1);
}

console.log(`Bogatka validation passed: ${required.length} required files and integration markers verified.`);
