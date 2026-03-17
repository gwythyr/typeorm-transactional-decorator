/** @type {import("jest").Config} **/
module.exports = {
  preset: "ts-jest",
  testEnvironment: "node",

  // Mock management
  clearMocks: true,
  resetMocks: true,
  restoreMocks: true,

  // Test discovery
  roots: ["<rootDir>/tests"],
  testMatch: ["**/*.test.ts"],

  // Setup — imports reflect-metadata before each test suite
  setupFilesAfterEnv: ["<rootDir>/tests/setup.ts"],

  // Coverage
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/__mocks__/**',
    '!src/**/index.ts',
  ],
  coverageDirectory: "coverage",

  // TypeScript — isolatedModules skips type-checking for faster test compilation
  transform: {
    "^.+\\.ts$": [
      "ts-jest",
      {
        tsconfig: "tsconfig.test.json",
      },
    ],
  },

  // Performance / reliability
  testTimeout: 10000,

  projects: [
    {
      displayName: "unit-integration",
      preset: "ts-jest",
      testEnvironment: "node",
      clearMocks: true,
      resetMocks: true,
      restoreMocks: true,
      roots: ["<rootDir>/tests"],
      testMatch: ["**/*.test.ts"],
      testPathIgnorePatterns: ["/node_modules/", "/tests/e2e/"],
      setupFilesAfterEnv: ["<rootDir>/tests/setup.ts"],
      transform: {
        "^.+\\.ts$": ["ts-jest", { tsconfig: "tsconfig.test.json" }],
      },
      testTimeout: 10000,
    },
    {
      displayName: "e2e",
      preset: "ts-jest",
      testEnvironment: "node",
      clearMocks: true,
      resetMocks: true,
      restoreMocks: true,
      roots: ["<rootDir>/tests/e2e"],
      testMatch: ["**/*.test.ts"],
      setupFilesAfterEnv: ["<rootDir>/tests/setup.ts"],
      transform: {
        "^.+\\.ts$": ["ts-jest", { tsconfig: "tsconfig.test.json" }],
      },
      testTimeout: 60000,
    },
  ],
};
