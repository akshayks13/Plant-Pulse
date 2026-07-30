'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Sidebar from '@/components/Sidebar';
import { getCommunityPosts, deleteCommunityPost } from '@/lib/api';
import styles from './community.module.css';

type Post = {
  id: string;
  title: string;
  content: string;
  image_url: string | null;
  category: string;
  likes_count: number;
  comments_count: number;
  created_at: string;
  author: { id: string; full_name: string; email: string };
};

export default function CommunityModerationPage() {
  const router = useRouter();
  const [items, setItems] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [total, setTotal] = useState(0);
  const [deleting, setDeleting] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    try {
      const data = await getCommunityPosts(1, 50) as { items: Post[]; total: number };
      setItems(data.items || []);
      setTotal(data.total || 0);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!localStorage.getItem('plant_pulse_admin_token')) {
      router.push('/login');
      return;
    }
    load();
  }, [router]);

  async function handleDelete(id: string) {
    if (!confirm('Delete this community post?')) return;
    setDeleting(id);
    try {
      await deleteCommunityPost(id);
      setItems(prev => prev.filter(p => p.id !== id));
      setTotal(t => Math.max(0, t - 1));
    } catch {
      alert('Failed to delete post');
    } finally {
      setDeleting(null);
    }
  }

  const filtered = items.filter(p =>
    p.title.toLowerCase().includes(search.toLowerCase()) ||
    p.content.toLowerCase().includes(search.toLowerCase()) ||
    p.author.email.toLowerCase().includes(search.toLowerCase()) ||
    p.author.full_name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className={styles.layout}>
      <Sidebar />
      <main className={styles.main}>
        <div className={styles.header}>
          <div>
            <h1 className={styles.title}>Community</h1>
            <p className={styles.sub}>{total} posts — moderate farmer community content</p>
          </div>
        </div>

        <div className={styles.toolbar}>
          <div className={styles.searchWrap}>
            <svg className={styles.searchIcon} width="16" height="16" viewBox="0 0 16 16" fill="none">
              <circle cx="7" cy="7" r="5" stroke="currentColor" strokeWidth="1.5"/>
              <path d="M11 11l3 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
            <input
              className={`input ${styles.search}`}
              placeholder="Search title, content, or author…"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
        </div>

        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Title</th>
                <th>Category</th>
                <th>Author</th>
                <th>Likes</th>
                <th>Comments</th>
                <th>Date</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={7} className={styles.loadCell}><div className="spinner" /></td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={7} className={styles.emptyCell}>No community posts found.</td></tr>
              ) : filtered.map((p, i) => (
                <tr key={p.id} className={styles.row} style={{ animationDelay: `${i * 0.03}s` }}>
                  <td>
                    <div className={styles.postTitle}>{p.title}</div>
                    <div className={styles.postPreview}>{p.content.slice(0, 80)}{p.content.length > 80 ? '…' : ''}</div>
                  </td>
                  <td><span className={styles.cat}>{p.category}</span></td>
                  <td>
                    <div className={styles.authorName}>{p.author.full_name}</div>
                    <div className={styles.authorEmail}>{p.author.email}</div>
                  </td>
                  <td className={styles.num}>{p.likes_count}</td>
                  <td className={styles.num}>{p.comments_count}</td>
                  <td className={styles.date}>
                    {new Date(p.created_at).toLocaleDateString('en-GB', {
                      day: 'numeric', month: 'short', year: 'numeric',
                    })}
                  </td>
                  <td>
                    <button
                      className={styles.deleteBtn}
                      disabled={deleting === p.id}
                      onClick={() => handleDelete(p.id)}
                    >
                      {deleting === p.id ? '…' : 'Delete'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </main>
    </div>
  );
}
