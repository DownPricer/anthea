import { useCallback, useEffect, useState } from 'react';

import { Loader2 } from 'lucide-react';

import { PostCard } from './PostCard';

import { ProfileEmptyState } from '../profile/ProfileEmptyState';

import { postsApi } from '../../lib/api';

import { getPublicHandle } from '../../lib/userProfile';

import { normalizeArray } from '../../lib/normalizeArray';

import { isCommonSessionPost, commonSessionFromPost } from '../../lib/commonSession';

import { isUserWallPost } from '../../lib/postWall';

import { CommonDuoSessionCard } from '../duo/CommonDuoSessionCard';

import { useTheme } from '../../context/ThemeContext';



export function PostFeed({

  profileUser,

  viewer,

  mode = 'posts',

  emptyIcon,

  emptyTitle,

  emptyDescription,

}) {

  const { theme } = useTheme();

  const [items, setItems] = useState([]);

  const [loading, setLoading] = useState(true);



  const load = useCallback(async () => {

    const handle = getPublicHandle(profileUser);

    if (!handle) {

      setItems([]);

      setLoading(false);

      return;

    }



    setLoading(true);

    try {

      if (mode === 'reposts') {

        const { data } = await postsApi.getRepostsByHandle(handle);

        const reposts = normalizeArray(data);

        setItems(

          reposts

            .filter((r) => r && r.post)

            .map((r) => ({ ...r.post, _repostId: r.id, is_repost: true }))

        );

      } else {

        const { data } = await postsApi.getByHandle(handle);

        setItems(normalizeArray(data).filter(isUserWallPost));

      }

    } catch {

      setItems([]);

    } finally {

      setLoading(false);

    }

  }, [profileUser, mode]);



  useEffect(() => {

    load();

  }, [load]);



  if (loading) {

    return (

      <div className="flex justify-center py-12">

        <Loader2 className="w-7 h-7 animate-spin text-[var(--theme-primary)]" />

      </div>

    );

  }



  const safeItems = normalizeArray(items);



  if (!safeItems.length) {

    return (

      <ProfileEmptyState

        icon={emptyIcon}

        title={emptyTitle}

        description={emptyDescription}

      />

    );

  }



  return (

    <div className="space-y-4">

      {safeItems.map((post, idx) => {

        if (isCommonSessionPost(post)) {

          const ctx = commonSessionFromPost(post, viewer || profileUser);

          if (ctx) {

            return (

              <CommonDuoSessionCard

                key={post._repostId || post.id || `common-${idx}`}

                item={ctx.item}

                user={ctx.user}

                partner={ctx.partner}

                theme={theme}

                readOnly

                isRepost={!!post.is_repost}

              />

            );

          }

        }

        return (

          <PostCard

            key={post._repostId || post.id || `post-${idx}`}

            post={post}

            viewer={viewer}

            onUpdate={load}

            onDelete={(id) => setItems((current) => current.filter((p) => (p?.id || p?._repostId) !== id))}

            isRepost={!!post.is_repost}

            showRepostAction={mode === 'posts'}

          />

        );

      })}

    </div>

  );

}


