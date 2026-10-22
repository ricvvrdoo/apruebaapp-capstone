import React, { useEffect, useState } from 'react';
import { api } from '../api/client.js';
import { useAuth } from '../auth/AuthContext.jsx';
import { Spinner, Toast, initials } from '../components/ui.jsx';

export default function Community() {
  const { L, user } = useAuth();
  const [posts, setPosts] = useState(null);
  const [nextCursor, setNextCursor] = useState(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [text, setText] = useState('');
  const [openComments, setOpenComments] = useState({}); // postId -> [comments]
  const [draft, setDraft] = useState({});
  const [toast, setToast] = useState('');
  const flash = (m) => { setToast(m); setTimeout(() => setToast(''), 2500); };

  const load = async () => {
    const { data, meta } = await api.get('/feed');
    setPosts(data); setNextCursor(meta?.pagination?.nextCursor || null);
  };
  useEffect(() => { load().catch(() => setPosts([])); }, []);

  const loadMore = async () => {
    if (!nextCursor || loadingMore) return;
    setLoadingMore(true);
    try {
      const { data, meta } = await api.get(`/feed?cursor=${encodeURIComponent(nextCursor)}`);
      setPosts((ps) => [...ps, ...data.filter((p) => !ps.some((x) => x.id === p.id))]);
      setNextCursor(meta?.pagination?.nextCursor || null);
    } catch (e) { flash(e.message); } finally { setLoadingMore(false); }
  };

  const publish = async () => {
    if (!text.trim()) return;
    try { await api.post('/posts', { text }); setText(''); await load(); } catch (e) { flash(e.message); }
  };
  const like = async (id) => {
    try { const { data } = await api.post(`/posts/${id}/like`, {}); setPosts((ps) => ps.map((p) => p.id === id ? { ...p, likes: data.likes, liked: data.liked } : p)); } catch (e) { flash(e.message); }
  };
  const repost = async (id) => {
    try { const { data } = await api.post(`/posts/${id}/repost`, {}); setPosts((ps) => ps.map((p) => p.id === id ? { ...p, reposts: data.reposts, reposted: data.reposted } : p)); } catch (e) { flash(e.message); }
  };
  const removePost = async (id) => {
    if (!window.confirm(L('post_delete_confirm'))) return;
    try { await api.del(`/posts/${id}`); setPosts((ps) => ps.filter((p) => p.id !== id)); } catch (e) { flash(e.message); }
  };
  const toggleComments = async (id) => {
    if (openComments[id]) { setOpenComments((s) => { const n = { ...s }; delete n[id]; return n; }); return; }
    try { const { data } = await api.get(`/posts/${id}/comments`); setOpenComments((s) => ({ ...s, [id]: data })); } catch (e) { flash(e.message); }
  };
  const addComment = async (id) => {
    const t = (draft[id] || '').trim(); if (!t) return;
    try {
      await api.post(`/posts/${id}/comments`, { text: t });
      const { data } = await api.get(`/posts/${id}/comments`);
      setOpenComments((s) => ({ ...s, [id]: data })); setDraft((d) => ({ ...d, [id]: '' }));
      setPosts((ps) => ps.map((p) => p.id === id ? { ...p, comments: data.length } : p));
    } catch (e) { flash(e.message); }
  };
  const removeComment = async (postId, commentId) => {
    try {
      await api.del(`/posts/${postId}/comments/${commentId}`);
      setOpenComments((s) => ({ ...s, [postId]: s[postId].filter((c) => c.id !== commentId) }));
      setPosts((ps) => ps.map((p) => p.id === postId ? { ...p, comments: Math.max(0, p.comments - 1) } : p));
    } catch (e) { flash(e.message); }
  };

  // Acciones que se activan con teclado igual que con el clic.
  const act = (fn) => ({
    role: 'button', tabIndex: 0, onClick: fn,
    onKeyDown: (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fn(); } },
  });

  if (!posts) return <Spinner />;
  return (
    <div style={{ maxWidth: 720, margin: '0 auto' }}>
      <Toast msg={toast} />
      <div className="card">
        <div className="flex" style={{ gap: 10 }}><div className="side-avatar" style={{ background: 'var(--brand)', color: '#fff' }}>{initials(user?.name)}</div>
          <input placeholder={L('post_ph')} aria-label={L('post_ph')} value={text} onChange={(e) => setText(e.target.value)} style={{ margin: 0 }} /></div>
        <div className="flex between" style={{ marginTop: 12 }}><span className="note">{'\u{1F4F7}'} {'\u{1F517}'} {'\u{1F4CA}'}</span><button className="btn" style={{ padding: '9px 16px' }} onClick={publish}>{L('publish')}</button></div>
      </div>
      {posts.length === 0 && <div className="card flat" style={{ marginTop: 16, textAlign: 'center' }}><p className="note">{L('com_empty')}</p></div>}
      {posts.map((p) => (
        <div key={p.id} className="card" style={{ marginTop: 16 }}>
          <div className="flex" style={{ gap: 10 }}><div className="mavatar" style={{ background: '#1A365D', margin: 0 }}>{initials(p.author?.name)}</div>
            <div style={{ flex: 1 }}><b style={{ fontSize: 13 }}>{p.author?.name}</b></div>
            {p.mine && <button className="btn gho" style={{ color: 'var(--danger)', padding: '4px 8px' }} onClick={() => removePost(p.id)}>{L('post_delete')}</button>}
          </div>
          <p style={{ marginTop: 10 }}>{p.text}</p>
          {p.question ? <div className="card flat" style={{ marginTop: 10 }}><span className="tag">{p.question.axis || 'Pregunta'}</span> <span className="note">#{p.question.id}</span></div> : null}
          <div className="flex" style={{ gap: 18, marginTop: 10 }}>
            <span className="note" style={{ cursor: 'pointer', color: p.liked ? 'var(--brand)' : undefined }} aria-pressed={!!p.liked} {...act(() => like(p.id))}>{'\u{1F44D}'} {p.likes}</span>
            <span className="note" style={{ cursor: 'pointer', color: p.reposted ? 'var(--brand)' : undefined }} aria-pressed={!!p.reposted} {...act(() => repost(p.id))}>{'\u{1F501}'} {p.reposts || 0}</span>
            <span className="note" style={{ cursor: 'pointer' }} {...act(() => toggleComments(p.id))}>{'\u{1F4AC}'} {p.comments} {L('comments')}</span>
          </div>
          {openComments[p.id] ? (
            <div style={{ marginTop: 10 }}>
              {openComments[p.id].map((c) => (
                <div key={c.id} className="row" style={{ marginTop: 6 }}><div className="mavatar" style={{ background: '#10B981', margin: 0 }}>{initials(c.author?.name)}</div>
                  <div style={{ fontSize: 13, flex: 1 }}><b>{c.author?.name}</b> {c.text}</div>
                  {p.mine && <button className="btn gho" style={{ color: 'var(--danger)', padding: '2px 8px' }} aria-label={L('comment_delete')} onClick={() => removeComment(p.id, c.id)}>✕</button>}
                </div>
              ))}
              <div className="flex" style={{ gap: 8, marginTop: 8 }}>
                <input placeholder={L('comment')} aria-label={L('comment')} value={draft[p.id] || ''} onChange={(e) => setDraft((d) => ({ ...d, [p.id]: e.target.value }))} />
                <button className="btn sec" style={{ padding: '10px 14px' }} onClick={() => addComment(p.id)}>{L('send')}</button>
              </div>
            </div>
          ) : null}
        </div>
      ))}
      {nextCursor && (
        <div style={{ textAlign: 'center', marginTop: 16 }}>
          <button className="btn sec" disabled={loadingMore} onClick={loadMore}>{loadingMore ? L('loading') : L('load_more')}</button>
        </div>
      )}
    </div>
  );
}
