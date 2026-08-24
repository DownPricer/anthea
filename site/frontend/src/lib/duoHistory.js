/**
 * Filtres et fusion pour l'historique Duo (Mes séances / Partenaire / Tout).
 */

export const DUO_HISTORY_SCOPES = ['mine', 'partner', 'all'];

export function getHistoryItemKey(item) {
  if (!item) return '';
  if (item.type === 'common_session') {
    return `common:${item.date || item.created_at || ''}`;
  }
  return `session:${item.id || item.created_at || ''}`;
}

export function filterDuoHistoryFeed(feed, scope, userId, partnerId) {
  const items = Array.isArray(feed) ? feed : [];
  const uid = userId != null ? String(userId) : '';
  const pid = partnerId != null ? String(partnerId) : '';

  if (scope === 'mine') {
    return items.filter(
      (item) =>
        item.type === 'common_session'
        || (item.type === 'session' && String(item.user_id) === uid),
    );
  }

  if (scope === 'partner') {
    return items.filter(
      (item) =>
        item.type === 'common_session'
        || (item.type === 'session' && String(item.user_id) === pid),
    );
  }

  const seen = new Set();
  const merged = [];
  for (const item of items) {
    const key = getHistoryItemKey(item);
    if (seen.has(key)) continue;
    seen.add(key);
    merged.push(item);
  }
  return merged.sort((a, b) => {
    const aTime = a.created_at || a.date || '';
    const bTime = b.created_at || b.date || '';
    return bTime.localeCompare(aTime);
  });
}

export function getDuoHistoryEmptyKey(scope) {
  if (scope === 'mine') return 'historyMine';
  if (scope === 'partner') return 'historyPartner';
  return 'historyAll';
}
