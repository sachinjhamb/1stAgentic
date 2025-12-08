// AuthUI - Renders authentication UI elements
class AuthUI {
  constructor(container, authManager) {
    this.container = container;
    this.authManager = authManager;
    this.syncStatusElement = null;
    this.syncStatusTimeout = null;
  }

  /**
   * Render sign-in screen
   * Displays a centered sign-in button when user is not authenticated
   */
  renderSignInScreen() {
    // Create sign-in overlay
    const signInOverlay = document.createElement('div');
    signInOverlay.className = 'auth-signin-overlay';
    signInOverlay.id = 'auth-signin-overlay';

    const signInCard = document.createElement('div');
    signInCard.className = 'auth-signin-card';

    // App logo/title
    const title = document.createElement('h1');
    title.className = 'auth-signin-title';
    title.textContent = 'To-Do App';

    // Description
    const description = document.createElement('p');
    description.className = 'auth-signin-description';
    description.textContent = 'Sign in with your Google account to sync your tasks across devices';

    // Sign-in button
    const signInButton = document.createElement('button');
    signInButton.className = 'auth-signin-button';
    signInButton.innerHTML = `
      <svg width="18" height="18" viewBox="0 0 18 18" xmlns="http://www.w3.org/2000/svg">
        <path fill="#4285F4" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.874 2.684-6.615z"/>
        <path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.258c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332C2.438 15.983 5.482 18 9 18z"/>
        <path fill="#FBBC05" d="M3.964 10.707c-.18-.54-.282-1.117-.282-1.707s.102-1.167.282-1.707V4.961H.957C.347 6.175 0 7.55 0 9s.348 2.825.957 4.039l3.007-2.332z"/>
        <path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0 5.482 0 2.438 2.017.957 4.961L3.964 7.293C4.672 5.163 6.656 3.58 9 3.58z"/>
      </svg>
      Sign in with Google
    `;
    signInButton.addEventListener('click', async () => {
      try {
        signInButton.disabled = true;
        signInButton.textContent = 'Signing in...';
        await this.authManager.signIn();
      } catch (error) {
        console.error('Sign-in error:', error);
        signInButton.disabled = false;
        signInButton.innerHTML = `
          <svg width="18" height="18" viewBox="0 0 18 18" xmlns="http://www.w3.org/2000/svg">
            <path fill="#4285F4" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.874 2.684-6.615z"/>
            <path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.258c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332C2.438 15.983 5.482 18 9 18z"/>
            <path fill="#FBBC05" d="M3.964 10.707c-.18-.54-.282-1.117-.282-1.707s.102-1.167.282-1.707V4.961H.957C.347 6.175 0 7.55 0 9s.348 2.825.957 4.039l3.007-2.332z"/>
            <path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0 5.482 0 2.438 2.017.957 4.961L3.964 7.293C4.672 5.163 6.656 3.58 9 3.58z"/>
          </svg>
          Sign in with Google
        `;
        alert('Sign-in failed. Please try again.');
      }
    });

    signInCard.appendChild(title);
    signInCard.appendChild(description);
    signInCard.appendChild(signInButton);
    signInOverlay.appendChild(signInCard);

    // Add to container
    this.container.appendChild(signInOverlay);
  }

  /**
   * Remove sign-in screen
   */
  removeSignInScreen() {
    const overlay = document.getElementById('auth-signin-overlay');
    if (overlay) {
      overlay.remove();
    }
  }

  /**
   * Render user profile in header
   * Displays user's profile picture, name, and sign-out button
   */
  renderUserProfile(user) {
    if (!user) {
      return;
    }

    // Remove sign-in screen if present
    this.removeSignInScreen();

    // Find or create user profile container in header
    const header = document.querySelector('header');
    if (!header) {
      console.error('Header element not found');
      return;
    }

    // Remove existing profile if any
    const existingProfile = document.getElementById('auth-user-profile');
    if (existingProfile) {
      existingProfile.remove();
    }

    // Create user profile element
    const profileContainer = document.createElement('div');
    profileContainer.id = 'auth-user-profile';
    profileContainer.className = 'auth-user-profile';

    // Profile picture
    const profilePicture = document.createElement('img');
    profilePicture.className = 'auth-user-picture';
    profilePicture.src = user.picture || 'https://via.placeholder.com/40';
    profilePicture.alt = user.name || 'User';
    profilePicture.title = user.email || '';

    // User name
    const userName = document.createElement('span');
    userName.className = 'auth-user-name';
    userName.textContent = user.name || user.email || 'User';

    // Sign-out button
    const signOutButton = document.createElement('button');
    signOutButton.className = 'auth-signout-button';
    signOutButton.textContent = 'Sign Out';
    signOutButton.addEventListener('click', async () => {
      try {
        signOutButton.disabled = true;
        signOutButton.textContent = 'Signing out...';
        await this.authManager.signOut();
      } catch (error) {
        console.error('Sign-out error:', error);
        signOutButton.disabled = false;
        signOutButton.textContent = 'Sign Out';
        alert('Sign-out failed. Please try again.');
      }
    });

    profileContainer.appendChild(profilePicture);
    profileContainer.appendChild(userName);
    profileContainer.appendChild(signOutButton);

    // Add to header
    header.appendChild(profileContainer);
  }

  /**
   * Remove user profile from header
   */
  removeUserProfile() {
    const profile = document.getElementById('auth-user-profile');
    if (profile) {
      profile.remove();
    }
  }

  /**
   * Render migration prompt dialog
   * Prompts user to migrate local tasks to cloud
   */
  renderMigrationPrompt(taskCount, onConfirm, onDecline) {
    // Create dialog overlay
    const dialogOverlay = document.createElement('div');
    dialogOverlay.className = 'auth-migration-overlay';
    dialogOverlay.id = 'auth-migration-overlay';

    const dialogContent = document.createElement('div');
    dialogContent.className = 'auth-migration-dialog';

    // Title
    const title = document.createElement('h2');
    title.className = 'auth-migration-title';
    title.textContent = 'Migrate Your Tasks';

    // Message
    const message = document.createElement('p');
    message.className = 'auth-migration-message';
    message.textContent = `We found ${taskCount} task${taskCount !== 1 ? 's' : ''} stored locally on this device. Would you like to sync ${taskCount !== 1 ? 'them' : 'it'} to your Google account?`;

    // Info text
    const info = document.createElement('p');
    info.className = 'auth-migration-info';
    info.textContent = 'Your tasks will be accessible from any device after migration.';

    // Button container
    const buttonContainer = document.createElement('div');
    buttonContainer.className = 'auth-migration-buttons';

    // Decline button
    const declineButton = document.createElement('button');
    declineButton.className = 'auth-migration-button auth-migration-decline';
    declineButton.textContent = 'No, Start Fresh';
    declineButton.addEventListener('click', () => {
      dialogOverlay.remove();
      if (typeof onDecline === 'function') {
        onDecline();
      }
    });

    // Confirm button
    const confirmButton = document.createElement('button');
    confirmButton.className = 'auth-migration-button auth-migration-confirm';
    confirmButton.textContent = 'Yes, Migrate Tasks';
    confirmButton.addEventListener('click', async () => {
      try {
        confirmButton.disabled = true;
        confirmButton.textContent = 'Migrating...';
        declineButton.disabled = true;
        
        if (typeof onConfirm === 'function') {
          await onConfirm();
        }
        
        dialogOverlay.remove();
      } catch (error) {
        console.error('Migration error:', error);
        confirmButton.disabled = false;
        confirmButton.textContent = 'Yes, Migrate Tasks';
        declineButton.disabled = false;
        alert('Migration failed. Please try again.');
      }
    });

    buttonContainer.appendChild(declineButton);
    buttonContainer.appendChild(confirmButton);

    dialogContent.appendChild(title);
    dialogContent.appendChild(message);
    dialogContent.appendChild(info);
    dialogContent.appendChild(buttonContainer);
    dialogOverlay.appendChild(dialogContent);

    // Add to container
    this.container.appendChild(dialogOverlay);
  }

  /**
   * Remove migration prompt
   */
  removeMigrationPrompt() {
    const overlay = document.getElementById('auth-migration-overlay');
    if (overlay) {
      overlay.remove();
    }
  }

  /**
   * Render sync status indicator
   * Shows syncing, success, error, or offline status
   * @param {Object} status - Status object with type and optional message
   * @param {string} status.type - 'syncing' | 'success' | 'error' | 'offline'
   * @param {string} status.message - Optional message to display
   */
  renderSyncStatus(status) {
    // Clear any existing timeout
    if (this.syncStatusTimeout) {
      clearTimeout(this.syncStatusTimeout);
      this.syncStatusTimeout = null;
    }

    // Find or create sync status container
    if (!this.syncStatusElement) {
      this.syncStatusElement = document.createElement('div');
      this.syncStatusElement.id = 'auth-sync-status';
      this.syncStatusElement.className = 'auth-sync-status';
      this.container.appendChild(this.syncStatusElement);
    }

    // Clear existing content
    this.syncStatusElement.innerHTML = '';
    this.syncStatusElement.className = 'auth-sync-status';

    // Add status-specific class
    if (status.type) {
      this.syncStatusElement.classList.add(`auth-sync-${status.type}`);
    }

    // Create icon
    const icon = document.createElement('span');
    icon.className = 'auth-sync-icon';
    
    switch (status.type) {
      case 'syncing':
        icon.innerHTML = '⟳';
        icon.classList.add('auth-sync-spinning');
        break;
      case 'success':
        icon.innerHTML = '✓';
        break;
      case 'error':
        icon.innerHTML = '✕';
        break;
      case 'offline':
        icon.innerHTML = '⚠';
        break;
      default:
        icon.innerHTML = '•';
    }

    // Create message
    const message = document.createElement('span');
    message.className = 'auth-sync-message';
    message.textContent = status.message || this.getDefaultMessage(status.type);

    this.syncStatusElement.appendChild(icon);
    this.syncStatusElement.appendChild(message);

    // Show the status
    this.syncStatusElement.classList.add('auth-sync-visible');

    // Auto-hide success messages after 3 seconds
    if (status.type === 'success') {
      this.syncStatusTimeout = setTimeout(() => {
        this.hideSyncStatus();
      }, 3000);
    }

    // Add retry button for errors
    if (status.type === 'error' && status.onRetry) {
      const retryButton = document.createElement('button');
      retryButton.className = 'auth-sync-retry';
      retryButton.textContent = 'Retry';
      retryButton.addEventListener('click', status.onRetry);
      this.syncStatusElement.appendChild(retryButton);
    }
  }

  /**
   * Hide sync status indicator
   */
  hideSyncStatus() {
    if (this.syncStatusElement) {
      this.syncStatusElement.classList.remove('auth-sync-visible');
    }
  }

  /**
   * Get default message for status type
   */
  getDefaultMessage(type) {
    const messages = {
      syncing: 'Syncing...',
      success: 'Synced',
      error: 'Sync failed',
      offline: 'Offline'
    };
    return messages[type] || '';
  }

  /**
   * Clear all auth UI elements
   */
  clearAll() {
    this.removeSignInScreen();
    this.removeUserProfile();
    this.removeMigrationPrompt();
    this.hideSyncStatus();
  }
}

// Make AuthUI available globally
if (typeof window !== 'undefined') {
  window.AuthUI = AuthUI;
}
