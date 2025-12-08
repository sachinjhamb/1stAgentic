// Mock localStorage for testing
class MockLocalStorage {
  constructor() {
    this.store = {};
  }

  getItem(key) {
    return this.store[key] || null;
  }

  setItem(key, value) {
    this.store[key] = value;
  }

  removeItem(key) {
    delete this.store[key];
  }

  clear() {
    this.store = {};
  }
}

// StorageManager implementation for testing
class StorageManager {
  constructor(storageKey = 'todoApp_tasks', mode = 'local') {
    this.storageKey = storageKey;
    this.mode = mode;
    this.queueKey = `${storageKey}_queue`;
    this.localStorage = global.localStorage || new MockLocalStorage();
  }

  loadTasks() {
    try {
      const saved = this.localStorage.getItem(this.storageKey);
      return saved ? JSON.parse(saved) : [];
    } catch (error) {
      console.error('Error loading tasks from localStorage:', error);
      return [];
    }
  }

  saveTasks(tasks) {
    try {
      this.localStorage.setItem(this.storageKey, JSON.stringify(tasks));
    } catch (error) {
      console.error('Error saving tasks to localStorage:', error);
    }
  }

  queueOperation(operation) {
    try {
      const queue = this.getQueuedOperations();
      queue.push({
        ...operation,
        timestamp: new Date().toISOString()
      });
      this.localStorage.setItem(this.queueKey, JSON.stringify(queue));
    } catch (error) {
      console.error('Error queueing operation:', error);
    }
  }

  getQueuedOperations() {
    try {
      const saved = this.localStorage.getItem(this.queueKey);
      return saved ? JSON.parse(saved) : [];
    } catch (error) {
      console.error('Error loading queued operations:', error);
      return [];
    }
  }

  clearQueue() {
    try {
      this.localStorage.removeItem(this.queueKey);
    } catch (error) {
      console.error('Error clearing queue:', error);
    }
  }

  hasLocalTasks() {
    try {
      const saved = this.localStorage.getItem(this.storageKey);
      if (!saved) return false;
      const tasks = JSON.parse(saved);
      return Array.isArray(tasks) && tasks.length > 0;
    } catch (error) {
      console.error('Error checking for local tasks:', error);
      return false;
    }
  }

  clearLocalTasks() {
    try {
      this.localStorage.removeItem(this.storageKey);
    } catch (error) {
      console.error('Error clearing local tasks:', error);
    }
  }
}

describe('StorageManager', () => {
  let storageManager;
  let mockLocalStorage;

  beforeEach(() => {
    mockLocalStorage = new MockLocalStorage();
    global.localStorage = mockLocalStorage;
    storageManager = new StorageManager('test_tasks', 'hybrid');
  });

  afterEach(() => {
    mockLocalStorage.clear();
  });

  describe('Queue Operations', () => {
    test('should queue a CREATE operation', () => {
      const operation = {
        type: 'CREATE',
        taskId: 'task-1',
        task: { id: 'task-1', text: 'Test task', completed: false }
      };

      storageManager.queueOperation(operation);

      const queue = storageManager.getQueuedOperations();
      expect(queue).toHaveLength(1);
      expect(queue[0].type).toBe('CREATE');
      expect(queue[0].taskId).toBe('task-1');
      expect(queue[0].task.text).toBe('Test task');
      expect(queue[0].timestamp).toBeDefined();
    });

    test('should queue multiple operations in order', () => {
      const op1 = { type: 'CREATE', taskId: 'task-1', task: { id: 'task-1', text: 'Task 1' } };
      const op2 = { type: 'UPDATE', taskId: 'task-1', task: { id: 'task-1', text: 'Task 1 updated' } };
      const op3 = { type: 'DELETE', taskId: 'task-1' };

      storageManager.queueOperation(op1);
      storageManager.queueOperation(op2);
      storageManager.queueOperation(op3);

      const queue = storageManager.getQueuedOperations();
      expect(queue).toHaveLength(3);
      expect(queue[0].type).toBe('CREATE');
      expect(queue[1].type).toBe('UPDATE');
      expect(queue[2].type).toBe('DELETE');
    });

    test('should return empty array when no operations are queued', () => {
      const queue = storageManager.getQueuedOperations();
      expect(queue).toEqual([]);
    });

    test('should clear all queued operations', () => {
      storageManager.queueOperation({ type: 'CREATE', taskId: 'task-1' });
      storageManager.queueOperation({ type: 'UPDATE', taskId: 'task-2' });

      expect(storageManager.getQueuedOperations()).toHaveLength(2);

      storageManager.clearQueue();

      expect(storageManager.getQueuedOperations()).toEqual([]);
    });

    test('should handle queueing UPDATE operations', () => {
      const operation = {
        type: 'UPDATE',
        taskId: 'task-1',
        task: { id: 'task-1', text: 'Updated task', completed: true }
      };

      storageManager.queueOperation(operation);

      const queue = storageManager.getQueuedOperations();
      expect(queue).toHaveLength(1);
      expect(queue[0].type).toBe('UPDATE');
      expect(queue[0].task.completed).toBe(true);
    });

    test('should handle queueing DELETE operations', () => {
      const operation = {
        type: 'DELETE',
        taskId: 'task-1'
      };

      storageManager.queueOperation(operation);

      const queue = storageManager.getQueuedOperations();
      expect(queue).toHaveLength(1);
      expect(queue[0].type).toBe('DELETE');
      expect(queue[0].taskId).toBe('task-1');
    });

    test('should preserve operation data when retrieving queue', () => {
      const operation = {
        type: 'CREATE',
        taskId: 'task-1',
        task: {
          id: 'task-1',
          text: 'Test task',
          completed: false,
          subtasks: [
            { id: 'sub-1', text: 'Subtask 1', completed: false }
          ]
        }
      };

      storageManager.queueOperation(operation);

      const queue = storageManager.getQueuedOperations();
      expect(queue[0].task.subtasks).toHaveLength(1);
      expect(queue[0].task.subtasks[0].text).toBe('Subtask 1');
    });

    test('should handle corrupted queue data gracefully', () => {
      mockLocalStorage.setItem('test_tasks_queue', 'invalid json');

      const queue = storageManager.getQueuedOperations();
      expect(queue).toEqual([]);
    });
  });

  describe('Local Task Detection', () => {
    test('should detect when local tasks exist', () => {
      const tasks = [
        { id: 'task-1', text: 'Task 1', completed: false },
        { id: 'task-2', text: 'Task 2', completed: true }
      ];

      storageManager.saveTasks(tasks);

      expect(storageManager.hasLocalTasks()).toBe(true);
    });

    test('should return false when no local tasks exist', () => {
      expect(storageManager.hasLocalTasks()).toBe(false);
    });

    test('should return false when localStorage is empty', () => {
      mockLocalStorage.setItem('test_tasks', '[]');

      expect(storageManager.hasLocalTasks()).toBe(false);
    });

    test('should return false when localStorage contains null', () => {
      mockLocalStorage.setItem('test_tasks', 'null');

      expect(storageManager.hasLocalTasks()).toBe(false);
    });

    test('should return false when localStorage contains invalid JSON', () => {
      mockLocalStorage.setItem('test_tasks', 'invalid json');

      expect(storageManager.hasLocalTasks()).toBe(false);
    });

    test('should return false when localStorage contains non-array data', () => {
      mockLocalStorage.setItem('test_tasks', '{"not": "an array"}');

      expect(storageManager.hasLocalTasks()).toBe(false);
    });

    test('should detect single task', () => {
      storageManager.saveTasks([{ id: 'task-1', text: 'Single task' }]);

      expect(storageManager.hasLocalTasks()).toBe(true);
    });

    test('should detect multiple tasks', () => {
      const tasks = Array.from({ length: 10 }, (_, i) => ({
        id: `task-${i}`,
        text: `Task ${i}`
      }));

      storageManager.saveTasks(tasks);

      expect(storageManager.hasLocalTasks()).toBe(true);
    });
  });

  describe('localStorage Clearing', () => {
    test('should clear local tasks', () => {
      const tasks = [
        { id: 'task-1', text: 'Task 1' },
        { id: 'task-2', text: 'Task 2' }
      ];

      storageManager.saveTasks(tasks);
      expect(storageManager.hasLocalTasks()).toBe(true);

      storageManager.clearLocalTasks();

      expect(storageManager.hasLocalTasks()).toBe(false);
      expect(storageManager.loadTasks()).toEqual([]);
    });

    test('should not affect queue when clearing local tasks', () => {
      storageManager.saveTasks([{ id: 'task-1', text: 'Task 1' }]);
      storageManager.queueOperation({ type: 'CREATE', taskId: 'task-2' });

      storageManager.clearLocalTasks();

      expect(storageManager.hasLocalTasks()).toBe(false);
      expect(storageManager.getQueuedOperations()).toHaveLength(1);
    });

    test('should handle clearing when no tasks exist', () => {
      expect(() => {
        storageManager.clearLocalTasks();
      }).not.toThrow();

      expect(storageManager.hasLocalTasks()).toBe(false);
    });

    test('should clear queue independently of tasks', () => {
      storageManager.saveTasks([{ id: 'task-1', text: 'Task 1' }]);
      storageManager.queueOperation({ type: 'CREATE', taskId: 'task-2' });

      storageManager.clearQueue();

      expect(storageManager.hasLocalTasks()).toBe(true);
      expect(storageManager.getQueuedOperations()).toEqual([]);
    });

    test('should allow re-saving tasks after clearing', () => {
      storageManager.saveTasks([{ id: 'task-1', text: 'Task 1' }]);
      storageManager.clearLocalTasks();

      const newTasks = [{ id: 'task-2', text: 'Task 2' }];
      storageManager.saveTasks(newTasks);

      expect(storageManager.hasLocalTasks()).toBe(true);
      expect(storageManager.loadTasks()).toEqual(newTasks);
    });

    test('should allow re-queueing operations after clearing queue', () => {
      storageManager.queueOperation({ type: 'CREATE', taskId: 'task-1' });
      storageManager.clearQueue();

      storageManager.queueOperation({ type: 'UPDATE', taskId: 'task-2' });

      const queue = storageManager.getQueuedOperations();
      expect(queue).toHaveLength(1);
      expect(queue[0].type).toBe('UPDATE');
    });
  });

  describe('Mode Configuration', () => {
    test('should initialize with local mode', () => {
      const sm = new StorageManager('test', 'local');
      expect(sm.mode).toBe('local');
    });

    test('should initialize with cloud mode', () => {
      const sm = new StorageManager('test', 'cloud');
      expect(sm.mode).toBe('cloud');
    });

    test('should initialize with hybrid mode', () => {
      const sm = new StorageManager('test', 'hybrid');
      expect(sm.mode).toBe('hybrid');
    });

    test('should default to local mode when not specified', () => {
      const sm = new StorageManager('test');
      expect(sm.mode).toBe('local');
    });
  });

  describe('Task Load and Save', () => {
    test('should save and load tasks correctly', () => {
      const tasks = [
        { id: 'task-1', text: 'Task 1', completed: false },
        { id: 'task-2', text: 'Task 2', completed: true }
      ];

      storageManager.saveTasks(tasks);
      const loaded = storageManager.loadTasks();

      expect(loaded).toEqual(tasks);
    });

    test('should return empty array when loading from empty storage', () => {
      const loaded = storageManager.loadTasks();
      expect(loaded).toEqual([]);
    });

    test('should handle corrupted task data gracefully', () => {
      mockLocalStorage.setItem('test_tasks', 'invalid json');

      const loaded = storageManager.loadTasks();
      expect(loaded).toEqual([]);
    });

    test('should preserve task structure with subtasks', () => {
      const tasks = [
        {
          id: 'task-1',
          text: 'Task with subtasks',
          completed: false,
          subtasks: [
            { id: 'sub-1', text: 'Subtask 1', completed: false },
            { id: 'sub-2', text: 'Subtask 2', completed: true }
          ]
        }
      ];

      storageManager.saveTasks(tasks);
      const loaded = storageManager.loadTasks();

      expect(loaded[0].subtasks).toHaveLength(2);
      expect(loaded[0].subtasks[0].text).toBe('Subtask 1');
    });
  });
});
