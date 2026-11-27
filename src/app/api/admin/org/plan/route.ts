import { route, targetOrg } from '@/server/api';
import { planUsage } from '@/server/plan';

/** The organization's plan with its limits and current usage. */
export const GET = route(async (req, { user }) => planUsage(targetOrg(user, req)));
