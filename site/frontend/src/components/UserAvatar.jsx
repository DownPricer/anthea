import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar';
import { getAvatarFallbackStyle, getAvatarInitial } from '../lib/userProfile';
import { resolveMediaUrl } from '../lib/api';
import { cn } from '../lib/utils';

export function UserAvatar({ user, className, fallbackClassName }) {
  const initial = getAvatarInitial(user);
  const fallbackStyle = getAvatarFallbackStyle(user);
  const avatarSrc = resolveMediaUrl(user?.avatar_url);

  return (
    <Avatar className={cn('bg-[var(--theme-primary)]', className)}>
      {avatarSrc ? (
        <AvatarImage src={avatarSrc} alt={user.display_name || user.username || ''} />
      ) : null}
      <AvatarFallback
        className={cn('text-white font-bold', fallbackClassName)}
        style={fallbackStyle}
      >
        {initial}
      </AvatarFallback>
    </Avatar>
  );
}
