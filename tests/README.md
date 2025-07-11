# Multi-Language Support Tests

This directory contains comprehensive test suites for the multi-language support functionality.

## 📋 Test Overview

### Test Suites

1. **Unit Tests** (`languages.unit.test.js`)
   - Tests all language configuration module functions
   - Validates language validation, provider mapping, LLM context generation, etc.
   - Includes performance and memory tests

2. **Integration Tests** (`multilang-integration.test.js`)
   - Tests overall integration of multi-language functionality
   - Validates settings service, STT providers, LLM integration, etc.
   - Includes error handling and UI integration tests

3. **End-to-End Tests** (`multilang-e2e.test.js`)
   - Tests complete multi-language workflow
   - Validates full flow from UI selection to provider usage
   - Includes persistence, performance, and window management tests

## 🚀 Running Tests

### Method 1: Using Test Runner (Recommended)

```bash
# Run complete test suite
node tests/run-tests.js

# Run quick validation
node tests/run-tests.js --quick

# View help
node tests/run-tests.js --help
```

### Method 2: Using Jest Directly

```bash
# Install dependencies (if needed)
npm install --save-dev jest babel-jest

# Run all tests
npx jest --config=tests/jest.config.js

# Run specific test files
npx jest tests/languages.unit.test.js
npx jest tests/multilang-integration.test.js
npx jest tests/multilang-e2e.test.js

# Run tests with coverage report
npx jest --coverage --config=tests/jest.config.js
```

### Method 3: Using npm Scripts

Add to `package.json`:

```json
{
  "scripts": {
    "test": "jest --config=tests/jest.config.js",
    "test:unit": "jest tests/languages.unit.test.js",
    "test:integration": "jest tests/multilang-integration.test.js",
    "test:e2e": "jest tests/multilang-e2e.test.js",
    "test:coverage": "jest --coverage --config=tests/jest.config.js",
    "test:quick": "node tests/run-tests.js --quick"
  }
}
```

Then run:

```bash
npm test
npm run test:unit
npm run test:integration
npm run test:e2e
npm run test:coverage
npm run test:quick
```

## 📊 Test Coverage

Test configuration requires the following coverage thresholds:
- **Branch Coverage**: 80%
- **Function Coverage**: 80%
- **Line Coverage**: 80%
- **Statement Coverage**: 80%

Coverage reports will be generated in the `coverage/` directory.

## 🔧 Test Configuration

### Jest Configuration (`jest.config.js`)
- Test Environment: Node.js
- Timeout: 10 seconds
- Coverage Reports: Text, LCOV, HTML
- Mocking: Electron, File System, SQLite

### Test Setup (`setup.js`)
- Global mock configuration
- Test utility functions
- DOM environment mocking
- Error handling

## 📁 File Structure

```
tests/
├── README.md                    # This file
├── jest.config.js              # Jest configuration
├── setup.js                    # Test setup
├── run-tests.js                # Test runner
├── languages.unit.test.js      # Unit tests
├── multilang-integration.test.js # Integration tests
└── multilang-e2e.test.js       # End-to-end tests
```

## 🧪 Test Content

### Language Configuration Tests
- ✅ 37 language support
- ✅ Language validation functionality
- ✅ Provider-specific mappings
- ✅ LLM context generation
- ✅ RTL language detection
- ✅ Language normalization

### Integration Tests
- ✅ Settings service integration
- ✅ STT provider language support
- ✅ LLM provider language support
- ✅ Live insights language support
- ✅ Error handling and fallback
- ✅ Language persistence

### End-to-End Tests
- ✅ Complete language switching workflow
- ✅ Cross-application restart persistence
- ✅ Legacy format migration
- ✅ Provider integration
- ✅ UI integration
- ✅ Window management
- ✅ Performance testing

## 🐛 Troubleshooting

### Common Issues

1. **Module Not Found Error**
   ```bash
   # Ensure all dependencies are installed
   npm install
   ```

2. **Test Timeout**
   ```bash
   # Increase timeout duration
   jest --testTimeout=30000
   ```

3. **Insufficient Coverage**
   ```bash
   # View detailed coverage report
   jest --coverage --verbose
   ```

4. **Electron Mocking Issues**
   ```bash
   # Check mock configuration in setup.js
   # Ensure all Electron APIs are properly mocked
   ```

### Debugging Tests

```bash
# Run single test with verbose output
npx jest tests/languages.unit.test.js --verbose

# Run tests and keep process open for debugging
npx jest --detectOpenHandles

# Run tests with console output
npx jest --verbose --no-silent
```

## 📈 Continuous Integration

These tests can be integrated into CI/CD pipelines:

```yaml
# .github/workflows/test.yml
name: Tests
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - uses: actions/setup-node@v2
        with:
          node-version: '16'
      - run: npm install
      - run: npm run test:coverage
      - uses: codecov/codecov-action@v1
```

## 📝 Adding New Tests

To add new test cases:

1. Determine test type (unit/integration/end-to-end)
2. Add tests to the appropriate test file
3. Use appropriate mocks and assertions
4. Ensure test coverage meets requirements
5. Run tests to verify functionality

## 🤝 Contributing

Before submitting code, ensure:
- All tests pass
- Code coverage meets requirements
- New features have corresponding tests
- Test documentation is updated 