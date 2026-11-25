'use client';
/* eslint-disable @next/next/no-img-element */
import { motion } from 'framer-motion';

/** Professional brand loader: TS app icon inside a rotating accent ring, a label, and an indeterminate progress bar. Uses theme tokens, so it works on every theme. */
export function BrandLoader({ size = 96, label }: { size?: number; label?: string }) {
  const stroke = 3;
  const r = size / 2 - stroke;
  const c = 2 * Math.PI * r;
  const icon = Math.round(size * 0.5);
  return (
    <div role="status" aria-live="polite" className="flex flex-col items-center gap-5">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="absolute inset-0" aria-hidden>
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--border-strong)" strokeWidth={stroke} />
        </svg>
        <motion.svg width={size} height={size} className="absolute inset-0" aria-hidden
          animate={{ rotate: 360 }} transition={{ duration: 1.1, repeat: Infinity, ease: 'linear' }}>
          <defs>
            <linearGradient id="brand-loader-grad" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="var(--accent)" />
              <stop offset="100%" stopColor="var(--accent-2)" />
            </linearGradient>
          </defs>
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="url(#brand-loader-grad)" strokeWidth={stroke}
            strokeLinecap="round" strokeDasharray={`${c * 0.28} ${c}`} />
        </motion.svg>
        <motion.img src="/brand/icon.png" alt="" width={icon} height={icon}
          className="absolute left-1/2 top-1/2 rounded-[28%] shadow-[0_8px_24px_-10px_rgba(124,92,255,.55)]"
          style={{ width: icon, height: icon, x: '-50%', y: '-50%' }}
          animate={{ scale: [1, 1.05, 1] }} transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut' }} />
      </div>
      <div className="flex flex-col items-center gap-2.5">
        {label ? <p className="text-[14px] font-medium tracking-tight" style={{ color: 'var(--text-muted)' }}>{label}</p> : <span className="sr-only">Loading</span>}
        <div className="relative h-[3px] w-36 overflow-hidden rounded-full" style={{ background: 'var(--accent-soft)' }} aria-hidden>
          <motion.div className="absolute inset-y-0 w-1/3 rounded-full"
            style={{ background: 'linear-gradient(90deg, var(--accent), var(--accent-2))' }}
            initial={{ left: '-35%' }} animate={{ left: '100%' }} transition={{ duration: 1.2, repeat: Infinity, ease: 'easeInOut' }} />
        </div>
      </div>
    </div>
  );
}
