/**
 * Filtres et fusion pour l'historique Duo (Mes séances / Partenaire / Tout).
 */

export const DUO_HISTORY_SCOPES = ['mine', 'partner', 'all'];

function commonSessionIdentity(item) {
  if (item?.id) return String(item.id);
  if (item?.common_session_id) return String(item.common_session_id);
  if (item?.session_id) return String(item.session_id);
  const a = item?.session_a?.id;
  const b = item?.session_b?.id;
  if (a && b) {
    return [String(a), String(b)].sort().join(':');
  }
  return `${item?.date || item?.created_at || 'unknown'}`;
}

export function getHistoryItemKey(item) {
  if (!item) return '';
  if (item.type === 'common_session') {
    return `common:${commonSessionIdentity(item)}`;
  }
  const sid = item.id || item.session_id || item._id;
  if (sid) return `session:${sid}`;
  return `session:${item.created_at || ''}`;
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
