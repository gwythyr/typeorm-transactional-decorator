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
    "src/**/*.ts",
    "!src/**/index.ts",
    "!src/**/__mocks__/**",
  ],
  coverageDirectory: "coverage",

  // TypeScript — isolatedModules skips type-checking for faster test compilation
  transform: {
    "^.+\\.ts$": [
      "ts-jest",
      {
        tsconfig: "tsconfig.json",
        isolatedModules: true,
      },
    ],
  },

  // Performance / reliability
  testTimeout: 10000,
};
