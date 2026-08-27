process.env.TZ = 'America/New_York';

module.exports = {
  clearMocks: true,
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/types.ts',
  ],
  coveragePathIgnorePatterns: [
    '/node_modules/',
    '/static/',
    '/dist/',
  ],
  coverageProvider: 'v8',
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 70,
      lines: 50,
      statements: 50,
    },
  },
  restoreMocks: true,
  setupFilesAfterEnv: ['<rootDir>/tests/setup.ts'],
  testEnvironment: 'jsdom',
  testEnvironmentOptions: {
    pretendToBeVisual: true,
    url: 'http://localhost/',
  },
  testMatch: ['<rootDir>/tests/**/*.test.ts'],
  transform: {
    '^.+\\.tsx?$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.test.json' }],
  },
};
