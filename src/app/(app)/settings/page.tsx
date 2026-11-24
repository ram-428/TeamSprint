'use client';
import { useState } from 'react';
import { Moon, Sun, Contrast } from 'lucide-react';
import { api, errMsg, toast, ApiError } from '@/lib/api';
import { Avatar, Card, Field, PageHeader, Spinner } from '@/components/ui';
import { useMe } from '@/components/UserContext';
import { PasswordField, passwordRuleError } from '@/components/PasswordField';

export default function Settings() {
  const me = useMe();
  const [name, setName] = useState(me.name); const [title, setTitle] = useState(me.title || ''); const [busy, setBusy] = useState(false);
  const [pw, setPw] = useState({ current: '', next: '', confirm: '' }); const [pwBusy, setPwBusy] = useState(false); const [errs, setErrs] = useState<Record<string, string>>({});
  const setTheme = (t: 'dark' | 'light' | 'simple') => { document.documentElement.setAttribute('data-theme', t); try { localStorage.setItem('orbit-theme', t); } catch { /* ignore */ } api('/api/auth/me', { method: 'PATCH', body: { theme: t } }).catch(() => {}); };

  async function saveProfile() { setBusy(true); try { await api('/api/auth/me', { method: 'PATCH', body: { name, title } }); toast.success('Profile updated'); } catch (e) { toast.error(errMsg(e)); } finally { setBusy(false); } }
  async function changePw() {
    const f: Record<string, string> = {};
    if (!pw.current) f.current = 'Enter your current password';
    const rule = passwordRuleError(pw.next);
    if (rule) f.next = rule; else if (pw.next === pw.current) f.next = 'Choose a different password'; else if (pw.next !== pw.confirm) f.confirm = 'Passwords do not match';
    setErrs(f); if (Object.keys(f).length) return;
    setPwBusy(true);
    try { await api('/api/auth/password', { body: { current: pw.current, next: pw.next } }); toast.success('Password changed — other sessions were signed out'); setPw({ current: '', next: '', confirm: '' }); }
    catch (e) { if (e instanceof ApiError && e.fields) setErrs(e.fields); else toast.error(errMsg(e)); } finally { setPwBusy(false); }
  }
  return (
    <div className="mx-auto max-w-[760px] space-y-5">
      <PageHeader title="Profile & security" subtitle={me.email} />
      <Card className="p-6"><div className="mb-5 flex items-center gap-4"><Avatar user={me} size={60} /><div><div className="text-[17px] font-semibold">{me.name}</div><div className="text-sm text-muted capitalize">{me.platformRole === 'super_admin' ? 'Super Admin' : me.role.replace('_', ' ')}{me.orgName && ` · ${me.orgName}`}</div></div></div>
        <div className="grid gap-4 sm:grid-cols-2"><Field label="Full name"><input className="input" value={name} onChange={(e) => setName(e.target.value)} aria-label="Full name" /></Field><Field label="Job title"><input className="input" value={title} onChange={(e) => setTitle(e.target.value)} aria-label="Job title" /></Field></div>
        <div className="mt-4 flex justify-end"><button className="btn btn-primary" disabled={busy || !name.trim()} onClick={saveProfile}>{busy && <Spinner />}Save profile</button></div></Card>
      <Card className="p-6"><h2 className="mb-3 font-semibold">Appearance</h2><div className="flex gap-3">{([['dark', 'Dark', Moon], ['light', 'Light', Sun], ['simple', 'Simple', Contrast]] as const).map(([t, l, I]) => <button key={t} onClick={() => setTheme(t)} className="btn flex-1 !h-14"><I size={17} />{l}</button>)}</div></Card>
      <Card className="p-6"><h2 className="mb-1 font-semibold">Change password</h2><p className="mb-4 text-sm text-muted">Changing your password signs you out of every other device.</p>
        <form onSubmit={(e) => { e.preventDefault(); changePw(); }} noValidate>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2"><PasswordField label="Current password" value={pw.current} onChange={(v) => setPw({ ...pw, current: v })} error={errs.current} autoComplete="current-password" /></div>
            <PasswordField label="New password" value={pw.next} onChange={(v) => setPw({ ...pw, next: v })} error={errs.next} autoComplete="new-password" meter />
            <PasswordField label="Confirm new password" value={pw.confirm} onChange={(v) => setPw({ ...pw, confirm: v })} error={errs.confirm} autoComplete="new-password" />
          </div>
          <div className="mt-4 flex justify-end"><button type="submit" className="btn btn-primary" disabled={pwBusy || !pw.current || !pw.next || !pw.confirm}>{pwBusy && <Spinner />}Update password</button></div>
        </form></Card>
    </div>
  );
}
