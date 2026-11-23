'use client';
import { Suspense, useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { AnimatePresence, motion, useMotionValue, useSpring, useTransform } from 'framer-motion';
import { Mail, Lock, Eye, EyeOff, ArrowRight, Check, ShieldCheck, Zap, Gauge } from 'lucide-react';
import { Logo } from '@/components/Logo';
import { LoginBoard } from '@/components/LoginBoard';
import { Avatar, Spinner } from '@/components/ui';
import { api, ApiError } from '@/lib/api';

type Demo = { name: string; email: string; password: string; label: string; color: string };
const WORDS = ['plan', 'track', 'ship', 'celebrate'];

function LoginForm() {
  const router = useRouter(); const sp = useSearchParams();
  const [email, setEmail] = useState(''); const [password, setPassword] = useState(''); const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false); const [ok, setOk] = useState(false); const [error, setError] = useState(''); const [fields, setFields] = useState<Record<string, string>>({});
  const [demo, setDemo] = useState<Demo[]>([]); const [word, setWord] = useState(0); const [caps, setCaps] = useState(false);
  useEffect(() => { api<{ accounts: Demo[] }>('/api/auth/demo').then((d) => setDemo(d.accounts)).catch(() => {}); router.prefetch('/dashboard'); }, [router]);
  useEffect(() => { const t = setInterval(() => setWord((w) => (w + 1) % WORDS.length), 2200); return () => clearInterval(t); }, []);

  // pointer parallax / 3D tilt
  const mx = useMotionValue(0), my = useMotionValue(0);
  const sx = useSpring(mx, { stiffness: 90, damping: 18 }), sy = useSpring(my, { stiffness: 90, damping: 18 });
  const rotY = useTransform(sx, [-1, 1], [-5, 5]), rotX = useTransform(sy, [-1, 1], [4, -4]);
  const blobX = useTransform(sx, [-1, 1], [-40, 40]), blobY = useTransform(sy, [-1, 1], [-30, 30]);
  const wrap = useRef<HTMLDivElement>(null);
  const onMove = (e: React.PointerEvent) => { const r = wrap.current?.getBoundingClientRect(); if (!r) return; mx.set(((e.clientX - r.left) / r.width) * 2 - 1); my.set(((e.clientY - r.top) / r.height) * 2 - 1); };

  async function submit(e?: React.FormEvent, creds?: { email: string; password: string }) {
    e?.preventDefault(); setBusy(true); setError(''); setFields({});
    try {
      const r = await api<{ platformRole: string }>('/api/auth/login', { body: creds || { email, password } });
      setOk(true);
      const next = sp.get('next'); const to = next && next.startsWith('/') ? next : r.platformRole === 'super_admin' ? '/admin/platform' : '/dashboard';
      router.prefetch(to); setTimeout(() => { router.replace(to); router.refresh(); }, 650);
    } catch (err) {
      if (err instanceof ApiError) { setError(err.message); setFields(err.fields || {}); } else setError('Could not reach the server');
      setBusy(false);
    }
  }

  return (
    <div ref={wrap} onPointerMove={onMove} className="relative grid min-h-screen overflow-hidden lg:grid-cols-[1.1fr_1fr]">
      <motion.div aria-hidden style={{ x: blobX, y: blobY }} className="pointer-events-none absolute left-[18%] top-[22%] h-[520px] w-[520px] rounded-full bg-[var(--accent)] opacity-20 blur-[120px]" />
      <div aria-hidden className="pointer-events-none absolute inset-0">{Array.from({ length: 22 }, (_, i) => (
        <span key={i} className="absolute rounded-full bg-[var(--accent-2)]" style={{ left: `${(i * 37) % 100}%`, top: `${(i * 53) % 100}%`, width: 2 + (i % 3), height: 2 + (i % 3), opacity: 0.25, animation: `float ${5 + (i % 5)}s ease-in-out ${i * 0.3}s infinite` }} />))}</div>

      {/* hero */}
      <div className="relative hidden flex-col justify-between p-10 lg:flex xl:p-14">
        <motion.div initial={{ opacity: 0, y: -16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}><Logo variant="full" size={96} /></motion.div>
        <div className="relative">
          <motion.h1 initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, delay: 0.1 }} className="max-w-[640px] text-[52px] font-semibold leading-[1.05] xl:text-[60px]">
            Where teams <span className="relative inline-block min-w-[3.4ch] align-bottom"><AnimatePresence mode="wait"><motion.span key={word} initial={{ y: '60%', opacity: 0, filter: 'blur(6px)' }} animate={{ y: 0, opacity: 1, filter: 'blur(0px)' }} exit={{ y: '-60%', opacity: 0, filter: 'blur(6px)' }} transition={{ duration: 0.4 }} className="grad-text inline-block">{WORDS[word]}</motion.span></AnimatePresence></span> together.
          </motion.h1>
          <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4 }} className="mt-4 max-w-md text-[16.5px] text-muted">Boards, sprints, roadmaps and reports in one fast workspace — built for teams that move.</motion.p>
          <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.9, delay: 0.3, ease: [0.22, 1, 0.36, 1] }} style={{ rotateX: rotX, rotateY: rotY, transformPerspective: 1100 }} className="mt-9"><LoginBoard /></motion.div>
        </div>
        <div className="relative flex gap-6 text-[12.5px] text-muted">{[[Zap, 'Instant boards'], [ShieldCheck, 'Role-based access'], [Gauge, 'Real-time reports']].map(([I, t]: any, i) => <motion.span key={t} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.8 + i * 0.12 }} className="flex items-center gap-1.5"><I size={14} className="text-accent2" />{t}</motion.span>)}<span className="ml-auto text-faint">© {new Date().getFullYear()} Team Sprint</span></div>
      </div>

      {/* form */}
      <div className="relative flex items-center justify-center p-5 sm:p-8">
        <motion.div style={{ rotateX: rotX, rotateY: rotY, transformPerspective: 1200 }} initial={{ opacity: 0, y: 30, scale: 0.96 }} animate={ok ? { opacity: 0, scale: 1.06, y: -12 } : { opacity: 1, y: 0, scale: 1 }} transition={{ duration: ok ? 0.5 : 0.7, ease: [0.22, 1, 0.36, 1] }} className="relative w-full max-w-[450px]">
          <div aria-hidden className="absolute -inset-[1.5px] rounded-[30px] opacity-80" style={{ background: 'conic-gradient(from var(--ang, 0deg), var(--accent), var(--accent-2), #f472b6, var(--accent))', animation: 'ang 6s linear infinite' }} />
          <div className="relative rounded-[28px] p-7 sm:p-8" style={{ background: 'var(--surface-solid)' }}>
            <div className="mb-6 lg:hidden"><Logo variant="full" size={56} /></div>
            <motion.h2 initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="text-[28px] font-semibold">Welcome back 👋</motion.h2>
            <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }} className="mb-6 mt-1 text-muted">Sign in to your Team Sprint workspace.</motion.p>
            <form onSubmit={submit} className="space-y-4" noValidate>
              <AnimatePresence>{error && <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto', x: [0, -7, 7, -5, 5, 0] }} exit={{ opacity: 0, height: 0 }} role="alert" className="overflow-hidden rounded-xl border border-danger/40 bg-danger/10 px-3.5 py-2.5 text-[13.5px] text-danger">{error}</motion.div>}</AnimatePresence>
              {[
                { id: 'email', label: 'Email', type: 'email', icon: Mail, val: email, set: setEmail, ac: 'username', ph: 'you@company.com', d: 0.35 },
                { id: 'password', label: 'Password', type: show ? 'text' : 'password', icon: Lock, val: password, set: setPassword, ac: 'current-password', ph: '••••••••••', d: 0.45 },
              ].map((f) => (
                <motion.div key={f.id} initial={{ opacity: 0, x: -16 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: f.d }}>
                  <label className="label" htmlFor={f.id}>{f.label}</label>
                  <div className="group relative"><f.icon size={16} className="absolute left-3.5 top-3 text-faint transition-colors group-focus-within:text-accent" />
                    <input id={f.id} type={f.type} autoComplete={f.ac} className={`input !pl-10 ${f.id === 'password' ? '!pr-11' : ''} ${fields[f.id] ? 'err' : ''}`} placeholder={f.ph} value={f.val} onChange={(e) => f.set(e.target.value)} onKeyUp={(e) => f.id === 'password' && setCaps(e.getModifierState('CapsLock'))} autoFocus={f.id === 'email'} />
                    {f.id === 'password' && <button type="button" aria-label={show ? 'Hide password' : 'Show password'} className="absolute right-3 top-2.5 text-faint transition-colors hover:text-text" onClick={() => setShow((s) => !s)}>{show ? <EyeOff size={17} /> : <Eye size={17} />}</button>}
                  </div>
                  {fields[f.id] && <p className="field-err">{fields[f.id]}</p>}
                  {f.id === 'password' && caps && <p className="mt-1 text-xs text-warning">Caps Lock is on</p>}
                </motion.div>
              ))}
              <motion.button initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.55 }} whileTap={{ scale: 0.97 }} className="btn btn-primary relative w-full overflow-hidden !h-11 !rounded-xl" disabled={busy}>
                <span aria-hidden className="shine" />
                <AnimatePresence mode="wait" initial={false}>
                  {ok ? <motion.span key="ok" initial={{ scale: 0, rotate: -90 }} animate={{ scale: 1, rotate: 0 }} className="flex items-center gap-2"><Check size={18} /> Welcome</motion.span>
                    : busy ? <motion.span key="b" initial={{ opacity: 0 }} animate={{ opacity: 1 }}><Spinner /></motion.span>
                    : <motion.span key="s" className="flex items-center gap-2">Sign in <ArrowRight size={16} /></motion.span>}
                </AnimatePresence>
              </motion.button>
            </form>
            <p className="mt-5 text-center text-[13.5px] text-muted">New to Team Sprint? <Link href="/register" className="font-semibold text-accent2 hover:underline">Create a workspace</Link></p>

            {demo.length > 0 && (
              <div className="mt-5 border-t border-[var(--border)] pt-4">
                <div className="mb-2.5 flex items-center justify-between"><span className="text-[12px] font-semibold text-muted">Demo accounts · one-click</span><span className="chip !h-5 text-[10px]">dev only</span></div>
                <div className="grid grid-cols-2 gap-2">
                  {demo.map((d, i) => (
                    <motion.button key={d.email} type="button" initial={{ opacity: 0, y: 10, scale: 0.95 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ delay: 0.6 + i * 0.045, type: 'spring', stiffness: 260, damping: 22 }} whileHover={{ y: -3 }} whileTap={{ scale: 0.96 }} disabled={busy} onClick={() => { setEmail(d.email); setPassword(d.password); submit(undefined, d); }} className="flex items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-2 text-left transition-colors hover:border-[var(--accent)] hover:bg-[var(--accent-soft)]">
                      <Avatar user={d} size={26} /><span className="min-w-0"><span className="block truncate text-[12px] font-semibold">{d.label}</span><span className="block truncate text-[10.5px] text-faint">{d.name}</span></span>
                    </motion.button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </motion.div>
      </div>
    </div>
  );
}

export default function LoginPage() { return <Suspense><LoginForm /></Suspense>; }
