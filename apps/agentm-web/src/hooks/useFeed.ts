/**
 * Feed Hooks
 * 
 * Hooks for fetching and managing feed content from Daemon
 */

import { useState, useEffect, useCallback } from 'react';
import { useDaemonConnection } from '@/lib/connection/ConnectionContext';

export interface Post {
  id: string;
  author: {
    address: string;
    domain?: string;
    displayName: string;
    avatar?: string;
  };
  content: string;
  media?: Array<{
    type: 'image' | 'video';
    url: string;
  }>;
  createdAt: string;
  likes: number;
  comments: number;
  shares: number;
  isLiked: boolean;
}

export interface FeedFilters {
  type?: 'all' | 'posts' | 'updates' | 'workflows';
  sortBy?: 'latest' | 'popular' | 'following';
}

/**
 * Hook to fetch feed posts from Daemon
 */
export function useFeed(filters?: FeedFilters, page: number = 1) {
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const { daemonUrl, isConnected } = useDaemonConnection();

  useEffect(() => {
    if (!isConnected || !daemonUrl) {
      setPosts([]);
      return;
    }

    setLoading(true);
    
    const query = new URLSearchParams({
      page: page.toString(),
      limit: '20',
      ...(filters?.type && filters.type !== 'all' && { type: filters.type }),
      ...(filters?.sortBy && { sortBy: filters.sortBy }),
    });
    
    fetch(`${daemonUrl}/api/feed?${query}`)
      .then(async (res) => {
        if (!res.ok) throw new Error('Failed to fetch feed');
        return res.json();
      })
      .then((data) => {
        const fetchedPosts = data.posts || [];
        if (page === 1) {
          setPosts(fetchedPosts);
        } else {
          setPosts((prev) => [...prev, ...fetchedPosts]);
        }
        setHasMore(data.hasMore ?? page < 3);
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : 'Unknown error');
        // Fallback to mock data
        const mockPosts: Post[] = [
          {
            id: '1',
            author: {
              address: '0xabc...123',
              domain: 'alice.sol',
              displayName: 'Alice',
            },
            content: 'Just deployed my first AI agent! Excited to see how it performs. 🤖',
            createdAt: new Date(Date.now() - 1000 * 60 * 30).toISOString(),
            likes: 24,
            comments: 5,
            shares: 2,
            isLiked: false,
          },
          {
            id: '2',
            author: {
              address: '0xdef...456',
              domain: 'bob.sol',
              displayName: 'Bob',
            },
            content: 'New workflow available: Auto-responder for customer support.',
            createdAt: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(),
            likes: 56,
            comments: 12,
            shares: 8,
            isLiked: true,
          },
        ];
        setPosts(mockPosts);
        setHasMore(false);
      })
      .finally(() => {
        setLoading(false);
      });
  }, [filters?.type, filters?.sortBy, page, daemonUrl, isConnected]);

  const loadMore = useCallback(() => {
    // Triggered by InfiniteScroll, page increment handled by parent
  }, []);

  const likePost = useCallback(async (postId: string) => {
    if (!daemonUrl || !isConnected) return;
    
    try {
      const res = await fetch(`${daemonUrl}/api/posts/${postId}/like`, {
        method: 'POST',
      });
      
      if (!res.ok) throw new Error('Failed to like post');
      
      setPosts((prev) =>
        prev.map((post) =>
          post.id === postId
            ? {
                ...post,
                isLiked: !post.isLiked,
                likes: post.isLiked ? post.likes - 1 : post.likes + 1,
              }
            : post
        )
      );
    } catch (err) {
      console.error('Like post error:', err);
      // Optimistic update
      setPosts((prev) =>
        prev.map((post) =>
          post.id === postId
            ? {
                ...post,
                isLiked: !post.isLiked,
                likes: post.isLiked ? post.likes - 1 : post.likes + 1,
              }
            : post
        )
      );
    }
  }, [daemonUrl, isConnected]);

  return {
    posts,
    loading,
    error,
    hasMore,
    loadMore,
    likePost,
  };
}

/**
 * Hook to fetch a single post from Daemon
 */
export function usePost(postId: string) {
  const [post, setPost] = useState<Post | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { daemonUrl, isConnected } = useDaemonConnection();

  useEffect(() => {
    if (!postId || !isConnected || !daemonUrl) {
      setPost(null);
      return;
    }

    setLoading(true);
    
    fetch(`${daemonUrl}/api/posts/${postId}`)
      .then(async (res) => {
        if (!res.ok) throw new Error('Failed to fetch post');
        return res.json();
      })
      .then((data: Post) => {
        setPost(data);
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : 'Unknown error');
        // Fallback to mock data
        const mockPost: Post = {
          id: postId,
          author: {
            address: '0xabc...123',
            domain: 'alice.sol',
            displayName: 'Alice',
          },
          content: 'This is a detailed post view.',
          createdAt: new Date().toISOString(),
          likes: 42,
          comments: 8,
          shares: 3,
          isLiked: false,
        };
        setPost(mockPost);
      })
      .finally(() => {
        setLoading(false);
      });
  }, [postId, daemonUrl, isConnected]);

  return { post, loading, error };
}

export default useFeed;
