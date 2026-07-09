import { getAccentForUser } from './userAccent';

export const DUO_RELATION_OPTIONS = [
  { value: 'couple', label: 'Couple' },
  { value: 'friends', label: 'Amis' },
  { value: 'partners', label: 'Partenaires' },
  { value: 'coach_student', label: 'Coach / élève' },
  { value: 'student_coach', label: 'Élève / coach' },
  { value: 'other', label: 'Autre' },
];

export function getDuoRelationLabel(relationType) {
  const found = DUO_RELATION_OPTIONS.find((o) => o.value === relationType);
  if (found) return found.label;
  const legacy = {
    partner: 'Partenaires',
    coach: 'Coach / élève',
    trainer: 'Coach / élève',
    coach_partner: 'Coach + Partenaire',
    student: 'Élève / coach',
  };
  return legacy[relationType] || 'Partenaires';
}

export function isDuoLimited(duoProfile) {
  return !!duoProfile?.is_limited;
}

export function isDuoMember(duoProfile, user) {
  if (!duoProfile || !user) return false;
  return !!duoProfile.is_member;
}

export function canViewDuoSection(duoProfile, section) {
  if (!duoProfile) return false;
  if (duoProfile.is_limited) return false;
  if (duoProfile.is_member) return true;
  const map = {
    stats: 'show_stats',
    badges: 'show_badges',
    activity: 'show_recent_activity',
    posts: 'show_posts',
    challenges: 'show_challenges',
  };
  const flag = map[section];
  return flag ? !!duoProfile[flag] : true;
}

export function formatDuoTag(duoProfile) {
  if (!duoProfile) return '';
  return duoProfile.tag || `${duoProfile.name}#${duoProfile.short_id}`;
}

export function duoProfilePath(tag) {
  return `/duo/${encodeURIComponent(tag)}`;
}

export function getDuoGradientStyle(memberA, memberB, theme = 'default') {
  const colorA = getAccentForUser(memberA, theme);
  const colorB = getAccentForUser(memberB, theme);
  return {
    background: `linear-gradient(135deg, ${colorA}22, ${colorB}22)`,
    borderColor: `${colorA}55`,
  };
}
