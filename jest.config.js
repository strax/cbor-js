module.exports = {
  transform: {
    "\\.ts$": "ts-jest"
  },
  globals: {
    "ts-jest": {
      tsConfig: "test/tsconfig.json"
    }
  },
  roots: ["<rootDir>/test"],
  testEnvironment: "node",
  setupFiles: ["<rootDir>/test/setup.ts"]
};
