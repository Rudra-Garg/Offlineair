/**
 * OfflineAir — SigmetOverlay
 *
 * Renders active SIGMET zones as semi-transparent polygons on the MapView.
 * Reads from Zustand store — no props needed.
 *
 * Usage:
 *   <MapView ...>
 *     <SigmetOverlay />
 *   </MapView>
 *
 * Color coding:
 *   ADVISORY → amber  (#FF9800, 20% fill)
 *   WATCH    → orange (#FF6D00, 28% fill)
 *   WARNING  → red    (#F44336, 35% fill)
 */

import React, { useMemo } from 'react';
import { Polygon, Polyline } from 'react-native-maps';
import { useSigmets } from '../store';
import type { Sigmet } from '../db/types';

// ─── Types ────────────────────────────────────────────────────────────────────

interface LatLng {
  latitude:  number;
  longitude: number;
}

interface SigmetStyle {
  fillColor:   string;
  strokeColor: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function severityStyle(severity: Sigmet['severity']): SigmetStyle {
  switch (severity) {
    case 'WARNING':  return { fillColor: 'rgba(244,67,54,0.30)',  strokeColor: 'rgba(244,67,54,0.80)'  };
    case 'WATCH':    return { fillColor: 'rgba(255,109,0,0.25)',  strokeColor: 'rgba(255,109,0,0.75)'  };
    case 'ADVISORY': return { fillColor: 'rgba(255,152,0,0.18)', strokeColor: 'rgba(255,152,0,0.65)'  };
  }
}

/**
 * Parse a GeoJSON Polygon geometry stored in SQLite as a JSON string.
 * Returns an array of LatLng coordinate rings, or null if parsing fails.
 */
function parsePolygon(geoJSON: string): LatLng[][] | null {
  try {
    const geo = JSON.parse(geoJSON) as {
      type:        string;
      coordinates: number[][][];
    };

    if (geo.type !== 'Polygon' || !Array.isArray(geo.coordinates)) return null;

    return geo.coordinates.map(ring =>
      ring.map(([lng, lat]) => ({ latitude: lat, longitude: lng }))
    );
  } catch {
    return null;
  }
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function SigmetOverlay() {
  const sigmets = useSigmets();
  const now     = Math.floor(Date.now() / 1000);

  // Parse all active sigmets into renderable polygons
  const polygons = useMemo(() => {
    return sigmets
      .filter(s => s.validTo >= now)           // only active
      .flatMap(s => {
        const rings = parsePolygon(s.polygonGeoJSON);
        if (!rings || rings.length === 0) return [];
        const style = severityStyle(s.severity);

        // First ring = outer boundary, remaining = holes (rare for SIGMETs)
        return rings.slice(0, 1).map((coords, i) => ({
          key:         `sigmet-${s.id}-ring-${i}`,
          coords,
          fillColor:   style.fillColor,
          strokeColor: style.strokeColor,
          severity:    s.severity,
        }));
      });
  }, [sigmets, now]);

  if (polygons.length === 0) return null;

  return (
    <>
      {polygons.map(p => (
        <Polygon
          key={p.key}
          coordinates={p.coords}
          fillColor={p.fillColor}
          strokeColor={p.strokeColor}
          strokeWidth={1.5}
          tappable={false}
        />
      ))}
    </>
  );
}