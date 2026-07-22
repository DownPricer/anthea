import { useState } from 'react';
import { Loader2, UserPlus, UserMinus } from 'lucide-react';
import { Button } from '../ui/button';
import { duoProfilesApi, formatApiError } from '../../lib/api';
import { toast } from 'sonner';

export function DuoFollowButton({ duoProfile, onUpdate, className = '' }) {
  const [loading, setLoading] = useState(false);

  if (!duoProfile || duoProfile.is_member || duoProfile.is_limited) return null;

  const tag = duoProfile.tag;
  const isPrivate = duoProfile.account_visibility === 'private';

  const handleFollow = async () => {
    if (!tag) return;
    setLoading(true);
    try {
      const { data } = await duoProfilesApi.follow(tag);
      onUpdate?.(data);
      toast.success(isPrivate ? 'Demande envoyée au duo' : 'Vous suivez ce duo');
    } catch (error) {
      if (process.env.NODE_ENV === 'development') console.error('[duo follow]', error);
      toast.error(formatApiError(error));
    } finally {
      setLoading(false);
    }
  };

  const handleUnfollow = async () => {
    if (!tag) return;
    setLoading(true);
    try {
      const { data } = await duoProfilesApi.unfollow(tag);
      onUpdate?.(data);
      toast.success('Vous ne suivez plus ce duo');
    } catch (error) {
      if (process.env.NODE_ENV === 'development') console.error('[duo unfollow]', error);
      toast.error(formatApiError(error));
    } finally {
      setLoading(false);
    }
  };

  if (duoProfile.is_following_duo) {
    return (
      <Button
        type="button"
        size="sm"
        variant="outline"
        disabled={loading}
        onClick={handleUnfollow}
        className={`rounded-xl border-border text-muted ${className}`}
      >
        {loading ? <Loader2 size={14} className="animate-spin" /> : <UserMinus size={14} className="mr-1" />}
        Ne plus suivre
      </Button>
    );
  }

  if (duoProfile.duo_follow_pending) {
    return (
      <Button type="button" size="sm" disabled className={`rounded-xl bg-hover text-subtle ${className}`}>
        Demande envoyée
      </Button>
    );
  }

  return (
    <Button
      type="button"
      size="sm"
      disabled={loading}
      onClick={handleFollow}
      className={`rounded-xl btn-primary text-foreground ${className}`}
    >
      {loading ? (
        <Loader2 size={14} className="animate-spin" />
      ) : (
        <>
          <UserPlus size={14} className="mr-1" />
          {isPrivate ? 'Demander à suivre' : 'Suivre le duo'}
        </>
      )}
    </Button>
  );
}
