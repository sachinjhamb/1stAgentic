# Simple To-Do App

A clean, responsive To-Do application built with vanilla HTML, CSS, and JavaScript. Now with Google OAuth authentication and cloud sync capabilities!

## Features

- Add new tasks with subtasks, priorities, and notes
- Mark tasks as complete/incomplete  
- Delete individual tasks
- Due date/time scheduling with smart defaults
- Browser notifications (5 minutes before due time)
- Progress tracking with weighted subtasks
- **Google OAuth authentication** (sign in with your Google account)
- **Cloud sync** (access your tasks from any device)
- **User data isolation** (your tasks are private and secure)
- **Offline support** (changes sync when you reconnect)
- Persistent storage using localStorage (legacy) or cloud backend
- Responsive design for mobile and desktop
- Task counter with completion status
- Keyboard shortcuts
- Clean, minimal UI

## Quick Start (Local Mode - No Authentication)

1. **Simple Method**: Just open `frontend/index.html` in any modern web browser
   - Double-click the index.html file
   - Or right-click and select Open with your preferred browser
   - Tasks will be saved to localStorage only

2. **Local Server Method** (optional):
   ```bash
   # Using Python (if installed)
   cd frontend
   python -m http.server 8000
   
   # Using Node.js (if installed)
   npx http-server frontend -p 8000
   
   # Then open http://localhost:8000 in your browser
   ```

## Google OAuth Setup (Required for Cloud Sync)

To enable Google authentication and cloud sync, you need to set up Google OAuth credentials:

### Step 1: Create a Google Cloud Project

1. Go to the [Google Cloud Console](https://console.cloud.google.com/)
2. Click on the project dropdown at the top of the page
3. Click **"New Project"**
4. Enter a project name (e.g., "Todo App")
5. Click **"Create"**
6. Wait for the project to be created, then select it from the project dropdown

### Step 2: Enable Google+ API (if required)

1. In the Google Cloud Console, navigate to **"APIs & Services" > "Library"**
2. Search for "Google+ API" or "Google Identity"
3. Click on it and click **"Enable"** (if not already enabled)

### Step 3: Configure OAuth Consent Screen

1. In the Google Cloud Console, go to **"APIs & Services" > "OAuth consent screen"**
2. Select **"External"** user type (unless you have a Google Workspace account)
3. Click **"Create"**
4. Fill in the required fields:
   - **App name**: "Todo App" (or your preferred name)
   - **User support email**: Your email address
   - **Developer contact information**: Your email address
5. Click **"Save and Continue"**
6. On the **Scopes** page, click **"Add or Remove Scopes"**
7. Add the following scopes:
   - `openid`
   - `email`
   - `profile`
8. Click **"Update"** and then **"Save and Continue"**
9. On the **Test users** page (for External apps), add your Google account email as a test user
10. Click **"Save and Continue"**
11. Review the summary and click **"Back to Dashboard"**

### Step 4: Create OAuth 2.0 Client ID

1. In the Google Cloud Console, go to **"APIs & Services" > "Credentials"**
2. Click **"Create Credentials"** at the top
3. Select **"OAuth 2.0 Client ID"**
4. Choose **"Web application"** as the application type
5. Enter a name (e.g., "Todo App Web Client")
6. Under **"Authorized JavaScript origins"**, add:
   - `http://localhost:8000` (for local development)
   - `http://localhost:3000` (alternative local port)
   - Your production domain (e.g., `https://yourdomain.com`) when deploying to AWS
7. Under **"Authorized redirect URIs"**, add:
   - `http://localhost:8000` (for local development)
   - `http://localhost:3000` (alternative local port)
   - Your production domain (e.g., `https://yourdomain.com`) when deploying to AWS
8. Click **"Create"**
9. A dialog will appear with your **Client ID** and **Client Secret**
10. **Copy the Client ID** - you'll need this for configuration
11. Click **"OK"**

### Step 5: Configure the Application

1. Create a `frontend/config.js` file (if it doesn't exist):
   ```javascript
   const config = {
     local: {
       apiBaseUrl: 'http://localhost:3000',
       googleClientId: 'YOUR_GOOGLE_CLIENT_ID_HERE'
     },
     production: {
       apiBaseUrl: 'https://your-api-gateway-url.amazonaws.com/prod',
       googleClientId: 'YOUR_GOOGLE_CLIENT_ID_HERE'
     }
   }
   
   // Auto-detect environment
   const environment = window.location.hostname === 'localhost' ? 'local' : 'production'
   export default config[environment]
   ```

2. Replace `YOUR_GOOGLE_CLIENT_ID_HERE` with the Client ID you copied from Google Cloud Console

3. Set the environment variable for the backend server:
   ```bash
   export GOOGLE_CLIENT_ID="YOUR_GOOGLE_CLIENT_ID_HERE"
   ```
   
   Or create a `backend/.env` file:
   ```
   GOOGLE_CLIENT_ID=YOUR_GOOGLE_CLIENT_ID_HERE
   PORT=3000
   ```

### Step 6: Run with Authentication

1. Start the backend server:
   ```bash
   cd backend
   npm install
   npm start
   ```

2. In another terminal, start the frontend:
   ```bash
   cd frontend
   python -m http.server 8000
   # or
   npx http-server -p 8000
   ```

3. Open `http://localhost:8000` in your browser
4. Click "Sign in with Google"
5. Authenticate with your Google account
6. Your tasks will now sync to the cloud!

### Important Notes

- **Test Users**: If your OAuth consent screen is in "Testing" mode, only test users you've added can sign in
- **Publishing**: To allow any Google user to sign in, you need to publish your OAuth consent screen (requires verification for production use)
- **Client ID Security**: The Client ID is not a secret and can be included in your frontend code
- **Client Secret**: Do NOT use the Client Secret in frontend code - it's only needed for server-side OAuth flows (not used in this app)
- **Multiple Environments**: Create separate OAuth clients for development, staging, and production environments

## Usage

- **Add Task**: Type in the input field and press Enter or click Add Task
- **Complete Task**: Click the checkbox next to any task
- **Delete Task**: Click the Delete button next to any task
- **Add Subtask**: Click "Add Subtask" on any task to add detailed sub-items
- **Set Due Date**: Use the date/time picker to schedule tasks
- **Keyboard Shortcuts**:
  - Press / to focus on the input field
  - Press Ctrl+Shift+Delete to clear all tasks

## File Structure

```
/
├── frontend/
│   ├── index.html       # Main HTML structure
│   ├── styles.css       # CSS styling and responsive design
│   ├── app.js           # Main application (class-based)
│   ├── app-legacy.js    # Legacy implementation (reference)
│   └── config.js        # Environment configuration (create this)
├── backend/
│   ├── local-server.js  # Local development server
│   ├── package.json     # Backend dependencies
│   └── README.md        # Backend documentation
└── README.md            # This file
```

## Browser Compatibility

- Chrome 60+
- Firefox 55+
- Safari 12+
- Edge 79+

## Data Storage

### Local Mode (No Authentication)
Tasks are automatically saved to your browser's localStorage, so they persist between sessions. Data is stored locally on your device and is not sent to any external servers.

### Cloud Mode (With Authentication)
When signed in with Google, tasks are stored in the cloud backend and synchronized across all your devices. You can work offline, and changes will sync automatically when you reconnect.

## Troubleshooting

### OAuth Issues

**"Error 400: redirect_uri_mismatch"**
- Make sure the URL you're accessing matches one of the Authorized redirect URIs in your Google Cloud Console
- Check that you've added both `http://localhost:8000` and `http://localhost:3000`

**"Access blocked: This app's request is invalid"**
- Verify your OAuth consent screen is properly configured
- Make sure you've added yourself as a test user if the app is in "Testing" mode

**"Invalid token" errors**
- Check that your `GOOGLE_CLIENT_ID` environment variable matches the Client ID from Google Cloud Console
- Verify the Client ID in `frontend/config.js` is correct

### Backend Connection Issues

**"Failed to fetch" or CORS errors**
- Make sure the backend server is running on `http://localhost:3000`
- Check that CORS is properly configured in the backend
- Verify your frontend is accessing the correct API URL in `config.js`

## Customization

You can easily customize the app by modifying:
- **Colors**: Edit the CSS variables in styles.css
- **Features**: Add new functionality in app.js
- **Layout**: Modify the HTML structure in index.html
- **API Endpoints**: Modify backend/local-server.js for custom backend logic

## Testing

This project includes comprehensive unit tests, property-based tests, and manual integration tests.

### Automated Tests

See [TESTING.md](TESTING.md) for detailed automated testing instructions.

**Quick Test Commands:**

Run all tests:
```cmd
node node_modules/jest/bin/jest.js
```

Run frontend tests only:
```cmd
node node_modules/jest/bin/jest.js frontend
```

Run backend tests only:
```cmd
node node_modules/jest/bin/jest.js backend
```

Or use the convenient batch scripts:
```cmd
test.cmd              # All tests
test-frontend.cmd     # Frontend only
test-backend.cmd      # Backend only
```

**Note**: These commands work on Windows without PowerShell execution policy issues.

### Manual Integration Testing

For comprehensive manual testing of the Google OAuth flow, cloud sync, and user isolation:

- **[LOCAL-TESTING-GUIDE.md](LOCAL-TESTING-GUIDE.md)** - Complete step-by-step testing guide (~60 min)
- **[TESTING-CHECKLIST.md](TESTING-CHECKLIST.md)** - Quick validation checklist (~40 min)

These guides cover:
- Google OAuth authentication flow
- Task CRUD operations with cloud sync
- User data isolation (security testing)
- Offline/online scenarios with auto-sync
- Migration from localStorage to cloud
- Sync status indicators

**Important**: Complete manual testing before deploying to AWS.

## Deployment to AWS

For production deployment to AWS with Lambda, API Gateway, DynamoDB, and CloudFront, see the infrastructure documentation in the `infrastructure/` directory (coming soon).

Enjoy your new To-Do app!
