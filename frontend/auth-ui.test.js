/**
 * @jest-environment jsdom
 */

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
});
