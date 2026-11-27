'use client';
import { useCallback, useEffect, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { AnimatePresence, motion } from 'framer-motion';
import {
  LayoutDashboard, FolderKanban, Search, Bell, Plus, Sun, Moon, Contrast, LogOut, Settings, Target, Gauge, ShieldCheck, Building2, ListChecks,
  Command, Filter, Eye, X, UserCircle2, Menu, ChevronLeft, ChevronRight, Users,
} from 'lucide-react';
import clsx from 'clsx';
import { Logo } from './Logo';
import { UserProvider, type Me } from './UserContext';
import { Avatar, Dropdown, MenuItem, Modal, Select } from './ui';
import { CommandPalette } from './CommandPalette';
import { CreateIssueModal } from './issue/CreateIssueModal';
import { api, toast, useApi, errMsg } from '@/lib/api';

type NavItem = { href: string; label: string; icon: any; match?: string };

/** Super admin only: searchable list of every organization; picking one makes the whole app work inside it. */
function OrgSwitcher({ me, path }: { me: Me; path: string }) {
  const { data } = useApi<{ orgs: { _id: string; name: string; status: string }[] }>('/api/admin/platform/context');
  const [busy, setBusy] = useState(false);
  async function pick(orgId: string) {
    if (busy || orgId === me.orgId) return; setBusy(true);
    try {
      await api('/api/admin/platform/context', { body: { orgId } });
      // hard navigation so every cached list/board from the previous organization is dropped
      const keep = ['/dashboard', '/projects', '/goals', '/workload', '/teams', '/search', '/notifications', '/admin/org', '/admin/masters', '/admin/platform', '/settings'];
      window.location.href = keep.includes(path) ? path : '/dashboard';
    } catch (e) { toast.error(errMsg(e)); setBusy(false); }
  }
  return (
    <div className="hidden shrink-0 items-center gap-2 md:flex" title="Organization you are working in">
      <Building2 size={16} className="text-faint" />
      <Select searchable aria-label="Working organization" className="!w-52" value={me.orgId || ''} onChange={pick} disabled={busy || !data} placeholder="Select organization"
        options={(data?.orgs || []).map((o) => ({ value: o._id, label: o.status === 'active' ? o.name : `${o.name} (${o.status})` }))} />
    </div>
  );
}

export function Shell({ me, children }: { me: Me; children: ReactNode }) {
  const path = usePathname(); const router = useRouter();
  const [ready, setReady] = useState(false); const [collapsed, setCollapsed] = useState(false); const [mobile, setMobile] = useState(false);
  const [palette, setPalette] = useState(false); const [create, setCreate] = useState(false); const [help, setHelp] = useState(false);
  const [theme, setTheme] = useState<'dark' | 'light' | 'simple'>('simple');

  useEffect(() => { try { setCollapsed(localStorage.getItem('orbit-collapsed') === '1'); setTheme((localStorage.getItem('orbit-theme') as any) || 'simple'); } catch { /* ignore */ } const id = requestAnimationFrame(() => setReady(true)); return () => cancelAnimationFrame(id); }, []);
  useEffect(() => { setMobile(false); }, [path]);
  const toggleTheme = () => { const t = theme === 'dark' ? 'light' : theme === 'light' ? 'simple' : 'dark'; setTheme(t); document.documentElement.setAttribute('data-theme', t); try { localStorage.setItem('orbit-theme', t); } catch { /* ignore */ } };
  const toggleCollapse = () => setCollapsed((c) => { try { localStorage.setItem('orbit-collapsed', c ? '0' : '1'); } catch { /* ignore */ } return !c; });

  // keyboard shortcuts
  useEffect(() => {
    let g = false; let timer: any;
    const h = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement; const typing = t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable;
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); setPalette((p) => !p); return; }
      if (typing || e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === '/') { e.preventDefault(); setPalette(true); }
      else if (e.key === 'c' && me.role !== 'guest') { e.preventDefault(); setCreate(true); }
      else if (e.key === '?') setHelp(true);
      else if (e.key === '[') toggleCollapse();
      else if (e.key === 'g') { g = true; clearTimeout(timer); timer = setTimeout(() => (g = false), 900); }
      else if (g) { const m: Record<string, string> = { d: '/dashboard', p: '/projects', s: '/search', n: '/notifications', g: '/goals', w: '/workload' }; if (m[e.key]) { router.push(m[e.key]); } g = false; }
    };
    window.addEventListener('keydown', h); return () => window.removeEventListener('keydown', h);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [me.role, router]);

  const nav: NavItem[] = [
    { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { href: '/projects', label: 'Projects', icon: FolderKanban, match: '/projects' },
    { href: '/search', label: 'Filters', icon: Filter },
    ...(me.role !== 'guest' ? [{ href: '/goals', label: 'Goals', icon: Target }, { href: '/workload', label: 'Workload', icon: Gauge }, { href: '/teams', label: 'Teams', icon: Users }] : []),
    { href: '/notifications', label: 'Inbox', icon: Bell },
  ];
  const admin: NavItem[] = [
    ...(me.platformRole === 'super_admin' ? [{ href: '/admin/platform', label: 'Platform', icon: ShieldCheck }] : []),
    ...(me.role === 'org_admin' || me.platformRole === 'super_admin' ? [{ href: '/admin/org', label: 'Organization', icon: Building2 }, { href: '/admin/masters', label: 'Masters', icon: ListChecks }] : []),
  ];

  const exitImpersonation = async () => { try { await api('/api/admin/platform/impersonate', { method: 'DELETE' }); window.location.href = '/admin/platform'; } catch (e) { toast.error(errMsg(e)); } };
  const logout = async () => { await api('/api/auth/logout', { method: 'POST', body: {} }); window.location.href = '/login'; };

  // `narrow` = icon-only rail (collapsed desktop sidebar); the mobile drawer always shows labels
  const sidebar = (narrow: boolean) => (
    <nav className={clsx('flex h-full flex-col gap-0.5 overflow-y-auto pb-3 pt-2', narrow ? 'px-2' : 'px-3')} aria-label="Main">
      {nav.map((n) => <NavLink key={n.href} n={n} path={path} collapsed={narrow} />)}
      {admin.length > 0 && (narrow ? <div className="mx-1 my-2 border-t border-[var(--border)]" /> : <div className="px-2.5 pb-1 pt-4 text-[12px] font-semibold text-faint">Administration</div>)}
      {admin.map((n) => <NavLink key={n.href} n={n} path={path} collapsed={narrow} />)}
    </nav>
  );
  const top = me.impersonatedBy ? 40 : 0; // impersonation banner height

  return (
    <UserProvider value={me}>
      {me.impersonatedBy && (
        <motion.div initial={{ y: -40 }} animate={{ y: 0 }} className="fixed inset-x-0 top-0 z-[90] flex h-10 items-center justify-center gap-3 bg-gradient-to-r from-amber-500 to-orange-500 text-[13px] font-semibold text-black">
          <Eye size={15} /> Viewing as {me.name} — every action is audited
          <button onClick={exitImpersonation} className="rounded-lg bg-black/80 px-3 py-1 text-white hover:bg-black">Exit</button>
        </motion.div>
      )}
      <div className="min-h-screen">
        {/* top navigation bar: full width, like a work-management app header */}
        <header className="fixed inset-x-0 z-40 border-b border-[var(--border)] bg-[var(--surface-solid)]" style={{ top }}>
          <div className="flex h-14 items-center gap-1.5 px-2 sm:gap-2 sm:px-3">
            <Link href="/dashboard" className="flex shrink-0 items-center gap-2 rounded-[3px] px-1.5 py-1 hover:bg-[var(--surface-2)]" aria-label="Team Sprint home">
              <Logo text={false} size={26} /><span className="hidden text-[16px] font-semibold tracking-tight sm:inline">Team Sprint</span>
            </Link>
            {/* sidebar toggle sits right of the logo; visibility lives on wrappers because the .btn rule would otherwise override Tailwind's hidden/flex utilities */}
            <span className="shrink-0 lg:hidden">
              <button className="btn btn-ghost btn-icon" aria-label="Open menu" title="Open menu" onClick={() => setMobile(true)}>
                <Menu size={18} />
              </button>
            </span>
            <span className="hidden shrink-0 lg:block">
              <button className="btn btn-ghost btn-icon" onClick={toggleCollapse} aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'} title={`${collapsed ? 'Expand' : 'Collapse'} sidebar ([)`}>
                {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
              </button>
            </span>
            <div className="mx-auto flex min-w-0 flex-1 items-center justify-center gap-2 px-1 sm:px-4">
              <button onClick={() => setPalette(true)} className="flex h-9 min-w-0 flex-1 items-center gap-2.5 rounded-[6px] border border-[var(--border-strong)] bg-[var(--surface)] px-3 text-left text-faint transition-colors hover:bg-[var(--surface-2)] md:max-w-[560px]" aria-label="Search">
                <Search size={16} className="shrink-0" /><span className="flex-1 truncate text-[14px]">Search</span><kbd className="hidden sm:inline"><Command size={10} className="inline" /> K</kbd>
              </button>
              <button onClick={() => setCreate(true)} disabled={me.role === 'guest'} className="btn btn-primary shrink-0 !h-9 !px-3 sm:!px-4" title="Create issue (C)" aria-label="Create"><Plus size={17} /><span className="hidden sm:inline">Create</span></button>
            </div>
            {me.platformRole === 'super_admin' && !me.impersonatedBy && <OrgSwitcher me={me} path={path} />}
            <div className="flex shrink-0 items-center gap-0.5">
                <button className="btn btn-ghost btn-icon" aria-label="Toggle theme" onClick={toggleTheme}><AnimatePresence mode="wait" initial={false}><motion.span key={theme} initial={{ rotate: -90, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} exit={{ rotate: 90, opacity: 0 }} transition={{ duration: 0.18 }}>{theme === 'dark' ? <Sun size={18} /> : theme === 'light' ? <Contrast size={18} /> : <Moon size={18} />}</motion.span></AnimatePresence></button>
                <Bell2 />
                <Dropdown trigger={({ toggle }) => <button onClick={toggle} className="ml-1 flex items-center rounded-full p-0.5 transition-colors hover:bg-[var(--surface-2)]" aria-label="Account menu"><Avatar user={me} size={28} /></button>}>
                  {(close) => (
                    <div className="w-60">
                      <div className="flex items-center gap-3 border-b border-[var(--border)] px-3 pb-3 pt-2"><Avatar user={me} size={38} /><div className="min-w-0"><div className="truncate font-semibold">{me.name}</div><div className="truncate text-xs text-muted">{me.email}</div>{me.orgName && <div className="mt-0.5 truncate text-[11px] text-faint">{me.orgName}</div>}</div></div>
                      <div className="pt-1.5">
                        <MenuItem icon={<UserCircle2 size={16} />} onClick={() => { close(); router.push('/settings'); }}>Profile & security</MenuItem>
                        <MenuItem icon={<Settings size={16} />} onClick={() => { close(); setHelp(true); }}>Keyboard shortcuts</MenuItem>
                        <MenuItem icon={<LogOut size={16} />} danger onClick={logout}>Sign out</MenuItem>
                      </div>
                    </div>
                  )}
                </Dropdown>
            </div>
          </div>
        </header>

        {/* desktop sidebar: flush left, below the header */}
        <aside className={clsx('fixed bottom-0 left-0 z-30 hidden border-r border-[var(--border)] bg-[var(--surface-solid)] lg:block', ready && 'transition-[width] duration-200', collapsed ? 'w-[56px]' : 'w-[200px]')} style={{ top: top + 56 }}>{sidebar(collapsed)}</aside>
        {/* mobile drawer */}
        <AnimatePresence>
          {mobile && (
            <div className="fixed inset-0 z-[60] lg:hidden">
              <motion.div className="absolute inset-0 bg-[rgba(9,30,66,0.54)]" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setMobile(false)} />
              <motion.aside initial={{ x: -280 }} animate={{ x: 0 }} exit={{ x: -280 }} transition={{ type: 'spring', stiffness: 360, damping: 36 }} className="absolute bottom-0 left-0 top-0 flex w-[220px] flex-col border-r border-[var(--border)] bg-[var(--surface-solid)]">
                <div className="flex h-14 shrink-0 items-center gap-2 border-b border-[var(--border)] px-3"><Logo text={false} size={26} /><span className="text-[16px] font-semibold">Team Sprint</span></div>
                <div className="min-h-0 flex-1">{sidebar(false)}</div>
              </motion.aside>
            </div>
          )}
        </AnimatePresence>

        <div className={clsx(ready && 'transition-[padding] duration-200', collapsed ? 'lg:pl-[56px]' : 'lg:pl-[200px]')} style={{ paddingTop: top + 56 }}>
          <main className="px-4 pb-16 pt-3 sm:px-5 sm:pt-3" id="main">
            <motion.div key={path.split('/').slice(0, 3).join('/')} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.14, ease: 'easeOut' }}>{children}</motion.div>
          </main>
        </div>
      </div>
      <CommandPalette open={palette} onClose={() => setPalette(false)} onCreate={() => { setPalette(false); setCreate(true); }} toggleTheme={toggleTheme} />
      <CreateIssueModal open={create} onClose={() => setCreate(false)} />
      <ShortcutsModal open={help} onClose={() => setHelp(false)} />
    </UserProvider>
  );
}

function NavLink({ n, path, collapsed }: { n: NavItem; path: string; collapsed: boolean }) {
  const active = path === n.href || path.startsWith((n.match || n.href) + '/') || (n.match && path === n.match);
  const unread = useUnread(n.href === '/notifications');
  return (
    <Link href={n.href} title={collapsed ? n.label : undefined} aria-current={active ? 'page' : undefined}
      className={clsx('relative flex h-9 items-center gap-3 rounded-[3px] text-[14px] font-medium transition-colors', collapsed ? 'justify-center px-0' : 'px-2.5',
        active ? 'bg-[var(--accent-soft)] text-accent' : 'text-muted hover:bg-[var(--surface-2)] hover:text-text')}>
      {active && <span className="absolute bottom-1.5 left-0 top-1.5 w-[3px] rounded-r-[2px] bg-[var(--accent)]" aria-hidden />}
      <n.icon size={18} className="shrink-0" />
      {!collapsed && <span className="truncate">{n.label}</span>}
      {unread > 0 && <span className={clsx('rounded-[3px] bg-[var(--danger)] px-1.5 text-[11px] font-bold leading-[18px] text-white', collapsed ? 'absolute right-0.5 top-0.5 !px-1 !text-[10px] !leading-[15px]' : 'ml-auto')}>{unread}</span>}
    </Link>
  );
}

function useUnread(enabled: boolean) {
  const { data } = useApi<{ unread: number }>(enabled ? '/api/notifications?limit=1' : null, { refreshMs: 45000 });
  return enabled ? data?.unread || 0 : 0;
}

function Bell2() {
  const { data, mutate } = useApi<{ unread: number; items: any[] }>('/api/notifications?limit=8', { refreshMs: 45000 });
  const router = useRouter();
  const unread = data?.unread || 0;
  return (
    <Dropdown trigger={({ toggle }) => (
      <button onClick={toggle} className="btn btn-ghost btn-icon relative" aria-label={`Notifications${unread ? `, ${unread} unread` : ''}`}>
        <Bell size={18} />
        <AnimatePresence>{unread > 0 && <motion.span key={unread} initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }} className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-[3px] bg-[var(--danger)] px-1 text-[10px] font-bold text-white">{unread}</motion.span>}</AnimatePresence>
      </button>
    )}>
      {(close) => (
        <div className="w-[360px] max-w-[88vw]">
          <div className="flex items-center justify-between px-3 py-2"><span className="font-semibold">Notifications</span>{unread > 0 && <button className="text-xs font-semibold text-accent2 hover:underline" onClick={async () => { await api('/api/notifications', { body: { all: true } }); mutate(); }}>Mark all read</button>}</div>
          <div className="max-h-[360px] overflow-y-auto">
            {!data?.items.length && <p className="px-3 py-8 text-center text-muted">You're all caught up ✨</p>}
            {data?.items.map((n) => (
              <button key={n._id} onClick={async () => { close(); if (!n.readAt) await api('/api/notifications', { body: { id: n._id } }); mutate(); if (n.issueKey) router.push(`/issues/${n.issueKey}`); }} className="flex w-full items-start gap-3 rounded-xl px-3 py-2.5 text-left hover:bg-[var(--surface-2)]">
                <Avatar user={n.actor} size={30} />
                <span className="min-w-0 flex-1"><span className={clsx('block text-[13px] leading-snug', !n.readAt && 'font-medium')}>{n.message}</span><span className="text-[11.5px] text-faint">{new Date(n.createdAt).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span></span>
                {!n.readAt && <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-accent shadow-[0_0_8px_var(--accent)]" />}
              </button>
            ))}
          </div>
          <Link href="/notifications" onClick={close} className="block border-t border-[var(--border)] px-3 py-2.5 text-center text-[13px] font-semibold text-accent2">View all</Link>
        </div>
      )}
    </Dropdown>
  );
}

function ShortcutsModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const rows: [string, string][] = [['Ctrl / ⌘ + K', 'Command palette'], ['/', 'Search'], ['C', 'Create issue'], ['G then D', 'Go to dashboard'], ['G then P', 'Go to projects'], ['G then S', 'Go to filters'], ['G then N', 'Go to inbox'], ['[', 'Collapse sidebar'], ['?', 'This help'], ['Esc', 'Close dialogs']];
  return (
    <Modal open={open} onClose={onClose} title="Keyboard shortcuts" width={460}>
      <div className="space-y-2">{rows.map(([k, d]) => <div key={k} className="flex items-center justify-between"><span className="text-muted">{d}</span><span className="flex gap-1">{k.split(' ').map((x, i) => <kbd key={i}>{x}</kbd>)}</span></div>)}</div>
    </Modal>
  );
}

export { X as _X };
