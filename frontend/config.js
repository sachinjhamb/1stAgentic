/**
 * Environment Configuration
 * Automatically detects environment based on hostname and provides appropriate configuration
 */

const config = {
  local: {
    apiBaseUrl: 'http://localhost:3000',
    googleClientId: 'YOUR_LOCAL_GOOGLE_CLIENT_ID',
    environment: 'local'
  },
  development: {
    apiBaseUrl: 'https://api-dev.yourdomain.com',
    googleClientId: 'YOUR_DEV_GOOGLE_CLIENT_ID',
    environment: 'development'
  },
  staging: {
    apiBaseUrl: 'https://api-staging.yourdomain.com',
    googleClientId: 'YOUR_STAGING_GOOGLE_CLIENT_ID',
    environment: 'staging'
  },
  production: {
    apiBaseUrl: 'https://api.yourdomain.com',
    googleClientId: 'YOUR_PROD_GOOGLE_CLIENT_ID',
    environment: 'production'
  }
};

/**
 * Detects the current environment based on hostname
 * @returns {string} Environment name ('local', 'development', 'staging', or 'production')
 */
function detectEnvironment() {
  const hostname = window.location.hostname;
  
  // Local development
  if (hostname === 'localhost' || hostname === '127.0.0.1') {
    return 'local';
  }
  
  // Development environment
  if (hostname.includes('dev.') || hostname.includes('-dev.')) {
    return 'development';
  }
  
  // Staging environment
  if (hostname.includes('staging.') || hostname.includes('-staging.')) {
    return 'staging';
  }
  
  // Production environment (default)
  return 'production';
}

/**
 * Gets the configuration for the current environment
 * @returns {Object} Configuration object with apiBaseUrl, googleClientId, and environment
 */
function getConfig() {
  const environment = detectEnvironment();
  return config[environment];
}

// Export for ES6 modules
export default getConfig();
export { getConfig, detectEnvironment, config };
