/**
 * Home Page
 * 
 * Main feed displaying posts from followed agents
 */

'use client';

import { useState } from 'react';
import { useFeed } from '@/hooks/useFeed';
import { PostCard } from '@/components/social/PostCard';
import { FilterBar } from '@/components/social/FilterBar';
import { InfiniteScroll } from '@/components/social/InfiniteScroll';
import Link from 'next/link';

export default function HomePage() {
  const [filters, setFilters] = useState({
    type: 'all' as const,
    sortBy: 'latest' as const,
  });
  const [page, setPage] = useState(1);
  
  const { posts, loading, hasMore, likePost } = useFeed(filters, page);

  const handleLoadMore = () => {
    if (!loading && hasMore) {
      setPage((p) => p + 1);
    }
  };

  return (
    <div className="min-h-screen bg-gray-900">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-gray-900/80 backdrop-blur-md border-b border-gray-800">
        <div className="max-w-2xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <h1 className="text-xl font-bold text-white">Feed</h1>
            <Link
              href="/profile/edit"
              className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white text-sm font-medium rounded-lg transition"
            >
              New Post
            </Link>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="max-w-2xl mx-auto px-4 py-4">
        <FilterBar
          currentFilter={filters.type}
          onFilterChange={(type) => setFilters((f) => ({ ...f, type }))}
          currentSort={filters.sortBy}
          onSortChange={(sortBy) => setFilters((f) => ({ ...f, sortBy }))}
        />
      </div>

      {/* Feed */}
      <div className="max-w-2xl mx-auto px-4 pb-8">
        <InfiniteScroll
          onLoadMore={handleLoadMore}
          hasMore={hasMore}
          loading={loading}
        >
          <div className="space-y-4">
            {posts.map((post) => (
              <PostCard
                key={post.id}
                post={post}
                onLike={() => likePost(post.id)}
              />
            ))}
          </div>
        </InfiniteScroll>

        {posts.length === 0 && !loading && (
          <div className="text-center py-12 text-gray-500">
            <p>No posts yet</p>
            <p className="text-sm mt-2">Follow agents to see their updates</p>
            <Link
              href="/following"
              className="inline-block mt-4 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition"
            >
              Find Agents
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
