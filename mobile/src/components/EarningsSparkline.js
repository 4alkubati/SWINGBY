import React from 'react';
import { View } from 'react-native';
import Svg, {
  Path,
  Defs,
  LinearGradient,
  Stop,
} from 'react-native-svg';
import { colors } from '../theme/tokens';

// Simple monotone-ish curve rendered as SVG. Vertical purple fade fill under
// a 2.5px accentText stroke. Height ~44px per handoff.
export default function EarningsSparkline({
  data,
  width = 320,
  height = 44,
  strokeWidth = 2.5,
}) {
  const points = normalizePoints(data && data.length ? data : DEFAULT_POINTS, width, height);
  const pathD = buildSmoothPath(points);
  const areaD = `${pathD} L ${width} ${height} L 0 ${height} Z`;

  return (
    <View style={{ width: '100%', height }}>
      <Svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none">
        <Defs>
          <LinearGradient id="sparkFill" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor="#8878F9" stopOpacity="0.28" />
            <Stop offset="1" stopColor="#8878F9" stopOpacity="0" />
          </LinearGradient>
        </Defs>
        <Path d={areaD} fill="url(#sparkFill)" />
        <Path
          d={pathD}
          stroke={colors.accentText}
          strokeWidth={strokeWidth}
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </Svg>
    </View>
  );
}

const DEFAULT_POINTS = [22, 28, 20, 34, 30, 42, 38, 52, 48, 60];

function normalizePoints(vals, width, height) {
  const min = Math.min(...vals);
  const max = Math.max(...vals);
  const range = max - min || 1;
  const step = width / (vals.length - 1 || 1);
  const pad = 6;
  return vals.map((v, i) => ({
    x: i * step,
    y: pad + (1 - (v - min) / range) * (height - pad * 2),
  }));
}

// Catmull-Rom → Bezier smoothing so the line reads like a real sparkline.
function buildSmoothPath(points) {
  if (points.length === 0) return '';
  if (points.length === 1) {
    const p = points[0];
    return `M ${p.x} ${p.y}`;
  }
  let d = `M ${points[0].x} ${points[0].y}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i - 1] || points[i];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[i + 2] || p2;
    const cp1x = p1.x + (p2.x - p0.x) / 6;
    const cp1y = p1.y + (p2.y - p0.y) / 6;
    const cp2x = p2.x - (p3.x - p1.x) / 6;
    const cp2y = p2.y - (p3.y - p1.y) / 6;
    d += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${p2.x} ${p2.y}`;
  }
  return d;
}
