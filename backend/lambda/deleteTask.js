/**
 * Lambda Function: Delete Task
 * Deletes a task for an authenticated user
 * Requirements: 2.3, 3.1
 */

const { verifyGoogleToken, extractTokenFromHeaders } = require('./utils/tokenVerifier');
const { deleteTask, verifyTaskOwnership } = require('./utils/dynamodb');

/**
 * Lambda handler for DELETE /tasks/{taskId}
 * @param {Object} event - API Gateway event object
 * @returns {Object} - API Gateway response object
 */
exports.handler = async (event) => {
  console.log('DELETE /tasks/{taskId} - Request received');

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

    // Verify task ownership (Requirement 2.3)
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

    // Delete task from DynamoDB (Requirement 2.3)
    await deleteTask(userId, taskId);
    console.log(`Deleted task ${taskId} for user ${userId}`);

    // Return success response (Requirement 2.3)
    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ 
        success: true,
        message: 'Task deleted successfully' 
      })
    };

  } catch (error) {
    console.error('Error in deleteTask:', error);

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
