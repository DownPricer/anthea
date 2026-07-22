/**
 * Collecte les exercices récemment utilisés depuis les blocs / templates déjà en mémoire.
 * Aucune requête lourde supplémentaire.
 */
export function collectRecentExercises({ blocks = [], templates = [], limit = 10 } = {}) {
  const seen = new Set();
  const out = [];

  const push = (ex) => {
    if (!ex || out.length >= limit) return;
    const id = ex.exercise_id || ex.id;
    if (!id || seen.has(String(id))) return;
    seen.add(String(id));
    out.push({
      id: String(id),
      name: ex.name || ex.exercise_name_snapshot || 'Exercise',
      description: ex.description || '',
      image_url: ex.image_url || ex.media_snapshot || null,
      media_snapshot: ex.media_snapshot || ex.image_url || null,
      exercise_type: ex.exercise_type || ex.tracking_type_snapshot || 'reps',
      category: ex.category || 'general',
      default_duration: ex.duration || ex.default_duration || 30,
      default_reps: ex.reps || ex.default_reps || 10,
      default_rest: ex.rest_after || ex.default_rest || 30,
      tracking_type: ex.tracking_type_snapshot || ex.tracking_type || ex.exercise_type,
      name_i18n: ex.exercise_name_i18n_snapshot || ex.name_i18n || undefined,
      source_kind: 'recent',
      is_system: true,
    });
  };

  for (const block of blocks) {
    for (const ex of block?.exercises || []) push(ex);
  }
  for (const template of templates) {
    for (const block of template?.blocks || []) {
      for (const ex of block?.exercises || []) push(ex);
    }
  }

  return out;
}

export function mergeRecentWithCatalog(recent = [], catalogItems = [], limit = 10) {
  const seen = new Set();
  const out = [];
  for (const item of [...recent, ...catalogItems]) {
    if (!item || out.length >= limit) break;
    const id = String(item.id || item.exercise_id || '');
    if (!id || seen.has(id)) continue;
    seen.add(id);
    out.push(item);
  }
  return out;
}
