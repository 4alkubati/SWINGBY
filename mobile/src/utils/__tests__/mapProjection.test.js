// The Huawei has no Play Services, so MapCanvas is the ONLY map the walkthrough
// device will ever render. It was drawing hardcoded coordinates — a provider
// parked at dead centre and a dashed route through five invented points. These
// tests cover the geometry that replaces it, because it is geometry nobody can
// eyeball on a gradient background: a pin 30° off is still "a pin on a map".
import {
  projectToBox,
  asPercent,
  distanceKm,
  formatDistance,
} from '../mapProjection';

const BOX = { width: 360, height: 264 };

// Calgary. Latitude matters: cos(51°) ~ 0.63, so longitude is compressed here.
const DOWNTOWN = { lat: 51.0447, lng: -114.0719, key: 'dest' };

describe('distanceKm', () => {
  it('measures a known short hop', () => {
    // ~0.01 degree of latitude is ~1.11 km.
    const d = distanceKm(DOWNTOWN, { lat: 51.0547, lng: -114.0719 });
    expect(d).toBeGreaterThan(1.0);
    expect(d).toBeLessThan(1.2);
  });

  it('is symmetric', () => {
    const a = DOWNTOWN;
    const b = { lat: 51.09, lng: -114.13 };
    expect(distanceKm(a, b)).toBeCloseTo(distanceKm(b, a), 9);
  });

  it('is zero for the same point', () => {
    expect(distanceKm(DOWNTOWN, { ...DOWNTOWN })).toBeCloseTo(0, 9);
  });

  it('returns null rather than NaN for junk', () => {
    expect(distanceKm(null, DOWNTOWN)).toBeNull();
    expect(distanceKm({ lat: 'x', lng: 1 }, DOWNTOWN)).toBeNull();
    expect(distanceKm({ lat: NaN, lng: 1 }, DOWNTOWN)).toBeNull();
  });
});

describe('formatDistance', () => {
  it('uses metres below a kilometre', () => {
    expect(formatDistance(0.42)).toBe('400 m');
  });
  it('uses one decimal kilometre above', () => {
    expect(formatDistance(2.34)).toBe('2.3 km');
  });
  it('passes null through instead of printing NaN at a user', () => {
    expect(formatDistance(null)).toBeNull();
    expect(formatDistance(NaN)).toBeNull();
  });
});

describe('projectToBox', () => {
  it('puts a lone point at the centre — it has no extent to scale against', () => {
    const r = projectToBox([DOWNTOWN], BOX);
    expect(r.points[0].x).toBeCloseTo(180, 6);
    expect(r.points[0].y).toBeCloseTo(132, 6);
  });

  it('puts coincident points at the centre without dividing by zero', () => {
    const r = projectToBox([DOWNTOWN, { ...DOWNTOWN, key: 'prov' }], BOX);
    for (const p of r.points) {
      expect(Number.isFinite(p.x)).toBe(true);
      expect(Number.isFinite(p.y)).toBe(true);
      expect(p.x).toBeCloseTo(180, 6);
    }
  });

  it('puts north up', () => {
    const north = { lat: 51.09, lng: -114.0719, key: 'prov' };
    const { points } = projectToBox([DOWNTOWN, north], BOX);
    const dest = points.find((p) => p.key === 'dest');
    const prov = points.find((p) => p.key === 'prov');
    expect(prov.y).toBeLessThan(dest.y);
  });

  it('puts east right', () => {
    const east = { lat: 51.0447, lng: -114.0, key: 'prov' };
    const { points } = projectToBox([DOWNTOWN, east], BOX);
    const dest = points.find((p) => p.key === 'dest');
    const prov = points.find((p) => p.key === 'prov');
    expect(prov.x).toBeGreaterThan(dest.x);
  });

  it('corrects for longitude compression instead of stretching east-west', () => {
    // A degree of longitude at 51°N covers ~0.63 of the ground a degree of
    // latitude does. Equal DEGREE offsets must therefore NOT come out as equal
    // pixel offsets — the naive mapping's exact mistake.
    const sameDegrees = projectToBox(
      [
        { lat: 51.0, lng: -114.0, key: 'origin' },
        { lat: 51.02, lng: -114.0, key: 'north' },
        { lat: 51.0, lng: -113.98, key: 'east' },
      ],
      { width: 400, height: 400 }
    );
    const o = sameDegrees.points.find((p) => p.key === 'origin');
    const n = sameDegrees.points.find((p) => p.key === 'north');
    const e = sameDegrees.points.find((p) => p.key === 'east');

    const northPx = Math.abs(n.y - o.y);
    const eastPx = Math.abs(e.x - o.x);
    // cos(51°) ~= 0.629
    expect(eastPx / northPx).toBeGreaterThan(0.55);
    expect(eastPx / northPx).toBeLessThan(0.70);
  });

  it('keeps every point inside the box', () => {
    const { points } = projectToBox(
      [DOWNTOWN, { lat: 51.15, lng: -114.25, key: 'prov' }],
      BOX
    );
    for (const p of points) {
      expect(p.x).toBeGreaterThanOrEqual(0);
      expect(p.x).toBeLessThanOrEqual(BOX.width);
      expect(p.y).toBeGreaterThanOrEqual(0);
      expect(p.y).toBeLessThanOrEqual(BOX.height);
    }
  });

  it('drops a fix that has not arrived instead of plotting a fake one', () => {
    const r = projectToBox([DOWNTOWN, null, { lat: null, lng: null }], BOX);
    expect(r.points).toHaveLength(1);
    expect(r.points[0].key).toBe('dest');
  });

  it('returns null when there is nothing real to draw', () => {
    expect(projectToBox([], BOX)).toBeNull();
    expect(projectToBox([null], BOX)).toBeNull();
  });

  it('returns null for a box that has not been measured yet', () => {
    // onLayout has not fired — the caller must render nothing, not divide by zero.
    expect(projectToBox([DOWNTOWN], null)).toBeNull();
    expect(projectToBox([DOWNTOWN], { width: 0, height: 264 })).toBeNull();
  });

  it('survives a box smaller than its own padding', () => {
    const r = projectToBox([DOWNTOWN, { lat: 51.05, lng: -114.08, key: 'p' }], {
      width: 20,
      height: 16,
    });
    for (const p of r.points) {
      expect(Number.isFinite(p.x)).toBe(true);
      expect(Number.isFinite(p.y)).toBe(true);
    }
  });
});

describe('asPercent', () => {
  it('converts pixels to percentages for the View-positioned pins', () => {
    expect(asPercent({ x: 180, y: 132 }, BOX)).toMatchObject({ x: 50, y: 50 });
  });
  it('returns null on an unmeasured box', () => {
    expect(asPercent({ x: 1, y: 1 }, null)).toBeNull();
  });
});
