// AuthManager - Manages Google OAuth authentication flow and session state
class AuthManager {
  constructor(clientId) {
    this.clientId = clientId;
    this.currentUser = null;
    this.idToken = null;
    this.authStateListeners = [];
    this.googleAuth = null;
    this.isInitialized = false;
  }

  /**
   * Initialize Google OAuth client
   * Loads the Google Identity Services library and sets up the OAuth client
   */
  async initialize() {
    if (this.isInitialized) {
      return;
    }

    try {
      // Wait for Google Identity Services library to load
      await this.loadGoogleLibrary();
      
      // Initialize Google OAuth
      this.googleAuth = google.accounts.oauth2.initTokenClient({
        client_id: this.clientId,
        scope: 'openid email profile',
        callback: (response) => {
          this.handleAuthResponse(response);
        }
      });

      // Check if user is already signed in (from sessionStorage)
      const storedToken = sessionStorage.getItem('google_id_token');
      const storedUser = sessionStorage.getItem('google_user');
      
      if (storedToken && storedUser) {
        try {
          this.idToken = storedToken;
          this.currentUser = JSON.parse(storedUser);
          this.notifyAuthStateChange(true);
        } catch (error) {
          // Invalid stored data, clear it
          sessionStorage.removeItem('google_id_token');
          sessionStorage.removeItem('google_user');
        }
      }

      this.isInitialized = true;
    } catch (error) {
      console.error('Failed to initialize AuthManager:', error);
      throw error;
    }
  }

  /**
   * Load Google Identity Services library dynamically
   */
  loadGoogleLibrary() {
    return new Promise((resolve, reject) => {
      // Check if already loaded
      if (window.google && window.google.accounts) {
        resolve();
        return;
      }

      // Load the library
      const script = document.createElement('script');
      script.src = 'https://accounts.google.com/gsi/client';
      script.async = true;
      script.defer = true;
      script.onload = () => {
        // Wait a bit for the library to fully initialize
        setTimeout(resolve, 100);
      };
      script.onerror = () => reject(new Error('Failed to load Google library'));
      document.head.appendChild(script);
    });
  }

  /**
   * Handle authentication response from Google
   */
  async handleAuthResponse(response) {
    if (response.access_token) {
      try {
        // Get user info using the access token
        const userInfo = await this.fetchUserInfo(response.access_token);
        
        // Store the token and user info
        this.idToken = response.access_token;
        this.currentUser = {
          id: userInfo.sub,
          email: userInfo.email,
          name: userInfo.name,
          picture: userInfo.picture
        };

        // Persist to sessionStorage
        sessionStorage.setItem('google_id_token', this.idToken);
        sessionStorage.setItem('google_user', JSON.stringify(this.currentUser));

        // Notify listeners
        this.notifyAuthStateChange(true);
      } catch (error) {
        console.error('Failed to get user info:', error);
        throw error;
      }
    } else if (response.error) {
      console.error('Authentication error:', response.error);
      throw new Error(response.error);
    }
  }

  /**
   * Fetch user info from Google using access token
   */
  async fetchUserInfo(accessToken) {
    const response = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: {
        'Authorization': `Bearer ${accessToken}`
      }
    });

    if (!response.ok) {
      throw new Error('Failed to fetch user info');
    }

    return await response.json();
  }

  /**
   * Trigger Google sign-in flow
   */
  async signIn() {
    if (!this.isInitialized) {
      throw new Error('AuthManager not initialized. Call initialize() first.');
    }

    try {
      // Request access token
      this.googleAuth.requestAccessToken();
    } catch (error) {
      console.error('Sign-in failed:', error);
      throw error;
    }
  }

  /**
   * Sign out and clear session
   */
  async signOut() {
    try {
      // Revoke the token if we have one
      if (this.idToken && window.google && window.google.accounts) {
        google.accounts.oauth2.revoke(this.idToken, () => {
          console.log('Token revoked');
        });
      }

      // Clear local state
      this.currentUser = null;
      this.idToken = null;

      // Clear sessionStorage
      sessionStorage.removeItem('google_id_token');
      sessionStorage.removeItem('google_user');

      // Notify listeners
      this.notifyAuthStateChange(false);
    } catch (error) {
      console.error('Sign-out failed:', error);
      throw error;
    }
  }

  /**
   * Get current user info
   */
  getCurrentUser() {
    return this.currentUser;
  }

  /**
   * Get ID token for API calls
   */
  getIdToken() {
    return this.idToken;
  }

  /**
   * Check if user is authenticated
   */
  isAuthenticated() {
    return this.currentUser !== null && this.idToken !== null;
  }

  /**
   * Add auth state change listener
   */
  onAuthStateChanged(callback) {
    if (typeof callback === 'function') {
      this.authStateListeners.push(callback);
      
      // Immediately call with current state
      callback(this.isAuthenticated(), this.currentUser);
    }
  }

  /**
   * Notify all listeners of auth state change
   */
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

// Make AuthManager available globally
if (typeof window !== 'undefined') {
  window.AuthManager = AuthManager;
}
