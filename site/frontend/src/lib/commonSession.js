/** Détecte un post/repost de séance commune duo. */
export function isCommonSessionPost(post) {
  if (!post) return false;
  return (
    post.common_session === true
    || (post.type === 'duo' && !!post.partner_session_snapshot)
  );
}

/** Construit les props pour CommonDuoSessionCard à partir d'un post API. */
export function commonSessionFromPost(post, viewer) {
  if (!isCommonSessionPost(post)) return null;

  const snapA = post.session_snapshot || {};
  const snapB = post.partner_session_snapshot || {};

  const memberA = {
    id: post.author_id,
    username: post.author_username,
    handle: post.author_handle,
    display_name: post.author_display_name,
    avatar_url: post.author_avatar_url,
  };

  const memberB = {
    id: post.partner_author_id || post.partner_user_id || sessionB.user_id,
    username: post.partner_author_username,
    handle: post.partner_author_handle,
    display_name: post.partner_author_display_name,
    avatar_url: post.partner_author_avatar_url,
  };

  const date = post.common_date
    || (post.created_at ? String(post.created_at).slice(0, 10) : null);

  const sessionA = {
    id: post.workout_session_id,
    user_id: post.author_id,
    workout_title: snapA.workout_title,
    total_time: snapA.total_time,
    exercises_completed: snapA.exercises_completed,
    exercises_total: snapA.exercises_total,
    status: snapA.status || 'completed',
    difficulty_felt: snapA.difficulty_felt,
  };

  const sessionB = {
    id: post.partner_session_id,
    user_id: memberB.id,
    workout_title: snapB.workout_title,
    total_time: snapB.total_time,
    exercises_completed: snapB.exercises_completed,
    exercises_total: snapB.exercises_total,
    status: snapB.status || 'completed',
    difficulty_felt: snapB.difficulty_felt,
  };

  const viewerId = viewer?.id;
  let user = memberA;
  let partner = memberB;
  if (viewerId && memberB.id === viewerId) {
    user = memberB;
    partner = memberA;
  }

  const mySession = sessionA.user_id === user.id ? sessionA : sessionB;
  const partnerSession = sessionA.user_id === user.id ? sessionB : sessionA;

  return {
    item: {
      type: 'common_session',
      date,
      session_a: sessionA,
      session_b: sessionB,
    },
    user,
    partner,
    mySession,
    partnerSession,
  };
}
