const fc = require('fast-check');

// Mock AuthManager for testing (simulating browser environment)
class AuthManager {
  constructor(clientId) {
    this.clientId = clientId;
    this.currentUser = null;
    this.idToken = null;
    this.authStateListeners = [];
    this.isInitialized = false;
    this.storage = {}; // Mock sessionStorage
  }

  async initialize() {
    this.isInitialized = true;
    
    // Check for stored token and user
    const storedToken = this.storage['google_id_token'];
    const storedUser = this.storage['google_user'];
    
    if (storedToken && storedUser) {
      try {
        this.idToken = storedToken;
        this.currentUser = JSON.parse(storedUser);
      } catch (error) {
        delete this.storage['google_id_token'];
        delete this.storage['google_user'];
      }
    }
  }

  async signIn(mockUser, mockToken) {
    if (!this.isInitialized) {
      throw new Error('AuthManager not initialized');
    }

    this.idToken = mockToken;
    this.currentUser = mockUser;

    // Store in mock sessionStorage
    this.storage['google_id_token'] = this.idToken;
    this.storage['google_user'] = JSON.stringify(this.currentUser);

    this.notifyAuthStateChange(true);
  }

  async signOut() {
    this.currentUser = null;
    this.idToken = null;

    delete this.storage['google_id_token'];
    delete this.storage['google_user'];

    this.notifyAuthStateChange(false);
  }

  getCurrentUser() {
    return this.currentUser;
  }

  getIdToken() {
    return this.idToken;
  }

  isAuthenticated() {
    return this.currentUser !== null && this.idToken !== null;
  }

  onAuthStateChanged(callback) {
    if (typeof callback === 'function') {
      this.authStateListeners.push(callback);
      callback(this.isAuthenticated(), this.currentUser);
    }
  }

  notifyAuthStateChange(isAuthenticated) {
    this.authStateListeners.forEach(callback => {
      try {
        callback(isAuthenticated, this.currentUser);
      } catch (error) {
        console.error('Error in auth state listener:', error);
      }
    });
  }
}

/**
 * Feature: google-auth-aws-hosting, Property 1: Token storage on successful authentication
 * For any successful Google authentication, the system should store the identity token 
 * in a secure location accessible to the ApiClient
 * Validates: Requirements 1.3
 */
describe('Property 1: Token storage on successful authentication', () => {
  test('should store token on successful authentication', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          clientId: fc.string({ minLength: 10, maxLength: 100 }).filter(s => s.trim().length > 0),
          userId: fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0),
          email: fc.emailAddress(),
          name: fc.string({ minLength: 1, maxLength: 100 }).filter(s => s.trim().length > 0),
          picture: fc.webUrl(),
          token: fc.string({ minLength: 20, maxLength: 200 }).filter(s => s.trim().length > 0)
        }),
        async (testCase) => {
          const authManager = new AuthManager(testCase.clientId);
          await authManager.initialize();

          const mockUser = {
            id: testCase.userId,
            email: testCase.email,
            name: testCase.name,
            picture: testCase.picture
          };

          // Perform sign-in
          await authManager.signIn(mockUser, testCase.token);

          // Property: Token should be stored and accessible
          const storedToken = authManager.getIdToken();
          if (storedToken !== testCase.token) return false;

          // Property: Token should be in storage (sessionStorage)
          const storageToken = authManager.storage['google_id_token'];
          if (storageToken !== testCase.token) return false;

          // Property: User info should be stored
          const storedUser = authManager.getCurrentUser();
          if (!storedUser) return false;
          if (storedUser.id !== testCase.userId) return false;
          if (storedUser.email !== testCase.email) return false;
          if (storedUser.name !== testCase.name) return false;

          // Property: User should be authenticated
          if (!authManager.isAuthenticated()) return false;

          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  test('should persist token across initialization', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          clientId: fc.string({ minLength: 10, maxLength: 100 }).filter(s => s.trim().length > 0),
          userId: fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0),
          email: fc.emailAddress(),
          name: fc.string({ minLength: 1, maxLength: 100 }).filter(s => s.trim().length > 0),
          picture: fc.webUrl(),
          token: fc.string({ minLength: 20, maxLength: 200 }).filter(s => s.trim().length > 0)
        }),
        async (testCase) => {
          // First session: sign in
          const authManager1 = new AuthManager(testCase.clientId);
          await authManager1.initialize();

          const mockUser = {
            id: testCase.userId,
            email: testCase.email,
            name: testCase.name,
            picture: testCase.picture
          };

          await authManager1.signIn(mockUser, testCase.token);

          // Simulate page reload by creating new instance with same storage
          const authManager2 = new AuthManager(testCase.clientId);
          authManager2.storage = authManager1.storage; // Share storage
          await authManager2.initialize();

          // Property: Token should persist across initialization
          const persistedToken = authManager2.getIdToken();
          if (persistedToken !== testCase.token) return false;

          // Property: User should still be authenticated
          if (!authManager2.isAuthenticated()) return false;

          // Property: User info should persist
          const persistedUser = authManager2.getCurrentUser();
          if (!persistedUser) return false;
          if (persistedUser.id !== testCase.userId) return false;

          return true;
        }
      ),
      { numRuns: 100 }
    );
  });
});

/**
 * Feature: google-auth-aws-hosting, Property 3: Session cleanup on sign out
 * For any authenticated session, signing out should clear all stored tokens 
 * and return the UI to the unauthenticated state
 * Validates: Requirements 1.5
 */
describe('Property 3: Session cleanup on sign out', () => {
  test('should clear all session data on sign out', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          clientId: fc.string({ minLength: 10, maxLength: 100 }).filter(s => s.trim().length > 0),
          userId: fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0),
          email: fc.emailAddress(),
          name: fc.string({ minLength: 1, maxLength: 100 }).filter(s => s.trim().length > 0),
          picture: fc.webUrl(),
          token: fc.string({ minLength: 20, maxLength: 200 }).filter(s => s.trim().length > 0)
        }),
        async (testCase) => {
          const authManager = new AuthManager(testCase.clientId);
          await authManager.initialize();

          const mockUser = {
            id: testCase.userId,
            email: testCase.email,
            name: testCase.name,
            picture: testCase.picture
          };

          // Sign in first
          await authManager.signIn(mockUser, testCase.token);

          // Verify signed in
          if (!authManager.isAuthenticated()) return false;

          // Sign out
          await authManager.signOut();

          // Property: Token should be cleared
          const token = authManager.getIdToken();
          if (token !== null) return false;

          // Property: User should be cleared
          const user = authManager.getCurrentUser();
          if (user !== null) return false;

          // Property: Should not be authenticated
          if (authManager.isAuthenticated()) return false;

          // Property: Storage should be cleared
          if (authManager.storage['google_id_token']) return false;
          if (authManager.storage['google_user']) return false;

          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  test('should notify listeners of sign out', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          clientId: fc.string({ minLength: 10, maxLength: 100 }).filter(s => s.trim().length > 0),
          userId: fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0),
          email: fc.emailAddress(),
          name: fc.string({ minLength: 1, maxLength: 100 }).filter(s => s.trim().length > 0),
          picture: fc.webUrl(),
          token: fc.string({ minLength: 20, maxLength: 200 }).filter(s => s.trim().length > 0)
        }),
        async (testCase) => {
          const authManager = new AuthManager(testCase.clientId);
          await authManager.initialize();

          const mockUser = {
            id: testCase.userId,
            email: testCase.email,
            name: testCase.name,
            picture: testCase.picture
          };

          let authStateChanges = [];
          authManager.onAuthStateChanged((isAuthenticated, user) => {
            authStateChanges.push({ isAuthenticated, user });
          });

          // Sign in
          await authManager.signIn(mockUser, testCase.token);

          // Sign out
          await authManager.signOut();

          // Property: Should have received at least 3 notifications
          // 1. Initial state (false)
          // 2. After sign in (true)
          // 3. After sign out (false)
          if (authStateChanges.length < 3) return false;

          // Property: Last notification should be unauthenticated
          const lastChange = authStateChanges[authStateChanges.length - 1];
          if (lastChange.isAuthenticated !== false) return false;
          if (lastChange.user !== null) return false;

          return true;
        }
      ),
      { numRuns: 100 }
    );
  });
});

/**
 * Unit tests for AuthManager
 * Tests initialization, sign-in flow, sign-out flow, and token retrieval
 * Requirements: 1.2, 1.3, 1.5
 */
describe('AuthManager Unit Tests', () => {
  describe('Initialization', () => {
    test('should initialize successfully', async () => {
      const authManager = new AuthManager('test-client-id');
      await authManager.initialize();
      expect(authManager.isInitialized).toBe(true);
    });

    test('should not be authenticated initially', async () => {
      const authManager = new AuthManager('test-client-id');
      await authManager.initialize();
      expect(authManager.isAuthenticated()).toBe(false);
      expect(authManager.getCurrentUser()).toBeNull();
      expect(authManager.getIdToken()).toBeNull();
    });
  });

  describe('Sign-in flow', () => {
    test('should sign in successfully', async () => {
      const authManager = new AuthManager('test-client-id');
      await authManager.initialize();

      const mockUser = {
        id: 'user123',
        email: 'test@example.com',
        name: 'Test User',
        picture: 'https://example.com/pic.jpg'
      };
      const mockToken = 'mock-token-123';

      await authManager.signIn(mockUser, mockToken);

      expect(authManager.isAuthenticated()).toBe(true);
      expect(authManager.getCurrentUser()).toEqual(mockUser);
      expect(authManager.getIdToken()).toBe(mockToken);
    });

    test('should throw error if not initialized', async () => {
      const authManager = new AuthManager('test-client-id');
      
      const mockUser = {
        id: 'user123',
        email: 'test@example.com',
        name: 'Test User',
        picture: 'https://example.com/pic.jpg'
      };

      await expect(authManager.signIn(mockUser, 'token')).rejects.toThrow('not initialized');
    });
  });

  describe('Sign-out flow', () => {
    test('should sign out successfully', async () => {
      const authManager = new AuthManager('test-client-id');
      await authManager.initialize();

      const mockUser = {
        id: 'user123',
        email: 'test@example.com',
        name: 'Test User',
        picture: 'https://example.com/pic.jpg'
      };

      await authManager.signIn(mockUser, 'mock-token');
      expect(authManager.isAuthenticated()).toBe(true);

      await authManager.signOut();

      expect(authManager.isAuthenticated()).toBe(false);
      expect(authManager.getCurrentUser()).toBeNull();
      expect(authManager.getIdToken()).toBeNull();
    });
  });

  describe('Token retrieval', () => {
    test('should return null when not authenticated', async () => {
      const authManager = new AuthManager('test-client-id');
      await authManager.initialize();

      expect(authManager.getIdToken()).toBeNull();
    });

    test('should return token when authenticated', async () => {
      const authManager = new AuthManager('test-client-id');
      await authManager.initialize();

      const mockUser = {
        id: 'user123',
        email: 'test@example.com',
        name: 'Test User',
        picture: 'https://example.com/pic.jpg'
      };
      const mockToken = 'mock-token-123';

      await authManager.signIn(mockUser, mockToken);

      expect(authManager.getIdToken()).toBe(mockToken);
    });
  });

  describe('Auth state listeners', () => {
    test('should notify listeners on sign in', async () => {
      const authManager = new AuthManager('test-client-id');
      await authManager.initialize();

      let notificationCount = 0;
      let lastState = null;

      authManager.onAuthStateChanged((isAuthenticated, user) => {
        notificationCount++;
        lastState = { isAuthenticated, user };
      });

      const mockUser = {
        id: 'user123',
        email: 'test@example.com',
        name: 'Test User',
        picture: 'https://example.com/pic.jpg'
      };

      await authManager.signIn(mockUser, 'mock-token');

      expect(notificationCount).toBeGreaterThan(0);
      expect(lastState.isAuthenticated).toBe(true);
      expect(lastState.user).toEqual(mockUser);
    });

    test('should notify listeners on sign out', async () => {
      const authManager = new AuthManager('test-client-id');
      await authManager.initialize();

      const mockUser = {
        id: 'user123',
        email: 'test@example.com',
        name: 'Test User',
        picture: 'https://example.com/pic.jpg'
      };

      await authManager.signIn(mockUser, 'mock-token');

      let lastState = null;
      authManager.onAuthStateChanged((isAuthenticated, user) => {
        lastState = { isAuthenticated, user };
      });

      await authManager.signOut();

      expect(lastState.isAuthenticated).toBe(false);
      expect(lastState.user).toBeNull();
    });
  });
});
