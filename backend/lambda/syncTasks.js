/**
 * Lambda Function: Sync Tasks
 * Processes batch operations (CREATE, UPDATE, DELETE) for task synchronization
 * Requirements: 2.5, 3.1
 */

const { verifyGoogleToken, extractTokenFromHeaders } = require('./utils/tokenVerifier');
const { createTask, updateTask, deleteTask, verifyTaskOwnership } = require('./utils/dynamodb');

/**
 * Process a single sync operation
 * @param {string} userId - The authenticated user's ID
 * @param {Object} operation - The sync operation to process
 * @returns {Promise<Object>} - Result object with success status
 */
async function processOperation(userId, operation) {
  try {
    switch (operation.type) {
      case 'CREATE':
        if (!operation.task) {
          return {
            operation,
            success: false,
            error: 'Task data is required for CREATE operation'
          };
        }
        
        const createdTask = await createTask(userId, operation.task);
        return {
          operation,
          success: true,
          task: createdTask
        };

      case 'UPDATE':
        if (!operation.taskId) {
          return {
            operation,
            success: false,
            error: 'Task ID is required for UPDATE operation'
          };
        }
        
        // Verify ownership before updating
        const ownsTaskForUpdate = await verifyTaskOwnership(userId, operation.taskId);
        if (!ownsTaskForUpdate) {
          return {
            operation,
            success: false,
            error: 'Task not found or access denied'
          };
        }
        
        const updates = operation.task || operation.updates || {};
        const updatedTask = await updateTask(userId, operation.taskId, updates);
        return {
          operation,
          success: true,
          task: updatedTask
        };

      case 'DELETE':
        if (!operation.taskId) {
          return {
            operation,
            success: false,
            error: 'Task ID is required for DELETE operation'
          };
        }
        
        // Verify ownership before deleting
        const ownsTaskForDelete = await verifyTaskOwnership(userId, operation.taskId);
        if (!ownsTaskForDelete) {
          return {
            operation,
            success: false,
            error: 'Task not found or access denied'
          };
        }
        
        await deleteTask(userId, operation.taskId);
        return {
          operation,
          success: true
        };

      default:
        return {
          operation,
          success: false,
          error: `Unknown operation type: ${operation.type}`
        };
    }
  } catch (error) {
    console.error(`Error processing operation ${operation.type}:`, error);
    return {
      operation,
      success: false,
      error: error.message || 'Operation failed'
    };
  }
}

/**
 * Lambda handler for POST /tasks/sync
 * @param {Object} event - API Gateway event object
 * @returns {Object} - API Gateway response object
 */
exports.handler = async (event) => {
  console.log('POST /tasks/sync - Request received');

  try {
    // Extract and verify the ID token (Requirement 3.1)
    const token = extractTokenFromHeaders(event.headers);
    
    if (!token) {
      return {
        statusCode: 401,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ 
          error: 'No authorization token provided' 
        })
      };
    }

    const userId = await verifyGoogleToken(token);
    console.log(`Authenticated user: ${userId}`);

    // Parse request body
    const body = JSON.parse(event.body || '{}');
    const operations = body.operations;

    // Validate operations array
    if (!Array.isArray(operations)) {
      return {
        statusCode: 400,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ 
          error: 'Operations must be an array' 
        })
      };
    }

    if (operations.length === 0) {
      return {
        statusCode: 400,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ 
          error: 'At least one operation is required' 
        })
      };
    }

    // Process batch operations (Requirement 2.5)
    console.log(`Processing ${operations.length} sync operations`);
    const results = [];

    for (const operation of operations) {
      const result = await processOperation(userId, operation);
      results.push(result);
    }

    // Count successes and failures
    const successCount = results.filter(r => r.success).length;
    const failureCount = results.length - successCount;
    
    console.log(`Sync complete: ${successCount} succeeded, ${failureCount} failed`);

    // Return results for each operation (Requirement 2.5)
    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ 
        results,
        summary: {
          total: results.length,
          succeeded: successCount,
          failed: failureCount
        }
      })
    };

  } catch (error) {
    console.error('Error in syncTasks:', error);

    // Handle authentication errors
    if (error.statusCode === 401) {
      return {
        statusCode: 401,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ 
          error: error.message || 'Authentication failed' 
        })
      };
    }

    // Handle JSON parse errors
    if (error instanceof SyntaxError) {
      return {
        statusCode: 400,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ 
          error: 'Invalid JSON in request body' 
        })
      };
    }

    // Handle other errors
    return {
      statusCode: 500,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ 
        error: 'Internal server error',
        message: error.message 
      })
    };
  }
};
