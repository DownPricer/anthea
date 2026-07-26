import { cn } from '@/lib/utils';
import logoSrc from '../../assets/branding/logo-v1.png';

/**
 * Logo officiel Anthea — proportions préservées.
 */
export function AntheaLogo({ className, alt = 'FitGather', ...props }) {
  return (
    <img
      src={logoSrc}
      alt={alt}
      data-testid="anthea-logo"
      draggable={false}
      className={cn(
        'object-contain shrink-0 max-w-full h-8 w-auto',
        className
      )}
      {...props}
    />
  );
}
