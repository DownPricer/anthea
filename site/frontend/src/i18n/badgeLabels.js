import i18n from "./index";

function isUsableTranslation(value, key) {
  if (!value || typeof value !== "string") return false;
  if (value === key || value.endsWith(`.${key}`) || value === `badges:${key}`) return false;
  if (value === "…" || value === "...") return false;
  // Fallbacks neutres du parseMissingKeyHandler
  if (
    value === "Texte indisponible" ||
    value === "Text unavailable" ||
    value === "Texto no disponible"
  ) {
    return false;
  }
  return true;
}

export function getBadgeName(badgeId, t, fallbackName = "") {
  if (!badgeId) return fallbackName || "";
  const key = `${badgeId}.name`;
  const fullKey = `badges:${key}`;
  try {
    if (i18n.exists?.(fullKey) || i18n.exists?.(key, { ns: "badges" })) {
      const translated = typeof t === "function" ? t(fullKey) : i18n.t(fullKey);
      if (isUsableTranslation(translated, key)) return translated;
    }
  } catch {
    // ignore
  }
  if (typeof t === "function") {
    const translated = t(fullKey, { defaultValue: fallbackName || "" });
    if (isUsableTranslation(translated, key) && translated !== (fallbackName || "")) {
      return translated;
    }
  }
  return fallbackName || badgeId;
}

export function getBadgeDescription(badgeId, t, fallbackDescription = "") {
  if (!badgeId) return fallbackDescription || "";
  const key = `${badgeId}.description`;
  const fullKey = `badges:${key}`;
  try {
    if (i18n.exists?.(fullKey) || i18n.exists?.(key, { ns: "badges" })) {
      const translated = typeof t === "function" ? t(fullKey) : i18n.t(fullKey);
      if (isUsableTranslation(translated, key)) return translated;
    }
  } catch {
    // ignore
  }
  if (typeof t === "function") {
    const translated = t(fullKey, { defaultValue: fallbackDescription || "" });
    if (isUsableTranslation(translated, key) && translated !== (fallbackDescription || "")) {
      return translated;
    }
  }
  return fallbackDescription || "";
}

export function resolveBadgeLabels(badge, t) {
  if (!badge) {
    return { name: "", description: "", isSecret: false };
  }
  const badgeId = badge.id || badge.badge_id;
  const unlocked = Boolean(badge.unlocked);
  const isSecret = Boolean(badge.is_secret) && !unlocked;
  if (isSecret) {
    return {
      name: typeof t === "function" ? t("badges:secret") : "Succès secret",
      description: typeof t === "function" ? t("badges:secretHint") : "",
      isSecret: true,
    };
  }
  return {
    name: getBadgeName(badgeId, t, badge.name),
    description: getBadgeDescription(badgeId, t, badge.description),
    isSecret: false,
  };
}
