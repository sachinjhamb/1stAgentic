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
    apiBaseUrl: 'https://6hgehxlobc.execute-api.us-east-1.amazonaws.com/dev', // Will be replaced by deployment script
    googleClientId: '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', // Will be replaced by deployment script
    environment: 'development'
  },
  staging: {
    apiBaseUrl: 'https://6hgehxlobc.execute-api.us-east-1.amazonaws.com/dev', // Will be replaced by deployment script
    googleClientId: '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', // Will be replaced by deployment script
    environment: 'staging'
  },
  production: {
    apiBaseUrl: 'https://6hgehxlobc.execute-api.us-east-1.amazonaws.com/dev', // Will be replaced by deployment script
    googleClientId: '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', // Will be replaced by deployment script
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

// Make configuration available globally for the app
if (typeof window !== 'undefined') {
  window.APP_CONFIG = getConfig();
  window.getConfig = getConfig;
  window.detectEnvironment = detectEnvironment;
  window.config = config;
}
