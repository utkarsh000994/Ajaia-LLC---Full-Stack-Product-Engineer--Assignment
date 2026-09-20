# DocFlow
## Completed Project Documentation

**Project type:** AI-native collaborative document editor  
**Assessment:** Ajaia Full Stack Product Engineer  
**Status:** Completed local assessment build  
**Primary AI provider:** Google Gemini  
**Frontend:** React, TypeScript, Vite, Tiptap  
**Backend:** Node.js, Express, Prisma, SQLite

---

## 1. Executive Summary

DocFlow is a lightweight collaborative document workspace built for fast, reliable writing and review. It combines a focused rich-text editor with document persistence, sharing permissions, file import, explicit save controls, debounced autosave, and an AI-powered summarization workflow.

The product is designed around a practical question: how can a document tool help a user move from creating content to understanding and sharing it with less friction?

DocFlow answers that with three connected experiences:

1. **Create and edit:** Users can create documents, rename them, format content, and change text sizes.
2. **Collaborate safely:** Owners can share documents with viewer or editor access, while authorization is enforced by the backend.
3. **Understand quickly:** The **Summarize with AI** feature converts a long document into concise bullet points without changing the source document.

The implementation prioritizes correctness, clear permissions, readable UX, and a small architecture that is easy to understand and extend.

---

## 2. Product Highlights

### Rich Document Editing

The editor is powered by Tiptap and supports:

- Headings
- Bold, italic, and underline formatting
- Bullet lists
- Numbered lists
- Undo and redo
- Custom text-size selection
- Editable document titles
- Viewer read-only mode

Content is stored as structured editor JSON, allowing formatting to survive refreshes and future edits.

### Reliable Persistence

DocFlow combines two save mechanisms:

- **Debounced autosave:** Changes are written approximately 800 milliseconds after editing settles.
- **Manual Save:** Users can explicitly save the current title and content from the editor header.

The interface exposes save feedback through `Saving`, `Saved`, and `Save failed` states. When a save fails, the current draft remains in local editor state and the user receives an error message.

### Sharing and Permissions

Documents support three access levels:

| Role | Read | Edit | Share | Revoke access | Delete |
|---|---:|---:|---:|---:|---:|
| Owner | Yes | Yes | Yes | Yes | Yes |
| Editor | Yes | Yes | No | No | No |
| Viewer | Yes | No | No | No | No |

These permissions are checked on the server for every sensitive operation. The frontend only reflects the permission state; it is not trusted as the security boundary.

### File Import

Users can import:

- `.txt`
- `.md`
- `.docx`

Imported content can either create a new document or replace the content of the currently open draft through **Import into draft**. Uploads are held in memory, limited to 5 MB, validated by extension and MIME type, and converted into editor-compatible content.

---

## 3. AI Summarization: The Product Differentiator

### Turn Long Documents Into Clear Takeaways

DocFlow includes an intelligent reading assistant directly inside the document editor. When a document is open, the user can click **Summarize with AI** and receive a concise set of bullet-point takeaways in a clean popup.

This is more than a decorative AI button. It is a focused workflow that helps users:

- Understand a document before reviewing every paragraph
- Identify the main purpose and important decisions
- Scan imported or shared content quickly
- Prepare a document for discussion or handoff
- Reduce the time between reading and acting

The original document is never overwritten. The summary is an assistive view that complements the source content.

### AI Workflow

1. The user opens a document they are authorized to access.
2. The user clicks **Summarize with AI**.
3. The browser sends an authenticated request to the backend.
4. The backend verifies document access using the same authorization model as document reads.
5. ProseMirror/Tiptap JSON is converted into readable plain text.
6. The backend sends the text to Gemini with an instruction to return concise bullet points.
7. The response is parsed and normalized on the server.
8. The frontend displays the bullets in a summary modal.
9. The original document remains unchanged.

### Why the AI Feature Is Strong

The implementation treats AI as a product capability rather than an isolated API call:

- **Context-aware:** Gemini receives the actual open document content.
- **Actionable output:** The response is constrained to concise bullet points.
- **Non-destructive:** The source document is not modified.
- **Permission-aware:** Unauthorized users cannot summarize private documents.
- **Secure by design:** The API key stays on the backend and never enters frontend code.
- **Failure-aware:** Missing configuration, empty documents, provider failures, and empty responses produce clear errors.
- **Provider-configurable:** The provider and model are controlled through environment variables.

### AI Configuration

Set these values in the server-side `.env` file:

```env
GEMINI_API_KEY="your-gemini-api-key"
AI_PROVIDER="gemini"
AI_MODEL="gemini-3.6-flash"
```

Never commit `.env` or expose the Gemini key through `VITE_` frontend variables.

---

## 4. User Experience Flow

### Login

The assessment build uses seeded demo accounts for a fast, predictable demonstration:

- `utkarsh@example.com`
- `reviewer@example.com`

The backend creates a session after validating the account. Email input is normalized before lookup.

### Dashboard

The dashboard provides:

- Owned document listing
- Shared document listing
- Search by title
- New document action
- File import action
- Rename action
- Open/edit action
- Empty states and error feedback

### Editor

The editor page includes:

- Back navigation
- Editable title
- Save state
- Manual Save button
- Import into draft
- Summarize with AI
- Share action for owners
- Permission banner
- Rich-text toolbar
- Read-only behavior for viewers

### Collaboration Demonstration

A reviewer can be given either viewer or editor access. The UI reflects the permission, but the backend independently enforces it. This makes the behavior verifiable through a second browser session or separate login.

---

## 5. Technical Architecture

```text
Browser
  |
  v
React + React Router + Tiptap
  |
  v
REST API through Express
  |
  +--> Session authentication
  +--> Zod validation
  +--> Authorization checks
  +--> Gemini summarization service
  +--> Multer import processing
  |
  v
Prisma ORM
  |
  v
SQLite database
```

### Frontend Responsibilities

- Render login, dashboard, editor, sharing, and summary modal experiences
- Maintain temporary editing state
- Send authenticated requests with session credentials
- Display loading, save, and error states
- Disable editing controls for viewers

### Backend Responsibilities

- Create and validate sessions
- Authenticate users
- Authorize every document operation
- Persist document content and metadata
- Manage sharing relationships
- Parse imported files
- Extract document text for AI summarization
- Keep AI credentials server-side
- Return structured error responses

### Database Models

#### User

- `id`
- `name`
- `email`
- `createdAt`

#### Document

- `id`
- `title`
- `content`
- `ownerId`
- `createdAt`
- `updatedAt`

#### DocumentShare

- `id`
- `documentId`
- `userId`
- `permission`
- `createdAt`

Document content is stored as serialized structured JSON because SQLite-compatible string storage keeps the editor model intact without requiring a database-specific JSON type.

---

## 6. API Surface

| Method | Endpoint | Purpose |
|---|---|---|
| `GET` | `/api/health` | Health check |
| `POST` | `/api/login` | Start a demo session |
| `POST` | `/api/logout` | End a session |
| `GET` | `/api/me` | Read the current user |
| `GET` | `/api/documents` | List owned and shared documents |
| `POST` | `/api/documents` | Create a document |
| `GET` | `/api/documents/:id` | Open an accessible document |
| `PATCH` | `/api/documents/:id` | Update title or content |
| `DELETE` | `/api/documents/:id` | Delete an owned document |
| `GET` | `/api/documents/:id/shares` | List document shares |
| `POST` | `/api/documents/:id/share` | Create or update a share |
| `DELETE` | `/api/documents/:id/share/:shareId` | Revoke access |
| `POST` | `/api/import` | Import `.txt`, `.md`, or `.docx` |
| `POST` | `/api/documents/:id/summarize` | Generate an AI summary |

---

## 7. Security and Reliability

### Server-Side Authorization

The backend resolves access from the current session and document relationships. It does not trust permission values sent by the browser.

Examples:

- A viewer attempting to update a document receives `403`.
- A user without access receives `404` to avoid exposing private document existence.
- Only owners can create or revoke shares.
- Only users who can view a document can request its AI summary.

### Input and Upload Validation

- Login payloads are validated with Zod.
- Document titles are limited to 120 characters.
- Uploads are limited to 5 MB.
- File extensions and MIME types are checked.
- Unsupported file types are rejected with readable errors.
- AI output is normalized into a bounded list of bullet points.

### Credential Handling

- Session cookies are HTTP-only.
- Gemini credentials are loaded from server environment variables.
- API keys are not bundled into the React application.
- `.env` should never be committed to source control.

### Known Production Considerations

This is an assessment-focused local build. A production deployment should additionally use:

- A hosted PostgreSQL database
- A persistent session store
- Secure cookies over HTTPS
- A production authentication provider
- Rate limiting for AI requests
- Request logging and monitoring
- Secret management through the hosting provider
- Per-user AI usage limits and cost controls

---

## 8. Automated Testing

Run the test suite with:

```powershell
npm test
```

The Vitest and Supertest suite verifies meaningful backend behavior:

- Unauthorized users cannot open inaccessible documents.
- Users without document access cannot request an AI summary.
- Viewer users cannot modify documents.
- Editor users can update shared documents.
- Duplicate shares are handled safely.
- Imported content updates the existing draft document.

These are API-level behavior tests using Express sessions and Prisma persistence. They verify business rules rather than only checking that components render.

Additional verification commands:

```powershell
npm run build
npm run db:push
npm run seed
```

For Windows PowerShell 5.1, run commands separately instead of chaining them with `&&`:

```powershell
npm install
npm run db:push
npm run seed
npm run dev
```

---

## 9. Local Setup

### Requirements

- Node.js 20 or newer
- npm
- A Gemini API key for AI summaries

### Installation

```powershell
npm install
npm run db:push
npm run seed
npm run dev
```

Open the frontend at:

```text
http://localhost:5173
```

The backend runs at:

```text
http://localhost:4000
```

If port `4000` is already in use, stop the previous backend process before starting another one. Running two backend instances produces an `EADDRINUSE` error.

---

## 10. Project Structure

```text
ajai/
├── backend/
│   ├── prisma/
│   │   └── schema.prisma
│   └── src/
│       ├── lib/
│       │   ├── auth.ts
│       │   └── prisma.ts
│       ├── seed.ts
│       ├── server.test.ts
│       └── server.ts
├── src/
│   ├── App.tsx
│   ├── index.css
│   └── main.tsx
├── .env.example
├── ARCHITECTURE.md
├── AI_WORKFLOW.md
├── DEMO.md
├── IMPLEMENTATION_PLAN.md
├── README.md
├── SUBMISSION.md
└── package.json
```

---

## 11. Assessment Alignment

### AI Leverage

The project uses AI deliberately across planning, implementation, debugging, testing, and documentation. The AI workflow is recorded in `AI_WORKFLOW.md`, including decisions that were accepted, revised, or rejected.

The product itself also uses AI meaningfully through Gemini summarization. This demonstrates both AI-assisted development and an AI-native product feature.

### Execution Quality

The implementation focuses on a complete usable slice rather than disconnected screens:

- Authentication works with seeded users.
- Documents persist.
- Permissions are enforced.
- Imports reach the editor.
- Save behavior is visible.
- AI output is displayed in context.
- Errors are communicated to users.

### Decision-Making

The project intentionally favors a small, understandable architecture:

- SQLite keeps local setup fast.
- Prisma keeps data access explicit.
- Tiptap avoids rebuilding a rich-text engine.
- Server-side checks protect the document model.
- Debounced autosave avoids excessive writes.
- AI summaries are non-destructive and permission-aware.

### Communication

The documentation set explains the product, architecture, AI workflow, demo steps, tradeoffs, testing strategy, and deployment considerations. The result is intended to be understandable to both a technical reviewer and a product-focused stakeholder.

---

## 12. Limitations and Next Steps

### Current Limitations

- Authentication is intentionally simplified for assessment use.
- Real-time collaborative editing is not implemented.
- There is no version history or audit log.
- SQLite is intended for local demonstration rather than multi-instance production deployment.
- AI summaries require a valid Gemini configuration and external provider availability.

### Recommended Next Iterations

1. Replace demo sessions with production authentication and account management.
2. Move persistence to hosted PostgreSQL.
3. Add a persistent session store and secure cookie configuration.
4. Add real-time collaboration through a synchronization layer.
5. Add document version history and audit events.
6. Add AI rate limits, usage tracking, and retry policies.
7. Add richer Markdown and DOCX conversion coverage.
8. Add end-to-end browser tests for the main user journeys.

---

## 13. Final Project Statement

DocFlow demonstrates a complete, intentionally scoped full-stack product slice. It combines a polished writing experience with server-enforced collaboration rules and a high-value AI workflow that helps users understand content faster.

The strongest product idea is the relationship between editing and comprehension: users can create a document, refine it, share it safely, import external content, save their work, and ask AI for a concise understanding of what matters. The AI feature adds genuine utility while preserving user control, document integrity, and permission boundaries.
