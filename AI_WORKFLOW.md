# AI Workflow

## Tools Used
- GitHub Copilot
- VS Code workspace tooling

## Where AI Helped
- Initial project scaffold and repository setup
- API and auth flow design
- Prisma schema drafting for documents and shares
- Tiptap editor wiring and autosave behavior
- Test generation for document authorization and duplicate share rules
- Debugging build and environment issues
- Documentation drafting and polishing

## Human Decisions
- Tiptap was selected because it gives a compact, reliable rich-text editing experience without recreating Google Docs.
- SQLite was selected because it is lightweight, local, and easy to review in an assessment environment.
- Authentication was intentionally simplified to seeded demo users to prioritize the core assessment requirements.
- DOCX support was not prioritized because the assessment focuses on reliable .txt/.md import and correct core flows.
- Real-time collaboration was deferred to maintain a reliable, deployable product slice.

## AI Output Changed or Rejected
- The initial Prisma model used Json and enums, which were rejected because SQLite does not support those types directly. The final schema was adjusted to compatible string-based storage and explicit permission values.
- The generated code initially trusted frontend permission state. This was corrected by enforcing authorization inside the backend document routes.
- The autosave flow was revised to debounce writes instead of firing immediately on every keystroke.
- Upload validation was strengthened to reject unsupported file types and enforce size limits.

## Verification
Correctness was validated through:
- automated authorization tests
- local build verification
- API-level behavior checks
- session-based auth flow checks
- database schema and migration verification
