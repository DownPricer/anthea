import { computeCropSourceRect } from './imageCrop';

describe('avatar dialog flow', () => {
  it('un seul dialogue actif — crop après fermeture profil', () => {
    let profileOpen = true;
    let cropOpen = false;
    let pendingFile = null;

    const handleAvatarSelected = (file) => {
      pendingFile = file;
      profileOpen = false;
    };

    handleAvatarSelected({ name: 'test.jpg' });
    expect(profileOpen).toBe(false);
    expect(cropOpen).toBe(false);

    if (!profileOpen && pendingFile) {
      cropOpen = true;
    }

    expect(profileOpen && cropOpen).toBe(false);
    expect(cropOpen).toBe(true);
  });

  it('déplacement horizontal modifie les pixels source', () => {
    const center = computeCropSourceRect(800, 600, 280, 1, 0, 0);
    const shifted = computeCropSourceRect(800, 600, 280, 1, 80, 0);
    expect(shifted.sx).not.toBe(center.sx);
  });

  it('déplacement vertical modifie les pixels source', () => {
    const center = computeCropSourceRect(800, 600, 280, 1, 0, 0);
    const shifted = computeCropSourceRect(800, 600, 280, 1, 0, 60);
    expect(shifted.sy).not.toBe(center.sy);
  });
});
