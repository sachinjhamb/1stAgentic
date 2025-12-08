/**
 * Unit Tests for Lambda Functions
 * Tests token verification, DynamoDB operations, and error handling
 * Requirements: 3.1, 3.4
 */

// Mock the dependencies before requiring the modules
jest.mock('./utils/tokenVerifier');
jest.mock('./utils/dynamodb');

const { verifyGoogleToken, extractTokenFromHeaders } = require('./utils/tokenVerifier');
const {
  getUserTasks,
  createTask,
  updateTask,
  deleteTask,
  verifyTaskOwnership
} = require('./utils/dynamodb');

// Import Lambda handlers
const { handler: getTasksHandler } = require('./getTasks');
const { handler: createTaskHandler } = require('./createTask');
const { handler: updateTaskHandler } = require('./updateTask');
const { handler: deleteTaskHandler } = require('./deleteTask');
const { handler: syncTasksHandler } = require('./syncTasks');

describe('Lambda Functions - Token Verification', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('getTasks should reject request without token', async () => {
    extractTokenFromHeaders.mockReturnValue(null);

    const event = {
      headers: {}
    };

    const response = await getTasksHandler(event);

    expect(response.statusCode).toBe(401);
    expect(JSON.parse(response.body).error).toContain('authorization token');
  });

  test('getTasks should reject request with invalid token', async () => {
    extractTokenFromHeaders.mockReturnValue('invalid-token');
    const authError = new Error('Invalid or expired token');
    authError.statusCode = 401;
    verifyGoogleToken.mockRejectedValue(authError);

    const event = {
      headers: {
        Authorization: 'Bearer invalid-token'
      }
    };

    const response = await getTasksHandler(event);

    expect(response.statusCode).toBe(401);
    expect(JSON.parse(response.body).error).toContain('Invalid or expired token');
  });

  test('createTask should verify token before creating task', async () => {
    extractTokenFromHeaders.mockReturnValue('valid-token');
    verifyGoogleToken.mockResolvedValue('user123');
    createTask.mockResolvedValue({
      userId: 'user123',
      taskId: 'task1',
      text: 'Test task',
      completed: false
    });

    const event = {
      headers: {
        Authorization: 'Bearer valid-token'
      },
      body: JSON.stringify({
        task: {
          id: 'task1',
          text: 'Test task'
        }
      })
    };

    await createTaskHandler(event);

    expect(verifyGoogleToken).toHaveBeenCalledWith('valid-token');
    expect(createTask).toHaveBeenCalledWith('user123', expect.any(Object));
  });
});

describe('Lambda Functions - DynamoDB Operations', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    extractTokenFromHeaders.mockReturnValue('valid-token');
    verifyGoogleToken.mockResolvedValue('user123');
  });

  test('getTasks should retrieve user tasks from DynamoDB', async () => {
    const mockTasks = [
      { userId: 'user123', taskId: 'task1', text: 'Task 1' },
      { userId: 'user123', taskId: 'task2', text: 'Task 2' }
    ];
    getUserTasks.mockResolvedValue(mockTasks);

    const event = {
      headers: {
        Authorization: 'Bearer valid-token'
      }
    };

    const response = await getTasksHandler(event);

    expect(response.statusCode).toBe(200);
    expect(getUserTasks).toHaveBeenCalledWith('user123');
    
    const body = JSON.parse(response.body);
    expect(body.tasks).toEqual(mockTasks);
    expect(body.tasks).toHaveLength(2);
  });

  test('createTask should store task with userId in DynamoDB', async () => {
    const taskData = {
      id: 'task1',
      text: 'New task',
      completed: false
    };

    createTask.mockResolvedValue({
      userId: 'user123',
      taskId: 'task1',
      ...taskData
    });

    const event = {
      headers: {
        Authorization: 'Bearer valid-token'
      },
      body: JSON.stringify({ task: taskData })
    };

    const response = await createTaskHandler(event);

    expect(response.statusCode).toBe(201);
    expect(createTask).toHaveBeenCalledWith('user123', taskData);
    
    const body = JSON.parse(response.body);
    expect(body.task.userId).toBe('user123');
    expect(body.task.text).toBe('New task');
  });

  test('updateTask should verify ownership before updating', async () => {
    verifyTaskOwnership.mockResolvedValue(true);
    updateTask.mockResolvedValue({
      userId: 'user123',
      taskId: 'task1',
      text: 'Updated task',
      completed: true
    });

    const event = {
      headers: {
        Authorization: 'Bearer valid-token'
      },
      pathParameters: {
        taskId: 'task1'
      },
      body: JSON.stringify({
        updates: { completed: true }
      })
    };

    const response = await updateTaskHandler(event);

    expect(response.statusCode).toBe(200);
    expect(verifyTaskOwnership).toHaveBeenCalledWith('user123', 'task1');
    expect(updateTask).toHaveBeenCalledWith('user123', 'task1', { completed: true });
  });

  test('updateTask should reject if user does not own task', async () => {
    verifyTaskOwnership.mockResolvedValue(false);

    const event = {
      headers: {
        Authorization: 'Bearer valid-token'
      },
      pathParameters: {
        taskId: 'task1'
      },
      body: JSON.stringify({
        updates: { completed: true }
      })
    };

    const response = await updateTaskHandler(event);

    expect(response.statusCode).toBe(404);
    expect(updateTask).not.toHaveBeenCalled();
  });

  test('deleteTask should verify ownership before deleting', async () => {
    verifyTaskOwnership.mockResolvedValue(true);
    deleteTask.mockResolvedValue(true);

    const event = {
      headers: {
        Authorization: 'Bearer valid-token'
      },
      pathParameters: {
        taskId: 'task1'
      }
    };

    const response = await deleteTaskHandler(event);

    expect(response.statusCode).toBe(200);
    expect(verifyTaskOwnership).toHaveBeenCalledWith('user123', 'task1');
    expect(deleteTask).toHaveBeenCalledWith('user123', 'task1');
    
    const body = JSON.parse(response.body);
    expect(body.success).toBe(true);
  });

  test('deleteTask should reject if user does not own task', async () => {
    verifyTaskOwnership.mockResolvedValue(false);

    const event = {
      headers: {
        Authorization: 'Bearer valid-token'
      },
      pathParameters: {
        taskId: 'task1'
      }
    };

    const response = await deleteTaskHandler(event);

    expect(response.statusCode).toBe(404);
    expect(deleteTask).not.toHaveBeenCalled();
  });
});

describe('Lambda Functions - Error Handling', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    extractTokenFromHeaders.mockReturnValue('valid-token');
    verifyGoogleToken.mockResolvedValue('user123');
  });

  test('createTask should validate task data', async () => {
    const event = {
      headers: {
        Authorization: 'Bearer valid-token'
      },
      body: JSON.stringify({
        task: {
          // Missing required 'text' field
          id: 'task1'
        }
      })
    };

    const response = await createTaskHandler(event);

    expect(response.statusCode).toBe(400);
    expect(createTask).not.toHaveBeenCalled();
    
    const body = JSON.parse(response.body);
    expect(body.error).toContain('Invalid task data');
  });

  test('createTask should reject task with text exceeding 500 characters', async () => {
    const longText = 'a'.repeat(501);
    
    const event = {
      headers: {
        Authorization: 'Bearer valid-token'
      },
      body: JSON.stringify({
        task: {
          id: 'task1',
          text: longText
        }
      })
    };

    const response = await createTaskHandler(event);

    expect(response.statusCode).toBe(400);
    expect(createTask).not.toHaveBeenCalled();
  });

  test('updateTask should handle missing taskId', async () => {
    const event = {
      headers: {
        Authorization: 'Bearer valid-token'
      },
      pathParameters: {},
      body: JSON.stringify({
        updates: { completed: true }
      })
    };

    const response = await updateTaskHandler(event);

    expect(response.statusCode).toBe(400);
    expect(JSON.parse(response.body).error).toContain('Task ID is required');
  });

  test('getTasks should handle DynamoDB errors', async () => {
    getUserTasks.mockRejectedValue(new Error('DynamoDB connection failed'));

    const event = {
      headers: {
        Authorization: 'Bearer valid-token'
      }
    };

    const response = await getTasksHandler(event);

    expect(response.statusCode).toBe(500);
    expect(JSON.parse(response.body).error).toContain('Internal server error');
  });

  test('createTask should handle invalid JSON', async () => {
    const event = {
      headers: {
        Authorization: 'Bearer valid-token'
      },
      body: 'invalid json{'
    };

    const response = await createTaskHandler(event);

    expect(response.statusCode).toBe(400);
    expect(JSON.parse(response.body).error).toContain('Invalid JSON');
  });
});

describe('Lambda Functions - Sync Operations', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    extractTokenFromHeaders.mockReturnValue('valid-token');
    verifyGoogleToken.mockResolvedValue('user123');
  });

  test('syncTasks should process CREATE operations', async () => {
    createTask.mockResolvedValue({
      userId: 'user123',
      taskId: 'task1',
      text: 'New task'
    });

    const event = {
      headers: {
        Authorization: 'Bearer valid-token'
      },
      body: JSON.stringify({
        operations: [
          {
            type: 'CREATE',
            task: {
              id: 'task1',
              text: 'New task'
            }
          }
        ]
      })
    };

    const response = await syncTasksHandler(event);

    expect(response.statusCode).toBe(200);
    expect(createTask).toHaveBeenCalledWith('user123', expect.any(Object));
    
    const body = JSON.parse(response.body);
    expect(body.results).toHaveLength(1);
    expect(body.results[0].success).toBe(true);
    expect(body.summary.succeeded).toBe(1);
  });

  test('syncTasks should process UPDATE operations', async () => {
    verifyTaskOwnership.mockResolvedValue(true);
    updateTask.mockResolvedValue({
      userId: 'user123',
      taskId: 'task1',
      text: 'Updated task'
    });

    const event = {
      headers: {
        Authorization: 'Bearer valid-token'
      },
      body: JSON.stringify({
        operations: [
          {
            type: 'UPDATE',
            taskId: 'task1',
            task: { text: 'Updated task' }
          }
        ]
      })
    };

    const response = await syncTasksHandler(event);

    expect(response.statusCode).toBe(200);
    expect(verifyTaskOwnership).toHaveBeenCalledWith('user123', 'task1');
    expect(updateTask).toHaveBeenCalled();
    
    const body = JSON.parse(response.body);
    expect(body.results[0].success).toBe(true);
  });

  test('syncTasks should process DELETE operations', async () => {
    verifyTaskOwnership.mockResolvedValue(true);
    deleteTask.mockResolvedValue(true);

    const event = {
      headers: {
        Authorization: 'Bearer valid-token'
      },
      body: JSON.stringify({
        operations: [
          {
            type: 'DELETE',
            taskId: 'task1'
          }
        ]
      })
    };

    const response = await syncTasksHandler(event);

    expect(response.statusCode).toBe(200);
    expect(verifyTaskOwnership).toHaveBeenCalledWith('user123', 'task1');
    expect(deleteTask).toHaveBeenCalledWith('user123', 'task1');
    
    const body = JSON.parse(response.body);
    expect(body.results[0].success).toBe(true);
  });

  test('syncTasks should process mixed batch operations', async () => {
    createTask.mockResolvedValue({ taskId: 'task1' });
    verifyTaskOwnership.mockResolvedValue(true);
    updateTask.mockResolvedValue({ taskId: 'task2' });
    deleteTask.mockResolvedValue(true);

    const event = {
      headers: {
        Authorization: 'Bearer valid-token'
      },
      body: JSON.stringify({
        operations: [
          { type: 'CREATE', task: { id: 'task1', text: 'New' } },
          { type: 'UPDATE', taskId: 'task2', task: { completed: true } },
          { type: 'DELETE', taskId: 'task3' }
        ]
      })
    };

    const response = await syncTasksHandler(event);

    expect(response.statusCode).toBe(200);
    
    const body = JSON.parse(response.body);
    expect(body.results).toHaveLength(3);
    expect(body.summary.total).toBe(3);
    expect(body.summary.succeeded).toBe(3);
    expect(body.summary.failed).toBe(0);
  });

  test('syncTasks should handle partial failures', async () => {
    createTask.mockResolvedValue({ taskId: 'task1' });
    verifyTaskOwnership.mockResolvedValue(false); // Second operation will fail

    const event = {
      headers: {
        Authorization: 'Bearer valid-token'
      },
      body: JSON.stringify({
        operations: [
          { type: 'CREATE', task: { id: 'task1', text: 'New' } },
          { type: 'UPDATE', taskId: 'task2', task: { completed: true } }
        ]
      })
    };

    const response = await syncTasksHandler(event);

    expect(response.statusCode).toBe(200);
    
    const body = JSON.parse(response.body);
    expect(body.results).toHaveLength(2);
    expect(body.results[0].success).toBe(true);
    expect(body.results[1].success).toBe(false);
    expect(body.summary.succeeded).toBe(1);
    expect(body.summary.failed).toBe(1);
  });

  test('syncTasks should reject empty operations array', async () => {
    const event = {
      headers: {
        Authorization: 'Bearer valid-token'
      },
      body: JSON.stringify({
        operations: []
      })
    };

    const response = await syncTasksHandler(event);

    expect(response.statusCode).toBe(400);
    expect(JSON.parse(response.body).error).toContain('At least one operation');
  });

  test('syncTasks should reject non-array operations', async () => {
    const event = {
      headers: {
        Authorization: 'Bearer valid-token'
      },
      body: JSON.stringify({
        operations: 'not-an-array'
      })
    };

    const response = await syncTasksHandler(event);

    expect(response.statusCode).toBe(400);
    expect(JSON.parse(response.body).error).toContain('must be an array');
  });
});
