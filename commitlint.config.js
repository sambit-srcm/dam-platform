export default {
  extends: ['@commitlint/config-conventional'],
  rules: {
    // Subjects start with a capital letter, e.g. "chore: Docker compose added"
    'subject-case': [2, 'always', 'sentence-case'],
  },
};
