'use client';
import { useCallback, useEffect, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { AnimatePresence, motion } from 'framer-motion';
import {
  LayoutDashboard, FolderKanban, Search, Bell, Plus, Sun, Moon, Contrast, LogOut, Settings, Target, Gauge, ShieldCheck, Building2, ChevronsLeft, ChevronsRight,
  Command, Filter, Eye, X, UserCircle2, Menu, HelpCircle,
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
      const keep = ['/dashboard', '/projects', '/goals', '/workload', '/search', '/notifications', '/admin/org', '/admin/platform', '/settings'];
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
    { href: '/dashboard', label: 'For you', icon: LayoutDashboard },
    { href: '/projects', label: 'Projects', icon: FolderKanban, match: '/projects' },
    { href: '/search', label: 'Filters', icon: Filter },
    ...(me.role !== 'guest' ? [{ href: '/goals', label: 'Goals', icon: Target }, { href: '/workload', label: 'Workload', icon: Gauge }] : []),
    { href: '/notifications', label: 'Inbox', icon: Bell },
  ];
  const admin: NavItem[] = [
    ...(me.platformRole === 'super_admin' ? [{ href: '/admin/platform', label: 'Platform', icon: ShieldCheck }] : []),
    ...(me.role === 'org_admin' || me.platformRole === 'super_admin' ? [{ href: '/admin/org', label: 'Organization', icon: Building2 }] : []),
  ];

  const exitImpersonation = async () => { try { await api('/api/admin/platform/impersonate', { method: 'DELETE' }); window.location.href = '/admin/platform'; } catch (e) { toast.error(errMsg(e)); } };
  const logout = async () => { await api('/api/auth/logout', { method: 'POST', body: {} }); window.location.href = '/login'; };

  const sidebar = (
    <div className="flex h-full flex-col">
      <div className={clsx('flex items-center pt-4', collapsed ? 'justify-center' : 'px-4')}>
        <Link href="/dashboard" className={collapsed ? '' : 'block w-full'}>{collapsed ? <Logo text={false} size={44} /> : <Logo variant="sidebar" />}</Link>
      </div>
      <button onClick={() => setCreate(true)} disabled={me.role === 'guest'} className={clsx('btn btn-primary mx-4 mt-5', collapsed && '!mx-3 !px-0')} title="Create issue (C)"><Plus size={17} />{!collapsed && 'Create'}</button>
      <nav className="mt-5 flex flex-1 flex-col gap-1 px-4" aria-label="Main">
        {nav.map((n) => <NavLink key={n.href} n={n} path={path} collapsed={collapsed} />)}
        {admin.length > 0 && <div className="my-3 border-t border-[var(--border)]" />}
        {admin.length > 0 && !collapsed && <div className="px-3 pb-1 text-[11px] font-semibold uppercase tracking-wider text-faint">Administration</div>}
        {admin.map((n) => <NavLink key={n.href} n={n} path={path} collapsed={collapsed} />)}
      </nav>
      <div className="p-4">
        <button onClick={toggleCollapse} className="btn btn-ghost btn-sm hidden w-full lg:inline-flex" aria-label="Toggle sidebar" title="Toggle sidebar ([)">{collapsed ? <ChevronsRight size={16} /> : <><ChevronsLeft size={16} /> Collapse</>}</button>
      </div>
    </div>
  );

  return (
    <UserProvider value={me}>
      {me.impersonatedBy && (
        <motion.div initial={{ y: -40 }} animate={{ y: 0 }} className="fixed inset-x-0 top-0 z-[90] flex h-10 items-center justify-center gap-3 bg-gradient-to-r from-amber-500 to-orange-500 text-[13px] font-semibold text-black">
          <Eye size={15} /> Viewing as {me.name} — every action is audited
          <button onClick={exitImpersonation} className="rounded-lg bg-black/80 px-3 py-1 text-white hover:bg-black">Exit</button>
        </motion.div>
      )}
      <div className={clsx('min-h-screen', me.impersonatedBy && 'pt-10')}>
        {/* desktop sidebar */}
        <motion.aside animate={{ width: collapsed ? 84 : 248 }} transition={ready ? { type: 'spring', stiffness: 360, damping: 36 } : { duration: 0 }} className={clsx('glass fixed bottom-3 left-3 z-40 hidden overflow-hidden rounded-[24px] lg:block', me.impersonatedBy ? 'top-[52px]' : 'top-3')}>{sidebar}</motion.aside>
        {/* mobile drawer */}
        <AnimatePresence>
          {mobile && (
            <div className="fixed inset-0 z-[60] lg:hidden">
              <motion.div className="absolute inset-0 bg-black/50" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setMobile(false)} />
              <motion.aside initial={{ x: -280 }} animate={{ x: 0 }} exit={{ x: -280 }} transition={{ type: 'spring', stiffness: 360, damping: 36 }} className="glass-solid absolute bottom-2 left-2 top-2 w-[260px] rounded-3xl">{sidebar}</motion.aside>
            </div>
          )}
        </AnimatePresence>

        <div className={clsx(ready && 'transition-[padding] duration-300', collapsed ? 'lg:pl-[108px]' : 'lg:pl-[272px]')}>
          <header className="sticky top-0 z-30 px-4 pt-3 lg:pr-5">
            <div className="glass flex h-[58px] items-center gap-3 rounded-[20px] px-3">
              <button className="btn btn-ghost btn-icon lg:hidden" aria-label="Open menu" onClick={() => setMobile(true)}><Menu size={19} /></button>
              <button onClick={() => setPalette(true)} className="flex h-10 flex-1 items-center gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3.5 text-left text-faint transition-colors hover:border-[var(--border-strong)] sm:max-w-[520px]" aria-label="Search">
                <Search size={16} /><span className="flex-1 truncate text-[13.5px]">Search issues, projects, people…</span><kbd className="hidden sm:inline"><Command size={10} className="inline" /> K</kbd>
              </button>
              {me.platformRole === 'super_admin' && !me.impersonatedBy && <OrgSwitcher me={me} path={path} />}
              <div className="ml-auto flex items-center gap-1.5">
                <button className="btn btn-ghost btn-icon hidden sm:inline-flex" aria-label="Keyboard shortcuts" onClick={() => setHelp(true)}><HelpCircle size={18} /></button>
                <button className="btn btn-ghost btn-icon" aria-label="Toggle theme" onClick={toggleTheme}><AnimatePresence mode="wait" initial={false}><motion.span key={theme} initial={{ rotate: -90, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} exit={{ rotate: 90, opacity: 0 }} transition={{ duration: 0.18 }}>{theme === 'dark' ? <Sun size={18} /> : theme === 'light' ? <Contrast size={18} /> : <Moon size={18} />}</motion.span></AnimatePresence></button>
                <Bell2 />
                <Dropdown trigger={({ toggle }) => <button onClick={toggle} className="ml-1 flex items-center gap-2 rounded-xl p-1 pr-2 transition-colors hover:bg-[var(--surface-2)]" aria-label="Account menu"><Avatar user={me} size={32} /></button>}>
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
          <main className="px-4 pb-16 pt-6 lg:pr-5" id="main">
            <motion.div key={path.split('/').slice(0, 3).join('/')} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.16, ease: 'easeOut' }}>{children}</motion.div>
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
    <Link href={n.href} title={collapsed ? n.label : undefined} className={clsx('group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-[14px] font-medium transition-colors', active ? 'text-text' : 'text-muted hover:text-text')}>
      {active && <motion.span layoutId="nav-pill" className="absolute inset-0 rounded-xl border border-[var(--border-strong)] bg-[var(--surface-2)] shadow-[0_6px_22px_-10px_rgba(124,92,255,.7)]" transition={{ type: 'spring', stiffness: 420, damping: 34 }} />}
      {active && <motion.span layoutId="nav-bar" className="absolute -left-3 top-2.5 h-5 w-1 rounded-full grad-bar" />}
      <n.icon size={18} className={clsx('relative shrink-0 transition-transform group-hover:scale-110', active && 'text-accent2')} />
      {!collapsed && <span className="relative">{n.label}</span>}
      {unread > 0 && <span className={clsx('relative ml-auto rounded-full bg-accent px-1.5 text-[10.5px] font-bold text-white', collapsed && 'absolute right-1 top-1')}>{unread}</span>}
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
        <AnimatePresence>{unread > 0 && <motion.span key={unread} initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }} className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-accent px-1 text-[10px] font-bold text-white shadow-[0_0_12px_var(--accent)]">{unread}</motion.span>}</AnimatePresence>
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
