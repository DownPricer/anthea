/**
 * Garantit un tableau à partir d'une réponse API ou d'une valeur inconnue.
 */
export function normalizeArray(value) {
  if (Array.isArray(value)) return value;
  if (Array.isArray(value?.posts)) return value.posts;
  if (Array.isArray(value?.items)) return value.items;
  if (Array.isArray(value?.results)) return value.results;
  if (Array.isArray(value?.data)) return value.data;
  return [];
}
