const fc = require('fast-check');
const {
  ApiClient,
  AuthenticationError,
  AuthorizationError,
  NotFoundError,
  RateLimitError,
  ServerError
} = require('./api-client.js');

// Mock AuthManager for testing
class MockAuthManager {
  constructor(token = 'mock-token-123') {
    this.token = token;
  }

  getIdToken() {
    return this.token;
  }

  setToken(token) {
    this.token = token;
  }
}

// Mock fetch for testing
global.fetch = jest.fn();

/**
 * Feature: google-auth-aws-hosting, Property 10: HTTPS for all communications
 * For any API request from the frontend, the URL should use the HTTPS protocol
 * Validates: Requirements 3.5
 */
describe('Property 10: HTTPS for all communications', () => {
  beforeEach(() => {
    fetch.mockClear();
  });

  test('should use HTTPS for all non-localhost URLs', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          // Generate various domain names (not localhost)
          domain: fc.oneof(
            fc.constant('api.example.com'),
            fc.constant('api-dev.example.com'),
            fc.constant('api-staging.example.com'),
            fc.constant('production.api.com'),
            fc.domain()
          ),
          endpoint: fc.oneof(
            fc.constant('/tasks'),
            fc.constant('/tasks/123'),
            fc.constant('/tasks/sync')
          ),
          method: fc.constantFrom('GET', 'POST', 'PUT', 'DELETE')
        }),
        async (testCase) => {
          // Create API client with HTTP URL (should be converted to HTTPS)
          const baseUrl = `http://${testCase.domain}`;
          const authManager = new MockAuthManager();
          const apiClient = new ApiClient(baseUrl, authManager);

          // Mock successful response
          fetch.mockResolvedValueOnce({
            ok: true,
            status: 200,
            json: async () => ({ success: true })
          });

          try {
            await apiClient.request(testCase.method, testCase.endpoint);
          } catch (error) {
            // Ignore errors, we're just checking the URL
          }

          // Property: The URL used should be HTTPS
          const callArgs = fetch.mock.calls[0];
          if (!callArgs) return false;

          const usedUrl = callArgs[0];
          
          // Should start with https:// not http://
          if (!usedUrl.startsWith('https://')) return false;
          
          // Should not contain http:// (except in localhost cases)
          if (usedUrl.includes('http://') && !usedUrl.includes('localhost') && !usedUrl.includes('127.0.0.1')) {
            return false;
          }

          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  test('should allow HTTP for localhost URLs', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          localhost: fc.constantFrom('localhost', '127.0.0.1'),
          port: fc.integer({ min: 3000, max: 9999 }),
          endpoint: fc.constantFrom('/tasks', '/tasks/123', '/tasks/sync'),
          method: fc.constantFrom('GET', 'POST', 'PUT', 'DELETE')
        }),
        async (testCase) => {
          const baseUrl = `http://${testCase.localhost}:${testCase.port}`;
          const authManager = new MockAuthManager();
          const apiClient = new ApiClient(baseUrl, authManager);

          // Mock successful response
          fetch.mockResolvedValueOnce({
            ok: true,
            status: 200,
            json: async () => ({ success: true }),
            headers: {
              get: () => null
            }
          });

          try {
            await apiClient.request(testCase.method, testCase.endpoint);
          } catch (error) {
            // Ignore errors
          }

          // Property: Localhost URLs can use HTTP
          const callArgs = fetch.mock.calls[fetch.mock.calls.length - 1];
          if (!callArgs) return false;

          const usedUrl = callArgs[0];
          
          // Should start with http://localhost or http://127.0.0.1
          const isValidLocalhost = usedUrl.startsWith(`http://${testCase.localhost}`);
          
          return isValidLocalhost;
        }
      ),
      { numRuns: 100 }
    );
  });

  test('should include Authorization header in all requests', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          baseUrl: fc.webUrl({ validSchemes: ['https'] }),
          endpoint: fc.constantFrom('/tasks', '/tasks/123', '/tasks/sync'),
          method: fc.constantFrom('GET', 'POST', 'PUT', 'DELETE'),
          token: fc.string({ minLength: 20, maxLength: 200 }).filter(s => s.trim().length >= 20)
        }),
        async (testCase) => {
          const authManager = new MockAuthManager(testCase.token);
          const apiClient = new ApiClient(testCase.baseUrl, authManager);

          // Mock successful response
          fetch.mockResolvedValueOnce({
            ok: true,
            status: 200,
            json: async () => ({ success: true }),
            headers: {
              get: () => null
            }
          });

          try {
            await apiClient.request(testCase.method, testCase.endpoint);
          } catch (error) {
            // Ignore errors
          }

          // Property: Authorization header should be present with Bearer token
          const callArgs = fetch.mock.calls[fetch.mock.calls.length - 1];
          if (!callArgs) return false;

          const options = callArgs[1];
          if (!options || !options.headers) return false;

          const authHeader = options.headers['Authorization'];
          if (!authHeader) return false;

          // Should be in format "Bearer {token}"
          if (!authHeader.startsWith('Bearer ')) return false;
          if (authHeader !== `Bearer ${testCase.token}`) return false;

          return true;
        }
      ),
      { numRuns: 100 }
    );
  });
});

/**
 * Feature: google-auth-aws-hosting, Property 9: Invalid token rejection
 * For any API request with an invalid or expired token, the backend should reject 
 * the request with a 401 authentication error
 * Validates: Requirements 3.4
 */
describe('Property 9: Invalid token rejection', () => {
  beforeEach(() => {
    fetch.mockClear();
  });

  test('should throw AuthenticationError on 401 response', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          baseUrl: fc.webUrl({ validSchemes: ['https'] }),
          endpoint: fc.constantFrom('/tasks', '/tasks/123', '/tasks/sync'),
          method: fc.constantFrom('GET', 'POST', 'PUT', 'DELETE')
        }),
        async (testCase) => {
          const authManager = new MockAuthManager('invalid-token');
          const apiClient = new ApiClient(testCase.baseUrl, authManager);

          // Mock 401 Unauthorized response
          fetch.mockResolvedValueOnce({
            ok: false,
            status: 401,
            json: async () => ({ error: { message: 'Invalid token' } })
          });

          let threwAuthError = false;
          try {
            await apiClient.request(testCase.method, testCase.endpoint);
          } catch (error) {
            // Property: Should throw AuthenticationError
            if (error instanceof AuthenticationError) {
              threwAuthError = true;
            }
          }

          return threwAuthError;
        }
      ),
      { numRuns: 100 }
    );
  });

  test('should not retry on authentication errors', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          baseUrl: fc.webUrl({ validSchemes: ['https'] }),
          endpoint: fc.constantFrom('/tasks', '/tasks/123')
        }),
        async (testCase) => {
          const authManager = new MockAuthManager('expired-token');
          const apiClient = new ApiClient(testCase.baseUrl, authManager);

          // Clear previous calls
          fetch.mockClear();

          // Mock 401 response
          fetch.mockResolvedValue({
            ok: false,
            status: 401,
            json: async () => ({ error: { message: 'Token expired' } }),
            headers: {
              get: () => null
            }
          });

          try {
            await apiClient.request('GET', testCase.endpoint);
          } catch (error) {
            // Ignore error
          }

          // Property: Should only call fetch once (no retries for auth errors)
          const callCount = fetch.mock.calls.length;
          return callCount === 1;
        }
      ),
      { numRuns: 100 }
    );
  });
});

/**
 * Unit tests for ApiClient
 * Tests request formatting, error handling, and retry logic
 * Requirements: 2.1, 2.2, 2.3, 2.4
 */
describe('ApiClient Unit Tests', () => {
  let authManager;
  let apiClient;

  beforeEach(() => {
    fetch.mockClear();
    authManager = new MockAuthManager('test-token-123');
    apiClient = new ApiClient('https://api.example.com', authManager);
  });

  describe('Request formatting', () => {
    test('should format GET request correctly', async () => {
      fetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ tasks: [] })
      });

      await apiClient.getTasks();

      expect(fetch).toHaveBeenCalledWith(
        'https://api.example.com/tasks',
        expect.objectContaining({
          method: 'GET',
          headers: expect.objectContaining({
            'Authorization': 'Bearer test-token-123',
            'Content-Type': 'application/json'
          })
        })
      );
    });

    test('should format POST request with body', async () => {
      const task = { id: '1', text: 'Test task', completed: false };
      
      fetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ task, taskId: '1' })
      });

      await apiClient.createTask(task);

      expect(fetch).toHaveBeenCalledWith(
        'https://api.example.com/tasks',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Authorization': 'Bearer test-token-123',
            'Content-Type': 'application/json'
          }),
          body: JSON.stringify({ task })
        })
      );
    });

    test('should format PUT request with body', async () => {
      const updates = { completed: true };
      
      fetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ task: { id: '1', ...updates } })
      });

      await apiClient.updateTask('1', updates);

      expect(fetch).toHaveBeenCalledWith(
        'https://api.example.com/tasks/1',
        expect.objectContaining({
          method: 'PUT',
          body: JSON.stringify({ updates })
        })
      );
    });

    test('should format DELETE request correctly', async () => {
      fetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ success: true })
      });

      await apiClient.deleteTask('1');

      expect(fetch).toHaveBeenCalledWith(
        'https://api.example.com/tasks/1',
        expect.objectContaining({
          method: 'DELETE'
        })
      );
    });
  });

  describe('Error handling', () => {
    test('should throw error when not authenticated', async () => {
      authManager.setToken(null);

      await expect(apiClient.getTasks()).rejects.toThrow('Not authenticated');
      
      // Restore token for other tests
      authManager.setToken('test-token-123');
    });

    test('should throw AuthenticationError on 401', async () => {
      fetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        headers: {
          get: () => null
        },
        json: async () => ({ error: { message: 'Unauthorized' } })
      });

      await expect(apiClient.getTasks()).rejects.toThrow(AuthenticationError);
    });

    test('should throw AuthorizationError on 403', async () => {
      fetch.mockResolvedValueOnce({
        ok: false,
        status: 403,
        headers: {
          get: () => null
        },
        json: async () => ({ error: { message: 'Forbidden' } })
      });

      await expect(apiClient.getTasks()).rejects.toThrow(AuthorizationError);
    });

    test('should throw NotFoundError on 404', async () => {
      fetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        headers: {
          get: () => null
        },
        json: async () => ({ error: { message: 'Not found' } })
      });

      await expect(apiClient.getTasks()).rejects.toThrow(NotFoundError);
    });

    test('should throw RateLimitError on 429', async () => {
      // Mock all 3 retry attempts with 429
      for (let i = 0; i < 3; i++) {
        fetch.mockResolvedValueOnce({
          ok: false,
          status: 429,
          headers: {
            get: (name) => name === 'Retry-After' ? '60' : null
          },
          json: async () => ({ error: { message: 'Rate limited' } })
        });
      }

      await expect(apiClient.getTasks()).rejects.toThrow(RateLimitError);
    });

    test('should throw ServerError on 500', async () => {
      // Mock all 3 retry attempts with 500
      for (let i = 0; i < 3; i++) {
        fetch.mockResolvedValueOnce({
          ok: false,
          status: 500,
          headers: {
            get: () => null
          },
          json: async () => ({ error: { message: 'Internal server error' } })
        });
      }

      await expect(apiClient.getTasks()).rejects.toThrow(ServerError);
    });
  });

  describe('Retry logic', () => {
    test('should retry on server errors', async () => {
      // First two calls fail, third succeeds
      fetch
        .mockResolvedValueOnce({
          ok: false,
          status: 500,
          json: async () => ({ error: { message: 'Server error' } })
        })
        .mockResolvedValueOnce({
          ok: false,
          status: 500,
          json: async () => ({ error: { message: 'Server error' } })
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({ tasks: [] })
        });

      const result = await apiClient.getTasks();

      expect(fetch).toHaveBeenCalledTimes(3);
      expect(result).toEqual([]);
    });

    test('should not retry on authentication errors', async () => {
      fetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: async () => ({ error: { message: 'Unauthorized' } })
      });

      await expect(apiClient.getTasks()).rejects.toThrow(AuthenticationError);

      // Should only be called once (no retries)
      expect(fetch).toHaveBeenCalledTimes(1);
    });

    test('should not retry on authorization errors', async () => {
      fetch.mockResolvedValueOnce({
        ok: false,
        status: 403,
        json: async () => ({ error: { message: 'Forbidden' } })
      });

      await expect(apiClient.getTasks()).rejects.toThrow(AuthorizationError);

      expect(fetch).toHaveBeenCalledTimes(1);
    });

    test('should not retry on not found errors', async () => {
      fetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        json: async () => ({ error: { message: 'Not found' } })
      });

      await expect(apiClient.deleteTask('999')).rejects.toThrow(NotFoundError);

      expect(fetch).toHaveBeenCalledTimes(1);
    });

    test('should fail after max retries', async () => {
      // All calls fail
      fetch.mockResolvedValue({
        ok: false,
        status: 500,
        json: async () => ({ error: { message: 'Server error' } })
      });

      await expect(apiClient.getTasks()).rejects.toThrow(ServerError);

      // Should retry 3 times (maxRetries = 3)
      expect(fetch).toHaveBeenCalledTimes(3);
    });
  });

  describe('Task operations', () => {
    test('getTasks should return tasks array', async () => {
      const mockTasks = [
        { id: '1', text: 'Task 1', completed: false },
        { id: '2', text: 'Task 2', completed: true }
      ];

      fetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ tasks: mockTasks })
      });

      const result = await apiClient.getTasks();

      expect(result).toEqual(mockTasks);
    });

    test('createTask should return created task', async () => {
      const task = { id: '1', text: 'New task', completed: false };
      const response = { task, taskId: '1' };

      fetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => response
      });

      const result = await apiClient.createTask(task);

      expect(result).toEqual(response);
    });

    test('updateTask should return updated task', async () => {
      const updates = { completed: true };
      const updatedTask = { id: '1', text: 'Task', completed: true };

      fetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ task: updatedTask })
      });

      const result = await apiClient.updateTask('1', updates);

      expect(result).toEqual(updatedTask);
    });

    test('deleteTask should return success', async () => {
      fetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ success: true })
      });

      const result = await apiClient.deleteTask('1');

      expect(result).toEqual({ success: true });
    });

    test('syncTasks should return sync results', async () => {
      const operations = [
        { type: 'CREATE', taskId: '1', task: { text: 'Task 1' } },
        { type: 'UPDATE', taskId: '2', task: { completed: true } }
      ];
      const results = [
        { operation: operations[0], success: true },
        { operation: operations[1], success: true }
      ];

      fetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ results })
      });

      const result = await apiClient.syncTasks(operations);

      expect(result).toEqual(results);
    });
  });

  describe('Error handler', () => {
    test('should handle authentication errors', () => {
      const error = new AuthenticationError('Invalid token');
      const handled = apiClient.handleError(error);

      expect(handled.type).toBe('auth');
      expect(handled.action).toBe('sign-in');
    });

    test('should handle authorization errors', () => {
      const error = new AuthorizationError('Forbidden');
      const handled = apiClient.handleError(error);

      expect(handled.type).toBe('permission');
      expect(handled.action).toBe('none');
    });

    test('should handle not found errors', () => {
      const error = new NotFoundError('Not found');
      const handled = apiClient.handleError(error);

      expect(handled.type).toBe('not-found');
      expect(handled.action).toBe('refresh');
    });

    test('should handle rate limit errors', () => {
      const error = new RateLimitError('Too many requests');
      const handled = apiClient.handleError(error);

      expect(handled.type).toBe('rate-limit');
      expect(handled.action).toBe('retry');
    });

    test('should handle server errors', () => {
      const error = new ServerError('Internal error');
      const handled = apiClient.handleError(error);

      expect(handled.type).toBe('server');
      expect(handled.action).toBe('retry');
    });
  });
});
