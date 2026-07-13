import { duoProfilePath } from './duoProfile';
import { formatHandle, getDisplayName, getPublicHandle } from './userProfile';

/** Identité publique affichée d'une publication (duo ou utilisateur). */
export function getPostActorDisplay(post) {
  const actor = post?.actor;

  if (actor?.type === 'duo') {
    const tag = actor.tag || actor.handle || '';
    const members =
      actor.members ||
      (actor.member_avatars || []).map((avatarUrl, index) => ({
        avatar_url: avatarUrl,
        accent_color: actor.member_colors?.[index],
      }));

    return {
      type: 'duo',
      link: tag ? duoProfilePath(tag) : '#',
      name: actor.name || 'Duo',
      handleLabel: tag ? `@${tag}` : '',
      duoProfile: { avatar_url: actor.avatar_url },
      members,
    };
  }

  const user = {
    id: actor?.id ?? post?.author_id,
    username: actor?.handle ?? post?.author_username,
    handle: actor?.handle ?? post?.author_handle,
    display_name: actor?.name ?? post?.author_display_name,
    avatar_url: actor?.avatar_url ?? post?.author_avatar_url,
  };
  const publicHandle =
    getPublicHandle({ handle: user.handle, username: user.username }) || user.username;

  return {
    type: 'user',
    link: publicHandle ? `/profile/${publicHandle}` : '#',
    name: getDisplayName(user),
    handleLabel: formatHandle(user),
    user,
  };
}

export function canDeletePost(post, viewer) {
  if (post?.can_delete != null) return !!post.can_delete;
  const creatorId = post?.created_by_user_id || post?.author_id;
  return !!viewer?.id && viewer.id === creatorId;
}
