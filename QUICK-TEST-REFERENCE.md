# Quick Test Reference Card

## 🚀 Run Tests (Choose One Method)

### Method 1: Batch Scripts (Easiest on Windows)
```cmd
test.cmd              # All tests
test-frontend.cmd     # Frontend only  
test-backend.cmd      # Backend only
```

### Method 2: Node Direct (Always Works)
```cmd
node node_modules/jest/bin/jest.js           # All tests
node node_modules/jest/bin/jest.js frontend  # Frontend only
node node_modules/jest/bin/jest.js backend   # Backend only
```

### Method 3: npm (If PowerShell Allows)
```cmd
npm test                # All tests
npm run test:frontend   # Frontend only
npm run test:backend    # Backend only
```

## 📊 Current Test Status

✅ **17 tests passing**
- Frontend: 13 tests (2 property tests + 11 unit tests)
- Backend: 4 tests (4 property tests)

## 🔧 Common Options

```cmd
# Watch mode (re-run on file changes)
node node_modules/jest/bin/jest.js --watch

# Coverage report
node node_modules/jest/bin/jest.js --coverage

# Verbose output
node node_modules/jest/bin/jest.js --verbose

# Run specific test file
node node_modules/jest/bin/jest.js frontend/auth-manager.test.js
```

## 🐛 Troubleshooting

**PowerShell Error?** → Use batch scripts or node directly  
**Module Not Found?** → Ensure you're in root directory  
**Tests Failing?** → Run with `--verbose` flag

## 📚 More Info

See [TESTING.md](TESTING.md) for complete documentation.
