/**
 * Feed Hooks
 * 
 * Hooks for fetching and managing feed content
 */

import { useState, useEffect, useCallback } from 'react';

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
 * Hook to fetch feed posts
 */
export function useFeed(filters?: FeedFilters, page: number = 1) {
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);

  useEffect(() => {
    setLoading(true);
    
    // TODO: Replace with actual API call
    const mockPosts: Post[] = [
      {
        id: '1',
        author: {
          address: '0xabc...123',
          domain: 'alice.sol',
          displayName: 'Alice',
        },
        content: 'Just deployed my first AI agent on Gradience! Excited to see how it performs. 🤖',
        createdAt: new Date(Date.now() - 1000 * 60 * 30).toISOString(), // 30 min ago
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
        content: 'New workflow available: Auto-responder for customer support tickets. Check it out!',
        media: [
          { type: 'image', url: '/workflow-preview.png' },
        ],
        createdAt: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(), // 2 hours ago
        likes: 56,
        comments: 12,
        shares: 8,
        isLiked: true,
      },
      {
        id: '3',
        author: {
          address: '0xghi...789',
          displayName: 'Charlie',
        },
        content: 'Reached 100 tasks completed! Thanks to everyone who trusted my agent. 🎉',
        createdAt: new Date(Date.now() - 1000 * 60 * 60 * 5).toISOString(), // 5 hours ago
        likes: 89,
        comments: 23,
        shares: 5,
        isLiked: false,
      },
    ];

    const timer = setTimeout(() => {
      if (page === 1) {
        setPosts(mockPosts);
      } else {
        setPosts((prev) => [...prev, ...mockPosts]);
      }
      setHasMore(page < 3); // Simulate limited pages
      setLoading(false);
    }, 500);

    return () => clearTimeout(timer);
  }, [filters?.type, filters?.sortBy, page]);

  const loadMore = useCallback(() => {
    // Triggered by InfiniteScroll
  }, []);

  const likePost = useCallback(async (postId: string) => {
    // TODO: Replace with actual API call
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
  }, []);

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
 * Hook to fetch a single post
 */
export function usePost(postId: string) {
  const [post, setPost] = useState<Post | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!postId) return;

    setLoading(true);
    
    // TODO: Replace with actual API call
    const mockPost: Post = {
      id: postId,
      author: {
        address: '0xabc...123',
        domain: 'alice.sol',
        displayName: 'Alice',
      },
      content: 'This is a detailed post view. You can see all the comments and interactions here.',
      createdAt: new Date().toISOString(),
      likes: 42,
      comments: 8,
      shares: 3,
      isLiked: false,
    };

    const timer = setTimeout(() => {
      setPost(mockPost);
      setLoading(false);
    }, 500);

    return () => clearTimeout(timer);
  }, [postId]);

  return { post, loading, error };
}

export default useFeed;
