import request from 'supertest';
import app from './server.js';
import { prisma } from './lib/prisma.js';

describe('DocFlow API authorization', () => {
  let ownerId: string;
  let viewerId: string;

  beforeAll(async () => {
    await prisma.documentShare.deleteMany();
    await prisma.document.deleteMany();
    await prisma.user.deleteMany();

    const owner = await prisma.user.create({
      data: { name: 'Owner', email: 'owner@test.com' },
    });
    const reviewer = await prisma.user.create({
      data: { name: 'Reviewer', email: 'reviewer@test.com' },
    });

    ownerId = owner.id;
    viewerId = reviewer.id;
  });

  it('rejects access when a user is not allowed to read a document', async () => {
    const document = await prisma.document.create({
      data: {
        title: 'Secret',
        content: JSON.stringify({ type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'secret' }] }] }),
        ownerId,
      },
    });

    const agent = request.agent(app);
    await agent.post('/api/login').send({ email: 'reviewer@test.com' });

    const response = await agent.get(`/api/documents/${document.id}`);
    expect(response.status).toBe(404);
  });

  it('rejects summary requests for users without document access', async () => {
    const document = await prisma.document.create({
      data: {
        title: 'Private summary',
        content: JSON.stringify({ type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'private' }] }] }),
        ownerId,
      },
    });

    const agent = request.agent(app);
    await agent.post('/api/login').send({ email: 'reviewer@test.com' });

    const response = await agent.post(`/api/documents/${document.id}/summarize`);
    expect(response.status).toBe(404);
  });

  it('prevents viewer access from modifying a document', async () => {
    const document = await prisma.document.create({
      data: {
        title: 'Shared view',
        content: JSON.stringify({ type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'hello' }] }] }),
        ownerId,
      },
    });

    await prisma.documentShare.create({
      data: {
        documentId: document.id,
        userId: viewerId,
        permission: 'viewer',
      },
    });

    const agent = request.agent(app);
    await agent.post('/api/login').send({ email: 'reviewer@test.com' });

    const response = await agent.patch(`/api/documents/${document.id}`).send({ title: 'Hacked' });
    expect(response.status).toBe(403);
  });

  it('allows editor updates', async () => {
    const document = await prisma.document.create({
      data: {
        title: 'Shared edit',
        content: JSON.stringify({ type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'before' }] }] }),
        ownerId,
      },
    });

    await prisma.documentShare.create({
      data: {
        documentId: document.id,
        userId: viewerId,
        permission: 'editor',
      },
    });

    const agent = request.agent(app);
    await agent.post('/api/login').send({ email: 'reviewer@test.com' });

    const response = await agent.patch(`/api/documents/${document.id}`).send({ title: 'after' });
    expect(response.status).toBe(200);
    expect(response.body.title).toBe('after');
  });

  it('does not create duplicate shares', async () => {
    const document = await prisma.document.create({
      data: {
        title: 'Duplicate share',
        content: JSON.stringify({ type: 'doc', content: [{ type: 'paragraph' }] }),
        ownerId,
      },
    });

    const agent = request.agent(app);
    await agent.post('/api/login').send({ email: 'owner@test.com' });

    const first = await agent.post(`/api/documents/${document.id}/share`).send({ userEmail: 'reviewer@test.com', permission: 'viewer' });
    const second = await agent.post(`/api/documents/${document.id}/share`).send({ userEmail: 'reviewer@test.com', permission: 'editor' });
    const count = await prisma.documentShare.count({ where: { documentId: document.id, userId: viewerId } });

    expect(first.status).toBe(201);
    expect(second.status).toBe(201);
    expect(count).toBe(1);
  });

  it('imports content into an existing draft document', async () => {
    const document = await prisma.document.create({
      data: {
        title: 'Draft before import',
        content: JSON.stringify({ type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'old draft' }] }] }),
        ownerId,
      },
    });

    const agent = request.agent(app);
    await agent.post('/api/login').send({ email: 'owner@test.com' });

    const response = await agent
      .post('/api/import')
      .field('documentId', document.id)
      .attach('file', Buffer.from('Imported text', 'utf-8'), {
        filename: 'notes.txt',
        contentType: 'text/plain',
      });

    expect(response.status).toBe(200);
    const updated = await prisma.document.findUnique({ where: { id: document.id } });
    expect(updated?.title).toBe('notes');
    expect(updated?.content).toContain('Imported text');
  });
});
