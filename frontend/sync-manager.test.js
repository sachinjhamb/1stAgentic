const fc = require('fast-check');
const { SyncManager } = require('./sync-manager.js');

// Mock ApiClient for testing
class MockApiClient {
  constructor() {
    this.calls = [];
    this.shouldFail = false;
    this.failureType = 'NetworkError';
  }

  async createTask(task) {
    this.calls.push({ method: 'createTask', task });
    if (this.shouldFail) {
      const error = new Error('Network error');
      error.name = this.failureType;
      throw error;
    }
    return { task, taskId: task.id };
  }

  async updateTask(taskId, updates) {
    this.calls.push({ method: 'updateTask', taskId, updates });
    if (this.shouldFail) {
      const error = new Error('Network error');
      error.name = this.failureType;
      throw error;
    }
    return { id: taskId, ...updates };
  }

  async deleteTask(taskId) {
    this.calls.push({ method: 'deleteTask', taskId });
    if (this.shouldFail) {
      const error = new Error('Network error');
      error.name = this.failureType;
      throw error;
    }
    return { success: true };
  }

  async getTasks() {
    this.calls.push({ method: 'getTasks' });
    if (this.shouldFail) {
      const error = new Error('Network error');
      error.name = this.failureType;
      throw error;
    }
    return [];
  }

  async syncTasks(operations) {
    this.calls.push({ method: 'syncTasks', operations });
    if (this.shouldFail) {
      const error = new Error('Network error');
      error.name = this.failureType;
      throw error;
    }
    return operations.map(op => ({ operation: op, success: true }));
  }

  reset() {
    this.calls = [];
    this.shouldFail = false;
  }

  setFailure(shouldFail, type = 'NetworkError') {
    this.shouldFail = shouldFail;
    this.failureType = type;
  }
}

// Mock TaskManager for testing
class MockTaskManager {
  constructor() {
    this.tasks = [];
  }

  initializeTasks(tasks) {
    this.tasks = tasks;
  }

  getTasks() {
    return this.tasks;
  }
}

// Mock navigator.onLine
Object.defineProperty(global.navigator, 'onLine', {
  writable: true,
  value: true
});

// Mock localStorage
global.localStorage = {
  store: {},
  getItem(key) {
    return this.store[key] || null;
  },
  setItem(key, value) {
    this.store[key] = value;
  },
  removeItem(key) {
    delete this.store[key];
  },
  clear() {
    this.store = {};
  }
};

// Mock window event listeners
global.window = {
  addEventListener: jest.fn()
};

/**
 * Feature: google-auth-aws-hosting, Property 4: Task operations sync to cloud
 * For any task operation (create, update, delete) performed by an authenticated user,
 * the system should send the corresponding API request to the cloud backend
 * Validates: Requirements 2.1, 2.2, 2.3
 */
describe('Property 4: Task operations sync to cloud', () => {
  beforeEach(() => {
    global.navigator.onLine = true;
    localStorage.clear();
  });

  test('CREATE operations should call createTask API', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          taskId: fc.string({ minLength: 1, maxLength: 50 }),
          text: fc.string({ minLength: 1, maxLength: 500 }),
          completed: fc.boolean(),
          dueDateTime: fc.date().map(d => d.toISOString()),
          subtasks: fc.array(
            fc.record({
              id: fc.integer({ min: 1, max: 10000 }),
              text: fc.string({ minLength: 1, maxLength: 200 }),
              completed: fc.boolean()
            }),
            { maxLength: 5 }
          )
        }),
        async (task) => {
          const apiClient = new MockApiClient();
          const taskManager = new MockTaskManager();
          const syncManager = new SyncManager(apiClient, taskManager);

          // Create operation
          const operation = {
            type: 'CREATE',
            task: task,
            taskId: task.taskId
          };

          // Sync to cloud
          const result = await syncManager.syncToCloud(operation);

          // Property: Should call createTask API
          const createCalls = apiClient.calls.filter(c => c.method === 'createTask');
          if (createCalls.length !== 1) return false;

          // Should pass the task to the API
          if (JSON.stringify(createCalls[0].task) !== JSON.stringify(task)) return false;

          // Should return success
          if (!result.success) return false;

          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  test('UPDATE operations should call updateTask API', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          taskId: fc.string({ minLength: 1, maxLength: 50 }),
          updates: fc.record({
            text: fc.option(fc.string({ minLength: 1, maxLength: 500 })),
            completed: fc.option(fc.boolean()),
            dueDateTime: fc.option(fc.date().map(d => d.toISOString()))
          })
        }),
        async (testCase) => {
          const apiClient = new MockApiClient();
          const taskManager = new MockTaskManager();
          const syncManager = new SyncManager(apiClient, taskManager);

          // Update operation
          const operation = {
            type: 'UPDATE',
            taskId: testCase.taskId,
            task: testCase.updates
          };

          // Sync to cloud
          const result = await syncManager.syncToCloud(operation);

          // Property: Should call updateTask API
          const updateCalls = apiClient.calls.filter(c => c.method === 'updateTask');
          if (updateCalls.length !== 1) return false;

          // Should pass the taskId and updates to the API
          if (updateCalls[0].taskId !== testCase.taskId) return false;
          if (JSON.stringify(updateCalls[0].updates) !== JSON.stringify(testCase.updates)) return false;

          // Should return success
          if (!result.success) return false;

          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  test('DELETE operations should call deleteTask API', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1, maxLength: 50 }),
        async (taskId) => {
          const apiClient = new MockApiClient();
          const taskManager = new MockTaskManager();
          const syncManager = new SyncManager(apiClient, taskManager);

          // Delete operation
          const operation = {
            type: 'DELETE',
            taskId: taskId
          };

          // Sync to cloud
          const result = await syncManager.syncToCloud(operation);

          // Property: Should call deleteTask API
          const deleteCalls = apiClient.calls.filter(c => c.method === 'deleteTask');
          if (deleteCalls.length !== 1) return false;

          // Should pass the taskId to the API
          if (deleteCalls[0].taskId !== taskId) return false;

          // Should return success
          if (!result.success) return false;

          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  test('All operation types should send API requests when online', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.oneof(
          // CREATE operation
          fc.record({
            type: fc.constant('CREATE'),
            task: fc.record({
              taskId: fc.string({ minLength: 1, maxLength: 50 }),
              text: fc.string({ minLength: 1, maxLength: 500 }),
              completed: fc.boolean()
            })
          }).map(op => ({ ...op, taskId: op.task.taskId })),
          // UPDATE operation
          fc.record({
            type: fc.constant('UPDATE'),
            taskId: fc.string({ minLength: 1, maxLength: 50 }),
            task: fc.record({
              completed: fc.boolean()
            })
          }),
          // DELETE operation
          fc.record({
            type: fc.constant('DELETE'),
            taskId: fc.string({ minLength: 1, maxLength: 50 })
          })
        ),
        async (operation) => {
          const apiClient = new MockApiClient();
          const taskManager = new MockTaskManager();
          const syncManager = new SyncManager(apiClient, taskManager);

          // Ensure we're online
          global.navigator.onLine = true;

          // Sync to cloud
          const result = await syncManager.syncToCloud(operation);

          // Property: Should make an API call
          if (apiClient.calls.length !== 1) return false;

          // Property: Should return success when online
          if (!result.success) return false;

          // Property: API call method should match operation type
          const call = apiClient.calls[0];
          const expectedMethod = operation.type === 'CREATE' ? 'createTask' :
                                operation.type === 'UPDATE' ? 'updateTask' :
                                'deleteTask';
          
          if (call.method !== expectedMethod) return false;

          return true;
        }
      ),
      { numRuns: 100 }
    );
  });
});

/**
 * Feature: google-auth-aws-hosting, Property 5: Task loading on sign-in
 * For any user signing in, the system should fetch and load all tasks 
 * associated with that user's ID from the cloud backend
 * Validates: Requirements 2.4
 */
describe('Property 5: Task loading on sign-in', () => {
  beforeEach(() => {
    global.navigator.onLine = true;
    localStorage.clear();
  });

  test('syncFromCloud should call getTasks API', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(
          fc.record({
            id: fc.string({ minLength: 1, maxLength: 50 }),
            text: fc.string({ minLength: 1, maxLength: 500 }),
            completed: fc.boolean(),
            dueDateTime: fc.date().map(d => d.toISOString())
          }),
          { maxLength: 20 }
        ),
        async (mockTasks) => {
          const apiClient = new MockApiClient();
          // Override getTasks to return our mock tasks
          apiClient.getTasks = async function() {
            this.calls.push({ method: 'getTasks' });
            return mockTasks;
          };

          const taskManager = new MockTaskManager();
          const syncManager = new SyncManager(apiClient, taskManager);

          // Sync from cloud
          const tasks = await syncManager.syncFromCloud();

          // Property: Should call getTasks API
          const getCalls = apiClient.calls.filter(c => c.method === 'getTasks');
          if (getCalls.length !== 1) return false;

          // Property: Should return the tasks from API
          if (JSON.stringify(tasks) !== JSON.stringify(mockTasks)) return false;

          // Property: Should update task manager with loaded tasks
          if (JSON.stringify(taskManager.getTasks()) !== JSON.stringify(mockTasks)) return false;

          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  test('fullSync should load tasks from cloud', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(
          fc.record({
            id: fc.string({ minLength: 1, maxLength: 50 }),
            text: fc.string({ minLength: 1, maxLength: 500 }),
            completed: fc.boolean()
          }),
          { maxLength: 15 }
        ),
        async (mockTasks) => {
          const apiClient = new MockApiClient();
          apiClient.getTasks = async function() {
            this.calls.push({ method: 'getTasks' });
            return mockTasks;
          };

          const taskManager = new MockTaskManager();
          const syncManager = new SyncManager(apiClient, taskManager);

          // Full sync
          const result = await syncManager.fullSync();

          // Property: Should call getTasks API
          const getCalls = apiClient.calls.filter(c => c.method === 'getTasks');
          if (getCalls.length !== 1) return false;

          // Property: Should return success with cloud tasks
          if (!result.success) return false;
          if (JSON.stringify(result.cloudTasks) !== JSON.stringify(mockTasks)) return false;

          // Property: Task manager should have the loaded tasks
          if (JSON.stringify(taskManager.getTasks()) !== JSON.stringify(mockTasks)) return false;

          return true;
        }
      ),
      { numRuns: 100 }
    );
  });
});

/**
 * Feature: google-auth-aws-hosting, Property 6: Offline operation queueing
 * For any task operation that fails due to network unavailability,
 * the system should queue the operation locally and retry when connection is restored
 * Validates: Requirements 2.5
 */
describe('Property 6: Offline operation queueing', () => {
  beforeEach(() => {
    global.navigator.onLine = true;
    localStorage.clear();
  });

  test('Operations should be queued when offline', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.oneof(
          fc.record({
            type: fc.constant('CREATE'),
            task: fc.record({
              taskId: fc.string({ minLength: 1, maxLength: 50 }),
              text: fc.string({ minLength: 1, maxLength: 500 })
            })
          }).map(op => ({ ...op, taskId: op.task.taskId })),
          fc.record({
            type: fc.constant('UPDATE'),
            taskId: fc.string({ minLength: 1, maxLength: 50 }),
            task: fc.record({ completed: fc.boolean() })
          }),
          fc.record({
            type: fc.constant('DELETE'),
            taskId: fc.string({ minLength: 1, maxLength: 50 })
          })
        ),
        async (operation) => {
          const apiClient = new MockApiClient();
          const taskManager = new MockTaskManager();
          const syncManager = new SyncManager(apiClient, taskManager);

          // Go offline
          global.navigator.onLine = false;
          syncManager.isOnline = false;

          // Try to sync
          const result = await syncManager.syncToCloud(operation);

          // Property: Should not make API call when offline
          if (apiClient.calls.length !== 0) return false;

          // Property: Should queue the operation
          if (result.success !== false) return false;
          if (result.queued !== true) return false;

          // Property: Queue should contain the operation
          if (syncManager.getQueueLength() !== 1) return false;

          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  test('Failed operations should be queued', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(
          fc.oneof(
            fc.record({
              type: fc.constant('CREATE'),
              task: fc.record({
                taskId: fc.string({ minLength: 1, maxLength: 50 }),
                text: fc.string({ minLength: 1, maxLength: 500 })
              })
            }).map(op => ({ ...op, taskId: op.task.taskId })),
            fc.record({
              type: fc.constant('UPDATE'),
              taskId: fc.string({ minLength: 1, maxLength: 50 }),
              task: fc.record({ completed: fc.boolean() })
            })
          ),
          { minLength: 1, maxLength: 10 }
        ),
        async (operations) => {
          const apiClient = new MockApiClient();
          apiClient.setFailure(true, 'NetworkError');

          const taskManager = new MockTaskManager();
          const syncManager = new SyncManager(apiClient, taskManager);

          // Try to sync all operations (they will fail)
          for (const operation of operations) {
            await syncManager.syncToCloud(operation);
          }

          // Property: All operations should be queued
          if (syncManager.getQueueLength() !== operations.length) return false;

          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  test('Queue should persist to localStorage', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(
          fc.record({
            type: fc.constantFrom('CREATE', 'UPDATE', 'DELETE'),
            taskId: fc.string({ minLength: 1, maxLength: 50 })
          }),
          { minLength: 1, maxLength: 5 }
        ),
        async (operations) => {
          const apiClient = new MockApiClient();
          const taskManager = new MockTaskManager();
          const syncManager = new SyncManager(apiClient, taskManager);

          // Queue operations
          for (const operation of operations) {
            syncManager.queueOperation(operation);
          }

          // Property: Queue should be persisted to localStorage
          const stored = localStorage.getItem('syncQueue');
          if (!stored) return false;

          const parsedQueue = JSON.parse(stored);
          if (parsedQueue.length !== operations.length) return false;

          // Each operation should be in the stored queue
          for (let i = 0; i < operations.length; i++) {
            if (parsedQueue[i].type !== operations[i].type) return false;
            if (parsedQueue[i].taskId !== operations[i].taskId) return false;
          }

          return true;
        }
      ),
      { numRuns: 100 }
    );
  });
});

/**
 * Feature: google-auth-aws-hosting, Property 14: Automatic sync on reconnection
 * For any queued operations when the application reconnects to the network,
 * the system should automatically process all pending operations
 * Validates: Requirements 6.5
 */
describe('Property 14: Automatic sync on reconnection', () => {
  beforeEach(() => {
    global.navigator.onLine = true;
    localStorage.clear();
  });

  test('processQueue should sync all queued operations', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(
          fc.oneof(
            fc.record({
              type: fc.constant('CREATE'),
              task: fc.record({
                taskId: fc.string({ minLength: 1, maxLength: 50 }),
                text: fc.string({ minLength: 1, maxLength: 500 })
              })
            }).map(op => ({ ...op, taskId: op.task.taskId })),
            fc.record({
              type: fc.constant('UPDATE'),
              taskId: fc.string({ minLength: 1, maxLength: 50 }),
              task: fc.record({ completed: fc.boolean() })
            }),
            fc.record({
              type: fc.constant('DELETE'),
              taskId: fc.string({ minLength: 1, maxLength: 50 })
            })
          ),
          { minLength: 1, maxLength: 10 }
        ),
        async (operations) => {
          const apiClient = new MockApiClient();
          const taskManager = new MockTaskManager();
          const syncManager = new SyncManager(apiClient, taskManager);

          // Queue all operations
          for (const operation of operations) {
            syncManager.queueOperation(operation);
          }

          const initialQueueLength = syncManager.getQueueLength();

          // Process queue
          const results = await syncManager.processQueue();

          // Property: Should call syncTasks API with all operations
          const syncCalls = apiClient.calls.filter(c => c.method === 'syncTasks');
          if (syncCalls.length !== 1) return false;

          // Property: Should pass all queued operations to API
          if (syncCalls[0].operations.length !== initialQueueLength) return false;

          // Property: Should return results for all operations
          if (results.length !== initialQueueLength) return false;

          // Property: Queue should be empty after successful sync
          if (syncManager.getQueueLength() !== 0) return false;

          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  test('Failed operations should remain in queue', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(
          fc.record({
            type: fc.constantFrom('CREATE', 'UPDATE', 'DELETE'),
            taskId: fc.string({ minLength: 1, maxLength: 50 })
          }),
          { minLength: 2, maxLength: 5 }
        ),
        fc.integer({ min: 0, max: 100 }).filter(n => n > 0),
        async (operations, failureIndex) => {
          // Ensure failureIndex is within bounds
          const actualFailureIndex = failureIndex % operations.length;

          const apiClient = new MockApiClient();
          // Override syncTasks to fail some operations
          apiClient.syncTasks = async function(ops) {
            this.calls.push({ method: 'syncTasks', operations: ops });
            return ops.map((op, index) => ({
              operation: op,
              success: index !== actualFailureIndex
            }));
          };

          const taskManager = new MockTaskManager();
          const syncManager = new SyncManager(apiClient, taskManager);

          // Queue all operations
          for (const operation of operations) {
            syncManager.queueOperation(operation);
          }

          // Process queue
          await syncManager.processQueue();

          // Property: Failed operation should remain in queue
          if (syncManager.getQueueLength() !== 1) return false;

          // Property: The failed operation should be the one at failureIndex
          const remainingOp = syncManager.syncQueue[0];
          if (remainingOp.type !== operations[actualFailureIndex].type) return false;

          return true;
        }
      ),
      { numRuns: 100 }
    );
  });
});

/**
 * Unit tests for SyncManager
 * Tests queue management, sync operations, and conflict resolution
 * Requirements: 2.5
 */
describe('SyncManager Unit Tests', () => {
  let apiClient;
  let taskManager;
  let syncManager;

  beforeEach(() => {
    global.navigator.onLine = true;
    localStorage.clear();
    apiClient = new MockApiClient();
    taskManager = new MockTaskManager();
    syncManager = new SyncManager(apiClient, taskManager);
  });

  describe('Queue management', () => {
    test('should queue operations', () => {
      const operation = {
        type: 'CREATE',
        taskId: '1',
        task: { text: 'Test' }
      };

      syncManager.queueOperation(operation);

      expect(syncManager.getQueueLength()).toBe(1);
    });

    test('should persist queue to localStorage', () => {
      const operation = {
        type: 'CREATE',
        taskId: '1',
        task: { text: 'Test' }
      };

      syncManager.queueOperation(operation);

      const stored = localStorage.getItem('syncQueue');
      expect(stored).toBeTruthy();
      
      const parsed = JSON.parse(stored);
      expect(parsed).toHaveLength(1);
      expect(parsed[0].type).toBe('CREATE');
    });

    test('should load queue from localStorage', () => {
      const operations = [
        { type: 'CREATE', taskId: '1', task: { text: 'Test 1' } },
        { type: 'UPDATE', taskId: '2', task: { completed: true } }
      ];

      localStorage.setItem('syncQueue', JSON.stringify(operations));

      syncManager.loadQueue();

      expect(syncManager.getQueueLength()).toBe(2);
    });

    test('should clear queue', () => {
      syncManager.queueOperation({ type: 'CREATE', taskId: '1' });
      syncManager.queueOperation({ type: 'UPDATE', taskId: '2' });

      expect(syncManager.getQueueLength()).toBe(2);

      syncManager.clearQueue();

      expect(syncManager.getQueueLength()).toBe(0);
    });
  });

  describe('Sync operations', () => {
    test('should sync CREATE operation', async () => {
      const operation = {
        type: 'CREATE',
        taskId: '1',
        task: { id: '1', text: 'Test task' }
      };

      const result = await syncManager.syncToCloud(operation);

      expect(result.success).toBe(true);
      expect(apiClient.calls).toHaveLength(1);
      expect(apiClient.calls[0].method).toBe('createTask');
    });

    test('should sync UPDATE operation', async () => {
      const operation = {
        type: 'UPDATE',
        taskId: '1',
        task: { completed: true }
      };

      const result = await syncManager.syncToCloud(operation);

      expect(result.success).toBe(true);
      expect(apiClient.calls).toHaveLength(1);
      expect(apiClient.calls[0].method).toBe('updateTask');
    });

    test('should sync DELETE operation', async () => {
      const operation = {
        type: 'DELETE',
        taskId: '1'
      };

      const result = await syncManager.syncToCloud(operation);

      expect(result.success).toBe(true);
      expect(apiClient.calls).toHaveLength(1);
      expect(apiClient.calls[0].method).toBe('deleteTask');
    });

    test('should load tasks from cloud', async () => {
      const mockTasks = [
        { id: '1', text: 'Task 1', completed: false },
        { id: '2', text: 'Task 2', completed: true }
      ];

      apiClient.getTasks = async function() {
        this.calls.push({ method: 'getTasks' });
        return mockTasks;
      };

      const tasks = await syncManager.syncFromCloud();

      expect(tasks).toEqual(mockTasks);
      expect(taskManager.getTasks()).toEqual(mockTasks);
    });

    test('should perform full sync', async () => {
      const mockTasks = [{ id: '1', text: 'Task 1' }];

      apiClient.getTasks = async function() {
        this.calls.push({ method: 'getTasks' });
        return mockTasks;
      };

      // Queue an operation
      syncManager.queueOperation({ type: 'CREATE', taskId: '2', task: { text: 'Task 2' } });

      const result = await syncManager.fullSync();

      expect(result.success).toBe(true);
      expect(result.cloudTasks).toEqual(mockTasks);
      expect(result.queueResults).toHaveLength(1);
      expect(syncManager.getQueueLength()).toBe(0);
    });
  });

  describe('Sync status', () => {
    test('should update sync status', () => {
      const statuses = [];
      syncManager.onSyncStatusChange((status) => {
        statuses.push(status);
      });

      syncManager.updateSyncStatus('syncing');
      syncManager.updateSyncStatus('idle');

      expect(statuses).toContain('syncing');
      expect(statuses).toContain('idle');
    });

    test('should notify listeners on status change', () => {
      const listener = jest.fn();
      syncManager.onSyncStatusChange(listener);

      syncManager.updateSyncStatus('syncing');

      expect(listener).toHaveBeenCalledWith('syncing', 0);
    });

    test('should get current sync status', () => {
      expect(syncManager.getSyncStatus()).toBe('idle');

      syncManager.updateSyncStatus('syncing');

      expect(syncManager.getSyncStatus()).toBe('syncing');
    });
  });

  describe('Offline handling', () => {
    test('should queue operations when offline', async () => {
      global.navigator.onLine = false;
      syncManager.isOnline = false;

      const operation = {
        type: 'CREATE',
        taskId: '1',
        task: { text: 'Test' }
      };

      const result = await syncManager.syncToCloud(operation);

      expect(result.success).toBe(false);
      expect(result.queued).toBe(true);
      expect(syncManager.getQueueLength()).toBe(1);
      expect(apiClient.calls).toHaveLength(0);
    });

    test('should not process queue when offline', async () => {
      syncManager.queueOperation({ type: 'CREATE', taskId: '1' });

      global.navigator.onLine = false;
      syncManager.isOnline = false;

      const results = await syncManager.processQueue();

      expect(results).toEqual([]);
      expect(syncManager.getQueueLength()).toBe(1);
    });
  });

  describe('Migration', () => {
    // Mock StorageManager for migration tests
    class MockStorageManager {
      constructor() {
        this.tasks = [];
        this.cleared = false;
      }

      hasLocalTasks() {
        return this.tasks.length > 0;
      }

      loadTasks() {
        return this.tasks;
      }

      clearLocalTasks() {
        this.cleared = true;
        this.tasks = [];
      }

      setTasks(tasks) {
        this.tasks = tasks;
      }
    }

    /**
     * Unit tests for migration logic
     * Requirements: 5.1, 5.2, 5.3, 5.4, 5.5
     */
    describe('Local task detection', () => {
      test('should detect local tasks when storage has tasks', () => {
        const storageManager = new MockStorageManager();
        storageManager.setTasks([
          { id: '1', text: 'Task 1', completed: false },
          { id: '2', text: 'Task 2', completed: true }
        ]);

        const hasLocalTasks = syncManager.detectLocalTasks(storageManager);

        expect(hasLocalTasks).toBe(true);
      });

      test('should not detect local tasks when storage is empty', () => {
        const storageManager = new MockStorageManager();

        const hasLocalTasks = syncManager.detectLocalTasks(storageManager);

        expect(hasLocalTasks).toBe(false);
      });

      test('should handle null storage manager gracefully', () => {
        const hasLocalTasks = syncManager.detectLocalTasks(null);

        expect(hasLocalTasks).toBe(false);
      });

      test('should handle undefined storage manager gracefully', () => {
        const hasLocalTasks = syncManager.detectLocalTasks(undefined);

        expect(hasLocalTasks).toBe(false);
      });

      test('should detect single local task', () => {
        const storageManager = new MockStorageManager();
        storageManager.setTasks([{ id: '1', text: 'Single task' }]);

        const hasLocalTasks = syncManager.detectLocalTasks(storageManager);

        expect(hasLocalTasks).toBe(true);
      });

      test('should detect multiple local tasks', () => {
        const storageManager = new MockStorageManager();
        const tasks = Array.from({ length: 50 }, (_, i) => ({
          id: `task-${i}`,
          text: `Task ${i}`,
          completed: i % 2 === 0
        }));
        storageManager.setTasks(tasks);

        const hasLocalTasks = syncManager.detectLocalTasks(storageManager);

        expect(hasLocalTasks).toBe(true);
      });

      test('should get local tasks for migration', () => {
        const storageManager = new MockStorageManager();
        const tasks = [
          { id: '1', text: 'Task 1', completed: false },
          { id: '2', text: 'Task 2', completed: true }
        ];
        storageManager.setTasks(tasks);

        const localTasks = syncManager.getLocalTasksForMigration(storageManager);

        expect(localTasks).toEqual(tasks);
        expect(localTasks.length).toBe(2);
      });

      test('should return empty array when no local tasks exist', () => {
        const storageManager = new MockStorageManager();

        const localTasks = syncManager.getLocalTasksForMigration(storageManager);

        expect(localTasks).toEqual([]);
      });

      test('should handle null storage manager when getting tasks', () => {
        const localTasks = syncManager.getLocalTasksForMigration(null);

        expect(localTasks).toEqual([]);
      });

      test('should preserve task structure when getting local tasks', () => {
        const storageManager = new MockStorageManager();
        const tasks = [
          {
            id: '1',
            text: 'Task with subtasks',
            completed: false,
            createdAt: '2024-01-01T00:00:00.000Z',
            dueDateTime: '2024-01-02T00:00:00.000Z',
            subtasks: [
              { id: 1, text: 'Subtask 1', completed: false, priority: 'Normal', weight: 3 },
              { id: 2, text: 'Subtask 2', completed: true, priority: 'Important', weight: 5 }
            ]
          }
        ];
        storageManager.setTasks(tasks);

        const localTasks = syncManager.getLocalTasksForMigration(storageManager);

        expect(localTasks[0].subtasks).toHaveLength(2);
        expect(localTasks[0].subtasks[0].priority).toBe('Normal');
        expect(localTasks[0].dueDateTime).toBe('2024-01-02T00:00:00.000Z');
      });
    });

    describe('Migration confirmation flow', () => {
      test('should successfully migrate when user confirms', async () => {
        const storageManager = new MockStorageManager();
        const tasks = [
          { id: '1', text: 'Task 1', completed: false },
          { id: '2', text: 'Task 2', completed: true },
          { id: '3', text: 'Task 3', completed: false }
        ];
        storageManager.setTasks(tasks);

        // Simulate user confirmation by calling performMigration
        const result = await syncManager.performMigration(storageManager);

        expect(result.success).toBe(true);
        expect(result.migrated).toBe(3);
        expect(result.total).toBe(3);
        expect(storageManager.cleared).toBe(true);
      });

      test('should upload all tasks to cloud on confirmation', async () => {
        const storageManager = new MockStorageManager();
        const tasks = [
          { id: '1', text: 'Task 1', completed: false },
          { id: '2', text: 'Task 2', completed: true }
        ];
        storageManager.setTasks(tasks);

        await syncManager.performMigration(storageManager);

        // Verify API was called with all tasks
        const syncCalls = apiClient.calls.filter(c => c.method === 'syncTasks');
        expect(syncCalls).toHaveLength(1);
        expect(syncCalls[0].operations).toHaveLength(2);
        expect(syncCalls[0].operations[0].type).toBe('CREATE');
        expect(syncCalls[0].operations[1].type).toBe('CREATE');
      });

      test('should clear localStorage after successful confirmation', async () => {
        const storageManager = new MockStorageManager();
        storageManager.setTasks([
          { id: '1', text: 'Task 1' },
          { id: '2', text: 'Task 2' }
        ]);

        await syncManager.performMigration(storageManager);

        expect(storageManager.cleared).toBe(true);
        expect(storageManager.tasks).toEqual([]);
      });

      test('should handle confirmation with large number of tasks', async () => {
        const storageManager = new MockStorageManager();
        const tasks = Array.from({ length: 100 }, (_, i) => ({
          id: `task-${i}`,
          text: `Task ${i}`,
          completed: i % 2 === 0
        }));
        storageManager.setTasks(tasks);

        const result = await syncManager.performMigration(storageManager);

        expect(result.success).toBe(true);
        expect(result.migrated).toBe(100);
        expect(storageManager.cleared).toBe(true);
      });

      test('should preserve task data during confirmation migration', async () => {
        const storageManager = new MockStorageManager();
        const tasks = [
          {
            id: '1',
            text: 'Complex task',
            completed: false,
            createdAt: '2024-01-01T00:00:00.000Z',
            dueDateTime: '2024-01-02T00:00:00.000Z',
            subtasks: [
              { id: 1, text: 'Subtask 1', completed: false, notes: 'Note 1', priority: 'Urgent', weight: 8 }
            ]
          }
        ];
        storageManager.setTasks(tasks);

        await syncManager.performMigration(storageManager);

        const syncCalls = apiClient.calls.filter(c => c.method === 'syncTasks');
        const uploadedTask = syncCalls[0].operations[0].task;

        expect(uploadedTask.text).toBe('Complex task');
        expect(uploadedTask.createdAt).toBe('2024-01-01T00:00:00.000Z');
        expect(uploadedTask.subtasks[0].notes).toBe('Note 1');
        expect(uploadedTask.subtasks[0].priority).toBe('Urgent');
      });

      test('should not clear localStorage if migration fails during confirmation', async () => {
        const storageManager = new MockStorageManager();
        storageManager.setTasks([{ id: '1', text: 'Task 1' }]);

        // Make API fail
        apiClient.setFailure(true, 'ServerError');

        await expect(syncManager.performMigration(storageManager)).rejects.toThrow();

        // localStorage should NOT be cleared on error
        expect(storageManager.cleared).toBe(false);
        expect(storageManager.tasks.length).toBe(1);
      });

      test('should handle partial migration failure during confirmation', async () => {
        const storageManager = new MockStorageManager();
        storageManager.setTasks([
          { id: '1', text: 'Task 1' },
          { id: '2', text: 'Task 2' },
          { id: '3', text: 'Task 3' }
        ]);

        // Mock partial failure
        apiClient.syncTasks = async (operations) => {
          return [
            { operation: operations[0], success: true },
            { operation: operations[1], success: false },
            { operation: operations[2], success: true }
          ];
        };

        const result = await syncManager.performMigration(storageManager);

        expect(result.success).toBe(false);
        expect(result.migrated).toBe(2);
        expect(result.failed).toBe(1);
        // Should not clear localStorage on partial failure
        expect(storageManager.cleared).toBe(false);
      });

      test('should update sync status during confirmation migration', async () => {
        const storageManager = new MockStorageManager();
        storageManager.setTasks([{ id: '1', text: 'Task 1' }]);

        const statuses = [];
        syncManager.onSyncStatusChange((status) => {
          statuses.push(status);
        });

        await syncManager.performMigration(storageManager);

        expect(statuses).toContain('syncing');
        expect(statuses[statuses.length - 1]).toBe('idle');
      });
    });

    describe('Migration decline flow', () => {
      test('should not upload tasks when user declines', () => {
        const storageManager = new MockStorageManager();
        storageManager.setTasks([
          { id: '1', text: 'Task 1' },
          { id: '2', text: 'Task 2' }
        ]);

        // User declines migration - just clear local tasks without uploading
        syncManager.clearLocalTasksAfterMigration(storageManager);

        // Verify no API calls were made
        expect(apiClient.calls).toHaveLength(0);
        // Verify localStorage was cleared
        expect(storageManager.cleared).toBe(true);
      });

      test('should clear localStorage when user declines', () => {
        const storageManager = new MockStorageManager();
        storageManager.setTasks([
          { id: '1', text: 'Task 1' },
          { id: '2', text: 'Task 2' },
          { id: '3', text: 'Task 3' }
        ]);

        // Simulate decline by clearing without migration
        syncManager.clearLocalTasksAfterMigration(storageManager);

        expect(storageManager.cleared).toBe(true);
        expect(storageManager.tasks).toEqual([]);
      });

      test('should handle decline with no local tasks', () => {
        const storageManager = new MockStorageManager();

        expect(() => {
          syncManager.clearLocalTasksAfterMigration(storageManager);
        }).not.toThrow();

        expect(storageManager.cleared).toBe(true);
      });

      test('should handle decline with null storage manager', () => {
        expect(() => {
          syncManager.clearLocalTasksAfterMigration(null);
        }).not.toThrow();
      });

      test('should allow starting fresh after decline', () => {
        const storageManager = new MockStorageManager();
        storageManager.setTasks([
          { id: '1', text: 'Old task 1' },
          { id: '2', text: 'Old task 2' }
        ]);

        // User declines migration
        syncManager.clearLocalTasksAfterMigration(storageManager);

        // Verify old tasks are gone
        expect(storageManager.hasLocalTasks()).toBe(false);

        // User can now start fresh with cloud storage
        // No local tasks should exist
        expect(storageManager.loadTasks()).toEqual([]);
      });

      test('should not affect sync queue when declining migration', () => {
        const storageManager = new MockStorageManager();
        storageManager.setTasks([{ id: '1', text: 'Task 1' }]);

        // Queue some operations before decline
        syncManager.queueOperation({ type: 'CREATE', taskId: '2', task: { text: 'Queued task' } });

        // User declines migration
        syncManager.clearLocalTasksAfterMigration(storageManager);

        // Sync queue should remain intact
        expect(syncManager.getQueueLength()).toBe(1);
      });

      test('should handle decline with large number of tasks', () => {
        const storageManager = new MockStorageManager();
        const tasks = Array.from({ length: 200 }, (_, i) => ({
          id: `task-${i}`,
          text: `Task ${i}`
        }));
        storageManager.setTasks(tasks);

        // User declines migration
        syncManager.clearLocalTasksAfterMigration(storageManager);

        expect(storageManager.cleared).toBe(true);
        expect(storageManager.tasks).toEqual([]);
        // No API calls should have been made
        expect(apiClient.calls).toHaveLength(0);
      });
    });

    describe('localStorage cleanup', () => {
      test('should clear local tasks after successful migration', () => {
        const storageManager = new MockStorageManager();
        storageManager.setTasks([{ id: '1', text: 'Task 1' }]);

        syncManager.clearLocalTasksAfterMigration(storageManager);

        expect(storageManager.cleared).toBe(true);
        expect(storageManager.tasks.length).toBe(0);
      });

      test('should handle cleanup with empty storage', () => {
        const storageManager = new MockStorageManager();

        expect(() => {
          syncManager.clearLocalTasksAfterMigration(storageManager);
        }).not.toThrow();
      });

      test('should handle cleanup with null storage manager', () => {
        expect(() => {
          syncManager.clearLocalTasksAfterMigration(null);
        }).not.toThrow();
      });

      test('should handle cleanup with undefined storage manager', () => {
        expect(() => {
          syncManager.clearLocalTasksAfterMigration(undefined);
        }).not.toThrow();
      });

      test('should allow re-detection after cleanup', () => {
        const storageManager = new MockStorageManager();
        storageManager.setTasks([{ id: '1', text: 'Task 1' }]);

        syncManager.clearLocalTasksAfterMigration(storageManager);

        // After cleanup, should not detect local tasks
        expect(syncManager.detectLocalTasks(storageManager)).toBe(false);
      });

      test('should clear all task data including subtasks', () => {
        const storageManager = new MockStorageManager();
        storageManager.setTasks([
          {
            id: '1',
            text: 'Task with subtasks',
            subtasks: [
              { id: 1, text: 'Subtask 1' },
              { id: 2, text: 'Subtask 2' }
            ]
          }
        ]);

        syncManager.clearLocalTasksAfterMigration(storageManager);

        expect(storageManager.tasks).toEqual([]);
        expect(storageManager.cleared).toBe(true);
      });

      test('should not affect other localStorage keys during cleanup', () => {
        const storageManager = new MockStorageManager();
        storageManager.setTasks([{ id: '1', text: 'Task 1' }]);

        // Add some other data to localStorage
        localStorage.setItem('otherKey', 'otherValue');
        localStorage.setItem('userPreferences', JSON.stringify({ theme: 'dark' }));

        syncManager.clearLocalTasksAfterMigration(storageManager);

        // Other keys should remain
        expect(localStorage.getItem('otherKey')).toBe('otherValue');
        expect(localStorage.getItem('userPreferences')).toBe(JSON.stringify({ theme: 'dark' }));
      });

      test('should handle cleanup errors gracefully', () => {
        const storageManager = new MockStorageManager();
        storageManager.setTasks([{ id: '1', text: 'Task 1' }]);

        // Override clearLocalTasks to throw error
        storageManager.clearLocalTasks = () => {
          throw new Error('Storage error');
        };

        expect(() => {
          syncManager.clearLocalTasksAfterMigration(storageManager);
        }).toThrow('Storage error');
      });

      test('should complete full migration workflow with cleanup', async () => {
        const storageManager = new MockStorageManager();
        storageManager.setTasks([
          { id: '1', text: 'Task 1' },
          { id: '2', text: 'Task 2' }
        ]);

        const result = await syncManager.performMigration(storageManager);

        expect(result.success).toBe(true);
        expect(result.migrated).toBe(2);
        expect(storageManager.cleared).toBe(true);
        expect(storageManager.tasks).toEqual([]);
      });
    });

    test('should migrate local tasks to cloud', async () => {
      const localTasks = [
        { id: '1', text: 'Task 1', completed: false },
        { id: '2', text: 'Task 2', completed: true }
      ];

      const result = await syncManager.migrateLocalTasks(localTasks);

      expect(result.success).toBe(true);
      expect(result.migrated).toBe(2);
      expect(result.total).toBe(2);
    });

    test('should handle empty task list', async () => {
      const result = await syncManager.migrateLocalTasks([]);

      expect(result.success).toBe(true);
      expect(result.migrated).toBe(0);
    });

    test('should throw error when migrating offline', async () => {
      global.navigator.onLine = false;
      syncManager.isOnline = false;

      const localTasks = [{ id: '1', text: 'Task 1' }];

      await expect(syncManager.migrateLocalTasks(localTasks)).rejects.toThrow('Cannot migrate tasks while offline');
    });

    test('should detect existing local tasks', () => {
      const storageManager = new MockStorageManager();
      storageManager.setTasks([
        { id: '1', text: 'Task 1' },
        { id: '2', text: 'Task 2' }
      ]);

      const hasLocalTasks = syncManager.detectLocalTasks(storageManager);

      expect(hasLocalTasks).toBe(true);
    });

    test('should detect no local tasks when storage is empty', () => {
      const storageManager = new MockStorageManager();

      const hasLocalTasks = syncManager.detectLocalTasks(storageManager);

      expect(hasLocalTasks).toBe(false);
    });

    test('should get local tasks for migration', () => {
      const storageManager = new MockStorageManager();
      const tasks = [
        { id: '1', text: 'Task 1' },
        { id: '2', text: 'Task 2' }
      ];
      storageManager.setTasks(tasks);

      const localTasks = syncManager.getLocalTasksForMigration(storageManager);

      expect(localTasks).toEqual(tasks);
      expect(localTasks.length).toBe(2);
    });

    test('should clear local tasks after migration', () => {
      const storageManager = new MockStorageManager();
      storageManager.setTasks([{ id: '1', text: 'Task 1' }]);

      syncManager.clearLocalTasksAfterMigration(storageManager);

      expect(storageManager.cleared).toBe(true);
      expect(storageManager.tasks.length).toBe(0);
    });

    test('should perform complete migration workflow', async () => {
      const storageManager = new MockStorageManager();
      storageManager.setTasks([
        { id: '1', text: 'Task 1', completed: false },
        { id: '2', text: 'Task 2', completed: true }
      ]);

      const result = await syncManager.performMigration(storageManager);

      expect(result.success).toBe(true);
      expect(result.migrated).toBe(2);
      expect(result.total).toBe(2);
      expect(storageManager.cleared).toBe(true);
    });

    test('should not clear localStorage if migration fails', async () => {
      const storageManager = new MockStorageManager();
      storageManager.setTasks([{ id: '1', text: 'Task 1' }]);

      // Make API fail
      apiClient.setFailure(true, 'ServerError');

      await expect(syncManager.performMigration(storageManager)).rejects.toThrow();

      // localStorage should NOT be cleared on error
      expect(storageManager.cleared).toBe(false);
    });

    test('should handle migration with no local tasks', async () => {
      const storageManager = new MockStorageManager();

      const result = await syncManager.performMigration(storageManager);

      expect(result.success).toBe(true);
      expect(result.migrated).toBe(0);
      expect(result.total).toBe(0);
    });

    test('should handle partial migration failure', async () => {
      const storageManager = new MockStorageManager();
      storageManager.setTasks([
        { id: '1', text: 'Task 1' },
        { id: '2', text: 'Task 2' }
      ]);

      // Mock partial failure
      apiClient.syncTasks = async (operations) => {
        return [
          { operation: operations[0], success: true },
          { operation: operations[1], success: false }
        ];
      };

      const result = await syncManager.performMigration(storageManager);

      expect(result.success).toBe(false);
      expect(result.migrated).toBe(1);
      expect(result.failed).toBe(1);
      expect(result.total).toBe(2);
      // Should not clear localStorage on partial failure
      expect(storageManager.cleared).toBe(false);
    });
  });
});

/**
 * Feature: google-auth-aws-hosting, Property 11: Migration uploads all local tasks
 * For any set of tasks in localStorage, confirming migration should result in all tasks
 * being uploaded to the cloud backend with the authenticated user's ID
 * Validates: Requirements 5.3
 */
describe('Property 11: Migration uploads all local tasks', () => {
  beforeEach(() => {
    global.navigator.onLine = true;
    localStorage.clear();
  });

  test('All local tasks should be uploaded to cloud during migration', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(
          fc.record({
            id: fc.string({ minLength: 1, maxLength: 50 }),
            text: fc.string({ minLength: 1, maxLength: 500 }),
            completed: fc.boolean(),
            createdAt: fc.date().map(d => d.toISOString()),
            dueDateTime: fc.option(fc.date().map(d => d.toISOString())),
            subtasks: fc.array(
              fc.record({
                id: fc.integer({ min: 1, max: 10000 }),
                text: fc.string({ minLength: 1, maxLength: 200 }),
                completed: fc.boolean(),
                notes: fc.option(fc.string({ maxLength: 300 })),
                priority: fc.constantFrom('Normal', 'Important', 'Urgent'),
                weight: fc.constantFrom(3, 5, 8)
              }),
              { maxLength: 5 }
            )
          }),
          { minLength: 1, maxLength: 20 }
        ).map(tasks => {
          // Ensure unique task IDs by appending index
          return tasks.map((task, index) => ({
            ...task,
            id: `${task.id}-${index}`
          }));
        }),
        async (localTasks) => {
          const apiClient = new MockApiClient();
          const taskManager = new MockTaskManager();
          const syncManager = new SyncManager(apiClient, taskManager);

          // Migrate local tasks
          const result = await syncManager.migrateLocalTasks(localTasks);

          // Property: Should call syncTasks API with all local tasks
          const syncCalls = apiClient.calls.filter(c => c.method === 'syncTasks');
          if (syncCalls.length !== 1) return false;

          // Property: Should create CREATE operations for all tasks
          const operations = syncCalls[0].operations;
          if (operations.length !== localTasks.length) return false;

          // Property: All operations should be CREATE type
          if (!operations.every(op => op.type === 'CREATE')) return false;

          // Property: Each local task should be included in the operations
          for (let i = 0; i < localTasks.length; i++) {
            const localTask = localTasks[i];
            const operation = operations.find(op => op.taskId === localTask.id);
            
            if (!operation) return false;
            if (JSON.stringify(operation.task) !== JSON.stringify(localTask)) return false;
          }

          // Property: Migration should report success
          if (!result.success) return false;

          // Property: Migration should report correct counts
          if (result.migrated !== localTasks.length) return false;
          if (result.total !== localTasks.length) return false;
          if (result.failed !== 0) return false;

          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  test('Migration should preserve all task properties', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(
          fc.record({
            id: fc.string({ minLength: 1, maxLength: 50 }),
            text: fc.string({ minLength: 1, maxLength: 500 }),
            completed: fc.boolean(),
            createdAt: fc.date().map(d => d.toISOString()),
            dueDateTime: fc.option(fc.date().map(d => d.toISOString())),
            subtasks: fc.array(
              fc.record({
                id: fc.integer({ min: 1, max: 10000 }),
                text: fc.string({ minLength: 1, maxLength: 200 }),
                completed: fc.boolean(),
                notes: fc.option(fc.string({ maxLength: 300 })),
                priority: fc.constantFrom('Normal', 'Important', 'Urgent'),
                weight: fc.constantFrom(3, 5, 8)
              }),
              { maxLength: 3 }
            )
          }),
          { minLength: 1, maxLength: 10 }
        ).map(tasks => {
          // Ensure unique task IDs by appending index
          return tasks.map((task, index) => ({
            ...task,
            id: `${task.id}-${index}`
          }));
        }),
        async (localTasks) => {
          const apiClient = new MockApiClient();
          const taskManager = new MockTaskManager();
          const syncManager = new SyncManager(apiClient, taskManager);

          await syncManager.migrateLocalTasks(localTasks);

          const syncCalls = apiClient.calls.filter(c => c.method === 'syncTasks');
          const operations = syncCalls[0].operations;

          // Property: Each task's properties should be preserved exactly
          for (const localTask of localTasks) {
            const operation = operations.find(op => op.taskId === localTask.id);
            
            if (!operation) return false;

            // Check all properties are preserved
            if (operation.task.id !== localTask.id) return false;
            if (operation.task.text !== localTask.text) return false;
            if (operation.task.completed !== localTask.completed) return false;
            if (operation.task.createdAt !== localTask.createdAt) return false;
            if (operation.task.dueDateTime !== localTask.dueDateTime) return false;

            // Check subtasks are preserved
            if (operation.task.subtasks.length !== localTask.subtasks.length) return false;
            
            for (let i = 0; i < localTask.subtasks.length; i++) {
              const originalSubtask = localTask.subtasks[i];
              const migratedSubtask = operation.task.subtasks[i];

              if (migratedSubtask.id !== originalSubtask.id) return false;
              if (migratedSubtask.text !== originalSubtask.text) return false;
              if (migratedSubtask.completed !== originalSubtask.completed) return false;
              if (migratedSubtask.notes !== originalSubtask.notes) return false;
              if (migratedSubtask.priority !== originalSubtask.priority) return false;
              if (migratedSubtask.weight !== originalSubtask.weight) return false;
            }
          }

          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  test('Migration should handle empty task list', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.constant([]),
        async (emptyTasks) => {
          const apiClient = new MockApiClient();
          const taskManager = new MockTaskManager();
          const syncManager = new SyncManager(apiClient, taskManager);

          const result = await syncManager.migrateLocalTasks(emptyTasks);

          // Property: Should succeed with zero migrations
          if (!result.success) return false;
          if (result.migrated !== 0) return false;
          if (result.total !== 0) return false;

          // Property: Should not call API for empty list
          if (apiClient.calls.length !== 0) return false;

          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  test('Migration should fail when offline', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(
          fc.record({
            id: fc.string({ minLength: 1, maxLength: 50 }),
            text: fc.string({ minLength: 1, maxLength: 500 }),
            completed: fc.boolean()
          }),
          { minLength: 1, maxLength: 5 }
        ),
        async (localTasks) => {
          const apiClient = new MockApiClient();
          const taskManager = new MockTaskManager();
          const syncManager = new SyncManager(apiClient, taskManager);

          // Go offline
          global.navigator.onLine = false;
          syncManager.isOnline = false;

          // Property: Migration should throw error when offline
          let errorThrown = false;
          try {
            await syncManager.migrateLocalTasks(localTasks);
          } catch (error) {
            errorThrown = true;
            if (!error.message.includes('offline')) return false;
          }

          if (!errorThrown) return false;

          // Property: Should not call API when offline
          if (apiClient.calls.length !== 0) return false;

          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  test('Complete migration workflow should upload all tasks and clear localStorage', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(
          fc.record({
            id: fc.string({ minLength: 1, maxLength: 50 }),
            text: fc.string({ minLength: 1, maxLength: 500 }),
            completed: fc.boolean(),
            createdAt: fc.date().map(d => d.toISOString())
          }),
          { minLength: 1, maxLength: 15 }
        ),
        async (localTasks) => {
          // Mock StorageManager
          class MockStorageManager {
            constructor() {
              this.tasks = [...localTasks];
              this.cleared = false;
            }

            hasLocalTasks() {
              return this.tasks.length > 0;
            }

            loadTasks() {
              return this.tasks;
            }

            clearLocalTasks() {
              this.cleared = true;
              this.tasks = [];
            }
          }

          const apiClient = new MockApiClient();
          const taskManager = new MockTaskManager();
          const syncManager = new SyncManager(apiClient, taskManager);
          const storageManager = new MockStorageManager();

          // Perform complete migration
          const result = await syncManager.performMigration(storageManager);

          // Property: Should detect local tasks
          if (!result.success) return false;

          // Property: Should upload all tasks
          const syncCalls = apiClient.calls.filter(c => c.method === 'syncTasks');
          if (syncCalls.length !== 1) return false;
          if (syncCalls[0].operations.length !== localTasks.length) return false;

          // Property: Should report correct migration counts
          if (result.migrated !== localTasks.length) return false;
          if (result.total !== localTasks.length) return false;

          // Property: Should clear localStorage after successful migration
          if (!storageManager.cleared) return false;
          if (storageManager.tasks.length !== 0) return false;

          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  test('Migration should not clear localStorage on partial failure', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(
          fc.record({
            id: fc.string({ minLength: 1, maxLength: 50 }),
            text: fc.string({ minLength: 1, maxLength: 500 }),
            completed: fc.boolean()
          }),
          { minLength: 2, maxLength: 10 }
        ),
        fc.integer({ min: 0, max: 100 }),
        async (localTasks, failureIndexSeed) => {
          // Ensure we have at least 2 tasks and pick one to fail
          if (localTasks.length < 2) return true; // Skip this case

          const failureIndex = failureIndexSeed % localTasks.length;

          // Mock StorageManager
          class MockStorageManager {
            constructor() {
              this.tasks = [...localTasks];
              this.cleared = false;
            }

            hasLocalTasks() {
              return this.tasks.length > 0;
            }

            loadTasks() {
              return this.tasks;
            }

            clearLocalTasks() {
              this.cleared = true;
              this.tasks = [];
            }
          }

          const apiClient = new MockApiClient();
          // Mock partial failure
          apiClient.syncTasks = async function(operations) {
            this.calls.push({ method: 'syncTasks', operations });
            return operations.map((op, index) => ({
              operation: op,
              success: index !== failureIndex
            }));
          };

          const taskManager = new MockTaskManager();
          const syncManager = new SyncManager(apiClient, taskManager);
          const storageManager = new MockStorageManager();

          // Perform migration
          const result = await syncManager.performMigration(storageManager);

          // Property: Should report partial success
          if (result.success) return false; // Should be false due to failures
          if (result.migrated !== localTasks.length - 1) return false;
          if (result.failed !== 1) return false;

          // Property: Should NOT clear localStorage on partial failure
          if (storageManager.cleared) return false;
          if (storageManager.tasks.length === 0) return false;

          return true;
        }
      ),
      { numRuns: 100 }
    );
  });
});

/**
 * Feature: google-auth-aws-hosting, Property 12: Post-migration localStorage cleanup
 * For any completed migration, localStorage should be empty and all subsequent task
 * operations should use cloud storage exclusively
 * Validates: Requirements 5.4
 */
describe('Property 12: Post-migration localStorage cleanup', () => {
  beforeEach(() => {
    global.navigator.onLine = true;
    localStorage.clear();
  });

  test('localStorage should be empty after successful migration', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(
          fc.record({
            id: fc.string({ minLength: 1, maxLength: 50 }),
            text: fc.string({ minLength: 1, maxLength: 500 }),
            completed: fc.boolean(),
            createdAt: fc.date().map(d => d.toISOString()),
            dueDateTime: fc.option(fc.date().map(d => d.toISOString())),
            subtasks: fc.array(
              fc.record({
                id: fc.integer({ min: 1, max: 10000 }),
                text: fc.string({ minLength: 1, maxLength: 200 }),
                completed: fc.boolean()
              }),
              { maxLength: 3 }
            )
          }),
          { minLength: 1, maxLength: 15 }
        ).map(tasks => {
          // Ensure unique task IDs
          return tasks.map((task, index) => ({
            ...task,
            id: `${task.id}-${index}`
          }));
        }),
        async (localTasks) => {
          // Mock StorageManager
          class MockStorageManager {
            constructor() {
              this.tasks = [...localTasks];
              this.cleared = false;
              this.storageKey = 'todoTasks';
            }

            hasLocalTasks() {
              return this.tasks.length > 0;
            }

            loadTasks() {
              return this.tasks;
            }

            clearLocalTasks() {
              this.cleared = true;
              this.tasks = [];
              localStorage.removeItem(this.storageKey);
            }
          }

          const apiClient = new MockApiClient();
          const taskManager = new MockTaskManager();
          const syncManager = new SyncManager(apiClient, taskManager);
          const storageManager = new MockStorageManager();

          // Set up localStorage with tasks before migration
          localStorage.setItem(storageManager.storageKey, JSON.stringify(localTasks));

          // Perform migration
          const result = await syncManager.performMigration(storageManager);

          // Property: Migration should succeed
          if (!result.success) return false;

          // Property: localStorage should be empty after successful migration
          const storedTasks = localStorage.getItem(storageManager.storageKey);
          if (storedTasks !== null) return false;

          // Property: StorageManager should have cleared its internal state
          if (!storageManager.cleared) return false;
          if (storageManager.tasks.length !== 0) return false;

          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  test('Subsequent task operations should use cloud storage after migration', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(
          fc.record({
            id: fc.string({ minLength: 1, maxLength: 50 }),
            text: fc.string({ minLength: 1, maxLength: 500 }),
            completed: fc.boolean()
          }),
          { minLength: 1, maxLength: 10 }
        ),
        fc.record({
          id: fc.string({ minLength: 1, maxLength: 50 }),
          text: fc.string({ minLength: 1, maxLength: 500 }),
          completed: fc.boolean()
        }),
        async (localTasks, newTask) => {
          // Mock StorageManager
          class MockStorageManager {
            constructor() {
              this.tasks = [...localTasks];
              this.cleared = false;
              this.storageKey = 'todoTasks';
            }

            hasLocalTasks() {
              return this.tasks.length > 0;
            }

            loadTasks() {
              return this.tasks;
            }

            clearLocalTasks() {
              this.cleared = true;
              this.tasks = [];
              localStorage.removeItem(this.storageKey);
            }

            saveTasks(tasks) {
              // After migration, this should NOT save to localStorage
              if (this.cleared) {
                // Should not write to localStorage after migration
                return;
              }
              localStorage.setItem(this.storageKey, JSON.stringify(tasks));
            }
          }

          const apiClient = new MockApiClient();
          const taskManager = new MockTaskManager();
          const syncManager = new SyncManager(apiClient, taskManager);
          const storageManager = new MockStorageManager();

          // Set up localStorage with tasks before migration
          localStorage.setItem(storageManager.storageKey, JSON.stringify(localTasks));

          // Perform migration
          await syncManager.performMigration(storageManager);

          // Clear API call history
          apiClient.reset();

          // Property: After migration, new task operations should use cloud storage
          const createOperation = {
            type: 'CREATE',
            taskId: newTask.id,
            task: newTask
          };

          await syncManager.syncToCloud(createOperation);

          // Property: Should call cloud API for new task
          const createCalls = apiClient.calls.filter(c => c.method === 'createTask');
          if (createCalls.length !== 1) return false;

          // Property: localStorage should still be empty (not used for new tasks)
          const storedTasks = localStorage.getItem(storageManager.storageKey);
          if (storedTasks !== null) return false;

          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  test('localStorage should remain empty for all CRUD operations after migration', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(
          fc.record({
            id: fc.string({ minLength: 1, maxLength: 50 }),
            text: fc.string({ minLength: 1, maxLength: 500 }),
            completed: fc.boolean()
          }),
          { minLength: 1, maxLength: 5 }
        ).map(tasks => {
          // Ensure unique task IDs
          return tasks.map((task, index) => ({
            ...task,
            id: `task-${index}`
          }));
        }),
        fc.array(
          // Only CREATE operations to avoid referencing non-existent tasks
          fc.record({
            type: fc.constant('CREATE'),
            task: fc.record({
              id: fc.string({ minLength: 1, maxLength: 50 }),
              text: fc.string({ minLength: 1, maxLength: 500 }),
              completed: fc.boolean()
            })
          }).map(op => ({ ...op, taskId: op.task.id })),
          { minLength: 1, maxLength: 5 }
        ),
        async (localTasks, subsequentOperations) => {
          // Mock StorageManager
          class MockStorageManager {
            constructor() {
              this.tasks = [...localTasks];
              this.cleared = false;
              this.storageKey = 'todoTasks';
            }

            hasLocalTasks() {
              return this.tasks.length > 0;
            }

            loadTasks() {
              return this.tasks;
            }

            clearLocalTasks() {
              this.cleared = true;
              this.tasks = [];
              localStorage.removeItem(this.storageKey);
            }

            saveTasks(tasks) {
              // After migration, this should NOT save to localStorage
              if (this.cleared) {
                return;
              }
              localStorage.setItem(this.storageKey, JSON.stringify(tasks));
            }
          }

          const apiClient = new MockApiClient();
          const taskManager = new MockTaskManager();
          const syncManager = new SyncManager(apiClient, taskManager);
          const storageManager = new MockStorageManager();

          // Set up localStorage with tasks before migration
          localStorage.setItem(storageManager.storageKey, JSON.stringify(localTasks));

          // Perform migration
          await syncManager.performMigration(storageManager);

          // Verify localStorage is empty after migration
          let storedTasks = localStorage.getItem(storageManager.storageKey);
          if (storedTasks !== null) return false;

          // Clear API call history to count only subsequent operations
          apiClient.reset();

          // Perform subsequent operations (all CREATE operations with new task IDs)
          for (const operation of subsequentOperations) {
            await syncManager.syncToCloud(operation);
          }

          // Property: Task storage should still be empty after all operations
          storedTasks = localStorage.getItem(storageManager.storageKey);
          if (storedTasks !== null) return false;

          // Property: All operations should have used cloud API (not localStorage)
          if (apiClient.calls.length !== subsequentOperations.length) return false;

          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  test('Migration should not clear localStorage on failure', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(
          fc.record({
            id: fc.string({ minLength: 1, maxLength: 50 }),
            text: fc.string({ minLength: 1, maxLength: 500 }),
            completed: fc.boolean()
          }),
          { minLength: 1, maxLength: 5 }
        ),
        async (localTasks) => {
          // Mock StorageManager
          class MockStorageManager {
            constructor() {
              this.tasks = [...localTasks];
              this.cleared = false;
              this.storageKey = 'todoTasks';
            }

            hasLocalTasks() {
              return this.tasks.length > 0;
            }

            loadTasks() {
              return this.tasks;
            }

            clearLocalTasks() {
              this.cleared = true;
              this.tasks = [];
              localStorage.removeItem(this.storageKey);
            }
          }

          const apiClient = new MockApiClient();
          // Make API fail
          apiClient.setFailure(true, 'ServerError');

          const taskManager = new MockTaskManager();
          const syncManager = new SyncManager(apiClient, taskManager);
          const storageManager = new MockStorageManager();

          // Set up localStorage with tasks before migration
          localStorage.setItem(storageManager.storageKey, JSON.stringify(localTasks));

          // Attempt migration (should fail)
          let errorThrown = false;
          try {
            await syncManager.performMigration(storageManager);
          } catch (error) {
            errorThrown = true;
          }

          // Property: Should throw error on failure
          if (!errorThrown) return false;

          // Property: localStorage should NOT be cleared on failure
          const storedTasks = localStorage.getItem(storageManager.storageKey);
          if (storedTasks === null) return false;

          // Property: StorageManager should NOT have cleared its state
          if (storageManager.cleared) return false;
          if (storageManager.tasks.length === 0) return false;

          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  test('Sync queue should not use localStorage after migration', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(
          fc.record({
            id: fc.string({ minLength: 1, maxLength: 50 }),
            text: fc.string({ minLength: 1, maxLength: 500 }),
            completed: fc.boolean()
          }),
          { minLength: 1, maxLength: 5 }
        ),
        async (localTasks) => {
          // Mock StorageManager
          class MockStorageManager {
            constructor() {
              this.tasks = [...localTasks];
              this.cleared = false;
              this.storageKey = 'todoTasks';
            }

            hasLocalTasks() {
              return this.tasks.length > 0;
            }

            loadTasks() {
              return this.tasks;
            }

            clearLocalTasks() {
              this.cleared = true;
              this.tasks = [];
              localStorage.removeItem(this.storageKey);
            }
          }

          const apiClient = new MockApiClient();
          const taskManager = new MockTaskManager();
          const syncManager = new SyncManager(apiClient, taskManager);
          const storageManager = new MockStorageManager();

          // Set up localStorage with tasks before migration
          const taskStorageKey = storageManager.storageKey;
          localStorage.setItem(taskStorageKey, JSON.stringify(localTasks));

          // Perform migration
          await syncManager.performMigration(storageManager);

          // Property: Task storage should be cleared
          const storedTasks = localStorage.getItem(taskStorageKey);
          if (storedTasks !== null) return false;

          // Property: Only sync queue should remain in localStorage (if any)
          // The sync queue is separate from task storage
          const allKeys = Object.keys(localStorage.store);
          const taskKeys = allKeys.filter(key => key === taskStorageKey);
          if (taskKeys.length !== 0) return false;

          return true;
        }
      ),
      { numRuns: 100 }
    );
  });
});
