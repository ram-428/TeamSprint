'use client';
import { createContext, useContext } from 'react';

export type ProjectCtx = { project: any; reload: () => void; mutate: (v?: any) => void };
const Ctx = createContext<ProjectCtx | null>(null);
export const ProjectProvider = Ctx.Provider;
export function useProject(): ProjectCtx { const c = useContext(Ctx); if (!c) throw new Error('No project'); return c; }
