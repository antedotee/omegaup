// Jest config for the bs5-cutover tooling tests (codemod, integrity, scan).
//
// Run with: yarn jest --config stuff/bs5-cutover/jest.config.cjs
//
// Standalone on purpose: it does not extend the repo-root jest.config.js, so
// no jsdom, no Babel transform, and no frontend test.setup.ts. The `yarn test`
// pattern ('frontend/www/js/.*test\.ts$') never matches these `.test.cjs`
// files, so the 193-suite count is unchanged.
'use strict';
const path = require('path');

module.exports = {
  rootDir: path.resolve(__dirname, '../..'),
  roots: ['<rootDir>/stuff/bs5-cutover/test'],
  testMatch: ['**/*.test.cjs'],
  moduleFileExtensions: ['cjs', 'js', 'json'],
  testEnvironment: 'node',
  transform: {},
  setupFiles: [],
  setupFilesAfterEnv: [],
};
