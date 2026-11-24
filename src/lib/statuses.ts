/** Shared between server and client: the status set every project uses (also the Board columns, in this order). */
export type StatusDef = { id: string; name: string; category: 'todo' | 'inprogress' | 'done'; color: string };

export const STATUSES: StatusDef[] = [
  { id: 'todo', name: 'Todo', category: 'todo', color: '#94a3b8' },
  { id: 'progress', name: 'In Progress', category: 'inprogress', color: '#7c5cff' },
  { id: 'hold', name: 'On Hold', category: 'inprogress', color: '#f59e0b' },
  { id: 'resolved', name: 'Resolved', category: 'done', color: '#22d3ee' },
  { id: 'reopened', name: 'Reopened', category: 'inprogress', color: '#f472b6' },
  { id: 'done', name: 'Done', category: 'done', color: '#34d399' },
  { id: 'cancelled', name: 'Cancelled', category: 'done', color: '#64748b' },
];
