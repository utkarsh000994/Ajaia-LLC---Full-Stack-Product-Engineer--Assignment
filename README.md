# DocFlow

## Overview
DocFlow is a lightweight collaborative document editor designed for focused, productive writing. Create documents, edit rich text, persist content, import files, share with controlled permissions, and turn long documents into clear takeaways with AI-powered summarization. Authentication is intentionally simplified for the assessment using seeded demo accounts rather than full OAuth or password management.

## Features
- Document creation and listing
- Rich-text editing with Tiptap
- Debounced autosave with save state feedback
- Document rename in the editor header
- .txt and .md import with validation and sanitization
- AI-powered document intelligence with Gemini summaries
- Sharing with editor/viewer permissions
- Owner-controlled access revocation
- SQLite-backed persistence via Prisma
- Business-logic tests covering authorization rules

## Tech Stack
Frontend
- React
- TypeScript
- Vite
- React Router
- Tiptap
- CSS modules/custom CSS

Backend
- Node.js
- Express
- TypeScript
- Multer for uploads
- Zod validation

Database
- Prisma ORM
- SQLite for local development

Testing
- Vitest
- Supertest

## Architecture
The app uses a small full-stack architecture:

Browser -> React UI -> REST API -> Express services -> Prisma -> SQLite

Each document operation is validated and authorized on the server before persistence or modification. Rich-text content is stored as structured JSON encoded as a string in SQLite to preserve document structure while remaining compatible with SQLite.

## AI Summarization
### Turn Long Documents Into Clear Takeaways

DocFlow puts an intelligent reading assistant directly inside the document editor. Open any document and click **Summarize with AI** to transform its content into a concise, easy-to-scan set of key bullet points. It is designed to help users quickly understand the purpose, decisions, and most important ideas in a document without reading every paragraph first.

The workflow is simple and focused:

1. Open a document you can access.
2. Click **Summarize with AI**.
3. DocFlow sends the document text to the protected backend summary endpoint.
4. Gemini analyzes the content and returns a concise bullet-point summary.
5. The summary appears instantly in a clean popup while the original document remains unchanged.

This feature is built with privacy and access control in mind. The Gemini API key stays on the server in `.env` and is never exposed to the browser. The summary endpoint reuses DocFlow's document permissions, so only authenticated users who can view a document may request its summary. AI summarization is an assistive reading tool; the original document is never overwritten.

## Local Setup
1. Install dependencies:
   npm install
2. Copy environment variables:
   cp .env.example .env
3. Apply database migration:
   npm run db:migrate
4. Seed demo users:
   npm run seed
5. Start the app:
   npm run dev

For AI summaries, set `GEMINI_API_KEY`, `AI_PROVIDER=gemini`, and `AI_MODEL` in `.env`. Keep the key server-side and never expose it in frontend code.

## Demo Accounts
- Utkarsh Kumar — utkarsh@example.com
- Demo Reviewer — reviewer@example.com

## Supported File Types
- .txt
- .md

## API Overview
- POST /api/login
- POST /api/logout
- GET /api/me
- GET /api/documents
- POST /api/documents
- GET /api/documents/:id
- PATCH /api/documents/:id
- DELETE /api/documents/:id
- POST /api/documents/:id/share
- GET /api/documents/:id/shares
- DELETE /api/documents/:id/share/:shareId
- POST /api/import
- POST /api/documents/:id/summarize

## Testing
Run the automated authorization tests with:

```bash
npm test
```

The suite contains meaningful API-level tests using Vitest and Supertest. It verifies:
- unauthorized user access returns 404
- viewer users cannot edit
- editor users can edit
- duplicate share records are prevented
- users without document access cannot request an AI summary
- imported content updates an existing draft document

These tests exercise the Express API, session authentication, Prisma persistence, and permission rules rather than only checking that code renders.

## Deployment
The app is configured for local development and can be adapted to a hosted environment by setting:

- DATABASE_URL
- SESSION_SECRET
- FRONTEND_URL
- PORT

The included .env.example documents the required values.

## Tradeoffs
- SQLite is used for simplicity and local demo readiness.
- Authentication is intentionally demo-only rather than full OAuth.
- DOCX support is intentionally excluded to keep the core product reliable.
- Real-time collaboration is not included because the assessment focuses on correctness, permission enforcement, persistence, and UX.

## Known Limitations
- The app uses a demo session model instead of production-grade auth.
- File imports are limited to .txt and .md.
- There is no real-time multi-user editing or version history.

## Future Improvements
- Production auth and account management
- Improved Markdown conversion library coverage
- Real-time collaborative editing
- Better audit/history UI for changes
- Optional DOCX import with a more robust parser
