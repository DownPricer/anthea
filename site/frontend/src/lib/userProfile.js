const HANDLE_PATTERN = /^[a-z0-9_]{3,30}$/;

export function normalizeHandle(value) {
  if (!value || !String(value).trim()) return '';
  let raw = String(value).trim().toLowerCase().replace(/^@+/, '');
  raw = raw.replace(/\s+/g, '').replace(/[^a-z0-9_]/g, '');
  return raw;
}

export function isValidHandle(value) {
  const normalized = normalizeHandle(value);
  return HANDLE_PATTERN.test(normalized);
}

export function getPublicHandle(user) {
  return user?.handle || user?.username || '';
}

export function getAvatarInitial(user) {
  const name = user?.display_name || user?.username || 'U';
  return name.charAt(0).toUpperCase();
}

export function getAvatarFallbackStyle(user) {
  const seed = getPublicHandle(user) || 'user';
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) {
    hash = seed.charCodeAt(i) + ((hash << 5) - hash);
  }
  const hue = Math.abs(hash) % 360;
  return {
    background: `linear-gradient(135deg, hsl(${hue} 65% 45%), hsl(${(hue + 40) % 360} 55% 35%))`,
  };
}

export function getDisplayName(user) {
  return user?.display_name || user?.username || 'Utilisateur';
}

export function formatHandle(user) {
  const handle = normalizeHandle(getPublicHandle(user));
  return handle ? `@${handle}` : '';
}

export function isOwnProfile(viewer, profileUser) {
  if (!viewer || !profileUser) return false;
  return viewer.id === profileUser.id;
}

export function isProfilePrivate(profileUser) {
  return profileUser?.account_visibility !== 'public';
}

export function isMutualFriend(profileUser) {
  return !!profileUser?.is_mutual;
}

export function isProfileLimited(profileUser, viewer) {
  if (!profileUser) return true;
  if (isOwnProfile(viewer, profileUser)) return false;
  if (profileUser.is_limited != null) return !!profileUser.is_limited;
  if (isMutualFriend(profileUser)) return false;
  return isProfilePrivate(profileUser);
}

export function canViewProfileSection(profileUser, viewer, section) {
  if (!profileUser) return false;
  if (isOwnProfile(viewer, profileUser)) return true;

  if (isProfileLimited(profileUser, viewer)) {
    return section === 'header';
  }

  const flags = {
    stats: profileUser.show_stats,
    badges: profileUser.show_badges !== false,
    activity: profileUser.show_recent_activity,
    sessions: profileUser.show_sessions,
    posts: profileUser.show_posts,
  };

  return !!flags[section];
}

export function formatCount(value) {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) return '0';
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`;
  if (n >= 10_000) return `${Math.round(n / 1000)}k`;
  if (n >= 1_000) return `${(n / 1000).toFixed(1).replace(/\.0$/, '')}k`;
  return String(Math.floor(n));
}

export function formatDuration(seconds) {
  const total = Math.max(0, Math.floor(Number(seconds) || 0));
  if (total < 60) return `${total}s`;
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes} min`;
}
