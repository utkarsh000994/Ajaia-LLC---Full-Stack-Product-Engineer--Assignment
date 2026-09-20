import 'dotenv/config';
import express from 'express';
import session from 'express-session';
import cors from 'cors';
import multer from 'multer';
import { PrismaClient } from '@prisma/client';
import { z } from 'zod';
import { requireAuth, getCurrentUserId } from './lib/auth.js';
import { markdownToProseMirror } from './lib/markdown.js';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';

const app = express();
const prisma = new PrismaClient();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
});

app.use(cors({ origin: process.env.FRONTEND_URL ?? 'http://localhost:5173', credentials: true }));
app.use(express.json({ limit: '2mb' }));
app.use(
  session({
    secret: process.env.SESSION_SECRET ?? 'docflow-demo-secret',
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      sameSite: 'lax',
      secure: false,
      maxAge: 1000 * 60 * 60 * 8,
    },
  }),
);

const userSchema = z.object({
  email: z.string().email(),
});

type DocumentPermission = 'viewer' | 'editor';

const normalizeContent = (value: unknown) => {
  if (!value || typeof value === 'string') {
    return value ?? { type: 'doc', content: [{ type: 'paragraph' }] };
  }
  return value;
};

const documentBodySchema = z.object({
  title: z.string().trim().min(1).max(120).optional(),
  content: z.any().optional(),
});

const serializeDocument = (doc: any) => ({
  ...doc,
  content: typeof doc.content === 'string' ? JSON.parse(doc.content) : doc.content,
  owner: doc.owner,
  permission: doc.permission,
});

const shareSchema = z.object({
  userEmail: z.string().email(),
  permission: z.enum(['viewer', 'editor']),
});

const getUserBySession = async (userId: string | null) => {
  if (!userId) return null;
  return prisma.user.findUnique({ where: { id: userId } });
};

const canAccessDocument = async (documentId: string, userId: string) => {
  const document = await prisma.document.findUnique({
    where: { id: documentId },
    include: { owner: true, shares: true },
  });
  if (!document) return null;

  if (document.ownerId === userId) {
    return { document, permission: 'owner' as const };
  }

  const share = document.shares.find((entry) => entry.userId === userId);
  if (share) {
    return { document, permission: share.permission };
  }

  return null;
};

app.get('/api/health', (_req, res) => {
  res.json({ ok: true });
});

app.post('/api/login', async (req, res) => {
  const parsed = userSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'A valid email is required.' });
  }

  const user = await prisma.user.findUnique({ where: { email: parsed.data.email } });
  if (!user) {
    return res.status(401).json({ error: 'Unknown user.' });
  }

  req.session.userId = user.id;
  return res.json({ user: { id: user.id, email: user.email, name: user.name } });
});

app.post('/api/logout', (req, res) => {
  req.session.destroy(() => {
    res.json({ ok: true });
  });
});

app.get('/api/me', requireAuth, async (req, res) => {
  const user = await getUserBySession(req.session.userId);
  if (!user) {
    return res.status(401).json({ error: 'Session invalid.' });
  }
  res.json({ user: { id: user.id, email: user.email, name: user.name } });
});

app.get('/api/documents', requireAuth, async (req, res) => {
  const userId = getCurrentUserId(req);
  if (!userId) return res.status(401).json({ error: 'Authentication required.' });

  const owned = await prisma.document.findMany({
    where: { ownerId: userId },
    include: { owner: true },
    orderBy: { updatedAt: 'desc' },
  });

  const shared = await prisma.documentShare.findMany({
    where: { userId },
    include: { document: { include: { owner: true } } },
    orderBy: { createdAt: 'desc' },
  });

  const sharedDocuments = shared.map((entry) => ({
    ...entry.document,
    content: typeof entry.document.content === 'string' ? JSON.parse(entry.document.content) : entry.document.content,
    access: entry.permission,
    owner: entry.document.owner,
  }));

  res.json({
    owned: owned.map((doc) => ({ ...doc, content: typeof doc.content === 'string' ? JSON.parse(doc.content) : doc.content, owner: doc.owner })),
    shared: sharedDocuments,
  });
});

app.post('/api/documents', requireAuth, async (req, res) => {
  const userId = getCurrentUserId(req);
  if (!userId) return res.status(401).json({ error: 'Authentication required.' });

  const parsed = documentBodySchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid document payload.' });
  }

  const contentValue = normalizeContent(parsed.data.content ?? { type: 'doc', content: [{ type: 'paragraph' }] });

  const document = await prisma.document.create({
    data: {
      title: parsed.data.title ?? 'Untitled document',
      content: JSON.stringify(contentValue),
      ownerId: userId,
    },
    include: { owner: true },
  });

  return res.status(201).json(serializeDocument(document));
});

app.get('/api/documents/:id', requireAuth, async (req, res) => {
  const userId = getCurrentUserId(req);
  if (!userId) return res.status(401).json({ error: 'Authentication required.' });

  const result = await canAccessDocument(req.params.id, userId);
  if (!result) {
    return res.status(404).json({ error: 'Document not found or not accessible.' });
  }

  res.json(serializeDocument({ ...result.document, permission: result.permission }));
});

app.patch('/api/documents/:id', requireAuth, async (req, res) => {
  const userId = getCurrentUserId(req);
  if (!userId) return res.status(401).json({ error: 'Authentication required.' });

  const access = await canAccessDocument(req.params.id, userId);
  if (!access) {
    return res.status(404).json({ error: 'Document not found or not accessible.' });
  }

  if (access.permission === 'viewer') {
    return res.status(403).json({ error: 'Viewer users cannot modify documents.' });
  }

  const parsed = documentBodySchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid content or title.' });
  }

  try {
    const updated = await prisma.document.update({
      where: { id: req.params.id },
      data: {
        ...(parsed.data.title ? { title: parsed.data.title.trim() } : {}),
        ...(parsed.data.content !== undefined ? { content: JSON.stringify(normalizeContent(parsed.data.content)) } : {}),
      },
      include: { owner: true },
    });
    return res.json(serializeDocument(updated));
  } catch (error) {
    return res.status(500).json({ error: 'Unable to update document.' });
  }
});

app.delete('/api/documents/:id', requireAuth, async (req, res) => {
  const userId = getCurrentUserId(req);
  if (!userId) return res.status(401).json({ error: 'Authentication required.' });

  const access = await canAccessDocument(req.params.id, userId);
  if (!access) {
    return res.status(404).json({ error: 'Document not found or not accessible.' });
  }

  if (access.permission !== 'owner') {
    return res.status(403).json({ error: 'Only the owner can delete a document.' });
  }

  await prisma.document.delete({ where: { id: req.params.id } });
  res.json({ ok: true });
});

app.get('/api/documents/:id/shares', requireAuth, async (req, res) => {
  const userId = getCurrentUserId(req);
  if (!userId) return res.status(401).json({ error: 'Authentication required.' });

  const access = await canAccessDocument(req.params.id, userId);
  if (!access) {
    return res.status(404).json({ error: 'Document not found or not accessible.' });
  }

  if (access.permission !== 'owner') {
    return res.status(403).json({ error: 'Only the owner may manage shares.' });
  }

  const shares = await prisma.documentShare.findMany({
    where: { documentId: req.params.id },
    include: { user: true },
    orderBy: { createdAt: 'desc' },
  });

  res.json({
    shares: shares.map((share) => ({
      id: share.id,
      documentId: share.documentId,
      userId: share.userId,
      permission: share.permission,
      email: share.user.email,
      name: share.user.name,
    })),
  });
});

app.post('/api/documents/:id/share', requireAuth, async (req, res) => {
  const userId = getCurrentUserId(req);
  if (!userId) return res.status(401).json({ error: 'Authentication required.' });

  const access = await canAccessDocument(req.params.id, userId);
  if (!access) {
    return res.status(404).json({ error: 'Document not found or not accessible.' });
  }

  if (access.permission !== 'owner') {
    return res.status(403).json({ error: 'Only the owner may share a document.' });
  }

  const parsed = shareSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid share payload.' });
  }

  const targetUser = await prisma.user.findUnique({ where: { email: parsed.data.userEmail } });
  if (!targetUser) {
    return res.status(404).json({ error: 'User not found.' });
  }

  if (targetUser.id === userId) {
    return res.status(400).json({ error: 'The owner already has full access.' });
  }

  try {
    const share = await prisma.documentShare.upsert({
      where: {
        documentId_userId: {
          documentId: req.params.id,
          userId: targetUser.id,
        },
      },
      update: { permission: parsed.data.permission },
      create: {
        documentId: req.params.id,
        userId: targetUser.id,
        permission: parsed.data.permission,
      },
      include: { user: true },
    });

    return res.status(201).json({
      id: share.id,
      email: share.user.email,
      name: share.user.name,
      permission: share.permission,
      documentId: share.documentId,
    });
  } catch (error) {
    if (error instanceof PrismaClientKnownRequestError && error.code === 'P2002') {
      return res.status(409).json({ error: 'This share already exists.' });
    }
    return res.status(500).json({ error: 'Unable to create share.' });
  }
});

app.delete('/api/documents/:id/share/:shareId', requireAuth, async (req, res) => {
  const userId = getCurrentUserId(req);
  if (!userId) return res.status(401).json({ error: 'Authentication required.' });

  const access = await canAccessDocument(req.params.id, userId);
  if (!access) {
    return res.status(404).json({ error: 'Document not found or not accessible.' });
  }

  if (access.permission !== 'owner') {
    return res.status(403).json({ error: 'Only the owner may revoke shares.' });
  }

  const share = await prisma.documentShare.findUnique({ where: { id: req.params.shareId } });
  if (!share || share.documentId !== req.params.id) {
    return res.status(404).json({ error: 'Share not found.' });
  }

  await prisma.documentShare.delete({ where: { id: req.params.shareId } });
  res.json({ ok: true });
});

app.post('/api/import', requireAuth, upload.single('file'), async (req, res) => {
  const userId = getCurrentUserId(req);
  if (!userId) return res.status(401).json({ error: 'Authentication required.' });

  if (!req.file) {
    return res.status(400).json({ error: 'No file was uploaded.' });
  }

  const file = req.file;
  const allowedMime = ['text/plain', 'text/markdown', 'text/x-markdown', 'application/octet-stream'];
  const ext = file.originalname.split('.').pop()?.toLowerCase();
  const validExt = ['txt', 'md'];
  if (!ext || !validExt.includes(ext) || (!allowedMime.includes(file.mimetype) && file.mimetype !== '')) {
    return res.status(400).json({ error: 'Unsupported file type. Supported formats: .txt, .md' });
  }

  if (file.size > 5 * 1024 * 1024) {
    return res.status(400).json({ error: 'File exceeds the 5 MB size limit.' });
  }

  const text = Buffer.from(file.buffer).toString('utf-8');
  const content = ext === 'md' ? markdownToProseMirror(text) : {
    type: 'doc',
    content: [{ type: 'paragraph', content: [{ type: 'text', text: text.trim() || 'Imported document' }] }],
  };

  const document = await prisma.document.create({
    data: {
      title: (file.originalname.replace(/\.[^/.]+$/, '') || 'Imported document').slice(0, 120),
      content: JSON.stringify(content),
      ownerId: userId,
    },
    include: { owner: true },
  });

  return res.status(201).json(serializeDocument(document));
});

app.use((err: any, _req: any, res: any, _next: any) => {
  if (err instanceof multer.MulterError) {
    return res.status(400).json({ error: err.message });
  }

  console.error('Server error', err.message);
  return res.status(500).json({ error: 'Unexpected server error.' });
});

const PORT = Number(process.env.PORT ?? 4000);
if (process.env.NODE_ENV !== 'test') {
  app.listen(PORT, () => {
    console.log(`DocFlow API listening on http://localhost:${PORT}`);
  });
}

export default app;
