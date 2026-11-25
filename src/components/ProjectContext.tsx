'use client';
import { createContext, useContext } from 'react';

/** `assignees` = ids picked by tapping member avatars in the project header (multi-select). Empty = show everyone's issues. */
export type ProjectCtx = { project: any; reload: () => void; mutate: (v?: any) => void; assignees: string[]; toggleAssignee: (id: string) => void; clearAssignees: () => void };
const Ctx = createContext<ProjectCtx | null>(null);
export const ProjectProvider = Ctx.Provider;
export function useProject(): ProjectCtx { const c = useContext(Ctx); if (!c) throw new Error('No project'); return c; }
