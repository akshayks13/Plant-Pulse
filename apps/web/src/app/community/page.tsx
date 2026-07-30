'use client';
import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import {
  getCommunityPosts,
  getCommunityPost,
  createCommunityPost,
  likeCommunityPost,
  commentCommunityPost,
  deleteCommunityPost,
  mediaUrl,
  isAuthenticated,
  type CommunityPost,
  type CommunityComment,
} from '@/lib/api';
import styles from './community.module.css';

const CATEGORIES = ['all', 'general', 'tip', 'question'] as const;

export default function CommunityPage() {
  const router = useRouter();
  const [posts, setPosts] = useState<CommunityPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [category, setCategory] = useState<(typeof CATEGORIES)[number]>('all');
  const [expanded, setExpanded] = useState<string | null>(null);
  const [comments, setComments] = useState<Record<string, CommunityComment[]>>({});
  const [commentDraft, setCommentDraft] = useState<Record<string, string>>({});
  const [showComposer, setShowComposer] = useState(false);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [postCategory, setPostCategory] = useState('general');
  const [file, setFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [meId, setMeId] = useState<string | null>(null);

  useEffect(() => {
    if (!isAuthenticated()) {
      router.replace('/auth/login');
      return;
    }
    try {
      const raw = localStorage.getItem('plant_pulse_user');
      const user = raw ? JSON.parse(raw) : null;
      setMeId(user?.id || null);
    } catch { setMeId(null); }
  }, [router]);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await getCommunityPosts(1, 50, category === 'all' ? undefined : category);
      setPosts(data.items || []);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load community.');
    } finally {
      setLoading(false);
    }
  }, [category]);

  useEffect(() => {
    if (isAuthenticated()) load();
  }, [load]);

  async function toggleComments(postId: string) {
    if (expanded === postId) {
      setExpanded(null);
      return;
    }
    setExpanded(postId);
    try {
      const detail = await getCommunityPost(postId);
      setComments(prev => ({ ...prev, [postId]: detail.comments || [] }));
    } catch {
      setComments(prev => ({ ...prev, [postId]: [] }));
    }
  }

  async function handleLike(postId: string) {
    try {
      const res = await likeCommunityPost(postId);
      setPosts(prev => prev.map(p =>
        p.id === postId ? { ...p, liked_by_me: res.liked, likes_count: res.likes_count } : p
      ));
    } catch { /* ignore */ }
  }

  async function handleComment(postId: string) {
    const text = (commentDraft[postId] || '').trim();
    if (!text) return;
    try {
      const c = await commentCommunityPost(postId, text);
      setComments(prev => ({ ...prev, [postId]: [...(prev[postId] || []), c] }));
      setPosts(prev => prev.map(p =>
        p.id === postId ? { ...p, comments_count: c.comments_count ?? p.comments_count + 1 } : p
      ));
      setCommentDraft(prev => ({ ...prev, [postId]: '' }));
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Comment failed.');
    }
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || !content.trim()) return;
    setSubmitting(true);
    setError('');
    try {
      const post = await createCommunityPost({
        title: title.trim(),
        content: content.trim(),
        category: postCategory,
        file,
      });
      setPosts(prev => [post, ...prev]);
      setTitle('');
      setContent('');
      setFile(null);
      setPostCategory('general');
      setShowComposer(false);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to create post.');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(postId: string) {
    if (!confirm('Delete this post?')) return;
    try {
      await deleteCommunityPost(postId);
      setPosts(prev => prev.filter(p => p.id !== postId));
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Delete failed.');
    }
  }

  return (
    <div className={styles.root}>
      <div className={styles.glow} />
      <div className={`container ${styles.inner}`}>
        <div className={styles.header}>
          <div>
            <h1 className={styles.title}>Community</h1>
            <p className={styles.sub}>Share tips, ask questions, and learn from fellow growers.</p>
          </div>
          <button className={styles.newBtn} onClick={() => setShowComposer(v => !v)}>
            {showComposer ? 'Cancel' : 'New post'}
          </button>
        </div>

        <div className={styles.filters}>
          {CATEGORIES.map(c => (
            <button
              key={c}
              className={`${styles.filterBtn} ${category === c ? styles.filterActive : ''}`}
              onClick={() => setCategory(c)}
            >
              {c.charAt(0).toUpperCase() + c.slice(1)}
            </button>
          ))}
        </div>

        {showComposer && (
          <form className={styles.composer} onSubmit={handleCreate}>
            <input
              className={styles.input}
              placeholder="Title"
              value={title}
              onChange={e => setTitle(e.target.value)}
              required
            />
            <textarea
              className={styles.textarea}
              placeholder="Share your experience, tip, or question…"
              value={content}
              onChange={e => setContent(e.target.value)}
              rows={4}
              required
            />
            <div className={styles.composerRow}>
              <select
                className={styles.select}
                value={postCategory}
                onChange={e => setPostCategory(e.target.value)}
              >
                <option value="general">General</option>
                <option value="tip">Tip</option>
                <option value="question">Question</option>
              </select>
              <label className={styles.fileLabel}>
                {file ? file.name : 'Attach image'}
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  hidden
                  onChange={e => setFile(e.target.files?.[0] || null)}
                />
              </label>
              <button className={styles.submitBtn} type="submit" disabled={submitting}>
                {submitting ? 'Posting…' : 'Publish'}
              </button>
            </div>
          </form>
        )}

        {error && <p className={styles.error}>{error}</p>}

        {loading ? (
          <div className={styles.center}><div className={styles.spinner} /></div>
        ) : posts.length === 0 ? (
          <div className={styles.empty}>
            <div className={styles.emptyIcon}>💬</div>
            <h3>No posts yet</h3>
            <p>Be the first to share something with the community.</p>
            <button className={styles.emptyBtn} onClick={() => setShowComposer(true)}>Write a post</button>
          </div>
        ) : (
          <div className={styles.feed}>
            {posts.map((p, i) => {
              const img = mediaUrl(p.image_url);
              return (
                <article key={p.id} className={styles.post} style={{ animationDelay: `${i * 0.04}s` }}>
                  <div className={styles.postTop}>
                    <div className={styles.avatar}>{p.author.full_name?.charAt(0)?.toUpperCase() || '?'}</div>
                    <div className={styles.meta}>
                      <span className={styles.author}>{p.author.full_name}</span>
                      <span className={styles.when}>
                        {new Date(p.created_at).toLocaleDateString('en-GB', {
                          day: 'numeric', month: 'short', year: 'numeric',
                        })}
                        {' · '}
                        <span className={styles.cat}>{p.category}</span>
                      </span>
                    </div>
                    {meId && p.author.id === meId && (
                      <button className={styles.deleteBtn} onClick={() => handleDelete(p.id)}>Delete</button>
                    )}
                  </div>
                  <h2 className={styles.postTitle}>{p.title}</h2>
                  <p className={styles.postBody}>{p.content}</p>
                  {img && (
                    <div className={styles.postImage}>
                      <Image src={img} alt="" fill style={{ objectFit: 'cover' }} unoptimized />
                    </div>
                  )}
                  <div className={styles.actions}>
                    <button
                      className={`${styles.actionBtn} ${p.liked_by_me ? styles.liked : ''}`}
                      onClick={() => handleLike(p.id)}
                    >
                      ♥ {p.likes_count}
                    </button>
                    <button className={styles.actionBtn} onClick={() => toggleComments(p.id)}>
                      💬 {p.comments_count}
                    </button>
                  </div>
                  {expanded === p.id && (
                    <div className={styles.comments}>
                      {(comments[p.id] || []).map(c => (
                        <div key={c.id} className={styles.comment}>
                          <strong>{c.author.full_name}</strong>
                          <span>{c.content}</span>
                        </div>
                      ))}
                      <div className={styles.commentForm}>
                        <input
                          className={styles.input}
                          placeholder="Write a comment…"
                          value={commentDraft[p.id] || ''}
                          onChange={e => setCommentDraft(prev => ({ ...prev, [p.id]: e.target.value }))}
                          onKeyDown={e => { if (e.key === 'Enter') handleComment(p.id); }}
                        />
                        <button className={styles.submitBtn} onClick={() => handleComment(p.id)}>Send</button>
                      </div>
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
