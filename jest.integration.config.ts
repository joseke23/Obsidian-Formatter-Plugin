export default {
    globalSetup: 'obsidian-integration-testing/jest-global-setup-plugin',
    globalTeardown: 'obsidian-integration-testing/jest-global-teardown-plugin',
    testMatch: ['<rootDir>/__tests__/Integration/**/*.ts'],
};
