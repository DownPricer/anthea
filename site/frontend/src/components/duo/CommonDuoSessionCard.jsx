import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { parseISO } from 'date-fns';

import { Clock, Trophy, Zap, Users, ChevronDown, Repeat2, Loader2, LayoutGrid } from 'lucide-react';

import { Button } from '../ui/button';

import { UserAvatar } from '../UserAvatar';

import { getDuoGradientStyle } from '../../lib/duoProfile';

import { getDisplayName } from '../../lib/userProfile';
import { useLocaleFormat } from '../../hooks/useLocaleFormat';



function formatDurationShort(seconds) {

  const mins = Math.floor((seconds || 0) / 60);

  return `${mins} min`;

}



function MiniSession({ user, session }) {

  if (!session) return null;

  return (

    <div className="rounded-xl bg-hover p-3 border border-border">

      <div className="flex items-center gap-2 mb-2">

        <UserAvatar user={user} className="w-7 h-7 text-xs" />

        <span className="text-foreground text-xs font-medium truncate">{getDisplayName(user)}</span>

        {session.status === 'completed' ? <Trophy size={12} className="text-green-500 shrink-0" /> : null}

      </div>

      <p className="text-muted text-xs truncate">{session.workout_title || 'Séance'}</p>

      <div className="flex gap-2 text-[10px] text-subtle mt-1">

        <span className="flex items-center gap-0.5">

          <Clock size={10} /> {formatDurationShort(session.total_time)}

        </span>

        <span className="flex items-center gap-0.5">

          <Zap size={10} /> {session.exercises_completed}/{session.exercises_total}

        </span>

      </div>

    </div>

  );

}



function SessionDetailBlock({ label, user, session }) {

  if (!session) return null;

  return (

    <div className="rounded-xl bg-hover p-3">

      <p className="text-subtle text-xs uppercase mb-2">{label} — {getDisplayName(user)}</p>

      <p className="text-foreground text-sm font-medium">{session.workout_title || 'Séance'}</p>

      <div className="flex flex-wrap gap-3 text-xs text-muted mt-2">

        <span>{formatDurationShort(session.total_time)}</span>

        <span>{session.exercises_completed}/{session.exercises_total} ex.</span>

        {session.difficulty_felt != null ? <span>Diff. {session.difficulty_felt}/10</span> : null}

      </div>

    </div>

  );

}



/**

 * Carte visuelle « Séance commune » — réutilisée dans activité Duo, republications et feed.

 */

export function CommonDuoSessionCard({

  item,

  user,

  partner,

  theme = 'default',

  showRepostButton = false,

  showDuoWallButton = false,

  reposted = false,

  duoWallPosted = false,

  repostLoading = false,

  duoWallLoading = false,

  onRepost,

  onUnrepost,

  onDuoWallPost,

  onDuoWallRemove,

  isRepost = false,

  readOnly = false,

  className = '',

}) {

  
  const { t } = useTranslation('duo');
  const { formatDate } = useLocaleFormat();
const [detailsOpen, setDetailsOpen] = useState(false);



  const sessionA = item?.session_a;

  const sessionB = item?.session_b;

  const mySession = sessionA?.user_id === user?.id ? sessionA : sessionB;

  const partnerSession = sessionA?.user_id === user?.id ? sessionB : sessionA;



  const memberA = user ? { ...user, id: user.id } : null;

  const memberB = partner ? { ...partner, id: partner.id } : null;

  const gradient = memberA && memberB ? getDuoGradientStyle(memberA, memberB, theme) : {};



  const dateLabel = item?.date
    ? formatDate(parseISO(item.date))
    : null;



  const handleRepostClick = () => {

    if (reposted) {

      onUnrepost?.();

    } else {

      onRepost?.();

    }

  };



  const handleDuoWallClick = () => {

    if (duoWallPosted) {

      onDuoWallRemove?.();

    } else {

      onDuoWallPost?.();

    }

  };



  return (

    <div

      data-testid={`common-duo-session-${item?.date || 'unknown'}`}

      className={`card min-w-0 overflow-visible p-4 space-y-4 border border-amber-500/30 ${className}`}

      style={gradient}

    >

      <div className="flex items-start gap-3">

        <div className="shared-workout-badge-icon">

          <Users size={18} />

        </div>

        <div className="flex-1 min-w-0">

          <p className="shared-workout-badge shared-workout-badge--title">

            {t('commonSession.label')}

          </p>

          <p className="text-foreground font-medium mt-0.5">

            {getDisplayName(user)} & {getDisplayName(partner)}

          </p>

          {isRepost ? (

            <p className="text-subtle text-xs mt-0.5 flex items-center gap-1">

              <Repeat2 size={12} /> Republication

            </p>

          ) : null}

        </div>

        {dateLabel ? (

          <span className="text-subtle text-xs shrink-0">{dateLabel}</span>

        ) : null}

      </div>



      <div className="grid grid-cols-2 gap-3">

        <MiniSession user={user} session={mySession} />

        <MiniSession user={partner} session={partnerSession} />

      </div>



      <div className="flex flex-wrap gap-2 pt-1">

        <Button

          type="button"

          size="sm"

          variant="outline"

          onClick={() => setDetailsOpen((v) => !v)}

          className="rounded-xl border-border text-foreground"

        >

          {t('commonSession.seeDetails')}

          <ChevronDown size={14} className={`ml-1 transition-transform ${detailsOpen ? 'rotate-180' : ''}`} />

        </Button>



        {showRepostButton && !readOnly ? (

          <Button

            type="button"

            size="sm"

            disabled={repostLoading}

            onClick={handleRepostClick}

            className={`rounded-xl border ${

              reposted

                ? 'bg-active text-muted border-border hover:bg-active'

                : 'bg-amber-500/20 text-amber-200 hover:bg-amber-500/30 border-amber-500/30'

            }`}

          >

            {repostLoading ? (

              <Loader2 size={14} className="animate-spin" />

            ) : reposted ? (

              t('commonSession.undoProfileRepost')

            ) : (

              <>

                <Repeat2 size={14} className="mr-1" /> {t('commonSession.repostToProfile')}

              </>

            )}

          </Button>

        ) : null}



        {showDuoWallButton && !readOnly ? (

          <Button

            type="button"

            size="sm"

            disabled={duoWallLoading}

            onClick={handleDuoWallClick}

            className={`rounded-xl border ${

              duoWallPosted

                ? 'bg-active text-muted border-border hover:bg-active'

                : 'bg-violet-500/20 text-violet-200 hover:bg-violet-500/30 border-violet-500/30'

            }`}

          >

            {duoWallLoading ? (

              <Loader2 size={14} className="animate-spin" />

            ) : duoWallPosted ? (

              t('commonSession.removeFromDuoWall')

            ) : (

              <>

                <LayoutGrid size={14} className="mr-1" /> {t('commonSession.publishToDuoWall')}

              </>

            )}

          </Button>

        ) : null}

      </div>



      {detailsOpen ? (

        <div className="space-y-3 pt-2 border-t border-border">

          <SessionDetailBlock label={t('commonSession.mySession')} user={user} session={mySession} />

          <SessionDetailBlock label={t('commonSession.partnerSession')} user={partner} session={partnerSession} />

        </div>

      ) : null}

    </div>

  );

}

