/** Built-in issue types every organization starts with (its master list can then be edited by the org admin). */
export type IssueTypeDef = { key: string; name: string; color: string; system: boolean };

export const DEFAULT_ISSUE_TYPES: IssueTypeDef[] = [
  { key: 'epic', name: 'Epic', color: '#a78bfa', system: true },
  { key: 'story', name: 'Story', color: '#34d399', system: true },
  { key: 'task', name: 'Task', color: '#60a5fa', system: true },
  { key: 'bug', name: 'Bug', color: '#f87171', system: true }, // the four work types (Epic, Story, Task, Bug) are always available
  { key: 'subtask', name: 'Subtask', color: '#94a3b8', system: false }, // ordinary type: admins may disable or delete it
];

/** Types that exist for the app's own flows (epic children, subtasks) and are never offered in "Create issue". */
export const HIDDEN_FROM_PICKERS = ['subtask'];
