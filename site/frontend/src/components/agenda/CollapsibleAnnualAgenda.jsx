import { useState } from 'react';
import { Calendar, ChevronDown } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '../ui/collapsible';
import { AnnualHeatmap } from './AnnualHeatmap';
import { cn } from '@/lib/utils';

/**
 * Agenda annuel fermé par défaut, ouvert via un bouton compact.
 */
export function CollapsibleAnnualAgenda({
  year,
  userId = null,
  title,
  accentColor = null,
  partnerColor = null,
  initialDays = null,
  onYearChange = null,
  defaultOpen = false,
  className,
}) {
  const { t } = useTranslation(['duo', 'settings']);
  const [open, setOpen] = useState(defaultOpen);
  const label = title || t('duo:annualAgenda', {
    defaultValue: t('settings:agenda.annualTitle', { defaultValue: 'Agenda annuel' }),
  });

  return (
    <Collapsible
      open={open}
      onOpenChange={setOpen}
      className={cn('w-full max-w-full min-w-0 overflow-hidden', className)}
      data-testid="collapsible-annual-agenda"
    >
      <CollapsibleTrigger asChild>
        <button
          type="button"
          data-testid="annual-agenda-toggle"
          aria-expanded={open}
          className="flex w-full max-w-full min-w-0 items-center justify-between gap-2 rounded-xl border border-border bg-surface-elevated px-3 py-2.5 text-left text-sm text-foreground transition-colors hover:bg-hover"
        >
          <span className="flex min-w-0 items-center gap-2">
            <Calendar size={16} className="shrink-0 text-[var(--theme-primary)]" />
            <span className="truncate font-medium">
              {open
                ? t('duo:hideAnnualAgenda', { defaultValue: 'Masquer l’agenda annuel' })
                : label}
            </span>
          </span>
          <ChevronDown
            size={16}
            className={cn(
              'shrink-0 text-subtle transition-transform duration-200',
              open && 'rotate-180'
            )}
          />
        </button>
      </CollapsibleTrigger>
      <CollapsibleContent
        className="overflow-hidden data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:slide-up-1 data-[state=open]:slide-down-1"
        data-testid="annual-agenda-panel"
      >
        <div className="mt-3 w-full max-w-full min-w-0 overflow-hidden">
          <AnnualHeatmap
            year={year}
            userId={userId}
            title={label}
            accentColor={accentColor}
            partnerColor={partnerColor}
            initialDays={initialDays}
            onYearChange={onYearChange}
          />
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
