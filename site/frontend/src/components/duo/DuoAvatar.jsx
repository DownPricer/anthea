import { getAvatarFallbackStyle, getAvatarInitial } from '../../lib/userProfile';
import { resolveMediaUrl } from '../../lib/api';
import { cn } from '../../lib/utils';

/**
 * Avatar duo : custom ou composition automatique des deux membres.
 */
export function DuoAvatar({ duoProfile, members, className = 'w-14 h-14', textSize = 'text-xl' }) {
  const customUrl = resolveMediaUrl(duoProfile?.avatar_url);
  if (customUrl) {
    return (
      <img
        src={customUrl}
        alt=""
        className={cn('rounded-full object-cover border-2 border-background', className)}
      />
    );
  }

  const list = members || duoProfile?.members || [];
  const memberA = list[0] || null;
  const memberB = list[1] || null;

  if (!memberA && !memberB) {
    return (
      <div className={cn('rounded-full bg-active border-2 border-background flex items-center justify-center', className)}>
        <span className="text-subtle text-xs">Duo</span>
      </div>
    );
  }

  return (
    <div className={cn('relative rounded-full overflow-hidden border-2 border-background shrink-0', className)}>
      <div className="absolute inset-0 flex">
        <DuoHalf user={memberA} textSize={textSize} side="left" />
        <DuoHalf user={memberB} textSize={textSize} side="right" />
      </div>
    </div>
  );
}

function DuoHalf({ user, textSize, side }) {
  const src = resolveMediaUrl(user?.avatar_url);
  const initial = getAvatarInitial(user);
  const fallbackStyle = getAvatarFallbackStyle(user);

  return (
    <div className={`w-1/2 h-full overflow-hidden ${side === 'left' ? '' : ''}`}>
      {src ? (
        <img
          src={src}
          alt=""
          className={`w-[200%] h-full object-cover ${side === 'left' ? 'object-left' : 'object-right'}`}
        />
      ) : (
        <div
          className={`w-full h-full flex items-center justify-center text-foreground font-bold ${textSize}`}
          style={fallbackStyle}
        >
          {initial}
        </div>
      )}
    </div>
  );
}

/** Petite variante pour listes / feed */
export function DuoAvatarStack({ duoProfile, members, className = 'w-10 h-10' }) {
  return <DuoAvatar duoProfile={duoProfile} members={members} className={className} textSize="text-sm" />;
}
