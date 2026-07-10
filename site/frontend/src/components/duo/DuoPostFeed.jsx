import { useState, useEffect, useCallback } from 'react';

import { LayoutGrid } from 'lucide-react';

import { duoProfilesApi, formatApiError } from '../../lib/api';

import { PostCard } from '../social/PostCard';

import { ProfileEmptyState } from '../profile/ProfileEmptyState';

import { DuoPostComposer } from './DuoPostComposer';

import { Loader2 } from 'lucide-react';

import { canViewDuoSection } from '../../lib/duoProfile';

import { normalizeArray } from '../../lib/normalizeArray';

import { isCommonSessionPost, commonSessionFromPost } from '../../lib/commonSession';

import { CommonDuoSessionCard } from './CommonDuoSessionCard';

import { useTheme } from '../../context/ThemeContext';

import { toast } from 'sonner';



export function DuoPostFeed({ duoProfile, viewer }) {

  const { theme } = useTheme();

  const [posts, setPosts] = useState([]);

  const [loading, setLoading] = useState(true);

  const [error, setError] = useState(null);

  const tag = duoProfile?.tag;



  const isMember = !!duoProfile?.is_member;

  const canViewPublic = duoProfile ? canViewDuoSection(duoProfile, 'posts') : false;

  const canLoad = !!tag && (canViewPublic || isMember);



  const load = useCallback(async () => {

    if (!canLoad) {

      setPosts([]);

      setError(null);

      setLoading(false);

      return;

    }

    setLoading(true);

    setError(null);

    try {

      const { data } = await duoProfilesApi.getPosts(tag);

      setPosts(normalizeArray(data));

    } catch (err) {

      if (process.env.NODE_ENV === 'development') console.error('[duo posts load]', err);

      setPosts([]);

      const msg = formatApiError(err);

      setError(msg);

      toast.error(msg);

    } finally {

      setLoading(false);

    }

  }, [tag, canLoad]);



  useEffect(() => {

    load();

  }, [load]);



  if (!duoProfile) {

    return (

      <ProfileEmptyState

        icon={LayoutGrid}

        title="Profil duo incomplet"

        description="Les informations duo ne sont pas encore disponibles."

      />

    );

  }



  if (!canLoad) {

    return (

      <ProfileEmptyState

        icon={LayoutGrid}

        title="Mur masqué"

        description="Ce duo a choisi de garder son mur privé."

      />

    );

  }



  const members = Array.isArray(duoProfile.members) ? duoProfile.members : [];

  const safePosts = normalizeArray(posts);



  return (

    <div className="space-y-4" data-testid="duo-post-feed">

      {isMember ? (
        <DuoPostComposer
          duoProfile={duoProfile}
          onPosted={(newPost) => {
            if (newPost?.id) {
              setPosts((prev) => [newPost, ...prev.filter((p) => p.id !== newPost.id)]);
            }
            load();
          }}
        />
      ) : null}



      {!canViewPublic && isMember ? (

        <p className="text-zinc-500 text-xs text-center">

          Mur visible pour les membres — active « Afficher le mur duo » pour le rendre public.

        </p>

      ) : null}



      {loading ? (

        <div className="flex justify-center py-16">

          <Loader2 className="w-8 h-8 animate-spin text-[var(--theme-primary)]" />

        </div>

      ) : null}



      {error && !loading ? (

        <ProfileEmptyState icon={LayoutGrid} title="Erreur de chargement" description={error} />

      ) : null}



      {!loading && !error && safePosts.length === 0 ? (

        <ProfileEmptyState

          icon={LayoutGrid}

          title="Aucune publication duo"

          description="Le mur duo est vide pour le moment."

        />

      ) : null}



      {!loading && !error

        ? safePosts.map((post, idx) => {

            if (isCommonSessionPost(post)) {

              const ctx = commonSessionFromPost(post, viewer);

              if (ctx) {

                const memberA = members.find((m) => m.id === ctx.user?.id) || ctx.user;

                const memberB = members.find((m) => m.id === ctx.partner?.id) || ctx.partner;

                return (

                  <CommonDuoSessionCard

                    key={post?.id || `duo-common-${idx}`}

                    item={ctx.item}

                    user={memberA}

                    partner={memberB}

                    theme={theme}

                    readOnly

                  />

                );

              }

            }

            return (

              <PostCard

                key={post?.id || `duo-post-${idx}`}

                post={post}

                viewer={viewer}

                onUpdate={load}

                showRepostAction={false}

              />

            );

          })

        : null}

    </div>

  );

}

