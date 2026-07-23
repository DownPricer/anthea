import { cn } from '@/lib/utils';
import { useTheme } from '../../context/ThemeContext';
import logoSrc from '../../assets/branding/logo-v1.svg';

/**
 * Logo officiel Anthea — proportions préservées, lisible clair/sombre.
 */
export function AntheaLogo({ className, alt = 'Anthea', ...props }) {
  const { colorMode } = useTheme();
  const isDark = colorMode === 'dark';

  return (
    <img
      src={logoSrc}
      alt={alt}
      data-testid="anthea-logo"
      draggable={false}
      className={cn(
        'object-contain shrink-0 max-w-full h-8 w-auto',
        isDark && 'invert',
        className
      )}
      {...props}
    />
  );
}
