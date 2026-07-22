import { UserAvatar } from '../UserAvatar';
import { cn } from '../../lib/utils';

const SIZE_MAP = {
  sm: { wrap: 'h-9', avatar: 'w-9 h-9', overlap: '-ml-3' },
  md: { wrap: 'h-12', avatar: 'w-12 h-12', overlap: '-ml-3.5' },
  lg: { wrap: 'h-16', avatar: 'w-16 h-16', overlap: '-ml-5' },
};

/**
 * Avatars superposés des deux membres Duo — photos réelles via UserAvatar.
 * Ordre : viewer (connected) en premier si fourni, sinon ordre members.
 */
export function DuoMembersAvatar({
  members = [],
  viewerId = null,
  size = 'lg',
  className = '',
}) {
  const dims = SIZE_MAP[size] || SIZE_MAP.lg;
  const list = Array.isArray(members) ? members.filter((m) => m && (m.id || m._id)) : [];

  let ordered = list.slice(0, 2);
  if (viewerId && ordered.length === 2) {
    const viewer = ordered.find((m) => String(m.id || m._id) === String(viewerId));
    const other = ordered.find((m) => String(m.id || m._id) !== String(viewerId));
    if (viewer && other) ordered = [viewer, other];
  }

  if (ordered.length === 0) {
    return (
      <div
        className={cn(
          'rounded-full bg-active border-2 border-background flex items-center justify-center shrink-0',
          dims.avatar,
          className
        )}
        data-testid="duo-members-avatar-empty"
      >
        <span className="text-subtle text-xs">Duo</span>
      </div>
    );
  }

  return (
    <div
      className={cn('flex items-center shrink-0', dims.wrap, className)}
      data-testid="duo-members-avatar"
    >
      {ordered.map((member, index) => (
        <UserAvatar
          key={String(member.id || member._id || index)}
          user={member}
          className={cn(
            dims.avatar,
            'border-2 border-background shrink-0',
            index > 0 ? dims.overlap : ''
          )}
        />
      ))}
    </div>
  );
}
