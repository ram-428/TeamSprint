'use client';
import { Suspense, useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { AnimatePresence, motion, useMotionValue, useSpring, useTransform } from 'framer-motion';
import { Mail, Lock, Eye, EyeOff, ArrowRight, Check, ShieldCheck, Zap, Gauge } from 'lucide-react';
import { Logo } from '@/components/Logo';
import { LoginBoard } from '@/components/LoginBoard';
import { ThemeSwitch } from '@/components/ThemeSwitch';
import { Spinner } from '@/components/ui';
import { DotsLoader } from '@/components/DotsLoader';
import { api, ApiError } from '@/lib/api';

const WORDS = ['plan', 'track', 'ship', 'celebrate'];

function LoginForm() {
  const router = useRouter(); const sp = useSearchParams();
  const [email, setEmail] = useState(''); const [password, setPassword] = useState(''); const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false); const [ok, setOk] = useState(false); const [error, setError] = useState(''); const [fields, setFields] = useState<Record<string, string>>({});
  const [word, setWord] = useState(0); const [caps, setCaps] = useState(false);
  useEffect(() => { router.prefetch('/dashboard'); }, [router]);
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
    <div ref={wrap} onPointerMove={onMove} className="relative flex h-[100dvh] flex-col overflow-hidden">
      <motion.div aria-hidden style={{ x: blobX, y: blobY }} className="pointer-events-none absolute left-[18%] top-[22%] h-[520px] w-[520px] rounded-full bg-[var(--accent)] opacity-20 blur-[120px]" />
      <div aria-hidden className="pointer-events-none absolute inset-0">{Array.from({ length: 22 }, (_, i) => (
        <span key={i} className="absolute rounded-full bg-[var(--accent-2)]" style={{ left: `${(i * 37) % 100}%`, top: `${(i * 53) % 100}%`, width: 2 + (i % 3), height: 2 + (i % 3), opacity: 0.25, animation: `float ${5 + (i % 5)}s ease-in-out ${i * 0.3}s infinite` }} />))}</div>


      {/* logo row (top of the page) */}
      <div className="relative z-30 flex shrink-0 items-start justify-between gap-4 px-4 pt-4 sm:px-6 lg:px-10 lg:pt-5 xl:px-14">
        <motion.div initial={{ opacity: 0, y: -16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }} className="hidden lg:block"><Logo variant="full" size={68} /></motion.div>
        <ThemeSwitch className="ml-auto" />
      </div>

      <div className="relative grid min-h-0 flex-1 lg:grid-cols-[1.1fr_1fr]">
      {/* hero */}
      <motion.div animate={ok ? { opacity: 0, x: -40, filter: 'blur(6px)' } : { opacity: 1, x: 0, filter: 'blur(0px)' }} transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }} className="relative hidden min-h-0 flex-col justify-between overflow-hidden px-10 pb-8 pt-8 lg:flex xl:px-14">
        <div className="relative">
          <motion.h1 initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, delay: 0.1 }} className="whitespace-nowrap text-[clamp(20px,2.8vw,52px)] font-semibold leading-[1.15]">
            {/* single line (nowrap): the word takes its natural width and "together." glides to follow it, so there is never a gap or a reflow */}
            Where teams{' '}<motion.span layout="position" className="relative inline-block align-bottom"><AnimatePresence mode="wait" initial={false}><motion.span key={word} initial={{ y: '60%', opacity: 0, filter: 'blur(6px)' }} animate={{ y: 0, opacity: 1, filter: 'blur(0px)' }} exit={{ y: '-60%', opacity: 0, filter: 'blur(6px)' }} transition={{ duration: 0.35 }} className="grad-text inline-block">{WORDS[word]}</motion.span></AnimatePresence></motion.span>{' '}<motion.span layout="position" className="inline-block">together.</motion.span>
          </motion.h1>
          <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4 }} className="mt-4 max-w-md text-[16.5px] text-muted">Boards, sprints, roadmaps and reports in one fast workspace — built for teams that move.</motion.p>
          <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.9, delay: 0.3, ease: [0.22, 1, 0.36, 1] }} style={{ rotateX: rotX, rotateY: rotY, transformPerspective: 1100 }} className="mt-9 [@media(max-height:820px)]:mt-5 [@media(max-height:820px)]:[zoom:0.78] [@media(max-height:680px)]:[zoom:0.6]"><LoginBoard /></motion.div>
        </div>
        <div className="relative flex gap-6 text-[12.5px] text-muted">{[[Zap, 'Instant boards'], [ShieldCheck, 'Role-based access'], [Gauge, 'Real-time reports']].map(([I, t]: any, i) => <motion.span key={t} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.8 + i * 0.12 }} className="flex items-center gap-1.5"><I size={14} className="text-accent2" />{t}</motion.span>)}<span className="ml-auto text-faint">© {new Date().getFullYear()} Team Sprint</span></div>
      </motion.div>

      {/* form */}
      <div className="relative flex min-h-0 items-center justify-center overflow-y-auto p-4 sm:p-6 lg:items-start lg:pt-8">
        <motion.div initial={{ opacity: 0, y: 30, scale: 0.96 }} animate={ok ? { opacity: 0, scale: 1.06, y: -12 } : { opacity: 1, y: 0, scale: 1 }} transition={{ duration: ok ? 0.5 : 0.7, ease: [0.22, 1, 0.36, 1] }} className="relative w-full max-w-[420px]">
          <div className="relative rounded-2xl border border-[var(--border)] p-6 shadow-[0_24px_60px_-24px_rgba(60,40,140,.35)] sm:p-8" style={{ background: 'var(--surface-solid)' }}>
            <div className="mb-6 lg:hidden"><Logo variant="full" size={56} /></div>
            <motion.h2 initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="text-[24px] font-semibold tracking-tight">Sign in to your account</motion.h2>
            <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }} className="mb-6 mt-1.5 text-[14px] text-muted">Enter your work email and password to access your workspace.</motion.p>
            <form onSubmit={submit} className="space-y-4" noValidate>
              {sp.get('reset') && !error && <div role="status" className="rounded-xl border border-success/40 bg-success/10 px-3.5 py-2.5 text-[13.5px] text-success">Password updated. Sign in with your new password.</div>}
              <AnimatePresence>{error && <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto', x: [0, -7, 7, -5, 5, 0] }} exit={{ opacity: 0, height: 0 }} role="alert" className="overflow-hidden rounded-xl border border-danger/40 bg-danger/10 px-3.5 py-2.5 text-[13.5px] text-danger">{error}</motion.div>}</AnimatePresence>
              {[
                { id: 'email', label: 'Work email', type: 'email', icon: Mail, val: email, set: setEmail, ac: 'username', ph: 'name@company.com', d: 0.35 },
                { id: 'password', label: 'Password', type: show ? 'text' : 'password', icon: Lock, val: password, set: setPassword, ac: 'current-password', ph: 'Enter your password', d: 0.45 },
              ].map((f) => (
                <motion.div key={f.id} initial={{ opacity: 0, x: -16 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: f.d }}>
                  {f.id === 'password'
                    ? <div className="flex items-center justify-between"><label className="label" htmlFor={f.id}>{f.label}</label><Link href="/forgot-password" className="mb-1.5 text-[13px] font-medium text-accent2 hover:underline">Forgot password?</Link></div>
                    : <label className="label" htmlFor={f.id}>{f.label}</label>}
                  <div className="group relative"><f.icon size={16} className="absolute left-3.5 top-3 text-faint transition-colors group-focus-within:text-accent" />
                    <input id={f.id} type={f.type} autoComplete={f.ac} className={`input !pl-10 ${f.id === 'password' ? '!pr-11' : ''} ${fields[f.id] ? 'err' : ''}`} placeholder={f.ph} value={f.val} onChange={(e) => f.set(e.target.value)} onKeyUp={(e) => f.id === 'password' && setCaps(e.getModifierState('CapsLock'))} autoFocus={f.id === 'email'} />
                    {f.id === 'password' && <button type="button" aria-label={show ? 'Hide password' : 'Show password'} className="absolute right-3 top-2.5 text-faint transition-colors hover:text-text" onClick={() => setShow((s) => !s)}>{show ? <EyeOff size={17} /> : <Eye size={17} />}</button>}
                  </div>
                  {fields[f.id] && <p className="field-err">{fields[f.id]}</p>}
                  {f.id === 'password' && caps && <p className="mt-1 text-xs text-warning">Caps Lock is on</p>}
                </motion.div>
              ))}
              <motion.button initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.55 }} whileTap={{ scale: 0.98 }} className="btn btn-primary relative !mt-6 w-full overflow-hidden !h-11 !rounded-xl" disabled={busy}>
                <AnimatePresence mode="wait" initial={false}>
                  {ok ? <motion.span key="ok" initial={{ scale: 0, rotate: -90 }} animate={{ scale: 1, rotate: 0 }} className="flex items-center gap-2"><Check size={18} /> Welcome</motion.span>
                    : busy ? <motion.span key="b" initial={{ opacity: 0 }} animate={{ opacity: 1 }}><Spinner /></motion.span>
                    : <motion.span key="s" className="flex items-center gap-2">Sign in <ArrowRight size={16} /></motion.span>}
                </AnimatePresence>
              </motion.button>
            </form>
            <div className="mt-6 border-t border-[var(--border)] pt-5 text-center text-[13.5px] text-muted">Don&apos;t have an account? <Link href="/register" className="font-semibold text-accent2 hover:underline">Create a workspace</Link></div>

          </div>
        </motion.div>
      </div>
      </div>

      {/* sign-in succeeded: hero + card are gone, the loader sits in the middle of the page until the dashboard has loaded */}
      <AnimatePresence>{ok && <motion.div key="signing-in" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.45, delay: 0.2 }} className="absolute inset-0 z-20 flex items-center justify-center"><DotsLoader size={240} label="Signing you in…" /></motion.div>}</AnimatePresence>
    </div>
  );
}

export default function LoginPage() { return <Suspense><LoginForm /></Suspense>; }
