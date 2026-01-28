'use client';

import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { Loader2, ImagePlus, Send } from 'lucide-react';
import Layout from '@/components/Layout';
import PostCard from '@/components/PostCard';
import { postsApi } from '@/lib/api';
import { useAuthStore } from '@/lib/store';
import { getInitials } from '@/lib/utils';

interface Post {
  id: string;
  content: string;
  image_url?: string;
  likes_count: number;
  created_at: string;
  user_id: string;
  name: string;
  profile_pic?: string;
  is_verified_donor?: boolean;
  is_liked?: boolean;
}

export default function FeedPage() {
  const { user } = useAuthStore();
  const [posts, setPosts] = useState<Post[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isPosting, setIsPosting] = useState(false);
  const [newPost, setNewPost] = useState('');

  useEffect(() => {
    loadPosts();
  }, []);

  async function loadPosts() {
    try {
      const { data } = await postsApi.getFeed({ limit: 50 });
      setPosts(data.posts);
    } catch (error) {
      toast.error('Failed to load feed');
    } finally {
      setIsLoading(false);
    }
  }

  async function handlePost() {
    if (!newPost.trim()) return;

    setIsPosting(true);
    try {
      const { data } = await postsApi.create({ content: newPost });
      setPosts([{ ...data.post, ...data.post.user }, ...posts]);
      setNewPost('');
      toast.success('Post created!');
    } catch (error) {
      toast.error('Failed to create post');
    } finally {
      setIsPosting(false);
    }
  }

  function handlePostDelete(postId: string) {
    setPosts(posts.filter((p) => p.id !== postId));
  }

  return (
    <Layout>
      <div className="max-w-2xl mx-auto">
        <h1 className="text-2xl font-bold mb-6">Feed</h1>

        {/* Create Post */}
        <div className="card mb-6">
          <div className="flex gap-4">
            {user?.profilePic ? (
              <img
                src={user.profilePic}
                alt={user.name}
                className="h-10 w-10 rounded-full object-cover shrink-0"
              />
            ) : (
              <div className="h-10 w-10 rounded-full bg-primary-100 flex items-center justify-center text-primary-700 font-medium shrink-0">
                {getInitials(user?.name)}
              </div>
            )}
            <div className="flex-1">
              <textarea
                value={newPost}
                onChange={(e) => setNewPost(e.target.value)}
                placeholder="Share your food donation story..."
                className="input resize-none min-h-[100px]"
                maxLength={500}
              />
              <div className="flex items-center justify-between mt-3">
                <button className="btn-ghost">
                  <ImagePlus className="h-5 w-5" />
                </button>
                <div className="flex items-center gap-3">
                  <span className="text-sm text-gray-500">
                    {newPost.length}/500
                  </span>
                  <button
                    onClick={handlePost}
                    disabled={isPosting || !newPost.trim()}
                    className="btn-primary"
                  >
                    {isPosting ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <>
                        <Send className="h-4 w-4 mr-1" />
                        Post
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Posts */}
        {isLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary-600" />
          </div>
        ) : posts.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <p>No posts yet. Be the first to share!</p>
          </div>
        ) : (
          <div className="space-y-4">
            {posts.map((post) => (
              <PostCard
                key={post.id}
                post={post}
                onDelete={() => handlePostDelete(post.id)}
              />
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
}
