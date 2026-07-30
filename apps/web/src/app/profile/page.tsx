'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { getMe, updateProfile, isAuthenticated } from '@/lib/api';
import styles from './profile.module.css';

type Profile = {
  id: string;
  email: string;
  full_name: string;
  role: string;
  is_active: boolean;
  created_at: string;
};

export default function ProfilePage() {
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    if (!isAuthenticated()) {
      router.replace('/auth/login');
      return;
    }
    (async () => {
      try {
        const me = await getMe();
        setProfile(me);
        setName(me.full_name);
      } catch {
        router.replace('/auth/login');
      } finally {
        setLoading(false);
      }
    })();
  }, [router]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      setError('Name is required.');
      return;
    }
    setSaving(true);
    setError('');
    setSuccess('');
    try {
      const updated = await updateProfile(name.trim());
      setProfile(updated);
      setName(updated.full_name);
      localStorage.setItem('plant_pulse_user', JSON.stringify({
        id: updated.id,
        full_name: updated.full_name,
        email: updated.email,
        role: updated.role,
      }));
      setSuccess('Profile updated.');
      setEditing(false);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Could not update profile.');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className={styles.root}>
        <div className={styles.center}><div className={styles.spinner} /></div>
      </div>
    );
  }

  if (!profile) return null;

  const initial = profile.full_name.charAt(0).toUpperCase();
  const joined = new Date(profile.created_at).toLocaleDateString('en-GB', {
    day: 'numeric', month: 'long', year: 'numeric',
  });

  return (
    <div className={styles.root}>
      <div className={styles.glow} />
      <div className={`container ${styles.inner}`}>
        <div className={styles.header}>
          <h1 className={styles.title}>Profile</h1>
          <p className={styles.sub}>Manage your Plant-Pulse account</p>
        </div>

        <div className={styles.layout}>
          <aside className={styles.card}>
            <div className={styles.avatar}>{initial}</div>
            <h2 className={styles.name}>{profile.full_name}</h2>
            <p className={styles.email}>{profile.email}</p>
            <span className={styles.role}>{profile.role.toLowerCase()}</span>
            <p className={styles.joined}>Member since {joined}</p>
          </aside>

          <div className={styles.mainCol}>
            <section className={styles.card}>
              <div className={styles.sectionHead}>
                <h3 className={styles.sectionTitle}>Account details</h3>
                {!editing && (
                  <button type="button" className={styles.editBtn} onClick={() => { setEditing(true); setSuccess(''); setError(''); }}>
                    Edit
                  </button>
                )}
              </div>

              {error && <div className={styles.error}>{error}</div>}
              {success && <div className={styles.success}>{success}</div>}

              {editing ? (
                <form onSubmit={handleSave} className={styles.form}>
                  <div className={styles.group}>
                    <label className={styles.label}>Full name</label>
                    <input
                      className={styles.input}
                      value={name}
                      onChange={e => setName(e.target.value)}
                      required
                      autoComplete="name"
                    />
                  </div>
                  <div className={styles.group}>
                    <label className={styles.label}>Email</label>
                    <input className={styles.input} value={profile.email} disabled />
                    <span className={styles.hint}>Email cannot be changed</span>
                  </div>
                  <div className={styles.formActions}>
                    <button type="button" className={styles.ghostBtn} onClick={() => { setEditing(false); setName(profile.full_name); setError(''); }}>
                      Cancel
                    </button>
                    <button type="submit" className={styles.saveBtn} disabled={saving}>
                      {saving ? 'Saving…' : 'Save changes'}
                    </button>
                  </div>
                </form>
              ) : (
                <dl className={styles.dl}>
                  <div className={styles.dlRow}>
                    <dt>Full name</dt>
                    <dd>{profile.full_name}</dd>
                  </div>
                  <div className={styles.dlRow}>
                    <dt>Email</dt>
                    <dd>{profile.email}</dd>
                  </div>
                  <div className={styles.dlRow}>
                    <dt>Role</dt>
                    <dd>{profile.role}</dd>
                  </div>
                  <div className={styles.dlRow}>
                    <dt>Status</dt>
                    <dd>{profile.is_active ? 'Active' : 'Suspended'}</dd>
                  </div>
                </dl>
              )}
            </section>

            <section className={styles.card}>
              <h3 className={styles.sectionTitle}>Quick links</h3>
              <div className={styles.links}>
                <Link href="/scan" className={styles.quickLink}>Scan a plant</Link>
                <Link href="/history" className={styles.quickLink}>Scan history</Link>
                <Link href="/community" className={styles.quickLink}>Community</Link>
                <Link href="/auth/forgot-password" className={styles.quickLink}>Change password</Link>
              </div>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}
