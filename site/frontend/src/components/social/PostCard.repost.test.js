import fs from 'fs';
import path from 'path';

describe('PostCard repost permissions and double-click guard', () => {
  const source = fs.readFileSync(path.join(__dirname, 'PostCard.jsx'), 'utf8');
  const fr = JSON.parse(
    fs.readFileSync(
      path.join(__dirname, '../../i18n/locales/fr/home.json'),
      'utf8'
    )
  );
  const en = JSON.parse(
    fs.readFileSync(
      path.join(__dirname, '../../i18n/locales/en/home.json'),
      'utf8'
    )
  );
  const es = JSON.parse(
    fs.readFileSync(
      path.join(__dirname, '../../i18n/locales/es/home.json'),
      'utf8'
    )
  );

  it('uses post_id for feed reposts instead of workout_session_id bypass', () => {
    expect(source).toContain('postsApi.repost({ post_id: post.id })');
    expect(source).not.toMatch(
      /workout_session_id:\s*post\.workout_session_id/
    );
  });

  it('guards with repostPending and can_repost before requesting', () => {
    expect(source).toContain('repostPending');
    expect(source).toContain('setRepostPending');
    expect(source).toMatch(/if \(repostPending \|\| !post\?\.id\) return/);
    expect(source).toMatch(/post\?\.can_repost === false/);
    expect(source).toContain('disabled={repostPending');
  });

  it('hides or disables forbidden repost action while allowing unrepost', () => {
    expect(source).toContain('reposted || canRepost');
    expect(source).toContain('viewer_has_reposted');
  });

  it('rolls back optimistic state and shows a single localized toast on 403', () => {
    expect(source).toContain('resolveRepostErrorMessage');
    expect(source).toContain('repostPrivacyBlocked');
    expect(source).toContain('repostForbidden');
    expect(source).toContain('repostUnavailable');
    expect(source).toContain('setCanRepost(false)');
  });

  it('ships localized repost error strings in fr en es', () => {
    expect(fr.comments.repostForbidden).toBe(
      'Cette publication ne peut pas être republiée.'
    );
    expect(fr.comments.repostPrivacyBlocked).toBe(
      'La confidentialité de cette publication empêche sa republication.'
    );
    expect(fr.comments.repostUnavailable).toBe(
      'Republication impossible pour le moment.'
    );
    expect(en.comments.repostForbidden).toBe('This post cannot be reposted.');
    expect(en.comments.repostPrivacyBlocked).toMatch(/privacy settings prevent reposting/);
    expect(en.comments.repostUnavailable).toBe('Unable to repost right now.');
    expect(es.comments.repostForbidden).toBe(
      'Esta publicación no se puede republicar.'
    );
    expect(es.comments.repostPrivacyBlocked).toMatch(/privacidad/);
    expect(es.comments.repostUnavailable).toBe(
      'No se puede republicar en este momento.'
    );
  });

  it('does not treat workout type as an automatic repost block', () => {
    expect(source).not.toMatch(/type === ['\"]workout['\"].*can_repost/);
    expect(source).not.toMatch(/can_repost.*type === ['\"]workout['\"]/);
  });
});
