import fs from 'fs';
import path from 'path';
import {
  POST_IMAGE_RATIO,
  POST_IMAGE_ASPECT_CLASS,
  POST_OUTPUT_WIDTH,
  POST_OUTPUT_HEIGHT,
  POST_VIEWPORT_WIDTH,
  POST_VIEWPORT_HEIGHT,
} from './postImageAspect';

describe('postImageAspect', () => {
  it('keeps portrait 4:5 ratio at all breakpoints', () => {
    expect(POST_IMAGE_RATIO).toBe(0.8);
    expect(POST_IMAGE_ASPECT_CLASS).toBe('aspect-[4/5]');
    expect(POST_OUTPUT_WIDTH / POST_OUTPUT_HEIGHT).toBeCloseTo(POST_IMAGE_RATIO, 5);
    expect(POST_VIEWPORT_WIDTH / POST_VIEWPORT_HEIGHT).toBeCloseTo(POST_IMAGE_RATIO, 5);
  });
});

describe('PostImageFrame', () => {
  const source = fs.readFileSync(
    path.join(__dirname, '../components/social/PostImageFrame.jsx'),
    'utf8'
  );

  it('uses unified aspect box without secondary object-cover crop', () => {
    expect(source).toContain('aspect-[4/5]');
    expect(source).toContain('object-contain');
    expect(source).not.toContain('object-cover');
    expect(source).not.toContain('max-h-');
  });
});

describe('Post display components', () => {
  const postCard = fs.readFileSync(
    path.join(__dirname, '../components/social/PostCard.jsx'),
    'utf8'
  );
  const publicCard = fs.readFileSync(
    path.join(__dirname, '../components/public/PublicPostCard.jsx'),
    'utf8'
  );
  const composer = fs.readFileSync(
    path.join(__dirname, '../components/duo/DuoPostComposer.jsx'),
    'utf8'
  );
  const shareDialog = fs.readFileSync(
    path.join(__dirname, '../components/social/ShareWorkoutDialog.jsx'),
    'utf8'
  );

  it('PostCard renders cropped images through PostImageFrame', () => {
    expect(postCard).toContain('PostImageFrame');
    expect(postCard).not.toContain('max-h-80 object-cover');
  });

  it('public and composer previews match final post frame', () => {
    expect(publicCard).toContain('PostImageFrame');
    expect(publicCard).not.toContain('aspect-video');
    expect(composer).toContain('PostImageFrame');
    expect(shareDialog).toContain('PostImageFrame');
  });
});

describe('imageCrop post output', () => {
  const source = fs.readFileSync(path.join(__dirname, './imageCrop.js'), 'utf8');

  it('exports fixed 1024x1280 portrait files', () => {
    expect(source).toContain('POST_OUTPUT_WIDTH');
    expect(source).toContain('POST_OUTPUT_HEIGHT');
    expect(POST_OUTPUT_WIDTH).toBe(1024);
    expect(POST_OUTPUT_HEIGHT).toBe(1280);
  });
});

describe('Duo shared history', () => {
  const duoPage = fs.readFileSync(
    path.join(__dirname, '../pages/DuoPage.jsx'),
    'utf8'
  );

  it('loads common sessions from duo activity feed', () => {
    expect(duoPage).toContain('getActivityFeed');
    expect(duoPage).toContain("item.type === 'common_session'");
    expect(duoPage).toContain('CommonSessionCard');
    expect(duoPage).toContain('emptyStates.sharedHistory');
    expect(duoPage).not.toContain('sessionsApi.getHistory');
  });
});

describe('Profile avatar lightbox', () => {
  const header = fs.readFileSync(
    path.join(__dirname, '../components/profile/ProfileHeader.jsx'),
    'utf8'
  );
  const lightbox = fs.readFileSync(
    path.join(__dirname, '../components/profile/ProfileAvatarLightbox.jsx'),
    'utf8'
  );

  it('opens responsive lightbox without download control', () => {
    expect(header).toContain('ProfileAvatarLightbox');
    expect(header).toContain('profile-avatar-open');
    expect(lightbox).toContain('draggable={false}');
    expect(lightbox).toContain('onContextMenu');
    expect(lightbox).toContain('object-contain');
    expect(lightbox).not.toMatch(/download/i);
  });
});

describe('Dialog accessibility', () => {
  const connections = fs.readFileSync(
    path.join(__dirname, '../components/profile/UserConnectionsModal.jsx'),
    'utf8'
  );

  it('UserConnectionsModal includes DialogDescription', () => {
    expect(connections).toContain('DialogDescription');
  });
});

describe('Appearance settings', () => {
  const settings = fs.readFileSync(
    path.join(__dirname, '../pages/SettingsPage.jsx'),
    'utf8'
  );

  it('removes preview and contrast block while keeping theme modes', () => {
    expect(settings).not.toContain('accent-contrast-preview');
    expect(settings).not.toContain('contrastOnAccent');
    expect(settings).not.toContain("t('appearance.preview')");
    expect(settings).toContain('theme-dark');
    expect(settings).toContain('theme-light');
  });
});
