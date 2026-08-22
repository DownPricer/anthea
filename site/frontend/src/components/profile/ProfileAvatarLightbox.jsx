import { useTranslation } from 'react-i18next';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog';
import { resolveMediaUrl } from '../../lib/api';
import { getDisplayName } from '../../lib/userProfile';

export function ProfileAvatarLightbox({ open, onOpenChange, user }) {
  const { t } = useTranslation(['profile', 'common']);
  const displayName = getDisplayName(user);
  const version = user?.updated_at || user?.avatar_updated_at;
  const baseSrc = resolveMediaUrl(user?.avatar_url);
  const src =
    baseSrc && version
      ? `${baseSrc}${baseSrc.includes('?') ? '&' : '?'}v=${encodeURIComponent(String(version))}`
      : baseSrc;

  if (!src) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="bg-surface-elevated border-border max-w-lg w-[calc(100vw-1.5rem)] p-4 sm:p-6"
        data-testid="profile-avatar-lightbox"
        onContextMenu={(e) => e.preventDefault()}
      >
        <DialogHeader className="sr-only">
          <DialogTitle>{displayName}</DialogTitle>
          <DialogDescription>
            {t('profile:avatarLightboxDesc', { defaultValue: 'Photo de profil agrandie.' })}
          </DialogDescription>
        </DialogHeader>
        <div className="flex items-center justify-center">
          <img
            src={src}
            alt={displayName}
            draggable={false}
            onDragStart={(e) => e.preventDefault()}
            onContextMenu={(e) => e.preventDefault()}
            className="max-h-[min(85vh,640px)] max-w-full w-auto h-auto object-contain rounded-xl select-none"
            data-testid="profile-avatar-lightbox-image"
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}
