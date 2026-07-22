import fs from 'fs';
import path from 'path';

describe('ProfileHeader compact layout', () => {
  const source = fs.readFileSync(
    path.join(__dirname, 'ProfileHeader.jsx'),
    'utf8'
  );

  it('uses a compact mobile avatar size (64px)', () => {
    expect(source).toMatch(/w-16 h-16/);
    expect(source).not.toMatch(/w-\[96px\]|w-28 h-28/);
  });

  it('uses compact sm/desktop avatars (80 / 88px)', () => {
    expect(source).toMatch(/sm:w-20 sm:h-20/);
    expect(source).toMatch(/md:w-\[88px\] md:h-\[88px\]/);
  });

  it('reduces padding and vertical gaps on mobile', () => {
    expect(source).toMatch(/relative p-3 sm:p-4/);
    expect(source).toMatch(/gap-2\.5 sm:gap-3/);
    expect(source).not.toMatch(/relative p-4 sm:p-5/);
    expect(source).not.toMatch(/sm:flex-row sm:items-start gap-3 sm:gap-4/);
  });

  it('keeps essential identity controls', () => {
    expect(source).toContain('profile-header');
    expect(source).toContain('profile-edit-btn');
    expect(source).toContain('ProfileFeaturedBadges');
    expect(source).toContain('getDisplayName');
    expect(source).toContain('formatHandle');
  });
});
