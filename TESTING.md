# Testing Guide

This document explains how to run tests for the Todo application on Windows.

## Quick Start

All test commands work from the root directory and bypass PowerShell execution policy issues.

### Run All Tests
```cmd
node node_modules/jest/bin/jest.js
```

Or use the batch script:
```cmd
test.cmd
```

Or use npm (if PowerShell allows):
```cmd
npm test
```

### Run Frontend Tests Only
```cmd
node node_modules/jest/bin/jest.js frontend
```

Or use the batch script:
```cmd
test-frontend.cmd
```

Or use npm:
```cmd
npm run test:frontend
```

### Run Backend Tests Only
```cmd
node node_modules/jest/bin/jest.js backend
```

Or use the batch script:
```cmd
test-backend.cmd
```

Or use npm:
```cmd
npm run test:backend
```

### Run Specific Test File
```cmd
node node_modules/jest/bin/jest.js frontend/auth-manager.test.js
```

### Run Tests in Watch Mode
```cmd
node node_modules/jest/bin/jest.js --watch
```

Or use npm:
```cmd
npm run test:watch
```

### Run Tests with Coverage
```cmd
node node_modules/jest/bin/jest.js --coverage
```

Or use npm:
```cmd
npm run test:coverage
```

## Test Structure

```
/
├── frontend/
│   ├── auth-manager.test.js      # AuthManager property & unit tests
│   └── (more test files...)
│
├── backend/
│   ├── local-server.test.js      # Backend API tests
│   └── (more test files...)
│
└── jest.config.js                # Jest configuration
```

## Property-Based Testing

This project uses **fast-check** for property-based testing. Property tests run 100 iterations by default to verify correctness across a wide range of inputs.

### Property Tests Include:
- **Property 1**: Token storage on successful authentication
- **Property 3**: Session cleanup on sign out
- **Property 7**: Token validation on all requests
- **Property 8**: User data isolation
- And more...

Each property test is tagged with a comment referencing the design document:
```javascript
// Feature: google-auth-aws-hosting, Property 1: Token storage on successful authentication
// Validates: Requirements 1.3
```

## Troubleshooting

### PowerShell Execution Policy Issues

If you see errors like:
```
npm.ps1 cannot be loaded because running scripts is disabled on this system
```

**Solution 1**: Use the batch scripts provided:
```cmd
test.cmd
test-frontend.cmd
test-backend.cmd
```

**Solution 2**: Use node directly:
```cmd
node node_modules/jest/bin/jest.js
```

**Solution 3**: Temporarily allow scripts (requires admin):
```powershell
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```

### Module Not Found Errors

If you see "Cannot find module" errors:

1. Ensure you're in the root directory:
   ```cmd
   cd C:\Users\sachi\projects\1stAgentic
   ```

2. Verify node_modules exists:
   ```cmd
   dir node_modules
   ```

3. If missing, install dependencies:
   ```cmd
   node node_modules/npm/bin/npm-cli.js install
   ```

### Test Failures

If tests fail:

1. Check that all dependencies are installed
2. Verify the test file exists
3. Review the error message for specific issues
4. Run with verbose output:
   ```cmd
   node node_modules/jest/bin/jest.js --verbose
   ```

## CI/CD Integration

For automated testing in CI/CD pipelines, use:
```bash
npm test
```

This works on all platforms (Windows, Linux, macOS) and doesn't require PowerShell.

## Writing New Tests

### Unit Tests
Place unit tests next to the code they test with `.test.js` extension:
```
frontend/my-component.js
frontend/my-component.test.js
```

### Property-Based Tests
Use fast-check for property tests:
```javascript
const fc = require('fast-check');

describe('Property: My property description', () => {
  test('should satisfy property', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string(), // generator
        async (input) => {
          // test logic
          return true; // property holds
        }
      ),
      { numRuns: 100 } // run 100 iterations
    );
  });
});
```

## Test Coverage

Generate coverage reports:
```cmd
npm run test:coverage
```

Coverage reports are saved to `coverage/` directory.

## Additional Resources

- [Jest Documentation](https://jestjs.io/)
- [fast-check Documentation](https://fast-check.dev/)
- [Property-Based Testing Guide](https://fast-check.dev/docs/introduction/)
