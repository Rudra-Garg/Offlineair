/**
 * OfflineAir — AltitudeGraph
 *
 * Sparkline showing estimated altitude over elapsed flight time.
 * Reads from Zustand `estimatedTrack` — updates live every 30s.
 * Falls back to the speed profile curve when track is empty (pre-first-tick).
 *
 * Uses react-native-svg (already in package.json).
 *
 * Usage:
 *   <AltitudeGraph width={width} height={72} />
 */

import React, { useMemo } from 'react';
import Svg, { Path, Line, Text as SvgText, Defs, LinearGradient, Stop, Rect } from 'react-native-svg';
import { useMapViewModel, useEstimatedTrack } from '../store';

// ─── Props ────────────────────────────────────────────────────────────────────

interface AltitudeGraphProps {
  width:  number;
  height?: number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Linear interpolation */
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/** Map a value in [inMin, inMax] to [outMin, outMax] */
function mapRange(
  value: number,
  inMin: number, inMax: number,
  outMin: number, outMax: number,
): number {
  if (inMax === inMin) return outMin;
  return outMin + ((value - inMin) / (inMax - inMin)) * (outMax - outMin);
}

/** Build an SVG polyline path string from x/y point pairs */
function buildPath(points: Array<[number, number]>): string {
  if (points.length === 0) return '';
  const [first, ...rest] = points;
  return [`M ${first[0].toFixed(1)} ${first[1].toFixed(1)}`,
    ...rest.map(([x, y]) => `L ${x.toFixed(1)} ${y.toFixed(1)}`)
  ].join(' ');
}

/** Build a closed fill path (line + bottom edge) */
function buildFillPath(points: Array<[number, number]>, bottomY: number): string {
  if (points.length === 0) return '';
  const line  = buildPath(points);
  const last  = points[points.length - 1];
  const first = points[0];
  return `${line} L ${last[0].toFixed(1)} ${bottomY} L ${first[0].toFixed(1)} ${bottomY} Z`;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function AltitudeGraph({ width, height = 72 }: AltitudeGraphProps) {
  const estimatedTrack = useEstimatedTrack();
  const speedProfile   = useMapViewModel(s => s.speedProfile);
  const livePosition   = useMapViewModel(s => s.livePosition);

  const PAD_LEFT   = 36;  // space for y-axis label
  const PAD_RIGHT  = 8;
  const PAD_TOP    = 8;
  const PAD_BOTTOM = 18;  // space for x-axis label
  const graphW     = width  - PAD_LEFT - PAD_RIGHT;
  const graphH     = height - PAD_TOP  - PAD_BOTTOM;

  // ── Build data points ──────────────────────────────────────────────────────
  const { points, maxAlt, currentX } = useMemo(() => {
    // Prefer real estimated track; fall back to speed profile curve
    const useTrack = estimatedTrack.length >= 2;

    type DataPoint = { elapsedMin: number; altFt: number };
    let data: DataPoint[] = [];

    if (useTrack) {
      const t0 = estimatedTrack[0].timestamp;
      data = estimatedTrack.map(p => ({
        elapsedMin: (p.timestamp - t0) / 60,
        altFt:      p.altitudeFt,
      }));
    } else if (speedProfile.length >= 2) {
      data = speedProfile.map(p => ({
        elapsedMin: p.elapsedMinutes,
        altFt:      p.altitudeFt,
      }));
    }

    if (data.length < 2) return { points: [], maxAlt: 40_000, currentX: null };

    const minElapsed = data[0].elapsedMin;
    const maxElapsed = data[data.length - 1].elapsedMin;
    const maxAlt     = Math.max(...data.map(d => d.altFt), 1);

    const pts: Array<[number, number]> = data.map(d => [
      PAD_LEFT + mapRange(d.elapsedMin, minElapsed, maxElapsed, 0, graphW),
      PAD_TOP  + mapRange(d.altFt, 0, maxAlt, graphH, 0),
    ]);

    // Current position marker x
    let currentX: number | null = null;
    if (livePosition && useTrack) {
      const nowMin = (Date.now() / 1000 - estimatedTrack[0].timestamp) / 60;
      const frac   = Math.min(1, Math.max(0, (nowMin - minElapsed) / (maxElapsed - minElapsed)));
      currentX     = PAD_LEFT + frac * graphW;
    }

    return { points: pts, maxAlt, currentX };
  }, [estimatedTrack, speedProfile, livePosition]);

  const linePath = buildPath(points);
  const fillPath = buildFillPath(points, PAD_TOP + graphH);
  const bottomY  = PAD_TOP + graphH;

  // ── Y-axis label (max altitude) ────────────────────────────────────────────
  const maxAltLabel = maxAlt >= 1000
    ? `${Math.round(maxAlt / 1000)}k`
    : `${Math.round(maxAlt)}`;

  return (
    <Svg width={width} height={height}>
      <Defs>
        <LinearGradient id="altGrad" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0%"   stopColor="#4A9EFF" stopOpacity={0.35} />
          <Stop offset="100%" stopColor="#4A9EFF" stopOpacity={0.02} />
        </LinearGradient>
      </Defs>

      {/* Baseline */}
      <Line
        x1={PAD_LEFT} y1={bottomY}
        x2={PAD_LEFT + graphW} y2={bottomY}
        stroke="rgba(255,255,255,0.1)" strokeWidth={1}
      />

      {/* Mid-altitude guide */}
      <Line
        x1={PAD_LEFT} y1={PAD_TOP + graphH / 2}
        x2={PAD_LEFT + graphW} y2={PAD_TOP + graphH / 2}
        stroke="rgba(255,255,255,0.05)" strokeWidth={1}
        strokeDasharray="4 4"
      />

      {/* Fill area */}
      {fillPath ? (
        <Path d={fillPath} fill="url(#altGrad)" />
      ) : null}

      {/* Line */}
      {linePath ? (
        <Path
          d={linePath}
          stroke="#4A9EFF"
          strokeWidth={1.5}
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ) : null}

      {/* Current position marker */}
      {currentX !== null && (
        <>
          <Line
            x1={currentX} y1={PAD_TOP}
            x2={currentX} y2={bottomY}
            stroke="rgba(255,255,255,0.3)"
            strokeWidth={1}
            strokeDasharray="3 3"
          />
          {/* Dot on the line */}
          {points.length > 0 && (() => {
            // Interpolate y at currentX
            const sorted = [...points].sort((a, b) => a[0] - b[0]);
            let dotY = PAD_TOP + graphH / 2;
            for (let i = 0; i < sorted.length - 1; i++) {
              if (currentX! >= sorted[i][0] && currentX! <= sorted[i + 1][0]) {
                const t = (currentX! - sorted[i][0]) / (sorted[i + 1][0] - sorted[i][0]);
                dotY = lerp(sorted[i][1], sorted[i + 1][1], t);
                break;
              }
            }
            return (
              <Rect
                x={currentX! - 3}
                y={dotY - 3}
                width={6}
                height={6}
                rx={3}
                fill="#4A9EFF"
                stroke="#FFFFFF"
                strokeWidth={1.5}
              />
            );
          })()}
        </>
      )}

      {/* Y-axis label — max altitude */}
      <SvgText
        x={PAD_LEFT - 4}
        y={PAD_TOP + 4}
        fontSize={9}
        fill="rgba(142,142,147,0.8)"
        textAnchor="end"
        alignmentBaseline="hanging"
      >
        {maxAltLabel}ft
      </SvgText>

      {/* Y-axis label — ground */}
      <SvgText
        x={PAD_LEFT - 4}
        y={bottomY}
        fontSize={9}
        fill="rgba(142,142,147,0.8)"
        textAnchor="end"
        alignmentBaseline="baseline"
      >
        0
      </SvgText>

      {/* X-axis label */}
      <SvgText
        x={PAD_LEFT + graphW / 2}
        y={height - 2}
        fontSize={9}
        fill="rgba(142,142,147,0.6)"
        textAnchor="middle"
        alignmentBaseline="baseline"
      >
        elapsed time
      </SvgText>
    </Svg>
  );
}