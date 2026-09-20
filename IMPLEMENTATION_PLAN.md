# DocFlow Implementation Plan

## Phase 1: Foundation
- Initialize Vite React + TypeScript frontend and Express + TypeScript backend.
- Configure Prisma with SQLite and seed the demo users.
- Add environment configuration and package scripts.

## Phase 2: Authentication and authorization
- Implement demo login/session flow.
- Protect document APIs with backend authorization checks for owner/editor/viewer.
- Add structured error responses and validation.

## Phase 3: Document CRUD and persistence
- Create document model and Prisma schema.
- Implement create/list/open/update/delete routes.
- Ensure content persists as structured rich-text JSON.

## Phase 4: Editor and autosave
- Integrate Tiptap editor with formatting toolbar.
- Add editable document title and debounced autosave.
- Handle save/loading/error UI states.

## Phase 5: Dashboard and sharing
- Build dashboard with owned/shared sections and empty states.
- Add sharing UI and backend permissions enforcement.
- Support revoke access and viewer/editor distinction.

## Phase 6: File import and validation
- Add `.txt` and `.md` upload flow with validation and size limits.
- Convert imported content into editor-compatible rich-text content.
- Reject unsupported formats with clear UI feedback.

## Phase 7: Tests, QA, and docs
- Add business-logic tests for authorization, viewer restrictions, and persistence.
- Build production bundle and confirm the app works end-to-end.
- Write README, architecture, workflow, and submission documentation.
