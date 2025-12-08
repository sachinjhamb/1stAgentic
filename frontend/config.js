// Environment-specific configuration
const config = {
  local: {
    apiBaseUrl: 'http://localhost:3000',
    googleClientId: 'YOUR_GOOGLE_CLIENT_ID_HERE'
  },
  development: {
    apiBaseUrl: 'https://api-dev.yourdomain.com',
    googleClientId: 'YOUR_DEV_CLIENT_ID_HERE'
  },
  staging: {
    apiBaseUrl: 'https://api-staging.yourdomain.com',
    googleClientId: 'YOUR_STAGING_CLIENT_ID_HERE'
  },
  production: {
    apiBaseUrl: 'https://api.yourdomain.com',
    googleClientId: 'YOUR_PROD_CLIENT_ID_HERE'
  }
}

// Auto-detect environment based on hostname
function getEnvironment() {
  const hostname = window.location.hostname
  
  if (hostname === 'localhost' || hostname === '127.0.0.1') {
    return 'local'
  } else if (hostname.includes('dev')) {
    return 'development'
  } else if (hostname.includes('staging')) {
    return 'staging'
  } else {
    return 'production'
  }
}

// Export the configuration for the current environment
const currentEnvironment = getEnvironment()
const currentConfig = config[currentEnvironment]

// Make config available globally or as module
if (typeof module !== 'undefined' && module.exports) {
  module.exports = currentConfig
}

// Also make it available as a global variable for browser usage
if (typeof window !== 'undefined') {
  window.APP_CONFIG = currentConfig
}
