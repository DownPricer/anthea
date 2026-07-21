/**
 * Résout le titre/description d'un défi système via challenge_id.
 * Les défis personnalisés (sans traduction) gardent leur texte utilisateur.
 */
export function resolveChallengeLabels(challenge, t) {
  if (!challenge) return { title: "", description: "" };
  const id = challenge.id || challenge.challenge_id;
  const fallbackTitle = challenge.title || "";
  const fallbackDescription = challenge.description || "";
  if (!id || typeof t !== "function") {
    return { title: fallbackTitle, description: fallbackDescription };
  }

  const titleKey = `challenges:${id}.title`;
  const descKey = `challenges:${id}.description`;
  const title = t(titleKey, { defaultValue: "" });
  const description = t(descKey, { defaultValue: "" });

  const usable = (value, key) =>
    value &&
    typeof value === "string" &&
    value.trim() &&
    value !== key &&
    !value.endsWith(`.${id}.title`) &&
    !value.endsWith(`.${id}.description`) &&
    value !== "Texte indisponible" &&
    value !== "Text unavailable" &&
    value !== "Texto no disponible";

  return {
    title: usable(title, titleKey) ? title : fallbackTitle,
    description: usable(description, descKey) ? description : fallbackDescription,
  };
}
