const express = require('express');
const cors = require('cors');
const { OAuth2Client } = require('google-auth-library');

const app = express();
const PORT = process.env.PORT || 3000;

// In-memory storage for local testing (keyed by userId:taskId)
const localDB = new Map();

// Initialize Google OAuth client
const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

// Middleware
app.use(cors());
app.use(express.json());

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    environment: 'local'
  });
});

// Token verification middleware
async function verifyToken(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ 
        error: {
          code: 'NO_TOKEN',
          message: 'No token provided'
        }
      });
    }
    
    const token = authHeader.replace('Bearer ', '');
    
    const ticket = await client.verifyIdToken({
      idToken: token,
      audience: process.env.GOOGLE_CLIENT_ID
    });
    
    const payload = ticket.getPayload();
    req.userId = payload.sub; // Google user ID
    req.userEmail = payload.email;
    req.userName = payload.name;
    
    next();
  } catch (error) {
    console.error('Token verification failed:', error.message);
    res.status(401).json({ 
      error: {
        code: 'INVALID_TOKEN',
        message: 'Invalid or expired token'
      }
    });
  }
}

// Helper functions for in-memory storage with user isolation
const storage = {
  // Get all tasks for a specific user
  getUserTasks(userId) {
    const tasks = [];
    for (const [key, task] of localDB.entries()) {
      if (key.startsWith(`${userId}:`)) {
        tasks.push(task);
      }
    }
    return tasks;
  },
  
  // Get a specific task for a user
  getUserTask(userId, taskId) {
    const key = `${userId}:${taskId}`;
    return localDB.get(key);
  },
  
  // Create or update a task for a user
  setUserTask(userId, taskId, task) {
    const key = `${userId}:${taskId}`;
    const taskData = {
      ...task,
      userId,
      taskId,
      updatedAt: new Date().toISOString()
    };
    localDB.set(key, taskData);
    return taskData;
  },
  
  // Delete a task for a user
  deleteUserTask(userId, taskId) {
    const key = `${userId}:${taskId}`;
    return localDB.delete(key);
  },
  
  // Check if a task belongs to a user
  taskBelongsToUser(userId, taskId) {
    const key = `${userId}:${taskId}`;
    return localDB.has(key);
  }
};

// GET /tasks - Retrieve all tasks for authenticated user
app.get('/tasks', verifyToken, (req, res) => {
  try {
    const tasks = storage.getUserTasks(req.userId);
    res.json({ tasks });
  } catch (error) {
    console.error('Error getting tasks:', error);
    res.status(500).json({ 
      error: {
        code: 'SERVER_ERROR',
        message: 'Failed to retrieve tasks'
      }
    });
  }
});

// POST /tasks - Create a new task
app.post('/tasks', verifyToken, (req, res) => {
  try {
    const { task } = req.body;
    
    if (!task || !task.id) {
      return res.status(400).json({ 
        error: {
          code: 'INVALID_DATA',
          message: 'Task data is required with an id'
        }
      });
    }
    
    const savedTask = storage.setUserTask(req.userId, task.id, task);
    res.status(201).json({ 
      task: savedTask,
      taskId: savedTask.taskId
    });
  } catch (error) {
    console.error('Error creating task:', error);
    res.status(500).json({ 
      error: {
        code: 'SERVER_ERROR',
        message: 'Failed to create task'
      }
    });
  }
});

// PUT /tasks/:taskId - Update an existing task
app.put('/tasks/:taskId', verifyToken, (req, res) => {
  try {
    const { taskId } = req.params;
    const { updates } = req.body;
    
    if (!storage.taskBelongsToUser(req.userId, taskId)) {
      return res.status(404).json({ 
        error: {
          code: 'TASK_NOT_FOUND',
          message: 'Task not found or does not belong to user'
        }
      });
    }
    
    const existingTask = storage.getUserTask(req.userId, taskId);
    const updatedTask = storage.setUserTask(req.userId, taskId, {
      ...existingTask,
      ...updates
    });
    
    res.json({ task: updatedTask });
  } catch (error) {
    console.error('Error updating task:', error);
    res.status(500).json({ 
      error: {
        code: 'SERVER_ERROR',
        message: 'Failed to update task'
      }
    });
  }
});

// DELETE /tasks/:taskId - Delete a task
app.delete('/tasks/:taskId', verifyToken, (req, res) => {
  try {
    const { taskId } = req.params;
    
    if (!storage.taskBelongsToUser(req.userId, taskId)) {
      return res.status(404).json({ 
        error: {
          code: 'TASK_NOT_FOUND',
          message: 'Task not found or does not belong to user'
        }
      });
    }
    
    const deleted = storage.deleteUserTask(req.userId, taskId);
    res.json({ success: deleted });
  } catch (error) {
    console.error('Error deleting task:', error);
    res.status(500).json({ 
      error: {
        code: 'SERVER_ERROR',
        message: 'Failed to delete task'
      }
    });
  }
});

// POST /tasks/sync - Batch sync operations
app.post('/tasks/sync', verifyToken, async (req, res) => {
  try {
    const { operations } = req.body;
    
    if (!Array.isArray(operations)) {
      return res.status(400).json({ 
        error: {
          code: 'INVALID_DATA',
          message: 'Operations must be an array'
        }
      });
    }
    
    const results = [];
    
    for (const operation of operations) {
      try {
        switch (operation.type) {
          case 'CREATE':
            if (!operation.task || !operation.task.id) {
              results.push({ 
                operation, 
                success: false, 
                error: 'Task data with id is required' 
              });
              break;
            }
            const createdTask = storage.setUserTask(
              req.userId, 
              operation.task.id, 
              operation.task
            );
            results.push({ operation, success: true, task: createdTask });
            break;
          
          case 'UPDATE':
            if (!operation.taskId) {
              results.push({ 
                operation, 
                success: false, 
                error: 'taskId is required' 
              });
              break;
            }
            if (!storage.taskBelongsToUser(req.userId, operation.taskId)) {
              results.push({ 
                operation, 
                success: false, 
                error: 'Task not found' 
              });
              break;
            }
            const existingTask = storage.getUserTask(req.userId, operation.taskId);
            const updatedTask = storage.setUserTask(
              req.userId, 
              operation.taskId, 
              { ...existingTask, ...operation.task }
            );
            results.push({ operation, success: true, task: updatedTask });
            break;
          
          case 'DELETE':
            if (!operation.taskId) {
              results.push({ 
                operation, 
                success: false, 
                error: 'taskId is required' 
              });
              break;
            }
            if (!storage.taskBelongsToUser(req.userId, operation.taskId)) {
              results.push({ 
                operation, 
                success: false, 
                error: 'Task not found' 
              });
              break;
            }
            storage.deleteUserTask(req.userId, operation.taskId);
            results.push({ operation, success: true });
            break;
          
          default:
            results.push({ 
              operation, 
              success: false, 
              error: `Unknown operation type: ${operation.type}` 
            });
        }
      } catch (error) {
        results.push({ 
          operation, 
          success: false, 
          error: error.message 
        });
      }
    }
    
    res.json({ results });
  } catch (error) {
    console.error('Error syncing tasks:', error);
    res.status(500).json({ 
      error: {
        code: 'SERVER_ERROR',
        message: 'Failed to sync tasks'
      }
    });
  }
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ 
    error: {
      code: 'SERVER_ERROR',
      message: 'An unexpected error occurred'
    }
  });
});

// Start server only if not being imported for testing
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Local backend server running on http://localhost:${PORT}`);
    console.log(`Health check: http://localhost:${PORT}/health`);
    
    if (!process.env.GOOGLE_CLIENT_ID) {
      console.warn('WARNING: GOOGLE_CLIENT_ID environment variable is not set!');
      console.warn('Set it with: export GOOGLE_CLIENT_ID="your-client-id"');
    } else {
      console.log('Google OAuth client configured');
    }
  });
}

// Export for testing
module.exports = { app, storage, verifyToken };
