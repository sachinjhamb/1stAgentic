// SyncManager - Manages synchronization between local state and cloud backend
class SyncManager {
  constructor(apiClient, taskManager) {
    this.apiClient = apiClient;
    this.taskManager = taskManager;
    this.syncQueue = [];
    this.syncStatus = 'idle'; // 'idle', 'syncing', 'error', 'offline'
    this.syncStatusListeners = [];
    this.isOnline = navigator.onLine;
    this.autoSyncEnabled = true;
    
    // Setup online/offline listeners
    this.setupNetworkListeners();
  }

  /**
   * Setup network status listeners
   */
  setupNetworkListeners() {
    window.addEventListener('online', () => {
      console.log('Network connection restored');
      this.isOnline = true;
      this.updateSyncStatus('idle');
      
      // Automatically process queued operations when coming back online
      if (this.syncQueue.length > 0) {
        this.processQueue();
      }
    });

    window.addEventListener('offline', () => {
      console.log('Network connection lost');
      this.isOnline = false;
      this.updateSyncStatus('offline');
    });
  }

  /**
   * Sync a single operation to the cloud
   * @param {object} operation - Operation to sync { type, task, taskId }
   * @returns {Promise<object>} Result of sync operation
   */
  async syncToCloud(operation) {
    if (!operation || !operation.type) {
      throw new Error('Invalid operation');
    }

    // If offline, queue the operation
    if (!this.isOnline) {
      this.queueOperation(operation);
      return { success: false, queued: true };
    }

    this.updateSyncStatus('syncing');

    try {
      let result;

      switch (operation.type) {
        case 'CREATE':
          result = await this.apiClient.createTask(operation.task);
          break;

        case 'UPDATE':
          result = await this.apiClient.updateTask(operation.taskId, operation.task);
          break;

        case 'DELETE':
          result = await this.apiClient.deleteTask(operation.taskId);
          break;

        default:
          throw new Error(`Unknown operation type: ${operation.type}`);
      }

      this.updateSyncStatus('idle');
      return { success: true, result };

    } catch (error) {
      console.error('Sync to cloud failed:', error);
      
      // Queue operation if it's a network error
      if (error.name === 'NetworkError' || error.name === 'ServerError') {
        this.queueOperation(operation);
        this.updateSyncStatus('offline');
        return { success: false, queued: true, error };
      }

      this.updateSyncStatus('error');
      return { success: false, error };
    }
  }

  /**
   * Load all tasks from the cloud
   * @returns {Promise<Array>} Array of tasks
   */
  async syncFromCloud() {
    if (!this.isOnline) {
      throw new Error('Cannot sync from cloud while offline');
    }

    this.updateSyncStatus('syncing');

    try {
      const tasks = await this.apiClient.getTasks();
      
      // Update task manager with cloud tasks
      this.taskManager.initializeTasks(tasks);
      
      this.updateSyncStatus('idle');
      return tasks;

    } catch (error) {
      console.error('Sync from cloud failed:', error);
      this.updateSyncStatus('error');
      throw error;
    }
  }

  /**
   * Perform a complete synchronization
   * Loads tasks from cloud and processes any queued operations
   * @returns {Promise<object>} Sync results
   */
  async fullSync() {
    if (!this.isOnline) {
      throw new Error('Cannot perform full sync while offline');
    }

    this.updateSyncStatus('syncing');

    try {
      // First, load tasks from cloud
      const cloudTasks = await this.syncFromCloud();

      // Then, process any queued operations
      let queueResults = [];
      if (this.syncQueue.length > 0) {
        queueResults = await this.processQueue();
      }

      this.updateSyncStatus('idle');

      return {
        success: true,
        cloudTasks,
        queueResults
      };

    } catch (error) {
      console.error('Full sync failed:', error);
      this.updateSyncStatus('error');
      throw error;
    }
  }

  /**
   * Queue an operation for later sync
   * @param {object} operation - Operation to queue
   */
  queueOperation(operation) {
    if (!operation || !operation.type) {
      throw new Error('Invalid operation');
    }

    // Add timestamp to operation
    const queuedOperation = {
      ...operation,
      timestamp: new Date().toISOString(),
      queuedAt: Date.now()
    };

    this.syncQueue.push(queuedOperation);
    
    // Persist queue to localStorage
    this.persistQueue();
    
    console.log(`Operation queued: ${operation.type}`, queuedOperation);
  }

  /**
   * Process all queued operations in batch
   * @returns {Promise<Array>} Results of each operation
   */
  async processQueue() {
    if (this.syncQueue.length === 0) {
      return [];
    }

    if (!this.isOnline) {
      console.log('Cannot process queue while offline');
      return [];
    }

    this.updateSyncStatus('syncing');

    try {
      // Use batch sync endpoint if available
      const results = await this.apiClient.syncTasks(this.syncQueue);

      // Clear successfully synced operations
      const failedOperations = [];
      results.forEach((result, index) => {
        if (!result.success) {
          failedOperations.push(this.syncQueue[index]);
        }
      });

      // Update queue with only failed operations
      this.syncQueue = failedOperations;
      this.persistQueue();

      this.updateSyncStatus('idle');

      return results;

    } catch (error) {
      console.error('Failed to process queue:', error);
      this.updateSyncStatus('error');
      throw error;
    }
  }

  /**
   * Persist sync queue to localStorage
   */
  persistQueue() {
    try {
      localStorage.setItem('syncQueue', JSON.stringify(this.syncQueue));
    } catch (error) {
      console.error('Failed to persist sync queue:', error);
    }
  }

  /**
   * Load sync queue from localStorage
   */
  loadQueue() {
    try {
      const stored = localStorage.getItem('syncQueue');
      if (stored) {
        this.syncQueue = JSON.parse(stored);
        console.log(`Loaded ${this.syncQueue.length} queued operations`);
      }
    } catch (error) {
      console.error('Failed to load sync queue:', error);
      this.syncQueue = [];
    }
  }

  /**
   * Clear the sync queue
   */
  clearQueue() {
    this.syncQueue = [];
    this.persistQueue();
  }

  /**
   * Get current sync status
   * @returns {string} Current status
   */
  getSyncStatus() {
    return this.syncStatus;
  }

  /**
   * Get number of queued operations
   * @returns {number} Queue length
   */
  getQueueLength() {
    return this.syncQueue.length;
  }

  /**
   * Update sync status and notify listeners
   * @param {string} status - New status
   */
  updateSyncStatus(status) {
    this.syncStatus = status;
    this.notifySyncStatusChange(status);
  }

  /**
   * Add sync status change listener
   * @param {Function} callback - Callback function
   */
  onSyncStatusChange(callback) {
    if (typeof callback === 'function') {
      this.syncStatusListeners.push(callback);
      
      // Immediately call with current status
      callback(this.syncStatus, this.syncQueue.length);
    }
  }

  /**
   * Notify all listeners of sync status change
   * @param {string} status - New status
   */
  notifySyncStatusChange(status) {
    this.syncStatusListeners.forEach(callback => {
      try {
        callback(status, this.syncQueue.length);
      } catch (error) {
        console.error('Error in sync status listener:', error);
      }
    });
  }

  /**
   * Detect if there are existing tasks in localStorage
   * @param {StorageManager} storageManager - StorageManager instance
   * @returns {boolean} True if local tasks exist
   */
  detectLocalTasks(storageManager) {
    if (!storageManager) {
      console.warn('No storage manager provided for local task detection');
      return false;
    }
    
    return storageManager.hasLocalTasks();
  }

  /**
   * Get local tasks from localStorage for migration
   * @param {StorageManager} storageManager - StorageManager instance
   * @returns {Array} Array of tasks from localStorage
   */
  getLocalTasksForMigration(storageManager) {
    if (!storageManager) {
      console.warn('No storage manager provided');
      return [];
    }

    try {
      const tasks = storageManager.loadTasks();
      console.log(`Found ${tasks.length} local tasks for migration`);
      return tasks;
    } catch (error) {
      console.error('Failed to load local tasks for migration:', error);
      return [];
    }
  }

  /**
   * Migrate local tasks from localStorage to cloud
   * @param {Array} localTasks - Tasks from localStorage
   * @returns {Promise<object>} Migration results
   */
  async migrateLocalTasks(localTasks) {
    if (!Array.isArray(localTasks) || localTasks.length === 0) {
      return { success: true, migrated: 0, total: 0 };
    }

    if (!this.isOnline) {
      throw new Error('Cannot migrate tasks while offline');
    }

    this.updateSyncStatus('syncing');

    try {
      const operations = localTasks.map(task => ({
        type: 'CREATE',
        task: task,
        taskId: task.id
      }));

      // Use batch sync to upload all tasks
      const results = await this.apiClient.syncTasks(operations);

      // Count successful migrations
      const successCount = results.filter(r => r.success).length;
      const failedCount = results.length - successCount;

      this.updateSyncStatus('idle');

      return {
        success: failedCount === 0,
        migrated: successCount,
        failed: failedCount,
        total: localTasks.length,
        results
      };

    } catch (error) {
      console.error('Migration failed:', error);
      this.updateSyncStatus('error');
      throw error;
    }
  }

  /**
   * Clear local tasks from localStorage after successful migration
   * @param {StorageManager} storageManager - StorageManager instance
   */
  clearLocalTasksAfterMigration(storageManager) {
    if (!storageManager) {
      console.warn('No storage manager provided for clearing local tasks');
      return;
    }

    try {
      storageManager.clearLocalTasks();
      console.log('Local tasks cleared after successful migration');
    } catch (error) {
      console.error('Failed to clear local tasks after migration:', error);
      throw error;
    }
  }

  /**
   * Complete migration workflow: detect, upload, and clear local tasks
   * This method orchestrates the full migration process
   * @param {StorageManager} storageManager - StorageManager instance
   * @returns {Promise<object>} Migration results
   */
  async performMigration(storageManager) {
    if (!storageManager) {
      throw new Error('StorageManager is required for migration');
    }

    // Step 1: Detect local tasks
    if (!this.detectLocalTasks(storageManager)) {
      console.log('No local tasks to migrate');
      return { success: true, migrated: 0, total: 0 };
    }

    // Step 2: Get local tasks
    const localTasks = this.getLocalTasksForMigration(storageManager);
    
    if (localTasks.length === 0) {
      console.log('No tasks found in localStorage');
      return { success: true, migrated: 0, total: 0 };
    }

    try {
      // Step 3: Upload tasks to cloud
      const migrationResult = await this.migrateLocalTasks(localTasks);

      // Step 4: Clear localStorage only if migration was successful
      if (migrationResult.success) {
        this.clearLocalTasksAfterMigration(storageManager);
        console.log(`Migration complete: ${migrationResult.migrated}/${migrationResult.total} tasks migrated`);
      } else {
        console.warn(`Migration partially failed: ${migrationResult.migrated}/${migrationResult.total} tasks migrated`);
        // Don't clear localStorage if some tasks failed to migrate
      }

      return migrationResult;

    } catch (error) {
      console.error('Migration workflow failed:', error);
      // Don't clear localStorage on error to prevent data loss
      throw error;
    }
  }

  /**
   * Enable or disable auto-sync
   * @param {boolean} enabled - Whether to enable auto-sync
   */
  setAutoSync(enabled) {
    this.autoSyncEnabled = enabled;
  }

  /**
   * Check if auto-sync is enabled
   * @returns {boolean} Auto-sync status
   */
  isAutoSyncEnabled() {
    return this.autoSyncEnabled;
  }
}

// Make SyncManager available globally
if (typeof window !== 'undefined') {
  window.SyncManager = SyncManager;
}

// Export for Node.js testing
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { SyncManager };
}
