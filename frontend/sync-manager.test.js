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
  });
});
