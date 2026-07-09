import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar';
import { getAvatarFallbackStyle, getAvatarInitial } from '../lib/userProfile';
import { cn } from '../lib/utils';

export function UserAvatar({ user, className, fallbackClassName }) {
  const initial = getAvatarInitial(user);
  const fallbackStyle = getAvatarFallbackStyle(user);

  return (
    <Avatar className={cn('bg-[var(--theme-primary)]', className)}>
      {user?.avatar_url ? (
        <AvatarImage src={user.avatar_url} alt={user.display_name || user.username || ''} />
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
