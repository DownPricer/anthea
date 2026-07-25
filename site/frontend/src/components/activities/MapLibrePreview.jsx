/**
 * Prévisualisation cartographique optionnelle (MapLibre).
 * Nécessite REACT_APP_MAP_STYLE_URL — sinon le parent utilise le fallback SVG.
 */

import React from 'react';

export function MapLibrePreview({ points, bbox, width, height, className }) {
  const styleUrl = process.env.REACT_APP_MAP_STYLE_URL;
  if (!styleUrl || !points?.length) {
    return null;
  }

  // MapLibre n'est pas embarqué par défaut : fallback silencieux en production web.
  // Le tracé SVG reste la source principale d'affichage FitMatch.
  return (
    <div
      className={`flex items-center justify-center bg-hover rounded-xl text-subtle text-sm ${className || ''}`}
      style={{ width, height }}
      data-testid="maplibre-fallback"
    >
      {styleUrl ? 'Carte non disponible — tracé SVG actif' : null}
    </div>
  );
}

export default MapLibrePreview;
