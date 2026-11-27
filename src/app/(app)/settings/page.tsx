'use client';
import { useState } from 'react';
import { useRef } from 'react';
import { Moon, Sun, Contrast, Camera, Trash2 } from 'lucide-react';
import { api, errMsg, toast, ApiError } from '@/lib/api';
import { Avatar, Card, Field, PageHeader, Spinner } from '@/components/ui';
import { useMe } from '@/components/UserContext';
import { PasswordField, passwordRuleError } from '@/components/PasswordField';

export default function Settings() {
  const me = useMe();
  const [name, setName] = useState(me.name); const [title, setTitle] = useState(me.title || ''); const [busy, setBusy] = useState(false);
  const [avatar, setAvatar] = useState<string | undefined>(me.avatarUrl); const [upBusy, setUpBusy] = useState(false); const fileRef = useRef<HTMLInputElement>(null);
  const [pw, setPw] = useState({ current: '', next: '', confirm: '' }); const [pwBusy, setPwBusy] = useState(false); const [errs, setErrs] = useState<Record<string, string>>({});
  const setTheme = (t: 'dark' | 'light' | 'simple') => { document.documentElement.setAttribute('data-theme', t); try { localStorage.setItem('orbit-theme', t); } catch { /* ignore */ } api('/api/auth/me', { method: 'PATCH', body: { theme: t } }).catch(() => {}); };

  /** Downscale in the browser (max 512px, JPEG) so uploads are small and fast, then send to the server. */
  async function pickPhoto(file?: File) {
    if (!file) return;
    if (!file.type.startsWith('image/')) { toast.error('Choose an image file'); return; }
    setUpBusy(true);
    try {
      const bmp = await createImageBitmap(file); const k = Math.min(1, 512 / Math.max(bmp.width, bmp.height));
      const cv = document.createElement('canvas'); cv.width = Math.round(bmp.width * k); cv.height = Math.round(bmp.height * k);
      cv.getContext('2d')!.drawImage(bmp, 0, 0, cv.width, cv.height);
      const blob: Blob = await new Promise((ok, no) => cv.toBlob((b) => (b ? ok(b) : no(new Error('encode'))), 'image/jpeg', 0.88));
      const fd = new FormData(); fd.set('file', new File([blob], 'avatar.jpg', { type: 'image/jpeg' }));
      const res = await fetch('/api/auth/avatar', { method: 'POST', body: fd, credentials: 'same-origin' }); const j = await res.json().catch(() => null);
      if (!res.ok || !j?.ok) throw new Error(j?.error?.message || 'Upload failed');
      setAvatar(j.data.avatarUrl); toast.success('Profile photo updated');
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Upload failed'); } finally { setUpBusy(false); if (fileRef.current) fileRef.current.value = ''; }
  }
  async function removePhoto() { setUpBusy(true); try { await api('/api/auth/avatar', { method: 'DELETE' }); setAvatar(undefined); toast.success('Profile photo removed'); } catch (e) { toast.error(errMsg(e)); } finally { setUpBusy(false); } }
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
      <Card className="p-6"><div className="mb-5 flex items-center gap-4"><div className="group relative shrink-0"><Avatar user={{ ...me, avatarUrl: avatar }} size={72} />
          <button type="button" aria-label="Change profile photo" disabled={upBusy} onClick={() => fileRef.current?.click()} className="absolute inset-0 flex items-center justify-center rounded-full bg-black/45 text-white opacity-0 transition-opacity focus:opacity-100 group-hover:opacity-100 disabled:opacity-100">{upBusy ? <Spinner /> : <Camera size={20} />}</button>
          <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp,image/gif" className="hidden" aria-label="Upload profile photo" onChange={(e) => pickPhoto(e.target.files?.[0])} /></div><div><div className="text-[17px] font-semibold">{me.name}</div><div className="text-sm text-muted capitalize">{me.platformRole === 'super_admin' ? 'Super Admin' : me.role.replace('_', ' ')}{me.orgName && ` · ${me.orgName}`}</div><div className="mt-2 flex gap-2"><button type="button" className="btn btn-sm" disabled={upBusy} onClick={() => fileRef.current?.click()}><Camera size={13} /> {avatar ? 'Change photo' : 'Upload photo'}</button>{avatar && <button type="button" className="btn btn-sm !text-danger" disabled={upBusy} onClick={removePhoto}><Trash2 size={13} /> Remove</button>}</div></div></div>
        <div className="grid gap-4 sm:grid-cols-2"><Field label="Full name"><input placeholder="Your full name" className="input" value={name} onChange={(e) => setName(e.target.value)} aria-label="Full name" /></Field><Field label="Job title"><input placeholder="e.g. Product Manager" className="input" value={title} onChange={(e) => setTitle(e.target.value)} aria-label="Job title" /></Field></div>
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
