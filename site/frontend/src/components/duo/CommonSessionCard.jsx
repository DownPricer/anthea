import { useState } from 'react';
import { postsApi, formatApiError } from '../../lib/api';
import { toast } from 'sonner';
import { CommonDuoSessionCard } from './CommonDuoSessionCard';

export function CommonSessionCard({
  item,
  user,
  partner,
  theme,
  duoProfile: _duoProfile,
}) {
  const sessionA = item.session_a;
  const sessionB = item.session_b;
  const mySession = sessionA?.user_id === user?.id ? sessionA : sessionB;
  const partnerSession = sessionA?.user_id === user?.id ? sessionB : sessionA;

  const [repostId, setRepostId] = useState(null);
  const [repostLoading, setRepostLoading] = useState(false);

  const handleRepost = async () => {
    if (!mySession?.id) return;
    setRepostLoading(true);
    try {
      const { data } = await postsApi.repost({
        workout_session_id: mySession.id,
        partner_session_id: partnerSession?.id,
      });
      setRepostId(data?.id || 'done');
      toast.success('Séance republiée');
    } catch (error) {
      const msg = formatApiError(error);
      if (msg.toLowerCase().includes('déjà')) {
        setRepostId('done');
        toast.info('Déjà republié');
      } else {
        toast.error(msg);
      }
    } finally {
      setRepostLoading(false);
    }
  };

  const handleUnrepost = async () => {
    if (!repostId || repostId === 'done') {
      setRepostId(null);
      toast.success('Republication retirée');
      return;
    }
    setRepostLoading(true);
    try {
      await postsApi.deleteRepost(repostId);
      setRepostId(null);
      toast.success('Republication retirée');
    } catch (error) {
      toast.error(formatApiError(error));
    } finally {
      setRepostLoading(false);
    }
  };

  return (
    <CommonDuoSessionCard
      item={item}
      user={user}
      partner={partner}
      theme={theme}
      showRepostButton
      reposted={!!repostId}
      repostLoading={repostLoading}
      onRepost={handleRepost}
      onUnrepost={handleUnrepost}
    />
  );
}
