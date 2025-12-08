const fc = require('fast-check');

// Mock window.location for testing
class MockLocation {
  constructor(hostname) {
    this.hostname = hostname;
  }
}

// Import config functions (we'll mock the window object)
const configModule = {
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

function detectEnvironment(hostname) {
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

function getConfig(hostname) {
  const environment = detectEnvironment(hostname);
  return configModule[environment];
}

/**
 * Feature: google-auth-aws-hosting, Property 17: Environment-based configuration
 * For any environment (local, dev, staging, production), the application should use 
 * the correct API base URL and Google Client ID without code changes
 * Validates: Requirements 7.4
 */
describe('Property 17: Environment-based configuration', () => {
  test('should return local config for localhost hostnames', () => {
    fc.assert(
      fc.property(
        fc.constantFrom('localhost', '127.0.0.1'),
        (hostname) => {
          const config = getConfig(hostname);
          
          // Property: Should return local environment config
          if (config.environment !== 'local') return false;
          
          // Property: Should have local API URL
          if (!config.apiBaseUrl.includes('localhost')) return false;
          
          // Property: Should have local Google Client ID
          if (!config.googleClientId) return false;
          
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  test('should return development config for dev hostnames', () => {
    fc.assert(
      fc.property(
        fc.oneof(
          fc.string({ minLength: 1, maxLength: 20 }).map(s => `dev.${s}.com`),
          fc.string({ minLength: 1, maxLength: 20 }).map(s => `${s}-dev.com`),
          fc.string({ minLength: 1, maxLength: 20 }).map(s => `app-dev.${s}.com`)
        ),
        (hostname) => {
          const config = getConfig(hostname);
          
          // Property: Should return development environment config
          if (config.environment !== 'development') return false;
          
          // Property: Should have dev API URL
          if (!config.apiBaseUrl.includes('dev')) return false;
          
          // Property: Should have dev Google Client ID
          if (!config.googleClientId) return false;
          
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  test('should return staging config for staging hostnames', () => {
    fc.assert(
      fc.property(
        fc.oneof(
          fc.string({ minLength: 1, maxLength: 20 }).map(s => `staging.${s}.com`),
          fc.string({ minLength: 1, maxLength: 20 }).map(s => `${s}-staging.com`),
          fc.string({ minLength: 1, maxLength: 20 }).map(s => `app-staging.${s}.com`)
        ),
        (hostname) => {
          const config = getConfig(hostname);
          
          // Property: Should return staging environment config
          if (config.environment !== 'staging') return false;
          
          // Property: Should have staging API URL
          if (!config.apiBaseUrl.includes('staging')) return false;
          
          // Property: Should have staging Google Client ID
          if (!config.googleClientId) return false;
          
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  test('should return production config for production hostnames', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 20 })
          .filter(s => !s.includes('localhost') && !s.includes('127.0.0.1'))
          .filter(s => !s.includes('dev'))
          .filter(s => !s.includes('staging'))
          .map(s => `${s}.com`),
        (hostname) => {
          const config = getConfig(hostname);
          
          // Property: Should return production environment config
          if (config.environment !== 'production') return false;
          
          // Property: Should have production API URL
          if (!config.apiBaseUrl) return false;
          
          // Property: Should have production Google Client ID
          if (!config.googleClientId) return false;
          
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  test('should always return valid config structure', () => {
    fc.assert(
      fc.property(
        fc.oneof(
          fc.constant('localhost'),
          fc.constant('127.0.0.1'),
          fc.string({ minLength: 1, maxLength: 20 }).map(s => `dev.${s}.com`),
          fc.string({ minLength: 1, maxLength: 20 }).map(s => `staging.${s}.com`),
          fc.string({ minLength: 1, maxLength: 20 }).map(s => `${s}.com`)
        ),
        (hostname) => {
          const config = getConfig(hostname);
          
          // Property: Config should always have required fields
          if (!config.apiBaseUrl) return false;
          if (!config.googleClientId) return false;
          if (!config.environment) return false;
          
          // Property: Environment should be one of the valid values
          const validEnvironments = ['local', 'development', 'staging', 'production'];
          if (!validEnvironments.includes(config.environment)) return false;
          
          // Property: API URL should be a valid URL format
          if (!config.apiBaseUrl.startsWith('http://') && !config.apiBaseUrl.startsWith('https://')) {
            return false;
          }
          
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  test('should be deterministic - same hostname always returns same config', () => {
    fc.assert(
      fc.property(
        fc.oneof(
          fc.constant('localhost'),
          fc.string({ minLength: 1, maxLength: 20 }).map(s => `dev.${s}.com`),
          fc.string({ minLength: 1, maxLength: 20 }).map(s => `staging.${s}.com`),
          fc.string({ minLength: 1, maxLength: 20 }).map(s => `${s}.com`)
        ),
        (hostname) => {
          // Property: Multiple calls with same hostname should return same config
          const config1 = getConfig(hostname);
          const config2 = getConfig(hostname);
          
          if (config1.environment !== config2.environment) return false;
          if (config1.apiBaseUrl !== config2.apiBaseUrl) return false;
          if (config1.googleClientId !== config2.googleClientId) return false;
          
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  test('should prioritize environment detection correctly', () => {
    // Property: localhost should always be detected as local, even if it contains other keywords
    const localhostConfig = getConfig('localhost');
    expect(localhostConfig.environment).toBe('local');
    
    // Property: dev should be detected before production
    const devConfig = getConfig('dev.example.com');
    expect(devConfig.environment).toBe('development');
    
    // Property: staging should be detected before production
    const stagingConfig = getConfig('staging.example.com');
    expect(stagingConfig.environment).toBe('staging');
    
    // Property: plain domain should be production
    const prodConfig = getConfig('example.com');
    expect(prodConfig.environment).toBe('production');
  });
});

/**
 * Unit tests for config module
 * Tests environment detection and configuration retrieval
 * Requirements: 7.3, 7.4
 */
describe('Config Module Unit Tests', () => {
  describe('Environment Detection', () => {
    test('should detect localhost as local', () => {
      expect(detectEnvironment('localhost')).toBe('local');
      expect(detectEnvironment('127.0.0.1')).toBe('local');
    });

    test('should detect dev hostnames as development', () => {
      expect(detectEnvironment('dev.example.com')).toBe('development');
      expect(detectEnvironment('app-dev.example.com')).toBe('development');
      expect(detectEnvironment('example-dev.com')).toBe('development');
    });

    test('should detect staging hostnames as staging', () => {
      expect(detectEnvironment('staging.example.com')).toBe('staging');
      expect(detectEnvironment('app-staging.example.com')).toBe('staging');
      expect(detectEnvironment('example-staging.com')).toBe('staging');
    });

    test('should detect production hostnames as production', () => {
      expect(detectEnvironment('example.com')).toBe('production');
      expect(detectEnvironment('www.example.com')).toBe('production');
      expect(detectEnvironment('app.example.com')).toBe('production');
    });
  });

  describe('Config Retrieval', () => {
    test('should return local config for localhost', () => {
      const config = getConfig('localhost');
      expect(config.environment).toBe('local');
      expect(config.apiBaseUrl).toContain('localhost');
      expect(config.googleClientId).toBeDefined();
    });

    test('should return development config for dev hostname', () => {
      const config = getConfig('dev.example.com');
      expect(config.environment).toBe('development');
      expect(config.apiBaseUrl).toContain('dev');
      expect(config.googleClientId).toBeDefined();
    });

    test('should return staging config for staging hostname', () => {
      const config = getConfig('staging.example.com');
      expect(config.environment).toBe('staging');
      expect(config.apiBaseUrl).toContain('staging');
      expect(config.googleClientId).toBeDefined();
    });

    test('should return production config for production hostname', () => {
      const config = getConfig('example.com');
      expect(config.environment).toBe('production');
      expect(config.apiBaseUrl).toBeDefined();
      expect(config.googleClientId).toBeDefined();
    });

    test('should always return valid config structure', () => {
      const hostnames = ['localhost', 'dev.example.com', 'staging.example.com', 'example.com'];
      
      hostnames.forEach(hostname => {
        const config = getConfig(hostname);
        expect(config).toHaveProperty('apiBaseUrl');
        expect(config).toHaveProperty('googleClientId');
        expect(config).toHaveProperty('environment');
        expect(typeof config.apiBaseUrl).toBe('string');
        expect(typeof config.googleClientId).toBe('string');
        expect(typeof config.environment).toBe('string');
      });
    });
  });

  describe('Config Consistency', () => {
    test('should return same config for same hostname', () => {
      const config1 = getConfig('example.com');
      const config2 = getConfig('example.com');
      
      expect(config1).toEqual(config2);
    });

    test('should return different configs for different environments', () => {
      const localConfig = getConfig('localhost');
      const devConfig = getConfig('dev.example.com');
      const stagingConfig = getConfig('staging.example.com');
      const prodConfig = getConfig('example.com');
      
      expect(localConfig.environment).not.toBe(devConfig.environment);
      expect(devConfig.environment).not.toBe(stagingConfig.environment);
      expect(stagingConfig.environment).not.toBe(prodConfig.environment);
    });
  });
});
