# Implementation Plan

- [x] 1. Set up project structure and configuration





  - Reorganize project into frontend/ and backend/ directories
  - Create config.js for environment-specific settings
  - Create .env.example template
  - Update .gitignore for node_modules and .env files
  - _Requirements: 7.3, 7.4_

- [x] 2. Set up Google OAuth credentials





  - Create Google Cloud Console project
  - Configure OAuth consent screen
  - Create OAuth 2.0 Client ID for web application
  - Add authorized JavaScript origins (localhost and production domains)
  - Add authorized redirect URIs
  - Document client ID setup in README
  - _Requirements: 1.2_

- [x] 3. Implement local backend server





  - [x] 3.1 Create Express.js server with CORS support


    - Set up Express app with JSON middleware
    - Configure CORS for localhost frontend
    - Add health check endpoint
    - _Requirements: 7.1_

  - [x] 3.2 Implement token verification middleware

    - Add google-auth-library dependency
    - Create verifyToken middleware function
    - Extract userId from verified token
    - Handle invalid/expired tokens with 401 response
    - _Requirements: 3.1, 3.4_

  - [x] 3.3 Write property test for token verification


    - **Property 7: Token validation on all requests**
    - **Validates: Requirements 3.1**

  - [x] 3.4 Implement in-memory storage with user isolation

    - Create Map-based storage keyed by userId:taskId
    - Implement helper functions for CRUD operations
    - Ensure user data isolation in all operations
    - _Requirements: 7.2, 3.2, 3.3_

  - [x] 3.5 Write property test for user data isolation


    - **Property 8: User data isolation**
    - **Validates: Requirements 3.2, 3.3**

  - [x] 3.6 Write property test for local storage behavior


    - **Property 16: Local storage mimics DynamoDB behavior**
    - **Validates: Requirements 7.2**

  - [x] 3.7 Implement GET /tasks endpoint

    - Filter tasks by authenticated userId
    - Return tasks array in response
    - _Requirements: 2.4, 3.2_

  - [x] 3.8 Implement POST /tasks endpoint

    - Validate task data
    - Associate task with authenticated userId
    - Store task in memory
    - Return created task
    - _Requirements: 2.1, 3.3_

  - [x] 3.9 Implement PUT /tasks/:taskId endpoint

    - Verify task belongs to authenticated user
    - Update task with provided data
    - Return updated task
    - _Requirements: 2.2_

  - [x] 3.10 Implement DELETE /tasks/:taskId endpoint

    - Verify task belongs to authenticated user
    - Remove task from storage
    - Return success response
    - _Requirements: 2.3_

  - [x] 3.11 Implement POST /tasks/sync endpoint

    - Process batch operations (CREATE, UPDATE, DELETE)
    - Return results for each operation
    - _Requirements: 2.5_

  - [x] 3.12 Write property test for API endpoint parity


    - **Property 15: Local and cloud API endpoint parity**
    - **Validates: Requirements 7.1**

- [x] 4. Checkpoint - Test local backend server





  - Ensure all tests pass, ask the user if questions arise.

- [x] 5. Implement frontend authentication (AuthManager)









  - [x] 5.1 Create auth-manager.js with AuthManager class


    - Add Google OAuth library script loading
    - Implement initialize() method
    - Implement signIn() method with Google OAuth flow
    - Implement signOut() method
    - Implement getCurrentUser() method
    - Implement getIdToken() method
    - Implement isAuthenticated() method
    - Add auth state change listeners
    - _Requirements: 1.2, 1.3, 1.5_

  - [x] 5.2 Write property test for token storage


    - **Property 1: Token storage on successful authentication**
    - **Validates: Requirements 1.3**


  - [x] 5.3 Write property test for session cleanup









    - **Property 3: Session cleanup on sign out**
    - **Validates: Requirements 1.5**



  - [x] 5.4 Write unit tests for AuthManager



    - Test initialization
    - Test sign-in flow
    - Test sign-out flow
    - Test token retrieval
    - _Requirements: 1.2, 1.3, 1.5_

- [x] 6. Implement API client (ApiClient)




  - [x] 6.1 Create api-client.js with ApiClient class


    - Implement constructor with baseUrl and authManager
    - Implement generic request() method with Authorization header
    - Implement getTasks() method
    - Implement createTask() method
    - Implement updateTask() method
    - Implement deleteTask() method
    - Implement syncTasks() method
    - Add error handling and retry logic
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 3.5_


  - [x] 6.2 Write property test for HTTPS usage

    - **Property 10: HTTPS for all communications**
    - **Validates: Requirements 3.5**

  - [x] 6.3 Write property test for invalid token rejection

    - **Property 9: Invalid token rejection**
    - **Validates: Requirements 3.4**

  - [x] 6.4 Write unit tests for ApiClient

    - Test request formatting
    - Test error handling
    - Test retry logic
    - _Requirements: 2.1, 2.2, 2.3, 2.4_

- [x] 7. Implement sync manager (SyncManager)






  - [x] 7.1 Create sync-manager.js with SyncManager class


    - Implement constructor with apiClient and taskManager
    - Implement syncToCloud() for single operations
    - Implement syncFromCloud() to load all tasks
    - Implement fullSync() for complete synchronization
    - Implement queueOperation() for offline operations
    - Implement processQueue() for batch sync
    - Add sync status tracking and callbacks
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5_



  - [x] 7.2 Write property test for task operations sync









    - **Property 4: Task operations sync to cloud**
    - **Validates: Requirements 2.1, 2.2, 2.3**


  - [x] 7.3 Write property test for task loading

    - **Property 5: Task loading on sign-in**

    - **Validates: Requirements 2.4**

  - [x] 7.4 Write property test for offline queueing

    - **Property 6: Offline operation queueing**
    - **Validates: Requirements 2.5**


  - [x] 7.5 Write property test for automatic reconnection sync

    - **Property 14: Automatic sync on reconnection**
    - **Validates: Requirements 6.5**

  - [x] 7.6 Write unit tests for SyncManager

    - Test queue management
    - Test sync operations
    - Test conflict resolution
    - _Requirements: 2.5_

- [x] 8. Update StorageManager for hybrid mode
  - [x] 8.1 Modify StorageManager class





    - Add mode parameter (local/cloud/hybrid)
    - Implement queueOperation() method
    - Implement getQueuedOperations() method
    - Implement clearQueue() method
    - Implement hasLocalTasks() method
    - Implement clearLocalTasks() method
    - _Requirements: 2.5, 5.1_

  - [x] 8.2 Write unit tests for updated StorageManager




    - Test queue operations
    - Test local task detection
    - Test localStorage clearing
    - _Requirements: 2.5, 5.1_

- [x] 9. Implement authentication UI (AuthUI)




  - [x] 9.1 Create auth-ui.js with AuthUI class





    - Implement renderSignInScreen() method
    - Implement renderUserProfile() method
    - Implement renderMigrationPrompt() method
    - Implement renderSyncStatus() method
    - Add CSS styles for auth UI components
    - _Requirements: 1.1, 1.4, 5.2, 6.1, 6.2, 6.3_

  - [x] 9.2 Write property test for authenticated user profile display


    - **Property 2: Authenticated user profile display**
    - **Validates: Requirements 1.4**

  - [x] 9.3 Write property test for sync status feedback

    - **Property 13: Sync status feedback**
    - **Validates: Requirements 6.1, 6.2, 6.3**

  - [x] 9.4 Write unit tests for AuthUI

    - Test sign-in screen rendering
    - Test user profile rendering
    - Test migration prompt rendering
    - Test sync status rendering
    - _Requirements: 1.1, 1.4, 5.2, 6.1, 6.2, 6.3_

- [x] 10. Implement migration logic
  - [x] 10.1 Add migration methods to SyncManager





    - Implement migrateLocalTasks() method
    - Detect existing localStorage tasks
    - Upload tasks to cloud with user confirmation
    - Clear localStorage after successful migration
    - Handle migration errors gracefully
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5_

  - [x] 10.2 Write property test for migration upload





    - **Property 11: Migration uploads all local tasks**
    - **Validates: Requirements 5.3**


  - [x] 10.3 Write property test for post-migration cleanup




    - **Property 12: Post-migration localStorage cleanup**
    - **Validates: Requirements 5.4**

  - [x] 10.4 Write unit tests for migration logic





    - Test local task detection
    - Test migration confirmation flow
    - Test migration decline flow
    - Test localStorage cleanup
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5_

- [x] 11. Update TodoApp class for authentication integration




  - [x] 11.1 Modify TodoApp constructor


    - Initialize AuthManager
    - Initialize ApiClient
    - Initialize SyncManager
    - Initialize AuthUI
    - Update initialization flow to check auth state
    - _Requirements: 1.1, 1.4_

  - [x] 11.2 Implement authentication flow


    - Add handleAuthenticatedUser() method
    - Add handleUnauthenticatedUser() method
    - Check for local tasks and prompt migration
    - Load tasks from cloud on sign-in
    - Setup sync listeners
    - _Requirements: 1.4, 2.4, 5.1_

  - [x] 11.3 Update task operations to sync with cloud


    - Modify handleAddTask() to call syncToCloud()
    - Modify toggleTask() to call syncToCloud()
    - Modify deleteTask() to call syncToCloud()
    - Modify addSubtask() to call syncToCloud()
    - Modify toggleSubtask() to call syncToCloud()
    - Modify deleteSubtask() to call syncToCloud()
    - _Requirements: 2.1, 2.2, 2.3_

  - [x] 11.4 Write integration tests for TodoApp with auth


    - Test complete auth flow
    - Test task CRUD with sync
    - Test offline/online scenarios
    - _Requirements: 1.1, 1.4, 2.1, 2.2, 2.3, 2.4_

- [x] 12. Create environment configuration




  - [x] 12.1 Create config.js with environment detection


    - Define config for local, dev, staging, production
    - Implement automatic environment detection
    - Export appropriate config based on hostname
    - _Requirements: 7.3, 7.4_

  - [x] 12.2 Write property test for environment-based configuration


    - **Property 17: Environment-based configuration**
    - **Validates: Requirements 7.4**

  - [x] 12.3 Create .env.example file


    - Document required environment variables
    - Provide example values
    - _Requirements: 7.4_

- [x] 13. Update HTML and CSS



  - [x] 13.1 Update index.html




    - Add Google OAuth library script
    - Add new script tags for auth-manager, api-client, sync-manager, auth-ui
    - Add auth UI container elements
    - Add sync status indicator element
    - _Requirements: 1.1, 1.4, 6.1_


  - [x] 13.2 Update styles.css




    - Add styles for sign-in screen
    - Add styles for user profile display
    - Add styles for migration prompt dialog
    - Add styles for sync status indicators
    - Ensure mobile responsiveness for new UI elements
    - _Requirements: 1.1, 1.4, 5.2, 6.1, 6.2, 6.3_

- [x] 14. Checkpoint - Test complete local implementation




  - Ensure all tests pass, ask the user if questions arise.

- [x] 15. Create backend package.json and dependencies




  - [x] 15.1 Initialize backend package.json

    - Add express dependency
    - Add cors dependency
    - Add google-auth-library dependency
    - Add start script for local-server.js
    - _Requirements: 7.1_

  - [x] 15.2 Create backend README.md

    - Document local server setup
    - Document environment variables
    - Document API endpoints
    - _Requirements: 7.1_

- [x] 16. Local testing and validation





  - [x] 16.1 Test Google OAuth flow locally

    - Verify sign-in works with Google account
    - Verify token is stored correctly
    - Verify sign-out clears session
    - _Requirements: 1.2, 1.3, 1.5_

  - [x] 16.2 Test task CRUD operations locally

    - Create tasks and verify they appear
    - Update tasks and verify changes persist
    - Delete tasks and verify removal
    - Test subtask operations
    - _Requirements: 2.1, 2.2, 2.3_

  - [x] 16.3 Test user data isolation locally

    - Sign in with first Google account, create tasks
    - Sign out and sign in with second Google account
    - Verify second user sees no tasks from first user
    - Create tasks for second user
    - Sign out and sign in as first user again
    - Verify first user's tasks are still there
    - _Requirements: 3.2, 3.3_

  - [x] 16.4 Test offline/online scenarios

    - Create tasks while online
    - Stop local backend server
    - Attempt to create/update tasks (should queue)
    - Restart local backend server
    - Verify queued operations sync automatically
    - _Requirements: 2.5, 6.5_

  - [x] 16.5 Test migration flow

    - Create tasks in localStorage (without auth)
    - Sign in with Google account
    - Verify migration prompt appears
    - Confirm migration
    - Verify all tasks uploaded to cloud
    - Verify localStorage is cleared
    - _Requirements: 5.1, 5.2, 5.3, 5.4_

  - [x] 16.6 Test sync status indicators

    - Verify syncing indicator during operations
    - Verify success indicator on completion
    - Verify error indicator on failure
    - Verify offline indicator when backend is down
    - _Requirements: 6.1, 6.2, 6.3, 6.4_

- [x] 17. Checkpoint - Complete local testing validation




  - Ensure all tests pass, ask the user if questions arise.

- [x] 18. Create AWS Lambda functions





  - [x] 18.1 Create lambda/getTasks.js


    - Implement token verification
    - Query DynamoDB for user's tasks
    - Return tasks array
    - _Requirements: 2.4, 3.1, 3.2_



  - [x] 18.2 Create lambda/createTask.js
    - Implement token verification
    - Validate task data
    - Store task in DynamoDB with userId
    - Return created task
    - _Requirements: 2.1, 3.1, 3.3_

  - [x] 18.3 Create lambda/updateTask.js
    - Implement token verification
    - Verify task ownership
    - Update task in DynamoDB
    - Return updated task
    - _Requirements: 2.2, 3.1_

  - [x] 18.4 Create lambda/deleteTask.js
    - Implement token verification
    - Verify task ownership
    - Delete task from DynamoDB
    - Return success response
    - _Requirements: 2.3, 3.1_

  - [x] 18.5 Create lambda/syncTasks.js
    - Implement token verification
    - Process batch operations
    - Return results for each operation
    - _Requirements: 2.5, 3.1_

  - [x] 18.6 Create lambda/utils/tokenVerifier.js


    - Implement verifyGoogleToken() function
    - Extract userId from token payload
    - Handle verification errors


    - _Requirements: 3.1, 3.4_

  - [x] 18.7 Create lambda/utils/dynamodb.js


    - Create DynamoDB client
    - Implement helper functions for CRUD operations
    - _Requirements: 4.5_

  - [x] 18.8 Write unit tests for Lambda functions
    - Test token verification
    - Test DynamoDB operations
    - Test error handling
    - _Requirements: 3.1, 3.4_

- [x] 19. Create AWS infrastructure as code







  - [x] 19.1 Create infrastructure/cloudformation.yaml
    - Define S3 bucket for frontend hosting
    - Define CloudFront distribution with SSL/TLS
    - Define DynamoDB table (TodoTasks with userId/taskId keys)
    - Define API Gateway REST API with CORS
    - Define Lambda function resources (getTasks, createTask, updateTask, deleteTask, syncTasks)
    - Define IAM roles and policies for Lambda execution
    - Define CloudWatch log groups for monitoring
    - Add parameters for environment and Google Client ID
    - Add outputs for CloudFront URL, API Gateway URL, and DynamoDB table name
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 8.1, 8.2_



  - [x] 19.2 Create infrastructure/deploy.sh deployment script
    - Package Lambda functions into deployment zip
    - Validate CloudFormation template
    - Deploy CloudFormation stack with parameters
    - Upload Lambda function code to AWS
    - Sync frontend files to S3 bucket
    - Invalidate CloudFront cache for immediate updates


    - Display deployment outputs (URLs and resource names)
    - _Requirements: 8.5_

  - [x] 19.3 Create infrastructure/README.md
    - Document AWS prerequisites (AWS CLI, credentials, permissions)
    - Document deployment steps with examples
    - Document required environment variables
    - Document how to update existing deployments
    - Document rollback procedures
    - Document cost estimates and resource cleanup
    - _Requirements: 8.1, 8.2, 8.3_

- [x] 20. AWS deployment preparation
  - [x] 20.1 Create deployment package structure
    - Create infrastructure/ directory
    - Prepare Lambda function deployment package
    - Create deployment configuration files
    - _Requirements: 8.1, 8.5_

  - [x] 20.2 Update frontend config for production
    - Add production environment configuration to config.js
    - Document how to set API Gateway URL after deployment
    - Add instructions for updating Google OAuth redirect URIs
    - _Requirements: 7.4_

  - [x] 20.3 Create deployment validation checklist
    - Document pre-deployment checks
    - Document post-deployment validation steps
    - Document testing procedures for AWS environment
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5_

- [x] 21. Update documentation for AWS deployment





  - [x] 21.1 Update main README.md with AWS deployment section

    - Add AWS deployment overview
    - Link to infrastructure/README.md for detailed steps
    - Add production environment setup instructions
    - Document how to configure production API URLs and Google Client ID
    - _Requirements: 1.1, 7.1, 8.1_

- [x] 22. Final checkpoint - Implementation complete





  - Ensure all tests pass, ask the user if questions arise.
