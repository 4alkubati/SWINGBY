#!/usr/bin/env node
/**
 * catalog — index what has actually been rendered into out/.
 *
 * Naming convention, enforced here rather than by habit:
 *   <template>__<aspect>__<cta>.mp4      e.g. cinematic-glide__9x16__waitlist.mp4
 *
 * The CTA is in the filename on purpose. FACTS section 5 allows exactly three
 * calls to action and they expire the moment the App Store listing goes live in
 * Oct 2026; when that happens, every file whose name carries a pre-launch CTA has
 * to be re-cut, and this makes finding them a glob instead of an audit.
 */

import {readdir, stat, writeFile} from 'node:fs/promises';
import {join, dirname, extname} from 'node:path';
import {fileURLToPath} from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'out');

const files = (await readdir(OUT).catch(() => [])).filter((f) =>
  ['.mp4', '.webm', '.gif'].includes(extname(f).toLowerCase()),
);

const rows = [];
for (const f of files) {
  const {size, mtime} = await stat(join(OUT, f));
  const [template, aspect, cta] = f.replace(/\.[^.]+$/, '').split('__');
  rows.push({
    file: f,
    bytes: size,
    megabytes: +(size / 1048576).toFixed(2),
    modified: mtime.toISOString(),
    template: template ?? null,
    aspect: aspect ?? null,
    cta: cta ?? null,
    conventional: Boolean(template && aspect && cta),
  });
}

const catalog = {
  convention: '<template>__<aspect>__<cta>.mp4',
  count: rows.length,
  videos: rows.sort((a, b) => a.file.localeCompare(b.file)),
};

await writeFile(join(OUT, 'catalog.json'), JSON.stringify(catalog, null, 2) + '\n');
console.log(`catalog: ${rows.length} video(s) -> out/catalog.json`);
for (const r of rows) {
  console.log(`  ${r.conventional ? ' ' : '?'} ${r.file}  ${r.megabytes} MB`);
}
if (rows.some((r) => !r.conventional)) {
  console.warn('  ? = filename does not follow <template>__<aspect>__<cta>.mp4');
}
