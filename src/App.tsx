import { useEffect, useMemo, useState } from 'react';
import { Link, Navigate, Route, Routes, useNavigate, useParams } from 'react-router-dom';
import { EditorContent, useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import Heading from '@tiptap/extension-heading';

type User = { id: string; name: string; email: string };
type Permission = 'owner' | 'editor' | 'viewer';
type DocumentItem = {
  id: string;
  title: string;
  content: any;
  ownerId: string;
  owner?: User;
  updatedAt: string;
  createdAt: string;
  access?: Permission;
};

type Share = {
  id: string;
  userId: string;
  email: string;
  name: string;
  permission: 'viewer' | 'editor';
};

const API_BASE = '/api';

async function request<T>(url: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API_BASE}${url}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers ?? {}),
    },
    credentials: 'include',
  });

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error ?? 'Request failed');
  }

  return res.json() as Promise<T>;
}

function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loadingUser, setLoadingUser] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    fetchUser().then(setUser).catch(() => setUser(null)).finally(() => setLoadingUser(false));
  }, []);

  if (loadingUser) {
    return <div className="page-shell">Loading...</div>;
  }

  if (!user) {
    return <Routes><Route path="*" element={<LoginScreen onLogin={setUser} />} /></Routes>;
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand-wrap">
          <div className="brand-mark">D</div>
          <div>
            <div className="brand-name">DocFlow</div>
            <small>Collaborative workspace</small>
          </div>
        </div>
        <div className="user-pill">{user.name}</div>
        <button className="button button-secondary" onClick={async () => {
          await fetch(`${API_BASE}/logout`, { method: 'POST', credentials: 'include' });
          setUser(null);
          navigate('/login');
        }}>Logout</button>
      </header>

      <Routes>
        <Route path="/" element={<Dashboard user={user} />} />
        <Route path="/documents" element={<Dashboard user={user} />} />
        <Route path="/documents/:id" element={<DocumentEditor user={user} />} />
        <Route path="/login" element={<LoginScreen onLogin={setUser} />} />
      </Routes>
    </div>
  );
}

async function fetchUser() {
  const data = await request<{ user: User }>('/me');
  return data.user;
}

function LoginScreen({ onLogin }: { onLogin: (user: User) => void }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const demoUsers = [
    { name: 'Utkarsh Kumar', email: 'utkarsh@example.com' },
    { name: 'Demo Reviewer', email: 'reviewer@example.com' },
  ];

  const loginAs = async (email: string) => {
    try {
      setLoading(true);
      setError('');
      const data = await request<{ user: User }>('/login', {
        method: 'POST',
        body: JSON.stringify({ email }),
      });
      onLogin(data.user);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to log in');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-shell">
      <div className="login-card">
        <div className="brand-mark large">D</div>
        <h1>DocFlow</h1>
        <p>Authentication is intentionally simplified for this assessment using seeded demo users.</p>
        {error && <div className="alert alert-error">{error}</div>}
        <div className="demo-list">
          {demoUsers.map((user) => (
            <button key={user.email} className="demo-user" onClick={() => loginAs(user.email)} disabled={loading}>
              <strong>{user.name}</strong>
              <span>{user.email}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function Dashboard({ user }: { user: User }) {
  const navigate = useNavigate();
  const [owned, setOwned] = useState<DocumentItem[]>([]);
  const [shared, setShared] = useState<DocumentItem[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadDocuments = async () => {
    try {
      setLoading(true);
      const data = await request<{ owned: DocumentItem[]; shared: DocumentItem[] }>('/documents');
      setOwned(data.owned);
      setShared(data.shared);
      setError('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load documents');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadDocuments(); }, []);

  const createDocument = async () => {
    try {
      const doc = await request<DocumentItem>('/documents', {
        method: 'POST',
        body: JSON.stringify({ title: 'Untitled document' }),
      });
      navigate(`/documents/${doc.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to create document');
    }
  };

  const importFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const formData = new FormData();
    formData.append('file', file);

    try {
      const result = await fetch(`${API_BASE}/import`, {
        method: 'POST',
        credentials: 'include',
        body: formData,
      });
      const data = await result.json().catch(() => ({}));
      if (!result.ok) throw new Error(data.error ?? 'Import failed');
      navigate(`/documents/${data.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Import failed');
    }
  };

  const allDocuments = useMemo(() => {
    const merged = [...owned, ...shared];
    if (!search.trim()) return merged;
    return merged.filter((doc) => doc.title.toLowerCase().includes(search.toLowerCase()));
  }, [owned, shared, search]);

  return (
    <main className="page-shell">
      <div className="section-header">
        <div>
          <h2>Dashboard</h2>
          <p>Current user: {user.name}</p>
        </div>
        <div className="header-actions">
          <button className="button" onClick={createDocument}>New Document</button>
          <label className="button button-secondary upload-button">
            Import File
            <input type="file" accept=".txt,.md" onChange={importFile} />
          </label>
        </div>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      <div className="search-box">
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search documents" />
      </div>

      {loading ? <div className="empty-state">Loading documents...</div> : (
        <div className="document-columns">
          <section>
            <h3>Owned documents</h3>
            {owned.length === 0 ? <div className="empty-state">Create your first document</div> : (
              <div className="document-list">
                {allDocuments.filter((doc) => doc.ownerId === user.id || !shared.some((shareDoc) => shareDoc.id === doc.id)).map((doc) => (
                  <DocumentCard key={doc.id} document={doc} onOpen={() => navigate(`/documents/${doc.id}`)} />
                ))}
              </div>
            )}
          </section>

          <section>
            <h3>Shared with me</h3>
            {shared.length === 0 ? <div className="empty-state">No shared documents</div> : (
              <div className="document-list">
                {shared.filter((doc) => doc.title.toLowerCase().includes(search.toLowerCase()) || !search.trim()).map((doc) => (
                  <DocumentCard key={doc.id} document={doc} onOpen={() => navigate(`/documents/${doc.id}`)} />
                ))}
              </div>
            )}
          </section>
        </div>
      )}
    </main>
  );
}

function DocumentCard({ document, onOpen }: { document: DocumentItem; onOpen: () => void }) {
  return (
    <button className="document-card" onClick={onOpen}>
      <div className="document-card-top">
        <strong>{document.title}</strong>
        <span>{document.access ?? 'owner'}</span>
      </div>
      <small>{new Date(document.updatedAt).toLocaleString()}</small>
      <div className="document-meta">Owner: {document.owner?.name ?? 'You'}</div>
      <div className="document-meta">Access: {document.access ?? 'owner'}</div>
    </button>
  );
}

function DocumentEditor({ user }: { user: User }) {
  const navigate = useNavigate();
  const { id } = useParams();
  const [document, setDocument] = useState<DocumentItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [saveState, setSaveState] = useState<'saving' | 'saved' | 'failed'>('saved');
  const [error, setError] = useState('');
  const [shareOpen, setShareOpen] = useState(false);
  const [permission, setPermission] = useState<Permission>('owner');
  const [shares, setShares] = useState<Share[]>([]);

  const editor = useEditor({
    extensions: [StarterKit, Underline, Heading.configure({ levels: [1, 2, 3] })],
    content: document?.content ?? { type: 'doc', content: [{ type: 'paragraph' }] },
    editable: permission !== 'viewer',
    onUpdate: ({ editor }) => {
      if (!document) return;
      setDocument({ ...document, content: editor.getJSON(), updatedAt: new Date().toISOString() });
    },
  });

  useEffect(() => {
    const loadDocument = async () => {
      if (!id) return;
      try {
        setLoading(true);
        const data = await request<DocumentItem & { permission: Permission }>(`/documents/${id}`);
        setDocument(data);
        setPermission(data.permission ?? 'owner');
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unable to load document');
      } finally {
        setLoading(false);
      }
    };
    loadDocument();
  }, [id]);

  useEffect(() => {
    if (!editor || !document) return;
    const nextContent = document.content;
    if (JSON.stringify(editor.getJSON()) !== JSON.stringify(nextContent)) {
      editor.commands.setContent(nextContent, { emitUpdate: false });
    }
  }, [document, editor]);

  useEffect(() => {
    if (!id || !document || !editor) return;
    const timeout = setTimeout(async () => {
      try {
        setSaveState('saving');
        await request(`/documents/${id}`, {
          method: 'PATCH',
          body: JSON.stringify({ title: document.title, content: editor.getJSON() }),
        });
        setSaveState('saved');
      } catch (err) {
        setSaveState('failed');
        setError(err instanceof Error ? err.message : 'Autosave failed');
      }
    }, 800);

    return () => clearTimeout(timeout);
  }, [document?.title, document?.content, editor, id]);

  useEffect(() => {
    if (!shareOpen || !id) return;
    fetchShares(id).then(setShares).catch(() => setShares([]));
  }, [shareOpen, id]);

  if (loading) return <div className="page-shell">Loading document...</div>;
  if (!document) return <div className="page-shell">Document not found</div>;

  return (
    <main className="page-shell editor-shell">
      <div className="editor-toolbar top-row">
        <button className="button button-secondary" onClick={() => navigate('/documents')}>Back to documents</button>
        <input
          className="title-input"
          value={document.title}
          onChange={(e) => setDocument({ ...document, title: e.target.value })}
          aria-label="Document title"
        />
        <div className="save-state">{saveState === 'saving' ? 'Saving...' : saveState === 'failed' ? 'Save failed' : 'Saved'}</div>
        {permission === 'owner' && <button className="button" onClick={() => setShareOpen(true)}>Share</button>}
      </div>

      {error && <div className="alert alert-error">{error}</div>}
      <div className="permission-banner">{permission === 'viewer' ? 'You have view access' : permission === 'editor' ? 'You have edit access' : 'Owner access'}</div>

      {editor && (
        <div className="editor-panel">
          <div className="toolbar">
            <button onClick={() => editor.chain().focus().undo().run()} disabled={!editor.can().undo() || permission === 'viewer'}>Undo</button>
            <button onClick={() => editor.chain().focus().redo().run()} disabled={!editor.can().redo() || permission === 'viewer'}>Redo</button>
            <button onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} disabled={permission === 'viewer'}>Heading</button>
            <button onClick={() => editor.chain().focus().toggleBold().run()} disabled={permission === 'viewer'}>Bold</button>
            <button onClick={() => editor.chain().focus().toggleItalic().run()} disabled={permission === 'viewer'}>Italic</button>
            <button onClick={() => editor.chain().focus().toggleUnderline().run()} disabled={permission === 'viewer'}>Underline</button>
            <button onClick={() => editor.chain().focus().toggleBulletList().run()} disabled={permission === 'viewer'}>Bullet List</button>
            <button onClick={() => editor.chain().focus().toggleOrderedList().run()} disabled={permission === 'viewer'}>Numbered List</button>
          </div>
          <EditorContent editor={editor} className="editor-content" />
        </div>
      )}

      {shareOpen && permission === 'owner' && (
        <ShareDialog
          documentId={id!}
          onClose={() => setShareOpen(false)}
          onChanged={() => fetchShares(id!).then(setShares)}
          shares={shares}
          currentUser={user}
        />
      )}
    </main>
  );
}

async function fetchShares(documentId: string): Promise<Share[]> {
  const data = await request<{ shares: Share[] }>(`/documents/${documentId}/shares`);
  return data.shares;
}

function ShareDialog({ documentId, onClose, onChanged, shares, currentUser }: { documentId: string; onClose: () => void; onChanged: () => Promise<void>; shares: Share[]; currentUser: User }) {
  const [email, setEmail] = useState('');
  const [permission, setPermission] = useState<'viewer' | 'editor'>('viewer');
  const [error, setError] = useState('');

  const share = async () => {
    try {
      setError('');
      await request(`/documents/${documentId}/share`, {
        method: 'POST',
        body: JSON.stringify({ userEmail: email, permission }),
      });
      setEmail('');
      await onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to share');
    }
  };

  const revoke = async (shareId: string) => {
    try {
      await request(`/documents/${documentId}/share/${shareId}`, { method: 'DELETE' });
      await onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to revoke access');
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>Share document</h3>
          <button className="button button-secondary" onClick={onClose}>Close</button>
        </div>
        {error && <div className="alert alert-error">{error}</div>}
        <div className="share-summary">Current owner: {currentUser.name}</div>
        <div className="share-list">
          {shares.length === 0 ? <div className="empty-state">No shared users yet</div> : shares.map((share) => (
            <div key={share.id} className="share-item">
              <div>
                <strong>{share.email}</strong>
                <div>{share.permission}</div>
              </div>
              <button className="button button-secondary" onClick={() => revoke(share.id)}>Revoke</button>
            </div>
          ))}
        </div>

        <div className="share-form">
          <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Share with email" />
          <select value={permission} onChange={(e) => setPermission(e.target.value as 'viewer' | 'editor')}>
            <option value="viewer">Viewer</option>
            <option value="editor">Editor</option>
          </select>
          <button className="button" onClick={share}>Share</button>
        </div>
      </div>
    </div>
  );
}

export default App;
