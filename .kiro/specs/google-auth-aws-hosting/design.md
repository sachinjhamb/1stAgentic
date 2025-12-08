# Design Document

## Overview

This design transforms the To-Do application from a client-side-only app using localStorage into a full-stack cloud application with Google OAuth authentication and AWS backend infrastructure. The architecture maintains the existing class-based frontend structure while adding authentication, API communication, and cloud data persistence layers.

## Architecture

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        Client Browser                        │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  Frontend (S3 + CloudFront)                            │ │
│  │  - index.html, app.js, styles.css                      │ │
│  │  - Google OAuth Client                                 │ │
│  │  - AuthManager, ApiClient, SyncManager                 │ │
│  └────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
                            │
                            │ HTTPS
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                      AWS Cloud                               │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  CloudFront CDN (HTTPS/SSL)                            │ │
│  └────────────────────────────────────────────────────────┘ │
│                            │                                 │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  API Gateway (REST API)                                │ │
│  │  - /tasks (GET, POST)                                  │ │
│  │  - /tasks/{id} (PUT, DELETE)                           │ │
│  │  - /tasks/sync (POST)                                  │ │
│  │  - Authorization: Bearer {token}                       │ │
│  └────────────────────────────────────────────────────────┘ │
│                            │                                 │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  Lambda Functions                                      │ │
│  │  - getTasks: Retrieve user's tasks                     │ │
│  │  - createTask: Create new task                         │ │
│  │  - updateTask: Update existing task                    │ │
│  │  - deleteTask: Delete task                             │ │
│  │  - syncTasks: Batch sync operations                    │ │
│  └────────────────────────────────────────────────────────┘ │
│                            │                                 │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  DynamoDB                                              │ │
│  │  Table: TodoTasks                                      │ │
│  │  - Partition Key: userId (string)                      │ │
│  │  - Sort Key: taskId (string)                           │ │
│  └────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
                            │
                            │ OAuth 2.0
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                   Google OAuth 2.0                           │
│  - Authentication                                            │
│  - User Profile                                              │
│  - ID Token (JWT)                                            │
└─────────────────────────────────────────────────────────────┘
```

### Authentication Flow

```
User → Click "Sign in with Google"
  ↓
Frontend → Redirect to Google OAuth consent screen
  ↓
Google → User grants permission
  ↓
Google → Redirect back with authorization code
  ↓
Frontend → Exchange code for ID token (via Google API)
  ↓
Frontend → Store ID token in memory/sessionStorage
  ↓
Frontend → Include token in all API requests (Authorization header)
  ↓
Lambda → Verify token with Google
  ↓
Lambda → Extract userId from token
  ↓
Lambda → Process request with userId
```

## Project Structure Changes

The project will be reorganized to support both frontend and backend code:

```
/
├── frontend/
│   ├── index.html           # Main HTML with auth UI
│   ├── styles.css           # Existing styles + auth UI styles
│   ├── app.js               # Updated with auth integration
│   ├── auth-manager.js      # New: Google OAuth management
│   ├── api-client.js        # New: Backend API communication
│   ├── sync-manager.js      # New: Sync logic
│   ├── auth-ui.js           # New: Auth UI components
│   ├── config.js            # New: Environment configuration
│   └── app-legacy.js        # Keep for reference
│
├── backend/
│   ├── local-server.js      # New: Local development server
│   ├── lambda/
│   │   ├── getTasks.js      # New: Lambda function
│   │   ├── createTask.js    # New: Lambda function
│   │   ├── updateTask.js    # New: Lambda function
│   │   ├── deleteTask.js    # New: Lambda function
│   │   ├── syncTasks.js     # New: Lambda function
│   │   └── utils/
│   │       ├── tokenVerifier.js  # New: Token verification
│   │       └── dynamodb.js       # New: DynamoDB helpers
│   ├── package.json         # New: Backend dependencies
│   └── README.md            # New: Backend documentation
│
├── infrastructure/
│   ├── cloudformation.yaml  # New: AWS infrastructure template
│   ├── deploy.sh            # New: Deployment script
│   └── README.md            # New: Infrastructure documentation
│
├── .env.example             # New: Environment variables template
├── .gitignore               # Updated: Ignore node_modules, .env
└── README.md                # Updated: New setup instructions
```

## Components and Interfaces

### Frontend Components

#### 1. AuthManager Class

Manages Google OAuth authentication flow and session state.

```javascript
class AuthManager {
  constructor(clientId)
  
  // Initialize Google OAuth client
  async initialize()
  
  // Trigger Google sign-in flow
  async signIn()
  
  // Sign out and clear session
  async signOut()
  
  // Get current user info
  getCurrentUser()
  
  // Get ID token for API calls
  getIdToken()
  
  // Check if user is authenticated
  isAuthenticated()
  
  // Listen for auth state changes
  onAuthStateChanged(callback)
}
```

#### 2. ApiClient Class

Handles all HTTP communication with AWS backend.

```javascript
class ApiClient {
  constructor(baseUrl, authManager)
  
  // Generic request method with auth header
  async request(method, endpoint, data)
  
  // Task operations
  async getTasks()
  async createTask(task)
  async updateTask(taskId, updates)
  async deleteTask(taskId)
  async syncTasks(operations)
  
  // Error handling and retry logic
  handleError(error)
  retry(fn, maxAttempts)
}
```

#### 3. SyncManager Class

Manages synchronization between local state and cloud backend.

```javascript
class SyncManager {
  constructor(apiClient, taskManager)
  
  // Sync operations
  async syncToCloud(operation)
  async syncFromCloud()
  async fullSync()
  
  // Offline queue management
  queueOperation(operation)
  processQueue()
  
  // Migration from localStorage
  async migrateLocalTasks()
  
  // Sync status
  getSyncStatus()
  onSyncStatusChange(callback)
}
```

#### 4. Updated StorageManager Class

Modified to support both localStorage (offline queue) and cloud storage.

```javascript
class StorageManager {
  constructor(storageKey, mode) // mode: 'local' | 'cloud' | 'hybrid'
  
  // Existing methods remain
  loadTasks()
  saveTasks(tasks)
  
  // New methods for offline queue
  queueOperation(operation)
  getQueuedOperations()
  clearQueue()
  
  // Migration support
  hasLocalTasks()
  clearLocalTasks()
}
```

#### 5. AuthUI Component

Renders authentication UI elements.

```javascript
class AuthUI {
  constructor(container, authManager)
  
  // Render sign-in screen
  renderSignInScreen()
  
  // Render user profile in header
  renderUserProfile(user)
  
  // Render migration prompt
  renderMigrationPrompt(taskCount)
  
  // Render sync status indicator
  renderSyncStatus(status)
}
```

#### 6. Updated TodoApp Class

Enhanced main application controller with auth integration.

```javascript
class TodoApp {
  constructor() {
    // Existing properties
    this.storage = new StorageManager()
    this.taskManager = new TaskManager()
    this.reminderManager = new ReminderManager()
    this.renderer = new TaskRenderer()
    
    // New properties
    this.authManager = new AuthManager(GOOGLE_CLIENT_ID)
    this.apiClient = new ApiClient(API_BASE_URL, this.authManager)
    this.syncManager = new SyncManager(this.apiClient, this.taskManager)
    this.authUI = new AuthUI(document.body, this.authManager)
  }
  
  async initialize() {
    await this.authManager.initialize()
    
    if (this.authManager.isAuthenticated()) {
      await this.handleAuthenticatedUser()
    } else {
      this.authUI.renderSignInScreen()
    }
  }
  
  async handleAuthenticatedUser() {
    // Check for local tasks to migrate
    if (this.storage.hasLocalTasks()) {
      await this.promptMigration()
    }
    
    // Load tasks from cloud
    await this.syncManager.syncFromCloud()
    this.renderTasks()
    
    // Setup sync listeners
    this.setupSyncListeners()
  }
  
  // Override task operations to sync with cloud
  async handleAddTask(e) {
    // ... existing logic ...
    await this.syncManager.syncToCloud({
      type: 'CREATE',
      task: task
    })
  }
  
  // Similar overrides for update, delete operations
}
```

### Backend Components (AWS Lambda)

#### Lambda Function Structure

Each Lambda function follows this pattern:

```javascript
// getTasks.js
exports.handler = async (event) => {
  try {
    // 1. Extract and verify ID token
    const token = event.headers.Authorization.replace('Bearer ', '')
    const userId = await verifyGoogleToken(token)
    
    // 2. Query DynamoDB
    const tasks = await dynamoDB.query({
      TableName: 'TodoTasks',
      KeyConditionExpression: 'userId = :userId',
      ExpressionAttributeValues: {
        ':userId': userId
      }
    }).promise()
    
    // 3. Return response
    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(tasks.Items)
    }
  } catch (error) {
    return {
      statusCode: error.statusCode || 500,
      body: JSON.stringify({ error: error.message })
    }
  }
}
```

#### Token Verification Utility

```javascript
// tokenVerifier.js
const { OAuth2Client } = require('google-auth-library')
const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID)

async function verifyGoogleToken(token) {
  const ticket = await client.verifyIdToken({
    idToken: token,
    audience: process.env.GOOGLE_CLIENT_ID
  })
  
  const payload = ticket.getPayload()
  return payload.sub // Google user ID
}

module.exports = { verifyGoogleToken }
```

## Data Models

### Frontend Task Model (Unchanged)

```javascript
{
  id: string,              // UUID or timestamp-based
  text: string,            // Max 500 chars
  completed: boolean,
  createdAt: string,       // ISO 8601
  dueDateTime: string,     // ISO 8601
  subtasks: Array<Subtask>
}
```

### DynamoDB Task Schema

```javascript
{
  userId: string,          // Partition key (Google user ID)
  taskId: string,          // Sort key (UUID)
  text: string,
  completed: boolean,
  createdAt: string,       // ISO 8601
  dueDateTime: string,     // ISO 8601
  subtasks: Array<Subtask>, // Stored as JSON
  updatedAt: string,       // ISO 8601 (for sync conflict resolution)
  version: number          // Optimistic locking
}
```

### Sync Operation Model

```javascript
{
  type: 'CREATE' | 'UPDATE' | 'DELETE',
  taskId: string,
  task?: Task,             // For CREATE/UPDATE
  timestamp: string        // ISO 8601
}
```

### API Request/Response Models

#### GET /tasks
```javascript
// Request
Headers: {
  Authorization: 'Bearer {idToken}'
}

// Response
{
  tasks: Array<Task>
}
```

#### POST /tasks
```javascript
// Request
Headers: {
  Authorization: 'Bearer {idToken}'
}
Body: {
  task: Task
}

// Response
{
  task: Task,
  taskId: string
}
```

#### PUT /tasks/{taskId}
```javascript
// Request
Headers: {
  Authorization: 'Bearer {idToken}'
}
Body: {
  updates: Partial<Task>,
  version: number
}

// Response
{
  task: Task
}
```

#### DELETE /tasks/{taskId}
```javascript
// Request
Headers: {
  Authorization: 'Bearer {idToken}'
}

// Response
{
  success: boolean
}
```

#### POST /tasks/sync
```javascript
// Request
Headers: {
  Authorization: 'Bearer {idToken}'
}
Body: {
  operations: Array<SyncOperation>
}

// Response
{
  results: Array<{
    operation: SyncOperation,
    success: boolean,
    error?: string
  }>
}
```

## 
Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system-essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*


Property 1: Token storage on successful authentication
*For any* successful Google authentication, the system should store the identity token in a secure location accessible to the ApiClient
**Validates: Requirements 1.3**

Property 2: Authenticated user profile display
*For any* authenticated user session, the header should display the user's profile picture and name
**Validates: Requirements 1.4**

Property 3: Session cleanup on sign out
*For any* authenticated session, signing out should clear all stored tokens and return the UI to the unauthenticated state
**Validates: Requirements 1.5**

Property 4: Task operations sync to cloud
*For any* task operation (create, update, delete) performed by an authenticated user, the system should send the corresponding API request to the cloud backend
**Validates: Requirements 2.1, 2.2, 2.3**

Property 5: Task loading on sign-in
*For any* user signing in, the system should fetch and load all tasks associated with that user's ID from the cloud backend
**Validates: Requirements 2.4**

Property 6: Offline operation queueing
*For any* task operation that fails due to network unavailability, the system should queue the operation locally and retry when connection is restored
**Validates: Requirements 2.5**

Property 7: Token validation on all requests
*For any* API request to the backend, the Lambda function should validate the provided identity token before processing the request
**Validates: Requirements 3.1**

Property 8: User data isolation
*For any* user requesting tasks, the backend should return only tasks where the userId matches the authenticated user's ID, and all stored tasks should be associated with the correct userId
**Validates: Requirements 3.2, 3.3**

Property 9: Invalid token rejection
*For any* API request with an invalid or expired token, the backend should reject the request with a 401 authentication error
**Validates: Requirements 3.4**

Property 10: HTTPS for all communications
*For any* API request from the frontend, the URL should use the HTTPS protocol
**Validates: Requirements 3.5**

Property 11: Migration uploads all local tasks
*For any* set of tasks in localStorage, confirming migration should result in all tasks being uploaded to the cloud backend with the authenticated user's ID
**Validates: Requirements 5.3**

Property 12: Post-migration localStorage cleanup
*For any* completed migration, localStorage should be empty and all subsequent task operations should use cloud storage exclusively
**Validates: Requirements 5.4**

Property 13: Sync status feedback
*For any* task operation, the system should display appropriate status indicators: syncing during the operation, success on completion, or error with retry option on failure
**Validates: Requirements 6.1, 6.2, 6.3**

Property 14: Automatic sync on reconnection
*For any* queued operations when the application reconnects to the network, the system should automatically process all pending operations
**Validates: Requirements 6.5**

Property 15: Local and cloud API endpoint parity
*For any* API endpoint available in the AWS deployment, the local backend server should provide the same endpoint with the same request/response format
**Validates: Requirements 7.1**

Property 16: Local storage mimics DynamoDB behavior
*For any* CRUD operation performed against the local in-memory storage, the behavior should match DynamoDB operations (create, read, update, delete with user isolation)
**Validates: Requirements 7.2**

Property 17: Environment-based configuration
*For any* environment (local, dev, staging, production), the application should use the correct API base URL and Google Client ID without code changes
**Validates: Requirements 7.4**

## Error Handling

### Frontend Error Handling

**Authentication Errors:**
- Google OAuth failures: Display user-friendly error message, allow retry
- Token expiration: Automatically trigger re-authentication flow
- Network errors during auth: Queue for retry, show offline indicator

**API Communication Errors:**
- 401 Unauthorized: Clear session, redirect to sign-in
- 403 Forbidden: Show permission error
- 404 Not Found: Handle gracefully, may indicate deleted task
- 500 Server Error: Show error message, queue operation for retry
- Network timeout: Queue operation, show offline indicator

**Sync Errors:**
- Conflict detection: Use "last write wins" strategy with timestamp comparison
- Partial sync failures: Continue processing remaining operations, report failures
- Queue overflow: Limit queue size, warn user if limit approached

### Backend Error Handling

**Lambda Function Errors:**
- Token verification failure: Return 401 with clear error message
- DynamoDB errors: Return 500, log error for monitoring
- Validation errors: Return 400 with specific validation messages
- Rate limiting: Return 429, include retry-after header

**Error Response Format:**
```javascript
{
  error: {
    code: string,        // e.g., 'INVALID_TOKEN', 'TASK_NOT_FOUND'
    message: string,     // Human-readable error message
    details?: object     // Additional error context
  }
}
```

## Testing Strategy

### Unit Testing

**Frontend Unit Tests:**
- AuthManager: Test sign-in/sign-out flows, token management
- ApiClient: Test request formatting, error handling, retry logic
- SyncManager: Test queue management, sync operations, conflict resolution
- StorageManager: Test localStorage operations, queue persistence

**Backend Unit Tests:**
- Token verification: Test valid/invalid/expired tokens
- DynamoDB operations: Test CRUD operations with mocked DynamoDB
- Authorization: Test user data isolation logic
- Input validation: Test task data validation

### Property-Based Testing

We will use **fast-check** (JavaScript property-based testing library) for frontend tests and **hypothesis** (Python) or custom generators for backend Lambda tests if using Python runtime.

**Property Test Configuration:**
- Each property-based test should run a minimum of 100 iterations
- Each test must be tagged with a comment referencing the design document property
- Tag format: `// Feature: google-auth-aws-hosting, Property {number}: {property_text}`

**Frontend Property Tests:**

Test generators needed:
- Random task data (text, dates, subtasks)
- Random user IDs
- Random auth states
- Random network conditions (online/offline)
- Random API responses (success/error)

**Backend Property Tests:**

Test generators needed:
- Random valid/invalid JWT tokens
- Random user IDs
- Random task data
- Random DynamoDB states

### Integration Testing

**End-to-End Tests:**
- Complete auth flow: Sign in → Create task → Sign out → Sign in → Verify task persists
- Migration flow: Local tasks → Sign in → Migrate → Verify cloud tasks
- Offline flow: Go offline → Create tasks → Go online → Verify sync
- Multi-device simulation: Create task on device A → Sign in on device B → Verify task appears

**AWS Integration Tests:**
- Deploy to test environment
- Test API Gateway endpoints with real Lambda functions
- Test DynamoDB operations
- Test CloudFront distribution

## AWS Infrastructure

### Infrastructure Components

**S3 Bucket (Frontend Hosting):**
- Bucket name: `todo-app-frontend-{environment}`
- Static website hosting enabled
- Public read access for website content
- Versioning enabled for rollback capability

**CloudFront Distribution:**
- Origin: S3 bucket
- SSL/TLS certificate from AWS Certificate Manager
- Custom domain name (optional)
- Caching strategy: Cache static assets, no-cache for index.html
- HTTPS redirect enabled

**API Gateway:**
- REST API type
- CORS enabled for frontend domain
- Authorization: None (handled in Lambda)
- Endpoints:
  - GET /tasks
  - POST /tasks
  - PUT /tasks/{taskId}
  - DELETE /tasks/{taskId}
  - POST /tasks/sync
- Request/response models defined
- API key optional for rate limiting

**Lambda Functions:**
- Runtime: Node.js 18.x or Python 3.11
- Memory: 256 MB (adjust based on performance)
- Timeout: 30 seconds
- Environment variables:
  - GOOGLE_CLIENT_ID
  - DYNAMODB_TABLE_NAME
  - ENVIRONMENT
- IAM role with DynamoDB access permissions
- CloudWatch Logs enabled

**DynamoDB Table:**
- Table name: `TodoTasks-{environment}`
- Partition key: `userId` (String)
- Sort key: `taskId` (String)
- Billing mode: On-demand (or provisioned based on usage)
- Point-in-time recovery enabled
- Encryption at rest enabled
- Global secondary indexes (if needed for queries):
  - Index on `dueDateTime` for time-based queries

**IAM Roles and Policies:**
- Lambda execution role with:
  - DynamoDB read/write permissions
  - CloudWatch Logs permissions
- S3 bucket policy for CloudFront access

**CloudWatch:**
- Lambda function logs
- API Gateway access logs
- Custom metrics for:
  - API request count
  - Error rates
  - Task operation counts
  - Authentication success/failure rates

### Infrastructure as Code

**CloudFormation Template Structure:**

```yaml
AWSTemplateFormatVersion: '2010-09-09'
Description: 'Todo App Infrastructure'

Parameters:
  Environment:
    Type: String
    AllowedValues: [dev, staging, prod]
  GoogleClientId:
    Type: String
    NoEcho: true

Resources:
  # S3 Bucket for frontend
  FrontendBucket:
    Type: AWS::S3::Bucket
    Properties:
      BucketName: !Sub 'todo-app-frontend-${Environment}'
      WebsiteConfiguration:
        IndexDocument: index.html
        ErrorDocument: index.html
      PublicAccessBlockConfiguration:
        BlockPublicAcls: false
        BlockPublicPolicy: false
        IgnorePublicAcls: false
        RestrictPublicBuckets: false
  
  # CloudFront Distribution
  CloudFrontDistribution:
    Type: AWS::CloudFront::Distribution
    Properties:
      DistributionConfig:
        Enabled: true
        Origins:
          - DomainName: !GetAtt FrontendBucket.DomainName
            Id: S3Origin
            S3OriginConfig:
              OriginAccessIdentity: ''
        DefaultCacheBehavior:
          TargetOriginId: S3Origin
          ViewerProtocolPolicy: redirect-to-https
          AllowedMethods: [GET, HEAD, OPTIONS]
          CachedMethods: [GET, HEAD]
          ForwardedValues:
            QueryString: false
        ViewerCertificate:
          CloudFrontDefaultCertificate: true
  
  # DynamoDB Table
  TodoTasksTable:
    Type: AWS::DynamoDB::Table
    Properties:
      TableName: !Sub 'TodoTasks-${Environment}'
      AttributeDefinitions:
        - AttributeName: userId
          AttributeType: S
        - AttributeName: taskId
          AttributeType: S
      KeySchema:
        - AttributeName: userId
          KeyType: HASH
        - AttributeName: taskId
          KeyType: RANGE
      BillingMode: PAY_PER_REQUEST
      PointInTimeRecoverySpecification:
        PointInTimeRecoveryEnabled: true
      SSESpecification:
        SSEEnabled: true
  
  # API Gateway
  TodoApi:
    Type: AWS::ApiGateway::RestApi
    Properties:
      Name: !Sub 'todo-api-${Environment}'
      Description: 'Todo App REST API'
  
  # Lambda Functions (example for getTasks)
  GetTasksFunction:
    Type: AWS::Lambda::Function
    Properties:
      FunctionName: !Sub 'getTasks-${Environment}'
      Runtime: nodejs18.x
      Handler: index.handler
      Code:
        ZipFile: |
          // Lambda function code here
      Role: !GetAtt LambdaExecutionRole.Arn
      Environment:
        Variables:
          GOOGLE_CLIENT_ID: !Ref GoogleClientId
          DYNAMODB_TABLE_NAME: !Ref TodoTasksTable
          ENVIRONMENT: !Ref Environment
      Timeout: 30
      MemorySize: 256
  
  # IAM Role for Lambda
  LambdaExecutionRole:
    Type: AWS::IAM::Role
    Properties:
      AssumeRolePolicyDocument:
        Version: '2012-10-17'
        Statement:
          - Effect: Allow
            Principal:
              Service: lambda.amazonaws.com
            Action: sts:AssumeRole
      ManagedPolicyArns:
        - arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole
      Policies:
        - PolicyName: DynamoDBAccess
          PolicyDocument:
            Version: '2012-10-17'
            Statement:
              - Effect: Allow
                Action:
                  - dynamodb:GetItem
                  - dynamodb:PutItem
                  - dynamodb:UpdateItem
                  - dynamodb:DeleteItem
                  - dynamodb:Query
                Resource: !GetAtt TodoTasksTable.Arn

Outputs:
  FrontendUrl:
    Value: !GetAtt CloudFrontDistribution.DomainName
  ApiUrl:
    Value: !Sub 'https://${TodoApi}.execute-api.${AWS::Region}.amazonaws.com/prod'
  TableName:
    Value: !Ref TodoTasksTable
```

### Local Development Setup

**Local Backend Server:**

To test the application locally before AWS deployment, we'll create a local Express.js server that mimics the Lambda + API Gateway setup.

```javascript
// backend/local-server.js
const express = require('express')
const cors = require('cors')
const { OAuth2Client } = require('google-auth-library')

const app = express()
const PORT = 3000

// In-memory storage for local testing (replace with DynamoDB in production)
const localDB = new Map()

// Middleware
app.use(cors())
app.use(express.json())

// Token verification middleware
const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID)

async function verifyToken(req, res, next) {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '')
    if (!token) {
      return res.status(401).json({ error: 'No token provided' })
    }
    
    const ticket = await client.verifyIdToken({
      idToken: token,
      audience: process.env.GOOGLE_CLIENT_ID
    })
    
    req.userId = ticket.getPayload().sub
    next()
  } catch (error) {
    res.status(401).json({ error: 'Invalid token' })
  }
}

// Routes
app.get('/tasks', verifyToken, (req, res) => {
  const userTasks = Array.from(localDB.values())
    .filter(task => task.userId === req.userId)
  res.json({ tasks: userTasks })
})

app.post('/tasks', verifyToken, (req, res) => {
  const task = {
    ...req.body.task,
    userId: req.userId,
    taskId: req.body.task.id,
    updatedAt: new Date().toISOString()
  }
  localDB.set(`${req.userId}:${task.taskId}`, task)
  res.json({ task, taskId: task.taskId })
})

app.put('/tasks/:taskId', verifyToken, (req, res) => {
  const key = `${req.userId}:${req.params.taskId}`
  const existing = localDB.get(key)
  
  if (!existing) {
    return res.status(404).json({ error: 'Task not found' })
  }
  
  const updated = {
    ...existing,
    ...req.body.updates,
    updatedAt: new Date().toISOString()
  }
  localDB.set(key, updated)
  res.json({ task: updated })
})

app.delete('/tasks/:taskId', verifyToken, (req, res) => {
  const key = `${req.userId}:${req.params.taskId}`
  const deleted = localDB.delete(key)
  res.json({ success: deleted })
})

app.post('/tasks/sync', verifyToken, async (req, res) => {
  const results = []
  
  for (const operation of req.body.operations) {
    try {
      switch (operation.type) {
        case 'CREATE':
          const task = {
            ...operation.task,
            userId: req.userId,
            taskId: operation.taskId,
            updatedAt: new Date().toISOString()
          }
          localDB.set(`${req.userId}:${task.taskId}`, task)
          results.push({ operation, success: true })
          break
        
        case 'UPDATE':
          const key = `${req.userId}:${operation.taskId}`
          const existing = localDB.get(key)
          if (existing) {
            localDB.set(key, { ...existing, ...operation.task, updatedAt: new Date().toISOString() })
            results.push({ operation, success: true })
          } else {
            results.push({ operation, success: false, error: 'Task not found' })
          }
          break
        
        case 'DELETE':
          const deleteKey = `${req.userId}:${operation.taskId}`
          localDB.delete(deleteKey)
          results.push({ operation, success: true })
          break
      }
    } catch (error) {
      results.push({ operation, success: false, error: error.message })
    }
  }
  
  res.json({ results })
})

app.listen(PORT, () => {
  console.log(`Local backend server running on http://localhost:${PORT}`)
  console.log(`Make sure GOOGLE_CLIENT_ID is set in environment`)
})
```

**Running Locally:**

```bash
# 1. Install dependencies
cd backend
npm install express cors google-auth-library

# 2. Set environment variable
export GOOGLE_CLIENT_ID="your-google-client-id"

# 3. Start local backend server
node local-server.js

# 4. In another terminal, serve frontend
cd ../frontend
python -m http.server 8000
# or
npx http-server -p 8000

# 5. Open browser to http://localhost:8000
```

**Local Configuration:**

Update `config.js` to detect local environment:

```javascript
// config.js
const config = {
  local: {
    apiBaseUrl: 'http://localhost:3000',
    googleClientId: 'YOUR_GOOGLE_CLIENT_ID'
  },
  development: {
    apiBaseUrl: 'https://api-dev.yourdomain.com',
    googleClientId: 'YOUR_DEV_CLIENT_ID'
  },
  staging: {
    apiBaseUrl: 'https://api-staging.yourdomain.com',
    googleClientId: 'YOUR_STAGING_CLIENT_ID'
  },
  production: {
    apiBaseUrl: 'https://api.yourdomain.com',
    googleClientId: 'YOUR_PROD_CLIENT_ID'
  }
}

// Auto-detect environment
const environment = window.location.hostname === 'localhost' ? 'local' :
                   window.location.hostname.includes('staging') ? 'staging' :
                   window.location.hostname.includes('dev') ? 'development' :
                   'production'

export default config[environment]
```

**Local Testing Checklist:**

1. ✓ Google OAuth sign-in works
2. ✓ Tasks can be created, updated, deleted
3. ✓ Tasks persist across page refreshes
4. ✓ Multiple users can sign in (different Google accounts)
5. ✓ User data isolation (each user sees only their tasks)
6. ✓ Offline queue works (stop server, make changes, restart server)
7. ✓ Migration from localStorage works
8. ✓ Sync status indicators display correctly

### Deployment Process

**Prerequisites:**
1. AWS CLI configured with appropriate credentials
2. Google OAuth Client ID obtained from Google Cloud Console
3. Domain name (optional) and SSL certificate in ACM
4. Local testing completed successfully

**Deployment Steps:**

```bash
# 1. Package Lambda functions
cd backend
npm install
zip -r functions.zip .

# 2. Deploy CloudFormation stack
aws cloudformation deploy \
  --template-file infrastructure.yaml \
  --stack-name todo-app-${ENVIRONMENT} \
  --parameter-overrides \
    Environment=${ENVIRONMENT} \
    GoogleClientId=${GOOGLE_CLIENT_ID} \
  --capabilities CAPABILITY_IAM

# 3. Upload Lambda function code
aws lambda update-function-code \
  --function-name getTasks-${ENVIRONMENT} \
  --zip-file fileb://functions.zip

# 4. Build and deploy frontend
cd ../frontend
# Update config.js with API Gateway URL and Google Client ID
aws s3 sync . s3://todo-app-frontend-${ENVIRONMENT}/ \
  --exclude "*.md" \
  --exclude ".git/*"

# 5. Invalidate CloudFront cache
aws cloudfront create-invalidation \
  --distribution-id ${DISTRIBUTION_ID} \
  --paths "/*"
```

**Environment Configuration:**

Create a `config.js` file for frontend environment-specific settings:

```javascript
// config.js
const config = {
  development: {
    apiBaseUrl: 'http://localhost:3000',
    googleClientId: 'YOUR_DEV_CLIENT_ID'
  },
  staging: {
    apiBaseUrl: 'https://api-staging.yourdomain.com',
    googleClientId: 'YOUR_STAGING_CLIENT_ID'
  },
  production: {
    apiBaseUrl: 'https://api.yourdomain.com',
    googleClientId: 'YOUR_PROD_CLIENT_ID'
  }
}

const environment = 'production' // Set during build
export default config[environment]
```

## Security Considerations

**Frontend Security:**
- Store ID tokens in memory or sessionStorage (not localStorage for security)
- Implement token refresh before expiration
- Clear all auth data on sign out
- Validate all user inputs before sending to backend
- Use Content Security Policy headers

**Backend Security:**
- Verify Google ID tokens on every request
- Implement rate limiting to prevent abuse
- Use least-privilege IAM roles
- Enable DynamoDB encryption at rest
- Enable CloudWatch logging for audit trail
- Implement request validation and sanitization
- Use environment variables for sensitive configuration

**Data Privacy:**
- Only collect necessary user data (Google ID, name, profile picture)
- Implement data retention policies
- Provide user data export capability
- Implement user data deletion on account closure
- Comply with GDPR/privacy regulations

## Performance Considerations

**Frontend Optimization:**
- Lazy load Google OAuth library
- Implement optimistic UI updates (update UI before API response)
- Batch sync operations when possible
- Cache user profile data
- Minimize API calls with intelligent sync strategy

**Backend Optimization:**
- Use DynamoDB batch operations for multiple tasks
- Implement API response caching where appropriate
- Optimize Lambda cold starts (keep functions warm if needed)
- Use DynamoDB on-demand billing for variable workloads
- Monitor and optimize Lambda memory allocation

**Network Optimization:**
- Enable CloudFront caching for static assets
- Use compression for API responses
- Implement request debouncing for rapid operations
- Use WebSocket or Server-Sent Events for real-time sync (future enhancement)

## Migration Strategy

**Phase 1: Local Development Setup**
1. Obtain Google OAuth credentials (for localhost)
2. Create local Express.js backend server
3. Set up local environment configuration
4. Test Google OAuth flow locally

**Phase 2: Frontend Integration (Local Testing)**
1. Add Google OAuth library to frontend
2. Implement AuthManager class
3. Implement ApiClient class
4. Add authentication UI
5. Test sign-in/sign-out locally

**Phase 3: Sync Implementation (Local Testing)**
1. Implement SyncManager class
2. Update TodoApp to use cloud storage
3. Implement offline queue
4. Add sync status indicators
5. Test all CRUD operations locally

**Phase 4: Migration Flow (Local Testing)**
1. Implement localStorage detection
2. Add migration prompt UI
3. Implement migration logic
4. Test migration with various data scenarios locally

**Phase 5: Local Testing & Validation**
1. Run all unit tests
2. Run property-based tests
3. Test with multiple Google accounts
4. Test offline/online scenarios
5. Test migration flows
6. Verify user data isolation

**Phase 6: AWS Infrastructure Setup**
1. Set up AWS infrastructure using CloudFormation
2. Deploy backend Lambda functions
3. Configure API Gateway
4. Set up DynamoDB table
5. Configure CloudFront and S3

**Phase 7: AWS Deployment & Testing**
1. Update frontend config for AWS endpoints
2. Deploy frontend to S3
3. Test on staging environment
4. Run integration tests against AWS
5. User acceptance testing
6. Deploy to production

**Phase 8: Monitoring & Optimization**
1. Set up CloudWatch dashboards
2. Monitor error rates and performance
3. Optimize Lambda memory and timeout settings
4. Adjust DynamoDB capacity if needed

**Rollback Plan:**
- Keep localStorage code as fallback
- Feature flag for cloud sync
- Ability to export tasks before migration
- CloudFormation stack rollback capability

## Future Enhancements

**Potential Features:**
- Real-time sync across devices using WebSockets
- Offline-first architecture with service workers
- Task sharing and collaboration
- Task categories and tags
- Advanced search and filtering
- Task templates
- Recurring tasks
- Email reminders
- Mobile app (React Native or Flutter)
- Browser extension
