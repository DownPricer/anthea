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

export function PartnerSettingsSection({ embedded = false }) {
  const { user, refreshUser } = useAuth();
  const [partner, setPartner] = useState(null);
  const [partnerRequests, setPartnerRequests] = useState([]);
  const [sentRequests, setSentRequests] = useState([]);
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
      setPartnerRequests(requestsRes.data || []);
      setSentRequests(sentRes.data || []);
    } catch {
      setPartner(null);
    }
  }, []);

  useEffect(() => {
    loadPartnerData();
  }, [loadPartnerData, user?.partner_id]);

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
      toast.success('Demande envoyée !');
      setPartnerDialogOpen(false);
      setSearchQuery('');
      setSearchResults([]);
      loadPartnerData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Erreur');
    }
  };

  const handleAcceptRequest = async (requestId) => {
    try {
      await partnerApi.accept(requestId);
      toast.success('Partenaire accepté !');
      loadPartnerData();
      refreshUser();
    } catch {
      toast.error('Erreur');
    }
  };

  const handleRejectRequest = async (requestId) => {
    try {
      await partnerApi.reject(requestId);
      toast.success('Demande refusée');
      loadPartnerData();
    } catch {
      toast.error('Erreur');
    }
  };

  const handleUnlinkPartner = async () => {
    try {
      await partnerApi.unlink();
      toast.success('Partenaire délié');
      setPartner(null);
      refreshUser();
    } catch {
      toast.error('Erreur');
    } finally {
      setUnlinkDialogOpen(false);
    }
  };

  const addPartnerDialog = !partner ? (
    <Dialog open={partnerDialogOpen} onOpenChange={setPartnerDialogOpen}>
      <DialogTrigger asChild>
        <Button size="sm" className="bg-[var(--theme-primary)] text-white shrink-0">
          <UserPlus size={16} className="mr-1" /> Ajouter
        </Button>
      </DialogTrigger>
      <DialogContent className="bg-[#141414] border-white/10">
        <DialogHeader>
          <DialogTitle className="text-white">Trouver un partenaire</DialogTitle>
          <DialogDescription className="text-zinc-500">
            Recherchez un utilisateur et envoyez une demande de liaison.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" size={18} />
            <Input
              value={searchQuery}
              onChange={(e) => handleSearch(e.target.value)}
              placeholder="Rechercher par pseudo..."
              className="pl-10 h-12 rounded-xl bg-[#0A0A0A] border-white/10 text-white"
            />
          </div>
          <div>
            <Label className="text-zinc-400 text-sm">Type de relation</Label>
            <Select value={selectedRelationType} onValueChange={setSelectedRelationType}>
              <SelectTrigger className="mt-2 h-12 rounded-xl bg-[#0A0A0A] border-white/10 text-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-[#141414] border-white/10">
                <SelectItem value="partner" className="text-white">Partenaire</SelectItem>
                <SelectItem value="coach" className="text-white">Coach</SelectItem>
                <SelectItem value="coach_partner" className="text-white">Coach + Partenaire</SelectItem>
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
                className="w-full p-3 flex items-center gap-3 bg-white/5 hover:bg-white/10 rounded-xl transition-colors"
              >
                <div className="w-10 h-10 rounded-full bg-[var(--theme-secondary)] flex items-center justify-center">
                  <span className="text-white font-medium">
                    {result.display_name?.[0] || result.username?.[0] || '?'}
                  </span>
                </div>
                <div className="flex-1 text-left">
                  <p className="text-white font-medium">{result.display_name || result.username}</p>
                  <p className="text-zinc-500 text-sm">{result.handle ? `@${result.handle}` : `@${result.username}`}</p>
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
            className="flex items-center gap-4 rounded-xl hover:bg-white/5 p-2 -m-2 transition-colors"
          >
            <div className="w-12 h-12 rounded-full bg-[var(--theme-secondary)] flex items-center justify-center">
              <span className="text-white font-bold">
                {partner.display_name?.[0] || partner.username?.[0]}
              </span>
            </div>
            <div className="flex-1">
              <p className="text-white font-medium">{partner.display_name || partner.username}</p>
              <p className="text-zinc-500 text-sm">
                {partner.relation_type === 'coach'
                  ? 'Coach'
                  : partner.relation_type === 'coach_partner'
                    ? 'Coach + Partenaire'
                    : 'Partenaire'}
              </p>
            </div>
            <ChevronRight className="text-zinc-500" size={18} />
          </Link>
          <Button
            size="sm"
            variant="outline"
            onClick={() => setUnlinkDialogOpen(true)}
            className="text-red-400 border-red-400/30 hover:bg-red-400/10"
          >
            <UserMinus size={16} className="mr-1.5" />
            Délier le partenaire
          </Button>
        </div>
      ) : (
        <p className="text-zinc-500 text-sm">Pas de partenaire lié</p>
      )}

      {partnerRequests.length > 0 && (
        <div className="pt-4 border-t border-white/10">
          <p className="text-zinc-400 text-sm mb-3">Demandes reçues</p>
          {partnerRequests.map((request) => (
            <div key={request.id} className="flex items-center gap-3 p-3 bg-white/5 rounded-xl mb-2">
              <div className="w-10 h-10 rounded-full bg-[var(--theme-primary)] flex items-center justify-center">
                <span className="text-white text-sm font-medium">
                  {request.from_username?.[0]?.toUpperCase()}
                </span>
              </div>
              <div className="flex-1">
                <p className="text-white font-medium">{request.from_username}</p>
                <p className="text-zinc-500 text-xs capitalize">{request.relation_type}</p>
              </div>
              <button
                type="button"
                onClick={() => handleAcceptRequest(request.id)}
                className="p-2 bg-green-500/20 text-green-500 rounded-lg hover:bg-green-500/30"
              >
                <Check size={18} />
              </button>
              <button
                type="button"
                onClick={() => handleRejectRequest(request.id)}
                className="p-2 bg-red-500/20 text-red-500 rounded-lg hover:bg-red-500/30"
              >
                <X size={18} />
              </button>
            </div>
          ))}
        </div>
      )}

      {sentRequests.length > 0 && (
        <div className="pt-4 border-t border-white/10">
          <p className="text-zinc-400 text-sm mb-3">Demandes envoyées</p>
          {sentRequests.map((request) => (
            <div key={request.id} className="flex items-center gap-3 p-3 bg-white/5 rounded-xl mb-2">
              <div className="w-10 h-10 rounded-full bg-zinc-700 flex items-center justify-center">
                <span className="text-white text-sm font-medium">
                  {request.to_username?.[0]?.toUpperCase()}
                </span>
              </div>
              <div className="flex-1">
                <p className="text-white font-medium">{request.to_username}</p>
                <p className="text-zinc-500 text-xs">En attente...</p>
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
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/5">
              <Heart size={18} className="text-[var(--theme-primary)]" />
            </div>
            <div className="flex-1">
              <h2 className="text-lg font-semibold text-white font-['Outfit']">Partenaire / Duo</h2>
              <p className="text-zinc-500 text-sm mt-0.5">Gérer votre relation et quitter le duo</p>
            </div>
            {addPartnerDialog}
          </div>
          {body}
        </section>
      )}

      <AlertDialog open={unlinkDialogOpen} onOpenChange={setUnlinkDialogOpen}>
        <AlertDialogContent className="border-white/10 bg-[#141414] text-white sm:rounded-xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Délier votre partenaire ?</AlertDialogTitle>
            <AlertDialogDescription className="text-zinc-400">
              Vous quitterez le duo. Cette action peut être annulée en créant une nouvelle relation.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2 sm:gap-0">
            <AlertDialogCancel className="border-white/15 bg-white/5 text-white hover:bg-white/10">
              Annuler
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                handleUnlinkPartner();
              }}
              className="bg-red-600 text-white hover:bg-red-700"
            >
              Délier
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
