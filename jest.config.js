module.exports = {
  testEnvironment: 'node',
  testMatch: [
    '**/frontend/**/*.test.js',
    '**/backend/**/*.test.js'
  ],
  collectCoverageFrom: [
    'frontend/**/*.js',
    'backend/**/*.js',
    '!**/node_modules/**',
    '!**/*.test.js',
    '!**/jest.config.js',
    '!**/app-legacy.js',
    '!frontend/app.js',
    '!frontend/config.js'
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'text-summary', 'html', 'lcov'],
  coverageThreshold: {
    global: {
      statements: 80,
      branches: 70,
      functions: 80,
      lines: 80
    }
  },
  verbose: true,
  projects: [
    {
      displayName: 'frontend',
      testMatch: ['<rootDir>/frontend/**/*.test.js'],
      testEnvironment: 'node',
      testPathIgnorePatterns: ['<rootDir>/frontend/app.test.js'],
      collectCoverageFrom: [
        '<rootDir>/frontend/auth-manager.js'
      ]
    },
    {
      displayName: 'frontend-integration',
      testMatch: ['<rootDir>/frontend/app.test.js'],
      testEnvironment: 'jsdom',
      collectCoverageFrom: []
    },
    {
      displayName: 'backend',
      testMatch: ['<rootDir>/backend/**/*.test.js'],
      testEnvironment: 'node',
      collectCoverageFrom: [
        '<rootDir>/backend/local-server.js',
        '!<rootDir>/backend/**/*.test.js'
      ]
    }
  ]
};
