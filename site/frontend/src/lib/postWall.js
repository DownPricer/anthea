const DUO_WALL_TYPES = new Set([
  'duo',
  'duo_free',
  'duo_common_session',
  'duo_badge',
  'duo_challenge',
]);

/** Publication du mur personnel (exclut mur duo, rétrocompat). */
export function isUserWallPost(post) {
  if (!post) return false;
  if (post.owner_type === 'duo') return false;
  if (post.owner_type === 'user') return true;
  if (post.duo_id) return false;
  if (DUO_WALL_TYPES.has(post.type)) return false;
  return true;
}
