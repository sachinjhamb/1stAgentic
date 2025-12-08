/**
 * Lambda Function: Get Tasks
 * Retrieves all tasks for an authenticated user
 * Requirements: 2.4, 3.1, 3.2
 */

const { verifyGoogleToken, extractTokenFromHeaders } = require('./utils/tokenVerifier');
const { getUserTasks } = require('./utils/dynamodb');

/**
 * Lambda handler for GET /tasks
 * @param {Object} event - API Gateway event object
 * @returns {Object} - API Gateway response object
 */
exports.handler = async (event) => {
  console.log('GET /tasks - Request received');

  try {
    // Extract and verify the ID token
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

    // Verify token and extract userId (Requirement 3.1)
    const userId = await verifyGoogleToken(token);
    console.log(`Authenticated user: ${userId}`);

    // Query DynamoDB for user's tasks (Requirement 3.2)
    const tasks = await getUserTasks(userId);
    console.log(`Retrieved ${tasks.length} tasks for user ${userId}`);

    // Return tasks array (Requirement 2.4)
    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ tasks })
    };

  } catch (error) {
    console.error('Error in getTasks:', error);

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
