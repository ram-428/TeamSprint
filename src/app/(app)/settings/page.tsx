'use client';
import { useState } from 'react';
import { Moon, Sun } from 'lucide-react';
import { api, errMsg, toast, ApiError } from '@/lib/api';
import { Avatar, Card, Field, PageHeader, Spinner } from '@/components/ui';
import { useMe } from '@/components/UserContext';

export default function Settings() {
  const me = useMe();
  const [name, setName] = useState(me.name); const [title, setTitle] = useState(me.title || ''); const [busy, setBusy] = useState(false);
  const [pw, setPw] = useState({ current: '', next: '' }); const [pwBusy, setPwBusy] = useState(false); const [errs, setErrs] = useState<Record<string, string>>({});
  const setTheme = (t: 'dark' | 'light') => { document.documentElement.setAttribute('data-theme', t); try { localStorage.setItem('orbit-theme', t); } catch { /* ignore */ } api('/api/auth/me', { method: 'PATCH', body: { theme: t } }).catch(() => {}); };

  async function saveProfile() { setBusy(true); try { await api('/api/auth/me', { method: 'PATCH', body: { name, title } }); toast.success('Profile updated'); } catch (e) { toast.error(errMsg(e)); } finally { setBusy(false); } }
  async function changePw() {
    setPwBusy(true); setErrs({});
    try { await api('/api/auth/password', { body: pw }); toast.success('Password changed — other sessions were signed out'); setPw({ current: '', next: '' }); }
    catch (e) { if (e instanceof ApiError && e.fields) setErrs(e.fields); else toast.error(errMsg(e)); } finally { setPwBusy(false); }
  }
  return (
    <div className="mx-auto max-w-[760px] space-y-5">
      <PageHeader title="Profile & security" subtitle={me.email} />
      <Card className="p-6"><div className="mb-5 flex items-center gap-4"><Avatar user={me} size={60} /><div><div className="text-[17px] font-semibold">{me.name}</div><div className="text-sm text-muted capitalize">{me.platformRole === 'super_admin' ? 'Super Admin' : me.role.replace('_', ' ')}{me.orgName && ` · ${me.orgName}`}</div></div></div>
        <div className="grid gap-4 sm:grid-cols-2"><Field label="Full name"><input className="input" value={name} onChange={(e) => setName(e.target.value)} aria-label="Full name" /></Field><Field label="Job title"><input className="input" value={title} onChange={(e) => setTitle(e.target.value)} aria-label="Job title" /></Field></div>
        <div className="mt-4 flex justify-end"><button className="btn btn-primary" disabled={busy || !name.trim()} onClick={saveProfile}>{busy && <Spinner />}Save profile</button></div></Card>
      <Card className="p-6"><h2 className="mb-3 font-semibold">Appearance</h2><div className="flex gap-3">{([['dark', 'Dark', Moon], ['light', 'Light', Sun]] as const).map(([t, l, I]) => <button key={t} onClick={() => setTheme(t)} className="btn flex-1 !h-14"><I size={17} />{l}</button>)}</div></Card>
      <Card className="p-6"><h2 className="mb-4 font-semibold">Change password</h2>
        <div className="grid gap-4 sm:grid-cols-2"><Field label="Current password" error={errs.current}><input type="password" autoComplete="current-password" className="input" value={pw.current} onChange={(e) => setPw({ ...pw, current: e.target.value })} aria-label="Current password" /></Field><Field label="New password" error={errs.next} hint="10+ characters, a capital letter and a number"><input type="password" autoComplete="new-password" className="input" value={pw.next} onChange={(e) => setPw({ ...pw, next: e.target.value })} aria-label="New password" /></Field></div>
        <div className="mt-4 flex justify-end"><button className="btn btn-primary" disabled={pwBusy || !pw.current || !pw.next} onClick={changePw}>{pwBusy && <Spinner />}Update password</button></div></Card>
    </div>
  );
}
