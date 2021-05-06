module.exports = {
  plugins: ['commitlint-plugin-jira-rules'],
  extends: ['jira'],
  rules: {
    'jira-task-id-min-length': [2, 'always', 9],
    'jira-task-id-case': [0],
    'jira-task-id-project-key': [2, 'always', 'CU'],
    'jira-commit-status-case': [0]
  },
}