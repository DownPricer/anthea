/**
 * Prévisualisation du tracé d'activité
 * Affiche toujours un SVG (pas besoin de clé API)
 * Option MapLibre si REACT_APP_MAP_STYLE_URL est configuré (lazy load, fallback SVG)
 */

import React, { useMemo, lazy, Suspense } from 'react';
import { calculateBoundingBox } from '../../lib/activities/geo';

// Lazy import MapLibre (optionnel)
const MapLibrePreview = lazy(() =>
  import('./MapLibrePreview').catch(() => ({
    default: () => null, // Fallback silencieux si MapLibre absent
  }))
);

export function ActivityRoutePreview({ 
  points, 
  className = '', 
  width = 400, 
  height = 300,
  showMap = false,
}) {
  const bbox = useMemo(() => calculateBoundingBox(points), [points]);

  // Si pas de points valides
  if (!bbox || !Array.isArray(points) || points.length === 0) {
    return (
      <div
        className={`flex items-center justify-center bg-hover rounded-xl ${className}`}
        style={{ width, height }}
      >
        <p className="text-subtle text-sm">Aucun tracé disponible</p>
      </div>
    );
  }

  // Affiche MapLibre si demandé et disponible
  const hasMapConfig = !!process.env.REACT_APP_MAP_STYLE_URL;
  
  if (showMap && hasMapConfig) {
    return (
      <Suspense fallback={<SvgRoutePreview bbox={bbox} points={points} width={width} height={height} className={className} />}>
        <MapLibrePreview
          points={points}
          bbox={bbox}
          width={width}
          height={height}
          className={className}
        />
      </Suspense>
    );
  }

  // Fallback: SVG simple
  return <SvgRoutePreview bbox={bbox} points={points} width={width} height={height} className={className} />;
}

function SvgRoutePreview({ bbox, points, width, height, className }) {
  const padding = 20;
  const viewWidth = width - padding * 2;
  const viewHeight = height - padding * 2;

  const latRange = bbox.maxLat - bbox.minLat;
  const lonRange = bbox.maxLon - bbox.minLon;

  // Projette un point lat/lon en coordonnées SVG
  const project = (lat, lon) => {
    const x = padding + ((lon - bbox.minLon) / lonRange) * viewWidth;
    const y = padding + ((bbox.maxLat - lat) / latRange) * viewHeight;
    return { x, y };
  };

  // Génère le path SVG
  const pathData = useMemo(() => {
    if (points.length === 0) return '';

    const segments = [];
    let currentSegment = [];

    points.forEach((point, i) => {
      const { x, y } = project(point.lat, point.lon);

      if (point.segment === 'new_segment' && currentSegment.length > 0) {
        // Nouveau segment (après pause)
        segments.push(currentSegment);
        currentSegment = [];
      }

      if (i === 0) {
        currentSegment.push(`M ${x} ${y}`);
      } else {
        currentSegment.push(`L ${x} ${y}`);
      }
    });

    if (currentSegment.length > 0) {
      segments.push(currentSegment);
    }

    return segments.map((seg) => seg.join(' ')).join(' ');
  }, [points, bbox]);

  const startPoint = points[0];
  const endPoint = points[points.length - 1];
  const startPos = project(startPoint.lat, startPoint.lon);
  const endPos = project(endPoint.lat, endPoint.lon);

  return (
    <svg
      width={width}
      height={height}
      className={`bg-hover rounded-xl ${className}`}
      viewBox={`0 0 ${width} ${height}`}
    >
      <path
        d={pathData}
        fill="none"
        stroke="var(--theme-primary)"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      
      {/* Point de départ */}
      <circle
        cx={startPos.x}
        cy={startPos.y}
        r="6"
        fill="#22c55e"
        stroke="white"
        strokeWidth="2"
      />

      {/* Point d'arrivée */}
      <circle
        cx={endPos.x}
        cy={endPos.y}
        r="6"
        fill="#ef4444"
        stroke="white"
        strokeWidth="2"
      />
    </svg>
  );
}

export default ActivityRoutePreview;
