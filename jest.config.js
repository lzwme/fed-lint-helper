/** @type {import('ts-jest/dist/types').InitialOptionsTsJest} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  collectCoverage: true,
  moduleFileExtensions: [
    "ts",
    "tsx",
    "js"
  ],
  testRegex: "/src/.*\\.spec\\.(ts|tsx|js)$"
};
