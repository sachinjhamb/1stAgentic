# Local Testing and Validation Guide

This guide provides step-by-step instructions for manually testing all features of the Todo App with Google OAuth authentication and cloud sync.

## Prerequisites

Before starting the tests, ensure you have:

1. ✅ Google OAuth Client ID configured in Google Cloud Console
2. ✅ Backend server dependencies installed (`cd backend && npm install`)
3. ✅ Environment variable set: `GOOGLE_CLIENT_ID="your-client-id"`
4. ✅ Two different Google accounts for testing user isolation
5. ✅ Modern web browser (Chrome, Firefox, Safari, or Edge)

## Setup Instructions

### 1. Start the Backend Server

```bash
cd backend
# Set environment variable (Windows CMD)
set GOOGLE_CLIENT_ID=your-google-client-id-here

# Or use .env file
# Create backend/.env with:
# GOOGLE_CLIENT_ID=your-google-client-id-here
# PORT=3000

npm start
```

Expected output:
```
Local backend server running on http://localhost:3000
Health check: http://localhost:3000/health
Google OAuth client configured
```

### 2. Start the Frontend Server

Open a new terminal:

```bash
cd frontend
python -m http.server 8000
# or
npx http-server -p 8000
```

### 3. Open the Application

Navigate to `http://localhost:8000` in your browser.

---

## Test Suite


### Task 16.1: Test Google OAuth Flow Locally

**Requirements Validated:** 1.2, 1.3, 1.5

#### Test 16.1.1: Sign-In Flow

**Steps:**
1. Open `http://localhost:8000` in your browser
2. Verify you see a "Sign in with Google" button
3. Click the "Sign in with Google" button
4. Complete the Google OAuth consent flow
5. Grant permissions when prompted

**Expected Results:**
- ✅ Google OAuth popup/redirect appears
- ✅ After authentication, you're redirected back to the app
- ✅ Your profile picture and name appear in the header
- ✅ The sign-in button is replaced with user profile
- ✅ No errors in browser console

**Validation:**
- Open browser DevTools (F12) → Application → Session Storage
- Verify `google_id_token` is stored
- Verify `google_user` contains your user info (id, email, name, picture)

#### Test 16.1.2: Token Storage

**Steps:**
1. After signing in, open browser DevTools (F12)
2. Go to Application → Session Storage → `http://localhost:8000`
3. Check for stored items

**Expected Results:**
- ✅ `google_id_token` key exists with a JWT token value
- ✅ `google_user` key exists with JSON user data
- ✅ Token is NOT stored in localStorage (security best practice)

#### Test 16.1.3: Sign-Out Flow

**Steps:**
1. While signed in, locate the sign-out button (usually in user profile area)
2. Click "Sign Out"
3. Observe the UI changes

**Expected Results:**
- ✅ User profile disappears from header
- ✅ Sign-in button reappears
- ✅ Task list is cleared from view
- ✅ Session storage is cleared (check DevTools)
- ✅ No errors in console

**Validation:**
- Open DevTools → Application → Session Storage
- Verify `google_id_token` and `google_user` are removed

#### Test 16.1.4: Session Persistence

**Steps:**
1. Sign in with Google
2. Refresh the page (F5)
3. Observe the behavior

**Expected Results:**
- ✅ You remain signed in after refresh
- ✅ Your profile still appears in header
- ✅ Your tasks are still visible
- ✅ No need to sign in again

---


### Task 16.2: Test Task CRUD Operations Locally

**Requirements Validated:** 2.1, 2.2, 2.3

#### Test 16.2.1: Create Tasks

**Steps:**
1. Sign in with your Google account
2. In the task input field, type "Buy groceries"
3. Set a due date (tomorrow) and time (2:00 PM)
4. Click "Add Task" or press Enter
5. Repeat to create 3-5 more tasks with different names

**Expected Results:**
- ✅ Task appears immediately in the task list
- ✅ Task shows the correct text, date, and time
- ✅ Task is marked as incomplete (unchecked)
- ✅ Sync status indicator shows "Syncing..." briefly
- ✅ Sync status shows "Success" or disappears
- ✅ No errors in console

**Validation:**
- Open browser DevTools → Network tab
- Look for POST request to `http://localhost:3000/tasks`
- Verify request includes `Authorization: Bearer <token>` header
- Verify response status is 201 Created

#### Test 16.2.2: Read/Display Tasks

**Steps:**
1. After creating tasks, refresh the page (F5)
2. Observe the task list

**Expected Results:**
- ✅ All previously created tasks are displayed
- ✅ Tasks are sorted by due date/time
- ✅ Each task shows correct text, date, time
- ✅ Task completion status is preserved

**Validation:**
- Open DevTools → Network tab
- Look for GET request to `http://localhost:3000/tasks`
- Verify response contains all your tasks

#### Test 16.2.3: Update Tasks (Toggle Completion)

**Steps:**
1. Click the checkbox next to a task to mark it complete
2. Observe the UI changes
3. Click the checkbox again to mark it incomplete

**Expected Results:**
- ✅ Task text gets strikethrough when completed
- ✅ Task moves to completed section or changes appearance
- ✅ Sync indicator shows briefly
- ✅ Checkbox state persists after page refresh

**Validation:**
- Open DevTools → Network tab
- Look for PUT request to `http://localhost:3000/tasks/{taskId}`
- Verify request includes updated task data

#### Test 16.2.4: Delete Tasks

**Steps:**
1. Click the "Delete" button next to a task
2. Observe the behavior

**Expected Results:**
- ✅ Task is immediately removed from the list
- ✅ Task count updates correctly
- ✅ Sync indicator shows briefly
- ✅ Task does not reappear after page refresh

**Validation:**
- Open DevTools → Network tab
- Look for DELETE request to `http://localhost:3000/tasks/{taskId}`
- Verify response indicates success

#### Test 16.2.5: Subtask Operations

**Steps:**
1. Create a new task "Complete project"
2. Click "Add Subtask" button (+ icon)
3. Add subtask "Write documentation" with priority "Important"
4. Add another subtask "Review code" with priority "Urgent"
5. Click checkbox next to first subtask to complete it
6. Delete the second subtask

**Expected Results:**
- ✅ Subtasks appear under the main task
- ✅ Priority badges show correctly (Important, Urgent)
- ✅ Progress bar updates when subtasks are completed
- ✅ Main task auto-completes when all subtasks are done
- ✅ Subtask deletion works correctly
- ✅ All changes sync to cloud

---


### Task 16.3: Test User Data Isolation Locally

**Requirements Validated:** 3.2, 3.3

This is a critical security test to ensure users can only see their own tasks.

#### Test 16.3.1: First User Session

**Steps:**
1. Sign in with your first Google account (e.g., user1@gmail.com)
2. Create 3 tasks:
   - "User 1 - Task A"
   - "User 1 - Task B"
   - "User 1 - Task C"
3. Note the task count (should show 3 tasks)
4. Take a screenshot or note the tasks

**Expected Results:**
- ✅ All 3 tasks are visible
- ✅ Task count shows "3 tasks remaining"

#### Test 16.3.2: Sign Out and Switch Users

**Steps:**
1. Click "Sign Out" button
2. Verify you're signed out (sign-in button appears)
3. Click "Sign in with Google"
4. Sign in with a DIFFERENT Google account (e.g., user2@gmail.com)

**Expected Results:**
- ✅ Sign-out is successful
- ✅ Sign-in with second account is successful
- ✅ Second user's profile appears in header

#### Test 16.3.3: Verify Data Isolation

**Steps:**
1. After signing in as second user, check the task list
2. Verify it's empty (no tasks from first user)

**Expected Results:**
- ✅ Task list is EMPTY (shows "No tasks yet")
- ✅ Task count shows "0 tasks"
- ✅ NONE of the first user's tasks are visible
- ✅ No errors in console

**Critical:** If you see the first user's tasks, this is a SECURITY BUG!

#### Test 16.3.4: Second User Creates Tasks

**Steps:**
1. Still signed in as second user, create 2 tasks:
   - "User 2 - Task X"
   - "User 2 - Task Y"
2. Verify these tasks appear

**Expected Results:**
- ✅ Both tasks are visible
- ✅ Task count shows "2 tasks remaining"

#### Test 16.3.5: Switch Back to First User

**Steps:**
1. Sign out from second user account
2. Sign in again with first user account (user1@gmail.com)
3. Check the task list

**Expected Results:**
- ✅ First user sees ONLY their 3 original tasks:
  - "User 1 - Task A"
  - "User 1 - Task B"
  - "User 1 - Task C"
- ✅ Task count shows "3 tasks remaining"
- ✅ NONE of the second user's tasks are visible
- ✅ All original tasks are intact (not deleted or modified)

**Validation:**
- Open DevTools → Network tab
- Look at GET `/tasks` request
- Verify the `Authorization` header contains the correct token
- Verify response only contains tasks for the current user

---


### Task 16.4: Test Offline/Online Scenarios

**Requirements Validated:** 2.5, 6.5

This tests the offline queue and automatic sync on reconnection.

#### Test 16.4.1: Create Tasks While Online

**Steps:**
1. Sign in with your Google account
2. Ensure backend server is running
3. Create 2 tasks:
   - "Online Task 1"
   - "Online Task 2"
4. Verify they sync successfully

**Expected Results:**
- ✅ Tasks appear immediately
- ✅ Sync status shows success
- ✅ Tasks persist after refresh

#### Test 16.4.2: Simulate Offline Mode

**Steps:**
1. Stop the backend server:
   - Go to the terminal running the backend
   - Press Ctrl+C to stop the server
2. Wait a few seconds for the connection to drop

**Expected Results:**
- ✅ Sync status indicator shows "Offline" or similar message
- ✅ App remains functional (doesn't crash)

#### Test 16.4.3: Create Tasks While Offline

**Steps:**
1. With backend still stopped, create 3 new tasks:
   - "Offline Task 1"
   - "Offline Task 2"
   - "Offline Task 3"
2. Try to toggle completion on one of the online tasks
3. Try to delete one of the online tasks

**Expected Results:**
- ✅ Tasks appear in the UI immediately
- ✅ Sync status shows "Offline (X queued)" where X is the number of operations
- ✅ No error messages about failed requests
- ✅ App remains responsive

**Validation:**
- Open DevTools → Application → Local Storage
- Look for a queue key (e.g., `todoApp_tasks_queue`)
- Verify it contains the queued operations

#### Test 16.4.4: Restart Backend and Test Auto-Sync

**Steps:**
1. Restart the backend server:
   ```bash
   cd backend
   npm start
   ```
2. Wait for server to start (should see "Local backend server running...")
3. Return to the browser (keep it open, don't refresh)
4. Wait 5-10 seconds

**Expected Results:**
- ✅ Sync status changes from "Offline" to "Syncing..."
- ✅ Sync status shows "Success" or disappears
- ✅ Queue count goes to 0
- ✅ All offline tasks are now synced

**Validation:**
- Open DevTools → Network tab
- Look for POST request to `/tasks/sync` with batch operations
- Verify all queued operations are sent
- Refresh the page (F5)
- Verify all tasks (online and offline) are still there

#### Test 16.4.5: Verify Data Persistence After Reconnection

**Steps:**
1. After auto-sync completes, refresh the page (F5)
2. Check the task list

**Expected Results:**
- ✅ All 5 tasks are visible (2 online + 3 offline)
- ✅ Task modifications (completions, deletions) are persisted
- ✅ No duplicate tasks
- ✅ Task count is correct

---


### Task 16.5: Test Migration Flow

**Requirements Validated:** 5.1, 5.2, 5.3, 5.4

This tests the migration of existing localStorage tasks to cloud storage.

#### Test 16.5.1: Setup - Create Local Tasks Without Auth

**Steps:**
1. Sign out if currently signed in
2. Open browser DevTools → Application → Local Storage
3. Clear all storage: Right-click → Clear
4. Close DevTools
5. Refresh the page
6. Create 4 tasks WITHOUT signing in:
   - "Local Task 1"
   - "Local Task 2"
   - "Local Task 3"
   - "Local Task 4"

**Expected Results:**
- ✅ Tasks are created and visible
- ✅ Tasks are stored in localStorage only
- ✅ No sync indicators appear (no cloud sync)

**Validation:**
- Open DevTools → Application → Local Storage
- Verify `todoApp_tasks` key exists with 4 tasks
- Verify NO session storage items (no auth tokens)

#### Test 16.5.2: Sign In and Trigger Migration Prompt

**Steps:**
1. With the 4 local tasks still visible, click "Sign in with Google"
2. Complete the Google OAuth flow
3. After successful sign-in, observe the UI

**Expected Results:**
- ✅ A migration prompt dialog appears
- ✅ Dialog shows the number of local tasks (4 tasks)
- ✅ Dialog offers two options:
  - "Migrate tasks to cloud" (or similar)
  - "Start fresh" or "Decline" (or similar)
- ✅ Tasks are still visible in the background

#### Test 16.5.3: Confirm Migration

**Steps:**
1. In the migration prompt, click "Migrate" or "Yes" button
2. Wait for the migration process to complete
3. Observe the sync status indicator

**Expected Results:**
- ✅ Sync status shows "Migrating tasks..." or similar
- ✅ Progress indicator appears (if implemented)
- ✅ After completion, sync status shows "4 tasks migrated successfully"
- ✅ All 4 tasks remain visible in the UI
- ✅ No errors in console

**Validation:**
- Open DevTools → Network tab
- Look for POST request to `/tasks/sync` or multiple POST `/tasks` requests
- Verify all 4 tasks are uploaded with correct data
- Verify responses are successful (200/201 status)

#### Test 16.5.4: Verify localStorage Cleanup

**Steps:**
1. After migration completes, open DevTools → Application → Local Storage
2. Check for the `todoApp_tasks` key

**Expected Results:**
- ✅ `todoApp_tasks` key is REMOVED from localStorage
- ✅ Only session storage items remain (auth tokens)
- ✅ Tasks are now stored in cloud only

#### Test 16.5.5: Verify Cloud Storage

**Steps:**
1. Refresh the page (F5)
2. Verify you're still signed in
3. Check the task list

**Expected Results:**
- ✅ All 4 migrated tasks are still visible
- ✅ Tasks are loaded from cloud (not localStorage)
- ✅ Task data is intact (text, dates, completion status)

**Validation:**
- Open DevTools → Network tab
- Look for GET request to `/tasks`
- Verify response contains all 4 migrated tasks

#### Test 16.5.6: Test Migration Decline Flow

**Steps:**
1. Sign out
2. Clear all storage (DevTools → Application → Clear storage)
3. Create 2 new local tasks without signing in
4. Sign in with Google
5. When migration prompt appears, click "Decline" or "Start fresh"

**Expected Results:**
- ✅ Migration prompt closes
- ✅ Local tasks are cleared from view
- ✅ Task list shows "No tasks yet"
- ✅ localStorage is cleared
- ✅ User starts with empty task list in cloud

---


### Task 16.6: Test Sync Status Indicators

**Requirements Validated:** 6.1, 6.2, 6.3, 6.4

This tests the visual feedback for sync operations.

#### Test 16.6.1: Syncing Indicator During Operations

**Steps:**
1. Sign in with your Google account
2. Ensure backend is running
3. Create a new task
4. Watch the sync status indicator closely

**Expected Results:**
- ✅ Sync status appears immediately when task is created
- ✅ Shows "Syncing..." or similar message
- ✅ May show a spinner or loading animation
- ✅ Indicator is visible for at least a brief moment

#### Test 16.6.2: Success Indicator on Completion

**Steps:**
1. After creating a task, wait for sync to complete
2. Observe the sync status indicator

**Expected Results:**
- ✅ Sync status changes to "Success" or shows a checkmark
- ✅ Success message appears briefly (2-5 seconds)
- ✅ Indicator then disappears or returns to idle state
- ✅ No error messages appear

#### Test 16.6.3: Error Indicator on Failure

**Steps:**
1. Stop the backend server (Ctrl+C in backend terminal)
2. Wait a few seconds
3. Try to create a new task
4. Observe the sync status indicator

**Expected Results:**
- ✅ Sync status shows "Error" or "Failed to sync"
- ✅ Error message is displayed
- ✅ May show a retry button or option
- ✅ Task is still visible in UI (queued locally)

#### Test 16.6.4: Offline Indicator When Backend is Down

**Steps:**
1. With backend still stopped, observe the sync status
2. Try to perform multiple operations (create, update, delete tasks)
3. Watch the queue count

**Expected Results:**
- ✅ Sync status shows "Offline" indicator
- ✅ Shows queue count: "Offline (X queued)" where X increases
- ✅ Indicator persists while offline
- ✅ Different visual style from error (e.g., different color)

#### Test 16.6.5: Retry Functionality

**Steps:**
1. With backend stopped and error/offline indicator showing
2. Restart the backend server
3. If there's a "Retry" button, click it
4. Otherwise, wait for automatic retry

**Expected Results:**
- ✅ Clicking retry triggers sync attempt
- ✅ Or automatic retry happens within 5-10 seconds
- ✅ Sync status changes to "Syncing..."
- ✅ Then changes to "Success" when complete
- ✅ Queue is cleared

#### Test 16.6.6: Multiple Rapid Operations

**Steps:**
1. Ensure backend is running
2. Rapidly create 5 tasks in quick succession
3. Watch the sync status indicator

**Expected Results:**
- ✅ Sync indicator handles rapid operations gracefully
- ✅ May show "Syncing..." continuously or batch operations
- ✅ Eventually shows success for all operations
- ✅ No UI freezing or errors
- ✅ All tasks are synced successfully

---


## Additional Integration Tests

### Test: Complete End-to-End Flow

**Steps:**
1. Start with clean state (clear all storage)
2. Create 2 local tasks without auth
3. Sign in with Google
4. Migrate tasks to cloud
5. Create 3 more tasks while online
6. Stop backend server
7. Create 2 tasks while offline
8. Restart backend server
9. Wait for auto-sync
10. Sign out
11. Sign in again
12. Verify all 7 tasks are present

**Expected Results:**
- ✅ All operations complete successfully
- ✅ All 7 tasks are present and correct
- ✅ No data loss at any step
- ✅ No errors in console

### Test: Browser Compatibility

Test the application in multiple browsers:

**Browsers to Test:**
- ✅ Chrome (latest)
- ✅ Firefox (latest)
- ✅ Safari (latest, if on Mac)
- ✅ Edge (latest)

**What to Verify:**
- ✅ Google OAuth works in all browsers
- ✅ UI renders correctly
- ✅ All features function properly
- ✅ No console errors

### Test: Mobile Responsiveness

**Steps:**
1. Open DevTools (F12)
2. Toggle device toolbar (Ctrl+Shift+M)
3. Test various screen sizes:
   - iPhone SE (375x667)
   - iPhone 12 Pro (390x844)
   - iPad (768x1024)
   - Desktop (1920x1080)

**Expected Results:**
- ✅ UI adapts to different screen sizes
- ✅ All buttons are clickable
- ✅ Text is readable
- ✅ No horizontal scrolling
- ✅ Touch interactions work (if testing on actual device)

---

## Troubleshooting Common Issues

### Issue: "Invalid token" errors

**Possible Causes:**
- Backend `GOOGLE_CLIENT_ID` doesn't match frontend config
- Token expired (sign out and sign in again)
- Clock skew between client and server

**Solutions:**
1. Verify `GOOGLE_CLIENT_ID` matches in both places
2. Sign out and sign in again
3. Check system clock is correct

### Issue: CORS errors

**Symptoms:**
- "Access to fetch blocked by CORS policy" in console
- Network requests fail with CORS error

**Solutions:**
1. Verify backend server is running on port 3000
2. Check CORS is enabled in backend (`app.use(cors())`)
3. Verify frontend is accessing correct API URL

### Issue: Tasks not syncing

**Symptoms:**
- Tasks created but don't persist after refresh
- Sync status shows errors

**Solutions:**
1. Check backend server is running
2. Verify network requests in DevTools
3. Check console for errors
4. Verify authentication token is present

### Issue: Migration prompt doesn't appear

**Possible Causes:**
- No local tasks in localStorage
- Already migrated previously
- Auth not properly initialized

**Solutions:**
1. Verify local tasks exist before signing in
2. Clear all storage and try again
3. Check console for errors

---

## Test Results Checklist

Use this checklist to track your testing progress:

### Task 16.1: Google OAuth Flow
- [ ] 16.1.1: Sign-in flow works
- [ ] 16.1.2: Token stored correctly
- [ ] 16.1.3: Sign-out clears session
- [ ] 16.1.4: Session persists across refresh

### Task 16.2: Task CRUD Operations
- [ ] 16.2.1: Create tasks
- [ ] 16.2.2: Read/display tasks
- [ ] 16.2.3: Update tasks (toggle completion)
- [ ] 16.2.4: Delete tasks
- [ ] 16.2.5: Subtask operations

### Task 16.3: User Data Isolation
- [ ] 16.3.1: First user creates tasks
- [ ] 16.3.2: Sign out and switch users
- [ ] 16.3.3: Second user sees no first user's tasks
- [ ] 16.3.4: Second user creates own tasks
- [ ] 16.3.5: First user's tasks intact when signing back in

### Task 16.4: Offline/Online Scenarios
- [ ] 16.4.1: Create tasks while online
- [ ] 16.4.2: Offline mode detected
- [ ] 16.4.3: Create tasks while offline (queued)
- [ ] 16.4.4: Auto-sync on reconnection
- [ ] 16.4.5: Data persists after reconnection

### Task 16.5: Migration Flow
- [ ] 16.5.1: Create local tasks without auth
- [ ] 16.5.2: Migration prompt appears on sign-in
- [ ] 16.5.3: Migration uploads all tasks
- [ ] 16.5.4: localStorage cleared after migration
- [ ] 16.5.5: Tasks load from cloud after migration
- [ ] 16.5.6: Decline migration clears local tasks

### Task 16.6: Sync Status Indicators
- [ ] 16.6.1: Syncing indicator during operations
- [ ] 16.6.2: Success indicator on completion
- [ ] 16.6.3: Error indicator on failure
- [ ] 16.6.4: Offline indicator when backend down
- [ ] 16.6.5: Retry functionality works
- [ ] 16.6.6: Handles multiple rapid operations

### Additional Tests
- [ ] Complete end-to-end flow
- [ ] Browser compatibility (Chrome, Firefox, Safari, Edge)
- [ ] Mobile responsiveness

---

## Reporting Issues

If you encounter any issues during testing:

1. **Document the issue:**
   - What were you doing?
   - What did you expect to happen?
   - What actually happened?

2. **Collect evidence:**
   - Screenshot of the issue
   - Browser console errors (F12 → Console)
   - Network requests (F12 → Network)
   - Browser and OS version

3. **Check if reproducible:**
   - Can you reproduce the issue consistently?
   - Does it happen in other browsers?
   - Does it happen for other users?

4. **Report:**
   - Create a detailed bug report
   - Include all evidence collected
   - Specify which test case failed

---

## Success Criteria

All tests pass when:

✅ **Authentication:**
- Sign-in and sign-out work correctly
- Tokens are stored securely
- Session persists across page refreshes

✅ **Task Operations:**
- All CRUD operations work (create, read, update, delete)
- Subtasks function properly
- Changes sync to cloud immediately

✅ **Security:**
- User data is completely isolated
- Users cannot see other users' tasks
- Invalid tokens are rejected

✅ **Offline Support:**
- App works offline
- Operations are queued
- Auto-sync works on reconnection

✅ **Migration:**
- Local tasks migrate to cloud
- localStorage is cleaned up
- No data loss during migration

✅ **User Experience:**
- Sync status indicators work correctly
- No errors in console
- UI is responsive and functional

---

## Next Steps

After completing all tests successfully:

1. ✅ Mark task 16 as complete in tasks.md
2. ✅ Document any issues found
3. ✅ Proceed to task 17: Checkpoint
4. ✅ Prepare for AWS deployment (tasks 18-20)

**Note:** This local testing validates the core functionality. AWS deployment will require additional testing in the cloud environment.
