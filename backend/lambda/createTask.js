/**
 * Lambda Function: Create Task
 * Creates a new task for an authenticated user
 * Requirements: 2.1, 3.1, 3.3
 */

const { verifyGoogleToken, extractTokenFromHeaders } = require('./utils/tokenVerifier');
const { createTask } = require('./utils/dynamodb');

/**
 * Validate task data
 * @param {Object} task - Task object to validate
 * @returns {Object} - Validation result with isValid and errors
 */
function validateTaskData(task) {
  const errors = [];

  if (!task) {
    errors.push('Task data is required');
    return { isValid: false, errors };
  }

  if (!task.text || typeof task.text !== 'string') {
    errors.push('Task text is required and must be a string');
  } else if (task.text.length > 500) {
    errors.push('Task text must not exceed 500 characters');
  }

  if (!task.id && !task.taskId) {
    errors.push('Task must have an id or taskId');
  }

  if (task.completed !== undefined && typeof task.completed !== 'boolean') {
    errors.push('Task completed must be a boolean');
  }

  if (task.subtasks !== undefined && !Array.isArray(task.subtasks)) {
    errors.push('Task subtasks must be an array');
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}

/**
 * Lambda handler for POST /tasks
 * @param {Object} event - API Gateway event object
 * @returns {Object} - API Gateway response object
 */
exports.handler = async (event) => {
  console.log('POST /tasks - Request received');

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
    const taskData = body.task;

    // Validate task data (Requirement 2.1)
    const validation = validateTaskData(taskData);
    if (!validation.isValid) {
      return {
        statusCode: 400,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ 
          error: 'Invalid task data',
          details: validation.errors 
        })
      };
    }

    // Store task in DynamoDB with userId (Requirement 3.3)
    const createdTask = await createTask(userId, taskData);
    console.log(`Created task ${createdTask.taskId} for user ${userId}`);

    // Return created task (Requirement 2.1)
    return {
      statusCode: 201,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ 
        task: createdTask,
        taskId: createdTask.taskId 
      })
    };

  } catch (error) {
    console.error('Error in createTask:', error);

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
