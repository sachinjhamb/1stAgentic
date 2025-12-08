# Todo App - Local Backend Server

This is a local development server that mimics the AWS Lambda + API Gateway backend for testing the Todo application locally before deploying to AWS.

## Features

- Google OAuth token verification
- In-memory storage (mimics DynamoDB)
- User data isolation
- RESTful API endpoints
- CORS support for local frontend

## Prerequisites

- Node.js 18+ installed
- Google OAuth Client ID (from Google Cloud Console)
  - See the main [README.md](../README.md#google-oauth-setup-required-for-cloud-sync) for detailed setup instructions

## Setup

### Getting Your Google OAuth Client ID

If you haven't set up Google OAuth yet, follow the comprehensive guide in the main [README.md](../README.md#google-oauth-setup-required-for-cloud-sync).

**Quick Summary:**
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project
3. Configure OAuth consent screen
4. Create OAuth 2.0 Client ID (Web application type)
5. Add authorized origins: `http://localhost:8000`, `http://localhost:3000`
6. Copy the Client ID

### Installation

1. Install dependencies:
```bash
npm install
```

2. Set environment variables:
```bash
export GOOGLE_CLIENT_ID="your-google-client-id-here"
```

Or create a `.env` file (not committed to git):
```
GOOGLE_CLIENT_ID=your-google-client-id-here
PORT=3000
```

## Running the Server

```bash
npm start
```

The server will start on `http://localhost:3000` (or the PORT you specified).

## API Endpoints

### Health Check
- **GET** `/health`
- No authentication required
- Returns server status

### Get Tasks
- **GET** `/tasks`
- Requires: `Authorization: Bearer {idToken}` header
- Returns: All tasks for the authenticated user

### Create Task
- **POST** `/tasks`
- Requires: `Authorization: Bearer {idToken}` header
- Body: `{ "task": { "id": "...", "text": "...", ... } }`
- Returns: Created task with taskId

### Update Task
- **PUT** `/tasks/:taskId`
- Requires: `Authorization: Bearer {idToken}` header
- Body: `{ "updates": { "text": "...", ... } }`
- Returns: Updated task

### Delete Task
- **DELETE** `/tasks/:taskId`
- Requires: `Authorization: Bearer {idToken}` header
- Returns: `{ "success": true }`

### Sync Tasks (Batch Operations)
- **POST** `/tasks/sync`
- Requires: `Authorization: Bearer {idToken}` header
- Body: `{ "operations": [{ "type": "CREATE|UPDATE|DELETE", ... }] }`
- Returns: Results for each operation

## Testing

The server includes user data isolation - each authenticated user can only access their own tasks.

To test with multiple users:
1. Sign in with one Google account
2. Create some tasks
3. Sign out and sign in with a different Google account
4. Verify you see no tasks from the first user

## Environment Variables

- `GOOGLE_CLIENT_ID` (required): Your Google OAuth 2.0 Client ID
- `PORT` (optional): Server port, defaults to 3000

## Storage

This server uses in-memory storage (Map) that mimics DynamoDB behavior:
- Data is lost when server restarts
- Tasks are keyed by `userId:taskId` for isolation
- Each user can only access their own tasks

## Error Handling

The server returns structured error responses:
```json
{
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable error message"
  }
}
```

Common error codes:
- `NO_TOKEN`: Authorization header missing
- `INVALID_TOKEN`: Token verification failed
- `TASK_NOT_FOUND`: Task doesn't exist or doesn't belong to user
- `INVALID_DATA`: Request data validation failed
- `SERVER_ERROR`: Unexpected server error

## Development

The server automatically reloads when you make changes if you use nodemon:
```bash
npm install -g nodemon
nodemon local-server.js
```
