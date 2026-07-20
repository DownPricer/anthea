import { normalizeBadgeRarityKey, LABEL_TO_KEY } from '../components/badges/BadgeArtwork';
import { getBadgeRarityStyle } from './badgeStyles';

describe('badge rarity styles', () => {
  test('maps FR and EN keys', () => {
    expect(normalizeBadgeRarityKey('Commun')).toBe('common');
    expect(normalizeBadgeRarityKey('rare')).toBe('rare');
    expect(normalizeBadgeRarityKey('Épique')).toBe('epic');
    expect(normalizeBadgeRarityKey('legendary')).toBe('legendary');
  });

  test('styles exist for all rarities', () => {
    ['Commun', 'Rare', 'Épique', 'Légendaire', 'common', 'rare', 'epic', 'legendary'].forEach((r) => {
      const style = getBadgeRarityStyle(r);
      expect(style.label).toBeTruthy();
      expect(style.border).toBeTruthy();
    });
  });

  test('LABEL_TO_KEY covers four rarities', () => {
    expect(LABEL_TO_KEY.common).toBe('common');
    expect(LABEL_TO_KEY.Diamant).toBe('legendary');
  });
});
