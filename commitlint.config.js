export default {
  extends: ['@commitlint/config-conventional'],
  // Dependabot writes its own subjects and long body lines
  ignores: [(message) => /Signed-off-by: dependabot\[bot\]/.test(message)],
  rules: {
    // Subjects start with a capital letter, e.g. "chore: Docker compose added"
    'subject-case': [2, 'always', 'sentence-case'],
  },
};
