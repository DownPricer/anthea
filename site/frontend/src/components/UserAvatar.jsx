import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar';
import { getAvatarFallbackStyle, getAvatarInitial } from '../lib/userProfile';
import { resolveMediaUrl } from '../lib/api';
import { cn } from '../lib/utils';

export function UserAvatar({ user, className, fallbackClassName, cacheVersion = null }) {
  const initial = getAvatarInitial(user);
  const fallbackStyle = getAvatarFallbackStyle(user);
  const baseSrc = resolveMediaUrl(user?.avatar_url);
  const version = cacheVersion || user?.updated_at || user?.avatar_updated_at;
  const avatarSrc =
    baseSrc && version
      ? `${baseSrc}${baseSrc.includes('?') ? '&' : '?'}v=${encodeURIComponent(String(version))}`
      : baseSrc;

  return (
    <Avatar className={cn(user?.accent_color ? '' : 'bg-[var(--theme-primary)]', className)}>
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
