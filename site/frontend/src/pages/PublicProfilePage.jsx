import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { usersApi } from '../lib/api';
import { ProfilePage } from './ProfilePage';
import { Button } from '../components/ui/button';

export function PublicProfilePage() {
  const { handle } = useParams();
  const navigate = useNavigate();
  const [profileUser, setProfileUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setNotFound(false);
      try {
        const { data } = await usersApi.getByHandle(handle);
        if (!cancelled) setProfileUser(data);
      } catch (error) {
        if (!cancelled) {
          setProfileUser(null);
          setNotFound(error.response?.status === 404);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    if (handle) load();
    return () => {
      cancelled = true;
    };
  }, [handle]);

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-[var(--theme-primary)]" />
      </div>
    );
  }

  if (notFound || !profileUser) {
    return (
      <div className="p-5 text-center py-20">
        <p className="text-foreground font-medium mb-2">Profil introuvable</p>
        <p className="text-subtle text-sm mb-6">Cet arobase n'existe pas ou a été supprimé.</p>
        <Button onClick={() => navigate('/search')} className="btn-primary text-foreground rounded-xl">
          Rechercher un utilisateur
        </Button>
      </div>
    );
  }

  return (
    <ProfilePage
      viewedUser={profileUser}
      onProfileUpdate={setProfileUser}
    />
  );
}
