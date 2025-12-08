// ApiClient - Handles all HTTP communication with AWS backend
class ApiClient {
  constructor(baseUrl, authManager) {
    this.baseUrl = baseUrl;
    this.authManager = authManager;
    this.maxRetries = 3;
    this.retryDelay = 1000; // 1 second
  }

  /**
   * Generic request method with auth header and retry logic
   * @param {string} method - HTTP method (GET, POST, PUT, DELETE)
   * @param {string} endpoint - API endpoint (e.g., '/tasks')
   * @param {object} data - Request body data (optional)
   * @returns {Promise<object>} Response data
   */
  async request(method, endpoint, data = null) {
    // Ensure HTTPS for all communications (except localhost)
    const url = this.buildUrl(endpoint);
    
    // Get auth token
    const token = this.authManager.getIdToken();
    if (!token) {
      throw new Error('Not authenticated. Please sign in first.');
    }

    // Build request options
    const options = {
      method: method,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      }
    };

    // Add body for POST, PUT requests
    if (data && (method === 'POST' || method === 'PUT')) {
      options.body = JSON.stringify(data);
    }

    // Execute request with retry logic
    return await this.retry(async () => {
      const response = await fetch(url, options);
      
      // Handle different response statuses
      if (response.status === 401) {
        // Unauthorized - token invalid or expired
        throw new AuthenticationError('Authentication failed. Please sign in again.');
      }
      
      if (response.status === 403) {
        // Forbidden
        throw new AuthorizationError('You do not have permission to perform this action.');
      }
      
      if (response.status === 404) {
        // Not found
        throw new NotFoundError('Resource not found.');
      }
      
      if (response.status === 429) {
        // Rate limited
        const retryAfter = response.headers.get('Retry-After');
        throw new RateLimitError(`Rate limit exceeded. Retry after ${retryAfter || 'some time'}.`);
      }
      
      if (response.status >= 500) {
        // Server error - retryable
        throw new ServerError(`Server error: ${response.status}`);
      }
      
      if (!response.ok) {
        // Other errors
        const errorData = await response.json().catch(() => ({}));
        throw new ApiError(errorData.error?.message || `Request failed with status ${response.status}`, response.status);
      }
      
      // Parse and return response
      return await response.json();
    });
  }

  /**
   * Build full URL ensuring HTTPS for non-localhost
   */
  buildUrl(endpoint) {
    const url = `${this.baseUrl}${endpoint}`;
    
    // Ensure HTTPS for all non-localhost URLs
    if (!url.startsWith('http://localhost') && !url.startsWith('http://127.0.0.1') && url.startsWith('http://')) {
      return url.replace('http://', 'https://');
    }
    
    return url;
  }

  /**
   * Retry logic for failed requests
   * @param {Function} fn - Async function to retry
   * @param {number} maxAttempts - Maximum retry attempts (default: this.maxRetries)
   * @returns {Promise<any>} Result of successful attempt
   */
  async retry(fn, maxAttempts = this.maxRetries) {
    let lastError;
    
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error;
        
        // Don't retry on authentication/authorization errors
        if (error instanceof AuthenticationError || 
            error instanceof AuthorizationError ||
            error instanceof NotFoundError) {
          throw error;
        }
        
        // Don't retry on the last attempt
        if (attempt === maxAttempts) {
          break;
        }
        
        // Wait before retrying (exponential backoff)
        const delay = this.retryDelay * Math.pow(2, attempt - 1);
        await this.sleep(delay);
        
        console.log(`Retrying request (attempt ${attempt + 1}/${maxAttempts})...`);
      }
    }
    
    // All retries failed
    throw lastError;
  }

  /**
   * Sleep utility for retry delays
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Get all tasks for the authenticated user
   * @returns {Promise<Array>} Array of tasks
   */
  async getTasks() {
    try {
      const response = await this.request('GET', '/tasks');
      return response.tasks || [];
    } catch (error) {
      console.error('Failed to get tasks:', error);
      throw error;
    }
  }

  /**
   * Create a new task
   * @param {object} task - Task object to create
   * @returns {Promise<object>} Created task with taskId
   */
  async createTask(task) {
    try {
      const response = await this.request('POST', '/tasks', { task });
      return response;
    } catch (error) {
      console.error('Failed to create task:', error);
      throw error;
    }
  }

  /**
   * Update an existing task
   * @param {string} taskId - ID of task to update
   * @param {object} updates - Partial task object with updates
   * @returns {Promise<object>} Updated task
   */
  async updateTask(taskId, updates) {
    try {
      const response = await this.request('PUT', `/tasks/${taskId}`, { updates });
      return response.task;
    } catch (error) {
      console.error('Failed to update task:', error);
      throw error;
    }
  }

  /**
   * Delete a task
   * @param {string} taskId - ID of task to delete
   * @returns {Promise<object>} Success response
   */
  async deleteTask(taskId) {
    try {
      const response = await this.request('DELETE', `/tasks/${taskId}`);
      return response;
    } catch (error) {
      console.error('Failed to delete task:', error);
      throw error;
    }
  }

  /**
   * Sync multiple operations in batch
   * @param {Array} operations - Array of sync operations
   * @returns {Promise<object>} Sync results
   */
  async syncTasks(operations) {
    try {
      const response = await this.request('POST', '/tasks/sync', { operations });
      return response.results || [];
    } catch (error) {
      console.error('Failed to sync tasks:', error);
      throw error;
    }
  }

  /**
   * Handle errors with user-friendly messages
   */
  handleError(error) {
    if (error instanceof AuthenticationError) {
      return {
        type: 'auth',
        message: 'Please sign in again to continue.',
        action: 'sign-in'
      };
    }
    
    if (error instanceof AuthorizationError) {
      return {
        type: 'permission',
        message: 'You do not have permission to perform this action.',
        action: 'none'
      };
    }
    
    if (error instanceof NotFoundError) {
      return {
        type: 'not-found',
        message: 'The requested resource was not found.',
        action: 'refresh'
      };
    }
    
    if (error instanceof RateLimitError) {
      return {
        type: 'rate-limit',
        message: 'Too many requests. Please wait a moment and try again.',
        action: 'retry'
      };
    }
    
    if (error instanceof ServerError) {
      return {
        type: 'server',
        message: 'Server error. Please try again later.',
        action: 'retry'
      };
    }
    
    if (error instanceof NetworkError) {
      return {
        type: 'network',
        message: 'Network error. Please check your connection.',
        action: 'retry'
      };
    }
    
    // Generic error
    return {
      type: 'unknown',
      message: error.message || 'An unexpected error occurred.',
      action: 'retry'
    };
  }
}

// Custom error classes
class ApiError extends Error {
  constructor(message, statusCode) {
    super(message);
    this.name = 'ApiError';
    this.statusCode = statusCode;
  }
}

class AuthenticationError extends ApiError {
  constructor(message) {
    super(message, 401);
    this.name = 'AuthenticationError';
  }
}

class AuthorizationError extends ApiError {
  constructor(message) {
    super(message, 403);
    this.name = 'AuthorizationError';
  }
}

class NotFoundError extends ApiError {
  constructor(message) {
    super(message, 404);
    this.name = 'NotFoundError';
  }
}

class RateLimitError extends ApiError {
  constructor(message) {
    super(message, 429);
    this.name = 'RateLimitError';
  }
}

class ServerError extends ApiError {
  constructor(message) {
    super(message, 500);
    this.name = 'ServerError';
  }
}

class NetworkError extends Error {
  constructor(message) {
    super(message);
    this.name = 'NetworkError';
  }
}

// Make ApiClient and error classes available globally
if (typeof window !== 'undefined') {
  window.ApiClient = ApiClient;
  window.ApiError = ApiError;
  window.AuthenticationError = AuthenticationError;
  window.AuthorizationError = AuthorizationError;
  window.NotFoundError = NotFoundError;
  window.RateLimitError = RateLimitError;
  window.ServerError = ServerError;
  window.NetworkError = NetworkError;
}

// Export for Node.js testing
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    ApiClient,
    ApiError,
    AuthenticationError,
    AuthorizationError,
    NotFoundError,
    RateLimitError,
    ServerError,
    NetworkError
  };
}
