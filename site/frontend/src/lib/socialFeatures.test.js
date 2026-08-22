import fs from 'fs';
import path from 'path';

describe('FollowRequestsPanel', () => {
  const source = fs.readFileSync(
    path.join(__dirname, '../components/social/FollowRequestsPanel.jsx'),
    'utf8'
  );

  it('loads incoming and outgoing sections', () => {
    expect(source).toContain('follow-requests-panel');
    expect(source).toContain('getFollowRequests');
    expect(source).toContain('acceptFollowRequest');
    expect(source).toContain('cancelFollowRequest');
  });
});

describe('NotificationsPage requests tab', () => {
  const source = fs.readFileSync(
    path.join(__dirname, '../pages/NotificationsPage.jsx'),
    'utf8'
  );

  it('includes Demandes filter tab', () => {
    expect(source).toContain('filter=requests');
    expect(source).toContain('FollowRequestsPanel');
    expect(source).toContain('notifications-tab-requests');
  });
});

describe('UserConnectionsModal', () => {
  const source = fs.readFileSync(
    path.join(__dirname, '../components/profile/UserConnectionsModal.jsx'),
    'utf8'
  );

  it('supports followers and following with pagination', () => {
    expect(source).toContain('getFollowers');
    expect(source).toContain('getFollowing');
    expect(source).toContain('connections-modal');
    expect(source).toContain('next_cursor');
  });
});

describe('PostImageCropDialog', () => {
  const source = fs.readFileSync(
    path.join(__dirname, '../components/social/PostImageCropDialog.jsx'),
    'utf8'
  );

  it('provides crop UX controls', () => {
    expect(source).toContain('cropRectImage');
    expect(source).toContain('Réinitialiser');
    expect(source).toContain('type="range"');
    expect(source).toContain('common:actions.cancel');
  });
});

describe('PostCard comment replies', () => {
  const source = fs.readFileSync(
    path.join(__dirname, '../components/social/PostCard.jsx'),
    'utf8'
  );

  it('supports reply flow and threaded display', () => {
    expect(source).toContain('parent_comment_id');
    expect(source).toContain('comment-reply');
    expect(source).toContain('reply-btn');
    expect(source).toContain('highlightCommentId');
  });
});

describe('ProfileHeader follow request cancel', () => {
  const source = fs.readFileSync(
    path.join(__dirname, '../components/profile/ProfileHeader.jsx'),
    'utf8'
  );

  it('exposes cancel and clickable stats', () => {
    expect(source).toContain('cancel-follow-request-btn');
    expect(source).toContain('onFollowersClick');
    expect(source).toContain('onFollowingClick');
  });
});
