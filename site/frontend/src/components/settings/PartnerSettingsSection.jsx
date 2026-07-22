import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { partnerApi, usersApi } from '../../lib/api';
import { getPublicHandle } from '../../lib/userProfile';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '../ui/alert-dialog';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '../ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select';
import {
  UserPlus,
  UserMinus,
  Search,
  Check,
  X,
  Loader2,
  ChevronRight,
  Heart,
} from 'lucide-react';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';

export function PartnerSettingsSection({ embedded = false, panel = null, highlightRequestId = null }) {
  const { t } = useTranslation(['settings', 'common', 'notifications']);
  const { user, refreshUser } = useAuth();
  const [partner, setPartner] = useState(null);
  const [partnerRequests, setPartnerRequests] = useState([]);
  const [sentRequests, setSentRequests] = useState([]);
  const [resolvedHighlightStatus, setResolvedHighlightStatus] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [partnerDialogOpen, setPartnerDialogOpen] = useState(false);
  const [unlinkDialogOpen, setUnlinkDialogOpen] = useState(false);
  const [selectedRelationType, setSelectedRelationType] = useState('partner');

  const loadPartnerData = useCallback(async () => {
    try {
      const [partnerRes, requestsRes, sentRes] = await Promise.all([
        partnerApi.getInfo(),
        partnerApi.getRequests(),
        partnerApi.getSentRequests(),
      ]);
      setPartner(partnerRes.data);
      const received = requestsRes.data || [];
      setPartnerRequests(received);
      setSentRequests(sentRes.data || []);
      if (highlightRequestId) {
        const found = received.find((r) => String(r.id) === String(highlightRequestId));
        setResolvedHighlightStatus(found ? 'pending' : 'processed');
      } else {
        setResolvedHighlightStatus(null);
      }
    } catch {
      setPartner(null);
      if (highlightRequestId) setResolvedHighlightStatus('processed');
    }
  }, [highlightRequestId]);

  useEffect(() => {
    loadPartnerData();
  }, [loadPartnerData, user?.partner_id]);

  useEffect(() => {
    if (panel === 'requests' || highlightRequestId) {
      const el = document.getElementById('partner-requests-received');
      el?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [panel, highlightRequestId, partnerRequests]);

  const handleSearch = async (query) => {
    setSearchQuery(query);
    if (query.length < 2) {
      setSearchResults([]);
      return;
    }
    setSearching(true);
    try {
      const { data } = await usersApi.search(query);
      setSearchResults(data || []);
    } catch {
      setSearchResults([]);
    } finally {
      setSearching(false);
    }
  };

  const handleSendRequest = async (targetUsername) => {
    try {
      await partnerApi.sendRequest({
        target_username: targetUsername,
        relation_type: selectedRelationType,
      });
      toast.success(t('settings:partnerSection.toasts.requestSent'));
      setPartnerDialogOpen(false);
      setSearchQuery('');
      setSearchResults([]);
      loadPartnerData();
    } catch (error) {
      toast.error(error.response?.data?.detail || t('common:states.error'));
    }
  };

  const handleAcceptRequest = async (requestId) => {
    try {
      await partnerApi.accept(requestId);
      toast.success(t('settings:partnerSection.toasts.accepted'));
      loadPartnerData();
      refreshUser();
    } catch {
      toast.error(t('common:states.error'));
    }
  };

  const handleRejectRequest = async (requestId) => {
    try {
      await partnerApi.reject(requestId);
      toast.success(t('settings:partnerSection.toasts.rejected'));
      loadPartnerData();
    } catch {
      toast.error(t('common:states.error'));
    }
  };

  const handleUnlinkPartner = async () => {
    try {
      await partnerApi.unlink();
      toast.success(t('settings:partnerSection.toasts.unlinked'));
      setPartner(null);
      refreshUser();
    } catch {
      toast.error(t('common:states.error'));
    } finally {
      setUnlinkDialogOpen(false);
    }
  };

  const addPartnerDialog = !partner ? (
    <Dialog open={partnerDialogOpen} onOpenChange={setPartnerDialogOpen}>
      <DialogTrigger asChild>
        <Button size="sm" className="bg-[var(--theme-primary)] text-foreground shrink-0">
          <UserPlus size={16} className="mr-1" /> {t('settings:partnerSection.add')}
        </Button>
      </DialogTrigger>
      <DialogContent className="bg-surface-elevated border-border">
        <DialogHeader>
          <DialogTitle className="text-foreground">{t('settings:partnerSection.findTitle')}</DialogTitle>
          <DialogDescription className="text-subtle">
            {t('settings:partnerSection.findDesc')}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-subtle" size={18} />
            <Input
              value={searchQuery}
              onChange={(e) => handleSearch(e.target.value)}
              placeholder={t('settings:partnerSection.searchPlaceholder')}
              className="pl-10 h-12 rounded-xl bg-background border-border text-foreground"
            />
          </div>
          <div>
            <Label className="text-muted text-sm">{t('settings:partnerSection.relationType')}</Label>
            <Select value={selectedRelationType} onValueChange={setSelectedRelationType}>
              <SelectTrigger className="mt-2 h-12 rounded-xl bg-background border-border text-foreground">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-surface-elevated border-border">
                <SelectItem value="partner" className="text-foreground">{t('settings:partnerSection.relationPartner')}</SelectItem>
                <SelectItem value="coach" className="text-foreground">{t('settings:partnerSection.relationCoach')}</SelectItem>
                <SelectItem value="coach_partner" className="text-foreground">{t('settings:partnerSection.relationCoachPartner')}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {searching && (
            <div className="flex justify-center py-4">
              <Loader2 className="w-6 h-6 animate-spin text-[var(--theme-primary)]" />
            </div>
          )}
          <div className="max-h-60 overflow-y-auto space-y-2">
            {searchResults.map((result) => (
              <button
                key={result.id}
                type="button"
                onClick={() => handleSendRequest(result.username)}
                className="w-full p-3 flex items-center gap-3 bg-hover hover:bg-active rounded-xl transition-colors"
              >
                <div className="w-10 h-10 rounded-full bg-[var(--theme-secondary)] flex items-center justify-center">
                  <span className="text-foreground font-medium">
                    {result.display_name?.[0] || result.username?.[0] || '?'}
                  </span>
                </div>
                <div className="flex-1 text-left">
                  <p className="text-foreground font-medium">{result.display_name || result.username}</p>
                  <p className="text-subtle text-sm">{result.handle ? `@${result.handle}` : `@${result.username}`}</p>
                </div>
                <UserPlus size={18} className="text-[var(--theme-primary)]" />
              </button>
            ))}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  ) : null;

  const body = (
    <div className="space-y-4">
      {embedded && !partner ? (
        <div className="flex justify-end">{addPartnerDialog}</div>
      ) : null}

      {partner ? (
        <div className="space-y-3">
          <Link
            to={`/profile/${getPublicHandle(partner) || partner.username}`}
            className="flex items-center gap-4 rounded-xl hover:bg-hover p-2 -m-2 transition-colors"
          >
            <div className="w-12 h-12 rounded-full bg-[var(--theme-secondary)] flex items-center justify-center">
              <span className="text-foreground font-bold">
                {partner.display_name?.[0] || partner.username?.[0]}
              </span>
            </div>
            <div className="flex-1">
              <p className="text-foreground font-medium">{partner.display_name || partner.username}</p>
              <p className="text-subtle text-sm">
                {partner.relation_type === 'coach'
                  ? t('settings:partnerSection.relationCoach')
                  : partner.relation_type === 'coach_partner'
                    ? t('settings:partnerSection.relationCoachPartner')
                    : t('settings:partnerSection.relationPartner')}
              </p>
            </div>
            <ChevronRight className="text-subtle" size={18} />
          </Link>
          <Button
            size="sm"
            variant="outline"
            onClick={() => setUnlinkDialogOpen(true)}
            className="text-red-400 border-red-400/30 hover:bg-red-400/10"
          >
            <UserMinus size={16} className="mr-1.5" />
            {t('settings:partnerSection.unlink')}
          </Button>
        </div>
      ) : (
        <p className="text-subtle text-sm">{t('settings:partnerSection.noPartner')}</p>
      )}

      {(partnerRequests.length > 0 || highlightRequestId) && (
        <div id="partner-requests-received" className="pt-4 border-t border-border">
          <p className="text-muted text-sm mb-3">{t('settings:partnerSection.receivedRequests')}</p>
          {highlightRequestId && resolvedHighlightStatus === 'processed' ? (
            <p className="text-subtle text-sm mb-3" data-testid="partner-request-processed">
              {t('settings:partnerSection.requestProcessed', {
                defaultValue: 'Cette demande a déjà été traitée ou a expiré.',
              })}
            </p>
          ) : null}
          {partnerRequests.map((request) => {
            const isHighlighted = highlightRequestId && String(request.id) === String(highlightRequestId);
            return (
              <div
                key={request.id}
                data-testid={isHighlighted ? 'partner-request-highlight' : undefined}
                className={`flex items-center gap-3 p-3 rounded-xl mb-2 ${
                  isHighlighted
                    ? 'bg-[var(--theme-surface-active)] border border-[var(--theme-primary)]/40 ring-1 ring-[var(--theme-primary)]/30'
                    : 'bg-hover'
                }`}
              >
                <div className="w-10 h-10 rounded-full bg-[var(--theme-primary)] flex items-center justify-center">
                  <span className="text-foreground text-sm font-medium">
                    {request.from_username?.[0]?.toUpperCase()}
                  </span>
                </div>
                <div className="flex-1">
                  <p className="text-foreground font-medium">{request.from_username}</p>
                  <p className="text-subtle text-xs capitalize">{request.relation_type}</p>
                </div>
                <button
                  type="button"
                  onClick={() => handleAcceptRequest(request.id)}
                  className="p-2 bg-green-500/20 text-green-500 rounded-lg hover:bg-green-500/30"
                  aria-label={t('notifications:actions.accept')}
                >
                  <Check size={18} />
                </button>
                <button
                  type="button"
                  onClick={() => handleRejectRequest(request.id)}
                  className="p-2 bg-red-500/20 text-red-500 rounded-lg hover:bg-red-500/30"
                  aria-label={t('notifications:actions.reject')}
                >
                  <X size={18} />
                </button>
              </div>
            );
          })}
        </div>
      )}

      {sentRequests.length > 0 && (
        <div className="pt-4 border-t border-border">
          <p className="text-muted text-sm mb-3">{t('settings:partnerSection.sentRequests')}</p>
          {sentRequests.map((request) => (
            <div key={request.id} className="flex items-center gap-3 p-3 bg-hover rounded-xl mb-2">
              <div className="w-10 h-10 rounded-full bg-surface-subtle flex items-center justify-center">
                <span className="text-foreground text-sm font-medium">
                  {request.to_username?.[0]?.toUpperCase()}
                </span>
              </div>
              <div className="flex-1">
                <p className="text-foreground font-medium">{request.to_username}</p>
                <p className="text-subtle text-xs">{t('settings:partnerSection.pending')}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  return (
    <>
      {embedded ? (
        <div id="partner-settings" className="space-y-4">
          {body}
        </div>
      ) : (
        <section id="partner-settings" className="card p-5 space-y-4">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-hover">
              <Heart size={18} className="text-[var(--theme-primary)]" />
            </div>
            <div className="flex-1">
              <h2 className="text-lg font-semibold text-foreground font-['Outfit']">{t('settings:partnerSection.title')}</h2>
              <p className="text-subtle text-sm mt-0.5">{t('settings:partnerSection.hint')}</p>
            </div>
            {addPartnerDialog}
          </div>
          {body}
        </section>
      )}

      <AlertDialog open={unlinkDialogOpen} onOpenChange={setUnlinkDialogOpen}>
        <AlertDialogContent className="border-border bg-surface-elevated text-foreground sm:rounded-xl">
          <AlertDialogHeader>
            <AlertDialogTitle>{t('settings:partnerSection.unlinkTitle')}</AlertDialogTitle>
            <AlertDialogDescription className="text-muted">
              {t('settings:partnerSection.unlinkDesc')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2 sm:gap-0">
            <AlertDialogCancel className="border-border bg-hover text-foreground hover:bg-active">
              {t('common:actions.cancel')}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                handleUnlinkPartner();
              }}
              className="bg-red-600 text-foreground hover:bg-red-700"
            >
              {t('settings:partnerSection.unlinkAction')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
