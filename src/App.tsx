import { useEffect, useMemo, useState } from 'react';
import { Link, Navigate, Route, Routes, useNavigate, useParams } from 'react-router-dom';
import { EditorContent, useEditor } from '@tiptap/react';
import { Mark } from '@tiptap/core';
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
const fontSizes = ['8', '9', '10', '11', '12', '14', '16', '18', '20', '22', '24', '28', '36', '48', '72'];

const FontSize = Mark.create({
  name: 'fontSize',
  addAttributes() {
    return {
      fontSize: {
        default: null,
        parseHTML: (element) => element.style.fontSize || null,
        renderHTML: (attributes) => attributes.fontSize ? { style: `font-size: ${attributes.fontSize}` } : {},
      },
    };
  },
  parseHTML() {
    return [{ tag: 'span[style*="font-size"]' }];
  },
  renderHTML({ HTMLAttributes }) {
    return ['span', HTMLAttributes, 0];
  },
});

async function request<T>(url: string, options: RequestInit = {}): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${API_BASE}${url}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(options.headers ?? {}),
      },
      credentials: 'include',
    });
  } catch {
    throw new Error('Unable to reach the API. Start the backend with npm run dev:server.');
  }

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error ?? `Request failed (${res.status}).`);
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

  const renameDocument = async (docId: string, currentTitle: string) => {
    const nextTitle = window.prompt('Rename document', currentTitle || 'Untitled document');
    if (!nextTitle || !nextTitle.trim()) return;

    try {
      await request(`/documents/${docId}`, {
        method: 'PATCH',
        body: JSON.stringify({ title: nextTitle.trim() }),
      });
      await loadDocuments();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to rename document');
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
            <input type="file" accept=".txt,.md,.docx" onChange={importFile} />
          </label>
        </div>
      </div>

      <div className="import-help">Supported formats: .txt, .md, .docx</div>
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
                  <DocumentCard
                    key={doc.id}
                    document={doc}
                    onOpen={() => navigate(`/documents/${doc.id}`)}
                    onRename={() => renameDocument(doc.id, doc.title)}
                  />
                ))}
              </div>
            )}
          </section>

          <section>
            <h3>Shared with me</h3>
            {shared.length === 0 ? <div className="empty-state">No shared documents</div> : (
              <div className="document-list">
                {shared.filter((doc) => doc.title.toLowerCase().includes(search.toLowerCase()) || !search.trim()).map((doc) => (
                  <DocumentCard
                    key={doc.id}
                    document={doc}
                    onOpen={() => navigate(`/documents/${doc.id}`)}
                    onRename={() => renameDocument(doc.id, doc.title)}
                  />
                ))}
              </div>
            )}
          </section>
        </div>
      )}
    </main>
  );
}

function DocumentCard({ document, onOpen, onRename }: { document: DocumentItem; onOpen: () => void; onRename: () => void }) {
  return (
    <div className="document-card">
      <button className="document-card-main" onClick={onOpen}>
        <div className="document-card-top">
          <strong>{document.title}</strong>
          <span className="chip">{document.access ?? 'owner'}</span>
        </div>
        <small>{new Date(document.updatedAt).toLocaleString()}</small>
        <div className="document-meta">Owner: {document.owner?.name ?? 'You'}</div>
        <div className="document-meta">Access: {document.access ?? 'owner'}</div>
      </button>
      <div className="document-actions">
        <button className="mini-button" onClick={onRename}>✎ Rename</button>
        <button className="mini-button secondary" onClick={onOpen}>Open</button>
      </div>
    </div>
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
  const [fontSize, setFontSize] = useState('16');
  const [summaryOpen, setSummaryOpen] = useState(false);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [summary, setSummary] = useState<string[]>([]);

  const importCurrentFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !id) return;

    const formData = new FormData();
    formData.append('file', file);
    formData.append('documentId', id);

    try {
      const result = await fetch(`${API_BASE}/import`, {
        method: 'POST',
        credentials: 'include',
        body: formData,
      });
      const data = await result.json().catch(() => ({}));
      if (!result.ok) throw new Error(data.error ?? 'Import failed');
      setDocument({
        ...(document ?? {} as DocumentItem),
        title: data.title ?? (document?.title ?? 'Imported document'),
        content: data.content ?? (document?.content ?? { type: 'doc', content: [{ type: 'paragraph' }] }),
        updatedAt: data.updatedAt ?? new Date().toISOString(),
      });
      setError('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Import failed');
    } finally {
      event.target.value = '';
    }
  };

  const summarizeDocument = async () => {
    if (!id) return;
    try {
      setSummaryLoading(true);
      setSummaryOpen(true);
      setError('');
      const data = await request<{ bullets: string[] }>(`/documents/${id}/summarize`, { method: 'POST' });
      setSummary(data.bullets);
    } catch (err) {
      setSummaryOpen(false);
      setError(err instanceof Error ? err.message : 'Unable to summarize document');
    } finally {
      setSummaryLoading(false);
    }
  };

  const saveDocument = async () => {
    if (!id || !document || !editor || permission === 'viewer') return;

    try {
      setSaveState('saving');
      await request(`/documents/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ title: document.title, content: editor.getJSON() }),
      });
      setSaveState('saved');
      setError('');
    } catch (err) {
      setSaveState('failed');
      setError(err instanceof Error ? err.message : 'Unable to save document');
    }
  };

  const editor = useEditor({
    extensions: [StarterKit, Underline, Heading.configure({ levels: [1, 2, 3] }), FontSize],
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
        <button className="button save-button" onClick={saveDocument} disabled={permission === 'viewer' || saveState === 'saving'}>Save</button>
        <label className="button button-secondary upload-button compact">
          Import into draft
          <input type="file" accept=".txt,.md,.docx" onChange={importCurrentFile} />
        </label>
        <button className="button ai-button" onClick={summarizeDocument} disabled={summaryLoading}>Summarize with AI</button>
        {permission === 'owner' && <button className="button" onClick={() => setShareOpen(true)}>Share</button>}
      </div>

      <div className="import-help">Supported formats: .txt, .md, .docx</div>
      {error && <div className="alert alert-error">{error}</div>}
      <div className="permission-banner">{permission === 'viewer' ? 'You have view access' : permission === 'editor' ? 'You have edit access' : 'Owner access'}</div>

      {editor && (
        <div className="editor-panel">
          <div className="toolbar">
            <button className="tool-button" onClick={() => editor.chain().focus().undo().run()} disabled={!editor.can().undo() || permission === 'viewer'}>Undo</button>
            <button className="tool-button" onClick={() => editor.chain().focus().redo().run()} disabled={!editor.can().redo() || permission === 'viewer'}>Redo</button>
            <button className="tool-button heading-tool" onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} disabled={permission === 'viewer'}>Heading</button>
            <label className="font-size-control">
              <span>Size</span>
              <select
                value={fontSize}
                onChange={(event) => {
                  const nextSize = event.target.value;
                  setFontSize(nextSize);
                  editor.chain().focus().setMark('fontSize', { fontSize: `${nextSize}px` }).run();
                }}
                disabled={permission === 'viewer'}
                aria-label="Text size"
              >
                {fontSizes.map((size) => <option key={size} value={size}>{size}</option>)}
              </select>
            </label>
            <button className="tool-button" onClick={() => editor.chain().focus().toggleBold().run()} disabled={permission === 'viewer'}>Bold</button>
            <button className="tool-button" onClick={() => editor.chain().focus().toggleItalic().run()} disabled={permission === 'viewer'}>Italic</button>
            <button className="tool-button" onClick={() => editor.chain().focus().toggleUnderline().run()} disabled={permission === 'viewer'}>Underline</button>
            <button className="tool-button" onClick={() => editor.chain().focus().toggleBulletList().run()} disabled={permission === 'viewer'}>Bullet list</button>
            <button className="tool-button" onClick={() => editor.chain().focus().toggleOrderedList().run()} disabled={permission === 'viewer'}>Numbered list</button>
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

      {summaryOpen && (
        <div className="modal-backdrop" onClick={() => !summaryLoading && setSummaryOpen(false)}>
          <div className="modal summary-modal" onClick={(event) => event.stopPropagation()}>
            <div className="modal-header">
              <div>
                <span className="modal-eyebrow">AI ASSIST</span>
                <h3>Document summary</h3>
              </div>
              <button className="button button-secondary" onClick={() => setSummaryOpen(false)} disabled={summaryLoading}>Close</button>
            </div>
            {summaryLoading ? <div className="summary-loading">Creating a concise summary...</div> : (
              <ul className="summary-list">
                {summary.map((bullet, index) => <li key={`${bullet}-${index}`}>{bullet}</li>)}
              </ul>
            )}
          </div>
        </div>
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
