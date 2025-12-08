# Quick Testing Checklist

Use this checklist for rapid validation of the Todo App with Google OAuth.

## Setup
- [ ] Backend server running on port 3000
- [ ] Frontend server running on port 8000
- [ ] GOOGLE_CLIENT_ID environment variable set
- [ ] Two Google accounts available for testing

## 16.1: OAuth Flow (5 min)
- [ ] Sign-in button appears
- [ ] Google OAuth flow completes
- [ ] Profile appears in header
- [ ] Token stored in sessionStorage
- [ ] Sign-out clears session
- [ ] Session persists after refresh

## 16.2: Task CRUD (5 min)
- [ ] Create 3 tasks → all appear
- [ ] Refresh page → tasks persist
- [ ] Toggle task completion → updates
- [ ] Delete task → removes
- [ ] Add subtask → appears
- [ ] Complete subtask → progress updates

## 16.3: User Isolation (10 min)
- [ ] User 1: Create 3 tasks
- [ ] Sign out
- [ ] User 2: Sign in → sees 0 tasks
- [ ] User 2: Create 2 tasks
- [ ] Sign out
- [ ] User 1: Sign in → sees only their 3 tasks

## 16.4: Offline/Online (10 min)
- [ ] Create 2 tasks online → sync success
- [ ] Stop backend server
- [ ] Offline indicator appears
- [ ] Create 3 tasks offline → queued
- [ ] Restart backend
- [ ] Auto-sync completes
- [ ] Refresh → all 5 tasks present

## 16.5: Migration (5 min)
- [ ] Sign out, clear storage
- [ ] Create 4 local tasks (no auth)
- [ ] Sign in → migration prompt appears
- [ ] Confirm migration → tasks uploaded
- [ ] localStorage cleared
- [ ] Refresh → tasks load from cloud

## 16.6: Sync Indicators (5 min)
- [ ] Create task → "Syncing..." appears
- [ ] Success indicator shows briefly
- [ ] Stop backend → error/offline indicator
- [ ] Queue count increases with operations
- [ ] Restart backend → auto-retry works

## Critical Security Check
- [ ] ⚠️ User A cannot see User B's tasks
- [ ] ⚠️ Tokens are in sessionStorage (not localStorage)
- [ ] ⚠️ Invalid tokens are rejected by backend

## Total Time: ~40 minutes

**Pass Criteria:** All checkboxes checked with no errors.
