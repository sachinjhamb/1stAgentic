/**
 * DynamoDB Helper Utilities
 * Provides CRUD operations for task data in DynamoDB
 * Requirements: 4.5
 */

const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { 
  DynamoDBDocumentClient, 
  QueryCommand, 
  PutCommand, 
  UpdateCommand, 
  DeleteCommand,
  GetCommand
} = require('@aws-sdk/lib-dynamodb');

// Initialize DynamoDB client
const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client);

const TABLE_NAME = process.env.DYNAMODB_TABLE_NAME || 'TodoTasks';

/**
 * Get all tasks for a specific user
 * @param {string} userId - The user's Google ID
 * @returns {Promise<Array>} - Array of task objects
 */
async function getUserTasks(userId) {
  const command = new QueryCommand({
    TableName: TABLE_NAME,
    KeyConditionExpression: 'userId = :userId',
    ExpressionAttributeValues: {
      ':userId': userId
    }
  });

  const response = await docClient.send(command);
  return response.Items || [];
}

/**
 * Get a specific task by userId and taskId
 * @param {string} userId - The user's Google ID
 * @param {string} taskId - The task ID
 * @returns {Promise<Object|null>} - Task object or null if not found
 */
async function getTask(userId, taskId) {
  const command = new GetCommand({
    TableName: TABLE_NAME,
    Key: {
      userId,
      taskId
    }
  });

  const response = await docClient.send(command);
  return response.Item || null;
}

/**
 * Create a new task
 * @param {string} userId - The user's Google ID
 * @param {Object} task - Task object with taskId and other properties
 * @returns {Promise<Object>} - The created task
 */
async function createTask(userId, task) {
  const timestamp = new Date().toISOString();
  
  const item = {
    userId,
    taskId: task.taskId || task.id,
    text: task.text,
    completed: task.completed || false,
    createdAt: task.createdAt || timestamp,
    dueDateTime: task.dueDateTime || null,
    subtasks: task.subtasks || [],
    updatedAt: timestamp,
    version: 1
  };

  const command = new PutCommand({
    TableName: TABLE_NAME,
    Item: item
  });

  await docClient.send(command);
  return item;
}

/**
 * Update an existing task
 * @param {string} userId - The user's Google ID
 * @param {string} taskId - The task ID
 * @param {Object} updates - Object containing fields to update
 * @returns {Promise<Object>} - The updated task
 */
async function updateTask(userId, taskId, updates) {
  const timestamp = new Date().toISOString();
  
  // Build update expression dynamically
  const updateExpressions = [];
  const expressionAttributeNames = {};
  const expressionAttributeValues = {
    ':updatedAt': timestamp,
    ':inc': 1
  };

  // Add each update field to the expression
  Object.keys(updates).forEach((key, index) => {
    if (key !== 'userId' && key !== 'taskId') {
      const attrName = `#attr${index}`;
      const attrValue = `:val${index}`;
      
      updateExpressions.push(`${attrName} = ${attrValue}`);
      expressionAttributeNames[attrName] = key;
      expressionAttributeValues[attrValue] = updates[key];
    }
  });

  // Always update timestamp and increment version
  updateExpressions.push('#updatedAt = :updatedAt');
  updateExpressions.push('#version = #version + :inc');
  expressionAttributeNames['#updatedAt'] = 'updatedAt';
  expressionAttributeNames['#version'] = 'version';

  const command = new UpdateCommand({
    TableName: TABLE_NAME,
    Key: {
      userId,
      taskId
    },
    UpdateExpression: `SET ${updateExpressions.join(', ')}`,
    ExpressionAttributeNames: expressionAttributeNames,
    ExpressionAttributeValues: expressionAttributeValues,
    ReturnValues: 'ALL_NEW'
  });

  const response = await docClient.send(command);
  return response.Attributes;
}

/**
 * Delete a task
 * @param {string} userId - The user's Google ID
 * @param {string} taskId - The task ID
 * @returns {Promise<boolean>} - True if deleted successfully
 */
async function deleteTask(userId, taskId) {
  const command = new DeleteCommand({
    TableName: TABLE_NAME,
    Key: {
      userId,
      taskId
    }
  });

  await docClient.send(command);
  return true;
}

/**
 * Verify task ownership
 * @param {string} userId - The user's Google ID
 * @param {string} taskId - The task ID
 * @returns {Promise<boolean>} - True if user owns the task
 */
async function verifyTaskOwnership(userId, taskId) {
  const task = await getTask(userId, taskId);
  return task !== null;
}

module.exports = {
  getUserTasks,
  getTask,
  createTask,
  updateTask,
  deleteTask,
  verifyTaskOwnership
};
