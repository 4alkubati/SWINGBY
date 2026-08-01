// P4 — two tabs, one glyph.
//
// `Jobs` and `My Business` both rendered Feather's briefcase in the business
// tab bar, so the two tabs a business owner uses most were told apart only by
// their labels. Cheap to introduce (an icon map is a list of strings, and a
// duplicate looks like a copy-paste that worked), and invisible in review.
//
// Read from source rather than by rendering: the maps are module-private, and
// what matters is the data, not the pixels.

import fs from 'fs';
import path from 'path';

const SRC = fs.readFileSync(
  path.join(__dirname, '..', 'BottomNav.js'),
  'utf8',
);

function iconsIn(mapName) {
  const block = SRC.split(`const ${mapName} = {`)[1];
  if (!block) throw new Error(`${mapName} not found in BottomNav.js`);
  const body = block.split('};')[0];
  return [...body.matchAll(/^\s*'?([^':\n]+)'?:\s*\{\s*icon:\s*'([^']+)'/gm)].map(
    (m) => ({ tab: m[1].trim(), icon: m[2] }),
  );
}

describe.each([['CLIENT_ICON_MAP'], ['BUSINESS_ICON_MAP']])(
  '%s',
  (mapName) => {
    const entries = iconsIn(mapName);

    it('defines an icon for every tab', () => {
      expect(entries.length).toBeGreaterThan(3);
      for (const e of entries) expect(e.icon).toBeTruthy();
    });

    it('never gives two tabs the same glyph', () => {
      const seen = new Map();
      const clashes = [];
      for (const { tab, icon } of entries) {
        if (seen.has(icon)) clashes.push(`${seen.get(icon)} + ${tab} → ${icon}`);
        seen.set(icon, tab);
      }
      expect(clashes).toEqual([]);
    });
  },
);
