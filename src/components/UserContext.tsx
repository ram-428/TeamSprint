'use client';
import { createContext, useContext } from 'react';

export type Me = { id: string; name: string; email: string; orgId: string | null; role: string; platformRole: string; title?: string; color?: string; avatarUrl?: string; theme: string; impersonatedBy?: string; orgName?: string; homeOrgId?: string | null; actingOrg?: boolean };
const Ctx = createContext<Me | null>(null);
export const UserProvider = Ctx.Provider;
export function useMe(): Me { const m = useContext(Ctx); if (!m) throw new Error('No user'); return m; }
