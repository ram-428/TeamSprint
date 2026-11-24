'use client';
import { motion } from 'framer-motion';

// position / radius / colour of each dot (SVG units), plus its own drift path and speed so they never move in sync
const DOTS = [
  { x: 338, y: 77, r: 23, c: '#ff86c8', dx: [0, 14, -8, 0], dy: [0, -10, 12, 0], t: 4.2 },
  { x: 392, y: 143, r: 18, c: '#ff8bb0', dx: [0, -12, 6, 0], dy: [0, 12, -8, 0], t: 3.6 },
  { x: 137, y: 167, r: 22, c: '#ffae2f', dx: [0, -10, 10, 0], dy: [0, 14, -10, 0], t: 4.8 },
  { x: 272, y: 180, r: 24, c: '#ff72ee', dx: [0, 12, -12, 0], dy: [0, -14, 8, 0], t: 3.9 },
  { x: 160, y: 250, r: 23, c: '#ffb02e', dx: [0, 10, -6, 0], dy: [0, -12, 10, 0], t: 4.5 },
  { x: 245, y: 293, r: 22, c: '#ffa06a', dx: [0, -14, 8, 0], dy: [0, -10, 6, 0], t: 3.7 },
  { x: 344, y: 279, r: 28, c: '#ff8f87', dx: [0, 12, -10, 0], dy: [0, 12, -12, 0], t: 5.1 },
];

/** Playful floating-dots loader: soft coloured balls drift and breathe. Pure SVG + framer-motion, works on any theme. */
export function DotsLoader({ size = 200, label }: { size?: number; label?: string }) {
  return (
    <div role="status" aria-live="polite" className="flex flex-col items-center gap-3">
      <svg viewBox="100 40 320 300" width={size} height={size * (300 / 320)} aria-hidden>
        {DOTS.map((d, i) => (
          <motion.circle key={i} cx={d.x} cy={d.y} r={d.r} fill={d.c}
            initial={{ scale: 0, opacity: 0 }}
            animate={{ x: d.dx, y: d.dy, scale: [1, 1.14, 0.92, 1], opacity: 1 }}
            transition={{ x: { duration: d.t, repeat: Infinity, ease: 'easeInOut' }, y: { duration: d.t * 1.1, repeat: Infinity, ease: 'easeInOut' }, scale: { duration: d.t * 0.8, repeat: Infinity, ease: 'easeInOut', delay: i * 0.12 }, opacity: { duration: 0.4, delay: i * 0.07 } }}
            style={{ transformBox: 'fill-box', transformOrigin: 'center' }} />
        ))}
      </svg>
      {label ? <p className="text-[13.5px] font-medium text-muted">{label}</p> : <span className="sr-only">Loading</span>}
    </div>
  );
}
