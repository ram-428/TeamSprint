/** Subscription plans and the limits each one gives an organization. */
export type PlanKey = 'free' | 'pro' | 'enterprise';
export const PLANS: Record<PlanKey, { label: string; maxUsers: number; maxProjects: number }> = {
  free: { label: 'Free', maxUsers: 10, maxProjects: 3 },
  pro: { label: 'Pro', maxUsers: 100, maxProjects: 50 },
  enterprise: { label: 'Enterprise', maxUsers: 5000, maxProjects: 1000 },
};
export const PLAN_KEYS = Object.keys(PLANS) as PlanKey[];
export const planLimits = (plan: string) => {
  const p = PLANS[(plan as PlanKey)] ?? PLANS.pro;
  return { maxUsers: p.maxUsers, maxProjects: p.maxProjects };
};
export const planLabel = (plan: string) => PLANS[plan as PlanKey]?.label ?? plan;
