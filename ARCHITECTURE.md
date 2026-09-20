# DocFlow Architecture

## Product Goal
DocFlow is a lightweight internal document system that allows users to create, edit, persist, share, and import documents with clear permissions and a reliable user experience.

## Architecture
Browser
→ React UI
→ REST API
→ Services
→ Prisma
→ SQLite database

## Core Data Model
User
- id
- name
- email

Document
- id
- title
- content
- ownerId
- createdAt
- updatedAt

DocumentShare
- id
- documentId
- userId
- permission
- createdAt

## Authorization Model
Owner
- read, update, delete, share, revoke share

Editor
- read, update

Viewer
- read only

The authorization rules are enforced server-side, not only in the client UI.

## Persistence Strategy
Document content is stored in a structured JSON document format and serialized into a SQLite string field. This keeps the rich-text structure intact and avoids losing formatting between editing and reload.

## File Import
Supported imports are .txt and .md. Uploaded files are validated for extension and file size and then parsed into Tiptap-compatible JSON. Files are sanitized before rendering and unsupported formats are rejected with user-friendly errors.

## Autosave
Autosave is debounced at approximately 800 ms. The editor updates local state immediately and then writes the document title and content to the backend after the debounce. If the save fails, the UI preserves the draft and shows a failed save state.

## Key Tradeoffs
- SQLite is chosen for local demo simplicity.
- Demo sessions are intentionally simplified.
- Real-time collaboration and advanced document features were intentionally left out to preserve reliability and correctness.

## Reliability
- backend authorization checks for each sensitive operation
- request validation with Zod
- file type and size validation
- tests for access control and duplicate shares
- user-facing error states for failed operations
