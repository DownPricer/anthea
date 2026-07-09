import { useState } from 'react';
import { postsApi, formatApiError } from '../../lib/api';
import { toast } from 'sonner';
import { CommonDuoSessionCard } from './CommonDuoSessionCard';

export function CommonSessionCard({
  item,
  user,
  partner,
  theme,
  duoProfile,
  onDuoWallUpdate,
}) {
  const sessionA = item.session_a;
  const sessionB = item.session_b;
  const mySession = sessionA?.user_id === user?.id ? sessionA : sessionB;
  const partnerSession = sessionA?.user_id === user?.id ? sessionB : sessionA;

  const [repostId, setRepostId] = useState(item.user_repost_id || null);
  const [duoWallPostId, setDuoWallPostId] = useState(item.duo_wall_post_id || null);
  const [repostLoading, setRepostLoading] = useState(false);
  const [duoWallLoading, setDuoWallLoading] = useState(false);

  const handleRepost = async () => {
    if (!mySession?.id) return;
    setRepostLoading(true);
    try {
      const { data } = await postsApi.repost({
        workout_session_id: mySession.id,
        partner_session_id: partnerSession?.id,
      });
      setRepostId(data?.id || null);
      toast.success(data?.already_exists ? 'Déjà republié sur ton profil' : 'Séance republiée sur ton profil');
    } catch (error) {
      toast.error(formatApiError(error));
    } finally {
      setRepostLoading(false);
    }
  };

  const handleUnrepost = async () => {
    if (!repostId) return;
    setRepostLoading(true);
    try {
      await postsApi.deleteRepost(repostId);
      setRepostId(null);
      toast.success('Republication retirée de ton profil');
    } catch (error) {
      toast.error(formatApiError(error));
    } finally {
      setRepostLoading(false);
    }
  };

  const handleDuoWall = async () => {
    if (!mySession?.id) return;
    setDuoWallLoading(true);
    try {
      const { data } = await postsApi.create({
        type: 'duo_common_session',
        workout_session_id: mySession.id,
        partner_session_id: partnerSession?.id,
        visibility: 'public',
      });
      setDuoWallPostId(data?.id || null);
      toast.success('Séance publiée sur le mur duo');
      onDuoWallUpdate?.();
    } catch (error) {
      toast.error(formatApiError(error));
    } finally {
      setDuoWallLoading(false);
    }
  };

  const handleRemoveDuoWall = async () => {
    if (!duoWallPostId) return;
    setDuoWallLoading(true);
    try {
      await postsApi.delete(duoWallPostId);
      setDuoWallPostId(null);
      toast.success('Publication retirée du mur duo');
      onDuoWallUpdate?.();
    } catch (error) {
      toast.error(formatApiError(error));
    } finally {
      setDuoWallLoading(false);
    }
  };

  return (
    <CommonDuoSessionCard
      item={item}
      user={user}
      partner={partner}
      theme={theme}
      showRepostButton
      showDuoWallButton={!!duoProfile}
      reposted={!!repostId}
      duoWallPosted={!!duoWallPostId}
      repostLoading={repostLoading}
      duoWallLoading={duoWallLoading}
      onRepost={handleRepost}
      onUnrepost={handleUnrepost}
      onDuoWallPost={handleDuoWall}
      onDuoWallRemove={handleRemoveDuoWall}
    />
  );
}
