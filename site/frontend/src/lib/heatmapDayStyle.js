const EMPTY_COLOR = '#1a1a1a';

/** Style d'une cellule heatmap basé uniquement sur les séances terminées. */
export function getHeatmapDayStyle(info, { accentColor, partnerColor } = {}) {
  const accent = accentColor || '#06b6d4';
  const partner = partnerColor || '#f97316';

  if (!info || info.is_future) {
    return { fill: EMPTY_COLOR, kind: 'empty', label: 'Jour futur' };
  }

  const my = !!info.my_completed;
  const partnerDone = !!info.partner_completed;
  const both = !!info.both_completed || (my && partnerDone);

  if (!my && !partnerDone) {
    return { fill: EMPTY_COLOR, kind: 'empty', label: 'Aucune séance' };
  }

  if (both) {
    return {
      fill: accent,
      gradient: [accent, partner],
      kind: 'duo',
      label: 'Séance duo',
    };
  }

  if (my) {
    return { fill: accent, kind: 'solo', label: 'Séance solo' };
  }

  return { fill: partner, kind: 'partner', label: 'Séance partenaire' };
}

export function heatmapDayTitle(info, dateLabel) {
  if (!info) return dateLabel;
  const parts = [dateLabel];
  const count = (info.my_session_count || 0) + (info.partner_session_count || 0);
  if (count > 0) {
    parts.push(`${count} séance${count > 1 ? 's' : ''}`);
  }
  if (info.both_completed) {
    parts.push('Duo');
  } else if (info.my_completed) {
    parts.push('Solo');
  } else if (info.partner_completed) {
    parts.push('Partenaire');
  }
  const titles = [
    ...(info.my_session_titles || []),
    ...(info.partner_session_titles || []),
  ].filter(Boolean);
  if (titles.length) {
    parts.push(titles.slice(0, 3).join(' · '));
  }
  return parts.join(' — ');
}

export function paintHeatmapCell(ctx, x, y, size, style) {
  if (style.gradient) {
    const grad = ctx.createLinearGradient(x, y, x + size, y + size);
    grad.addColorStop(0, style.gradient[0]);
    grad.addColorStop(0.5, style.gradient[0]);
    grad.addColorStop(0.5, style.gradient[1]);
    grad.addColorStop(1, style.gradient[1]);
    ctx.fillStyle = grad;
  } else {
    ctx.fillStyle = style.fill || EMPTY_COLOR;
  }
  ctx.fillRect(x, y, size, size);
}
