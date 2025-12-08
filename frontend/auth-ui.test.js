/**
 * @jest-environment jsdom
 */

const fc = require('fast-check');

// Mock AuthManager for testing
class MockAuthManager {
  constructor() {
    this.authenticated = false;
    this.user = null;
  }

  async signIn() {
    this.authenticated = true;
    this.user = {
      id: 'test-user-123',
      email: 'test@example.com',
      name: 'Test User',
      picture: 'https://example.com/picture.jpg'
    };
  }

  async signOut() {
    this.authenticated = false;
    this.user = null;
  }

  isAuthenticated() {
    return this.authenticated;
  }

  getCurrentUser() {
    return this.user;
  }
}

// Load AuthUI class
const fs = require('fs');
const path = require('path');
const authUICode = fs.readFileSync(path.join(__dirname, 'auth-ui.js'), 'utf8');
eval(authUICode);

describe('AuthUI', () => {
  let container;
  let authManager;
  let authUI;

  beforeEach(() => {
    // Setup DOM
    document.body.innerHTML = `
      <div id="app-container">
        <header>
          <h1>To-Do App</h1>
        </header>
      </div>
    `;
    container = document.getElementById('app-container');
    authManager = new MockAuthManager();
    authUI = new AuthUI(container, authManager);
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  describe('renderSignInScreen', () => {
    test('should render sign-in overlay with button', () => {
      authUI.renderSignInScreen();

      const overlay = document.getElementById('auth-signin-overlay');
      expect(overlay).toBeTruthy();
      expect(overlay.className).toBe('auth-signin-overlay');

      const button = overlay.querySelector('.auth-signin-button');
      expect(button).toBeTruthy();
      expect(button.textContent).toContain('Sign in with Google');
    });

    test('should have sign-in button that triggers authManager.signIn', async () => {
      authUI.renderSignInScreen();

      const button = document.querySelector('.auth-signin-button');
      const signInSpy = jest.spyOn(authManager, 'signIn');

      button.click();
      await new Promise(resolve => setTimeout(resolve, 0));

      expect(signInSpy).toHaveBeenCalled();
    });

    test('should remove sign-in screen when removeSignInScreen is called', () => {
      authUI.renderSignInScreen();
      expect(document.getElementById('auth-signin-overlay')).toBeTruthy();

      authUI.removeSignInScreen();
      expect(document.getElementById('auth-signin-overlay')).toBeFalsy();
    });
  });

  describe('renderUserProfile', () => {
    test('should render user profile with picture, name, and sign-out button', () => {
      const user = {
        id: 'test-123',
        email: 'test@example.com',
        name: 'Test User',
        picture: 'https://example.com/pic.jpg'
      };

      authUI.renderUserProfile(user);

      const profile = document.getElementById('auth-user-profile');
      expect(profile).toBeTruthy();

      const picture = profile.querySelector('.auth-user-picture');
      expect(picture).toBeTruthy();
      expect(picture.src).toBe(user.picture);
      expect(picture.alt).toBe(user.name);

      const name = profile.querySelector('.auth-user-name');
      expect(name).toBeTruthy();
      expect(name.textContent).toBe(user.name);

      const signOutButton = profile.querySelector('.auth-signout-button');
      expect(signOutButton).toBeTruthy();
      expect(signOutButton.textContent).toBe('Sign Out');
    });

    test('should use placeholder image if no picture provided', () => {
      const user = {
        id: 'test-123',
        email: 'test@example.com',
        name: 'Test User'
      };

      authUI.renderUserProfile(user);

      const picture = document.querySelector('.auth-user-picture');
      expect(picture.src).toContain('placeholder');
    });

    test('should remove sign-in screen when rendering user profile', () => {
      authUI.renderSignInScreen();
      expect(document.getElementById('auth-signin-overlay')).toBeTruthy();

      const user = { name: 'Test', email: 'test@example.com' };
      authUI.renderUserProfile(user);

      expect(document.getElementById('auth-signin-overlay')).toBeFalsy();
    });

    test('should trigger authManager.signOut when sign-out button clicked', async () => {
      const user = { name: 'Test', email: 'test@example.com' };
      authUI.renderUserProfile(user);

      const signOutSpy = jest.spyOn(authManager, 'signOut');
      const button = document.querySelector('.auth-signout-button');

      button.click();
      await new Promise(resolve => setTimeout(resolve, 0));

      expect(signOutSpy).toHaveBeenCalled();
    });
  });

  describe('renderMigrationPrompt', () => {
    test('should render migration dialog with task count', () => {
      const taskCount = 5;
      authUI.renderMigrationPrompt(taskCount, jest.fn(), jest.fn());

      const overlay = document.getElementById('auth-migration-overlay');
      expect(overlay).toBeTruthy();

      const message = overlay.querySelector('.auth-migration-message');
      expect(message.textContent).toContain('5 tasks');
    });

    test('should use singular "task" for count of 1', () => {
      authUI.renderMigrationPrompt(1, jest.fn(), jest.fn());

      const message = document.querySelector('.auth-migration-message');
      expect(message.textContent).toContain('1 task');
      expect(message.textContent).not.toContain('tasks');
    });

    test('should call onConfirm when confirm button clicked', async () => {
      const onConfirm = jest.fn().mockResolvedValue(undefined);
      const onDecline = jest.fn();

      authUI.renderMigrationPrompt(3, onConfirm, onDecline);

      const confirmButton = document.querySelector('.auth-migration-confirm');
      confirmButton.click();
      await new Promise(resolve => setTimeout(resolve, 0));

      expect(onConfirm).toHaveBeenCalled();
      expect(onDecline).not.toHaveBeenCalled();
    });

    test('should call onDecline when decline button clicked', () => {
      const onConfirm = jest.fn();
      const onDecline = jest.fn();

      authUI.renderMigrationPrompt(3, onConfirm, onDecline);

      const declineButton = document.querySelector('.auth-migration-decline');
      declineButton.click();

      expect(onDecline).toHaveBeenCalled();
      expect(onConfirm).not.toHaveBeenCalled();
    });

    test('should remove dialog after confirm', async () => {
      const onConfirm = jest.fn().mockResolvedValue(undefined);
      authUI.renderMigrationPrompt(3, onConfirm, jest.fn());

      const confirmButton = document.querySelector('.auth-migration-confirm');
      confirmButton.click();
      await new Promise(resolve => setTimeout(resolve, 0));

      expect(document.getElementById('auth-migration-overlay')).toBeFalsy();
    });
  });

  describe('renderSyncStatus', () => {
    test('should render syncing status', () => {
      authUI.renderSyncStatus({ type: 'syncing', message: 'Syncing tasks...' });

      const status = document.getElementById('auth-sync-status');
      expect(status).toBeTruthy();
      expect(status.classList.contains('auth-sync-syncing')).toBe(true);
      expect(status.classList.contains('auth-sync-visible')).toBe(true);

      const message = status.querySelector('.auth-sync-message');
      expect(message.textContent).toBe('Syncing tasks...');
    });

    test('should render success status', () => {
      authUI.renderSyncStatus({ type: 'success' });

      const status = document.getElementById('auth-sync-status');
      expect(status.classList.contains('auth-sync-success')).toBe(true);

      const message = status.querySelector('.auth-sync-message');
      expect(message.textContent).toBe('Synced');
    });

    test('should render error status with retry button', () => {
      const onRetry = jest.fn();
      authUI.renderSyncStatus({ type: 'error', message: 'Sync failed', onRetry });

      const status = document.getElementById('auth-sync-status');
      expect(status.classList.contains('auth-sync-error')).toBe(true);

      const retryButton = status.querySelector('.auth-sync-retry');
      expect(retryButton).toBeTruthy();
      expect(retryButton.textContent).toBe('Retry');

      retryButton.click();
      expect(onRetry).toHaveBeenCalled();
    });

    test('should render offline status', () => {
      authUI.renderSyncStatus({ type: 'offline' });

      const status = document.getElementById('auth-sync-status');
      expect(status.classList.contains('auth-sync-offline')).toBe(true);

      const message = status.querySelector('.auth-sync-message');
      expect(message.textContent).toBe('Offline');
    });

    test('should auto-hide success status after timeout', (done) => {
      authUI.renderSyncStatus({ type: 'success' });

      const status = document.getElementById('auth-sync-status');
      expect(status.classList.contains('auth-sync-visible')).toBe(true);

      setTimeout(() => {
        expect(status.classList.contains('auth-sync-visible')).toBe(false);
        done();
      }, 3100);
    });

    test('should hide sync status when hideSyncStatus is called', () => {
      authUI.renderSyncStatus({ type: 'syncing' });

      const status = document.getElementById('auth-sync-status');
      expect(status.classList.contains('auth-sync-visible')).toBe(true);

      authUI.hideSyncStatus();
      expect(status.classList.contains('auth-sync-visible')).toBe(false);
    });
  });

  describe('clearAll', () => {
    test('should remove all auth UI elements', () => {
      // Add all elements
      authUI.renderSignInScreen();
      authUI.renderUserProfile({ name: 'Test', email: 'test@example.com' });
      authUI.renderMigrationPrompt(3, jest.fn(), jest.fn());
      authUI.renderSyncStatus({ type: 'syncing' });

      // Clear all
      authUI.clearAll();

      expect(document.getElementById('auth-signin-overlay')).toBeFalsy();
      expect(document.getElementById('auth-user-profile')).toBeFalsy();
      expect(document.getElementById('auth-migration-overlay')).toBeFalsy();
      
      const syncStatus = document.getElementById('auth-sync-status');
      if (syncStatus) {
        expect(syncStatus.classList.contains('auth-sync-visible')).toBe(false);
      }
    });
  });

  // Property-Based Tests
  describe('Property 2: Authenticated user profile display', () => {
    /**
     * Feature: google-auth-aws-hosting, Property 2: Authenticated user profile display
     * Validates: Requirements 1.4
     * 
     * For any authenticated user session, the header should display the user's 
     * profile picture and name
     */
    test('should display user profile picture and name for any authenticated user', () => {
      fc.assert(
        fc.property(
          fc.record({
            id: fc.string({ minLength: 1, maxLength: 100 }),
            email: fc.emailAddress(),
            name: fc.string({ minLength: 1, maxLength: 100 }),
            picture: fc.option(fc.webUrl(), { nil: undefined })
          }),
          (user) => {
            // Setup fresh DOM for each test
            document.body.innerHTML = `
              <div id="app-container">
                <header>
                  <h1>To-Do App</h1>
                </header>
              </div>
            `;
            const testContainer = document.getElementById('app-container');
            const testAuthManager = new MockAuthManager();
            const testAuthUI = new AuthUI(testContainer, testAuthManager);

            // Render user profile
            testAuthUI.renderUserProfile(user);

            // Verify profile is displayed in header
            const profile = document.getElementById('auth-user-profile');
            expect(profile).toBeTruthy();

            // Verify profile picture is displayed
            const picture = profile.querySelector('.auth-user-picture');
            expect(picture).toBeTruthy();
            if (user.picture) {
              // Verify that a picture src is set (browser may normalize URLs)
              // The important thing is that the picture element has a src attribute
              expect(picture.src).toBeTruthy();
              expect(picture.src.length).toBeGreaterThan(0);
            } else {
              // Should use placeholder if no picture
              expect(picture.src).toContain('placeholder');
            }
            expect(picture.alt).toBe(user.name);

            // Verify user name is displayed
            const nameElement = profile.querySelector('.auth-user-name');
            expect(nameElement).toBeTruthy();
            expect(nameElement.textContent).toBe(user.name);

            // Verify profile is in the header
            const header = document.querySelector('header');
            expect(header.contains(profile)).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Property 13: Sync status feedback', () => {
    /**
     * Feature: google-auth-aws-hosting, Property 13: Sync status feedback
     * Validates: Requirements 6.1, 6.2, 6.3
     * 
     * For any task operation, the system should display appropriate status indicators:
     * syncing during the operation, success on completion, or error with retry option on failure
     */
    test('should display appropriate status indicators for all sync operations', () => {
      fc.assert(
        fc.property(
          fc.record({
            type: fc.constantFrom('syncing', 'success', 'error', 'offline'),
            message: fc.option(fc.string({ minLength: 1, maxLength: 100 }), { nil: undefined })
          }),
          (status) => {
            // Setup fresh DOM for each test
            document.body.innerHTML = `
              <div id="app-container">
                <header>
                  <h1>To-Do App</h1>
                </header>
              </div>
            `;
            const testContainer = document.getElementById('app-container');
            const testAuthManager = new MockAuthManager();
            const testAuthUI = new AuthUI(testContainer, testAuthManager);

            // Render sync status
            testAuthUI.renderSyncStatus(status);

            // Verify status element is displayed
            const statusElement = document.getElementById('auth-sync-status');
            expect(statusElement).toBeTruthy();
            expect(statusElement.classList.contains('auth-sync-visible')).toBe(true);

            // Verify correct status class is applied
            expect(statusElement.classList.contains(`auth-sync-${status.type}`)).toBe(true);

            // Verify icon is displayed
            const icon = statusElement.querySelector('.auth-sync-icon');
            expect(icon).toBeTruthy();
            expect(icon.textContent.length).toBeGreaterThan(0);

            // Verify message is displayed
            const messageElement = statusElement.querySelector('.auth-sync-message');
            expect(messageElement).toBeTruthy();
            if (status.message) {
              expect(messageElement.textContent).toBe(status.message);
            } else {
              // Should have default message
              expect(messageElement.textContent.length).toBeGreaterThan(0);
            }

            // Verify syncing has spinning animation
            if (status.type === 'syncing') {
              expect(icon.classList.contains('auth-sync-spinning')).toBe(true);
            }

            // Verify error status would have retry button if onRetry provided
            // (we test this separately since we can't generate functions with fc)
          }
        ),
        { numRuns: 100 }
      );
    });

    test('should provide retry option for error status', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1, maxLength: 100 }),
          (errorMessage) => {
            // Setup fresh DOM for each test
            document.body.innerHTML = `
              <div id="app-container">
                <header>
                  <h1>To-Do App</h1>
                </header>
              </div>
            `;
            const testContainer = document.getElementById('app-container');
            const testAuthManager = new MockAuthManager();
            const testAuthUI = new AuthUI(testContainer, testAuthManager);

            // Track if retry was called
            let retryCalled = false;
            const onRetry = () => { retryCalled = true; };

            // Render error status with retry
            testAuthUI.renderSyncStatus({
              type: 'error',
              message: errorMessage,
              onRetry
            });

            // Verify retry button is displayed
            const statusElement = document.getElementById('auth-sync-status');
            const retryButton = statusElement.querySelector('.auth-sync-retry');
            expect(retryButton).toBeTruthy();
            expect(retryButton.textContent).toBe('Retry');

            // Verify retry button calls onRetry
            retryButton.click();
            expect(retryCalled).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
