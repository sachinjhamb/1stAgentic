/**
 * Lambda Function: Update Task
 * Updates an existing task for an authenticated user
 * Requirements: 2.2, 3.1
 */

const { verifyGoogleToken, extractTokenFromHeaders } = require('./utils/tokenVerifier');
const { updateTask, verifyTaskOwnership } = require('./utils/dynamodb');

/**
 * Lambda handler for PUT /tasks/{taskId}
 * @param {Object} event - API Gateway event object
 * @returns {Object} - API Gateway response object
 */
exports.handler = async (event) => {
  console.log('PUT /tasks/{taskId} - Request received');

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

    // Extract taskId from path parameters
    const taskId = event.pathParameters?.taskId;
    
    if (!taskId) {
      return {
        statusCode: 400,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ 
          error: 'Task ID is required' 
        })
      };
    }

    // Verify task ownership (Requirement 2.2)
    const ownsTask = await verifyTaskOwnership(userId, taskId);
    
    if (!ownsTask) {
      return {
        statusCode: 404,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ 
          error: 'Task not found or access denied' 
        })
      };
    }

    // Parse request body
    const body = JSON.parse(event.body || '{}');
    const updates = body.updates || body;

    // Validate that there are updates to apply
    if (Object.keys(updates).length === 0) {
      return {
        statusCode: 400,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ 
          error: 'No updates provided' 
        })
      };
    }

    // Update task in DynamoDB (Requirement 2.2)
    const updatedTask = await updateTask(userId, taskId, updates);
    console.log(`Updated task ${taskId} for user ${userId}`);

    // Return updated task (Requirement 2.2)
    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ task: updatedTask })
    };

  } catch (error) {
    console.error('Error in updateTask:', error);

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
