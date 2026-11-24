'use client';
import { useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Download, ExternalLink, File as FileIcon, FileArchive, FileSpreadsheet, FileText, Film, Image as ImageIcon, Paperclip, Play, Presentation, Trash2, UploadCloud, X } from 'lucide-react';
import clsx from 'clsx';
import { api, errMsg, toast } from '@/lib/api';
import { ALLOWED_EXT, IMAGE_EXT, VIDEO_EXT, DOC_EXT, MAX_PER_ISSUE, checkFile, extOf, fmtBytes, kindOfExt, type Attachment } from '@/lib/attachments';

/* ───────── helpers ───────── */
export const thumbUrl = (a: Attachment, px = 200) => {
  if (a.kind === 'image') return a.url.replace('/upload/', `/upload/c_fill,w_${px},h_${px},f_auto,q_auto/`);
  if (a.kind === 'video') return a.url.replace('/upload/', `/upload/c_fill,w_${px},h_${px},so_0/`).replace(/\.[a-z0-9]+$/i, '.jpg');
  return '';
};
export const downloadUrl = (a: Attachment) => a.url.replace('/upload/', '/upload/fl_attachment/');
function DocIcon({ ext, size = 22 }: { ext?: string; size?: number }) {
  const e = (ext || '').toLowerCase();
  const I = e === 'pdf' || e === 'doc' || e === 'docx' || e === 'txt' ? FileText : e === 'xls' || e === 'xlsx' || e === 'csv' ? FileSpreadsheet : e === 'ppt' || e === 'pptx' ? Presentation : e === 'zip' ? FileArchive : FileIcon;
  return <I size={size} />;
}
const DOC_COLORS: Record<string, string> = { pdf: '#ef4444', doc: '#3b82f6', docx: '#3b82f6', xls: '#16a34a', xlsx: '#16a34a', csv: '#16a34a', ppt: '#f97316', pptx: '#f97316', zip: '#a855f7', txt: '#64748b' };

/** Uploads one file straight to Cloudinary using a server-made signature; reports progress. */
export async function uploadAttachment(file: File, onProgress: (pct: number) => void): Promise<Attachment> {
  const why = checkFile(file.name, file.size); if (why) throw new Error(why);
  const sig = await api<{ endpoint: string; apiKey: string; params: Record<string, string | number>; signature: string }>('/api/attachments/sign', { body: { name: file.name, size: file.size } });
  const fd = new FormData();
  fd.set('file', file); fd.set('api_key', sig.apiKey); fd.set('signature', sig.signature);
  for (const [k, v] of Object.entries(sig.params)) fd.set(k, String(v));
  const j: any = await new Promise((ok, no) => {
    const x = new XMLHttpRequest(); x.open('POST', sig.endpoint);
    x.upload.onprogress = (e) => e.lengthComputable && onProgress(Math.round((e.loaded / e.total) * 100));
    x.onload = () => { try { const r = JSON.parse(x.responseText); x.status >= 200 && x.status < 300 ? ok(r) : no(new Error(r?.error?.message || 'Upload failed')); } catch { no(new Error('Upload failed')); } };
    x.onerror = () => no(new Error('Network error while uploading')); x.send(fd);
  });
  const ext = (j.format || extOf(file.name)).toLowerCase();
  return { id: j.public_id, name: file.name, url: j.secure_url, publicId: j.public_id, resourceType: j.resource_type, kind: kindOfExt(ext) || 'document', format: ext, bytes: j.bytes || file.size, width: j.width, height: j.height };
}

/* ───────── picker: drag & drop + Photo / Video / Document buttons ───────── */
type Pending = { tmp: string; name: string; size: number; pct: number; error?: string };

export function AttachmentPicker({ files, onUploaded, onRemove, disabled, max = MAX_PER_ISSUE, compact }: {
  files: Attachment[]; onUploaded: (a: Attachment[]) => void | Promise<void>; onRemove?: (a: Attachment) => void; disabled?: boolean; max?: number; compact?: boolean;
}) {
  const [pending, setPending] = useState<Pending[]>([]); const [over, setOver] = useState(false);
  const refs = { image: useRef<HTMLInputElement>(null), video: useRef<HTMLInputElement>(null), document: useRef<HTMLInputElement>(null) };
  const room = max - files.length - pending.filter((p) => !p.error).length;

  async function handle(list: FileList | File[] | null) {
    const arr = Array.from(list || []); if (!arr.length || disabled) return;
    if (arr.length > room) { toast.error(`You can attach up to ${max} files per issue`); arr.length = Math.max(0, room); }
    const rows = arr.map((f) => ({ tmp: crypto.randomUUID(), f }));
    setPending((p) => [...p, ...rows.map((r) => ({ tmp: r.tmp, name: r.f.name, size: r.f.size, pct: 0 }))]);
    const done: Attachment[] = [];
    await Promise.all(rows.map(async ({ tmp, f }) => {
      try { const a = await uploadAttachment(f, (pct) => setPending((p) => p.map((x) => (x.tmp === tmp ? { ...x, pct } : x)))); done.push(a); setPending((p) => p.filter((x) => x.tmp !== tmp)); }
      catch (e) { setPending((p) => p.map((x) => (x.tmp === tmp ? { ...x, error: e instanceof Error ? e.message : errMsg(e) } : x))); }
    }));
    if (done.length) await onUploaded(done);
  }
  const pick = (k: 'image' | 'video' | 'document') => refs[k].current?.click();
  const accept = { image: IMAGE_EXT.map((e) => '.' + e).join(','), video: VIDEO_EXT.map((e) => '.' + e).join(','), document: DOC_EXT.map((e) => '.' + e).join(',') };

  return (
    <div className="space-y-3">
      <div onDragOver={(e) => { e.preventDefault(); if (!disabled) setOver(true); }} onDragLeave={() => setOver(false)} onDrop={(e) => { e.preventDefault(); setOver(false); handle(e.dataTransfer.files); }}
        className={clsx('rounded-2xl border-2 border-dashed text-center transition-colors', compact ? 'px-4 py-4' : 'px-4 py-6', over ? 'border-[var(--accent)] bg-[var(--accent-soft)]' : 'border-[var(--border-strong)] bg-[var(--surface)]', disabled && 'opacity-60')}>
        <UploadCloud size={compact ? 22 : 28} className="mx-auto text-accent2" />
        <p className="mt-1.5 text-[13.5px] font-medium">Drag &amp; drop files here, or choose</p>
        <div className="mt-3 flex flex-wrap justify-center gap-2">
          <button type="button" className="btn btn-sm" disabled={disabled || room <= 0} onClick={() => pick('image')}><ImageIcon size={14} /> Photo</button>
          <button type="button" className="btn btn-sm" disabled={disabled || room <= 0} onClick={() => pick('video')}><Film size={14} /> Video</button>
          <button type="button" className="btn btn-sm" disabled={disabled || room <= 0} onClick={() => pick('document')}><FileText size={14} /> Document</button>
        </div>
        <p className="mt-2.5 text-[11.5px] text-faint">Photos &amp; documents up to 10 MB · Videos up to 50 MB · max {max} files</p>
        {(['image', 'video', 'document'] as const).map((k) => <input key={k} ref={refs[k]} type="file" multiple hidden accept={accept[k]} aria-label={`Upload ${k}`} onChange={(e) => { handle(e.target.files); e.target.value = ''; }} />)}
      </div>

      {(files.length > 0 || pending.length > 0) && (
        <ul className="space-y-2">
          {files.map((a) => (
            <li key={a.id} className="flex items-center gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-2">
              <Thumb a={a} size={44} />
              <div className="min-w-0 flex-1"><div className="truncate text-[13.5px] font-medium">{a.name}</div><div className="text-xs text-faint">{a.kind === 'image' ? 'Photo' : a.kind === 'video' ? 'Video' : (a.format || 'Document').toUpperCase()} · {fmtBytes(a.bytes)}</div></div>
              {onRemove && <button type="button" aria-label={`Remove ${a.name}`} className="rounded-lg p-2 text-faint hover:text-danger" onClick={() => onRemove(a)}><X size={15} /></button>}
            </li>
          ))}
          {pending.map((p) => (
            <li key={p.tmp} className={clsx('rounded-xl border p-2.5', p.error ? 'border-danger/40 bg-danger/5' : 'border-[var(--border)] bg-[var(--surface)]')}>
              <div className="flex items-center gap-3"><Paperclip size={16} className="shrink-0 text-faint" />
                <div className="min-w-0 flex-1"><div className="truncate text-[13.5px] font-medium">{p.name}</div>
                  {p.error ? <div className="text-xs text-danger">{p.error}</div> : <div className="text-xs text-faint">{p.pct < 100 ? `Uploading… ${p.pct}%` : 'Processing…'} · {fmtBytes(p.size)}</div>}</div>
                {p.error && <button type="button" aria-label="Dismiss" className="rounded-lg p-1.5 text-faint hover:text-text" onClick={() => setPending((x) => x.filter((y) => y.tmp !== p.tmp))}><X size={15} /></button>}</div>
              {!p.error && <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[var(--surface-2)]"><motion.div className="grad-bar h-full rounded-full" animate={{ width: `${p.pct}%` }} transition={{ duration: 0.2 }} /></div>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Thumb({ a, size }: { a: Attachment; size: number }) {
  const t = thumbUrl(a, size * 2);
  if (t) return (
    <span className="relative inline-flex shrink-0 overflow-hidden rounded-lg bg-[var(--surface-2)]" style={{ width: size, height: size }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={t} alt="" width={size} height={size} loading="lazy" className="h-full w-full object-cover" />
      {a.kind === 'video' && <span className="absolute inset-0 flex items-center justify-center bg-black/30 text-white"><Play size={size * 0.4} fill="currentColor" /></span>}
    </span>
  );
  return <span className="inline-flex shrink-0 items-center justify-center rounded-lg" style={{ width: size, height: size, background: `${DOC_COLORS[a.format || ''] || '#64748b'}1f`, color: DOC_COLORS[a.format || ''] || '#64748b' }}><DocIcon ext={a.format} size={size * 0.5} /></span>;
}

/* ───────── gallery shown on the issue page ───────── */
export function AttachmentGallery({ items, canDelete, onDelete }: { items: Attachment[]; canDelete?: boolean; onDelete?: (a: Attachment) => void }) {
  const [view, setView] = useState<Attachment | null>(null);
  const media = items.filter((a) => a.kind !== 'document'); const docs = items.filter((a) => a.kind === 'document');
  return (
    <div className="space-y-3">
      {media.length > 0 && (
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
          {media.map((a) => (
            <div key={a.id} className="group relative overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface-2)]">
              <button type="button" className="relative block aspect-[4/3] w-full" onClick={() => setView(a)} aria-label={`Open ${a.name}`}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={thumbUrl(a, 480)} alt={a.name} loading="lazy" className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105" />
                {a.kind === 'video' && <span className="absolute inset-0 flex items-center justify-center bg-black/25"><span className="flex h-11 w-11 items-center justify-center rounded-full bg-white/90 text-black shadow-lg"><Play size={18} fill="currentColor" /></span></span>}
              </button>
              <div className="flex items-center gap-1 px-2.5 py-1.5"><span className="min-w-0 flex-1 truncate text-xs text-muted" title={a.name}>{a.name}</span>
                {canDelete && <button type="button" aria-label={`Delete ${a.name}`} className="rounded p-1 text-faint hover:text-danger" onClick={() => onDelete?.(a)}><Trash2 size={13} /></button>}</div>
            </div>
          ))}
        </div>
      )}
      {docs.length > 0 && (
        <ul className="space-y-2">
          {docs.map((a) => (
            <li key={a.id} className="flex items-center gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-2.5">
              <Thumb a={a} size={42} />
              <div className="min-w-0 flex-1"><div className="truncate text-[13.5px] font-medium" title={a.name}>{a.name}</div><div className="text-xs text-faint">{(a.format || 'file').toUpperCase()} · {fmtBytes(a.bytes)}</div></div>
              <a className="btn btn-sm" href={a.url} target="_blank" rel="noopener noreferrer"><ExternalLink size={13} /> Open</a>
              <a className="btn btn-sm" href={downloadUrl(a)} download={a.name} aria-label={`Download ${a.name}`}><Download size={13} /></a>
              {canDelete && <button type="button" aria-label={`Delete ${a.name}`} className="rounded-lg p-2 text-faint hover:text-danger" onClick={() => onDelete?.(a)}><Trash2 size={15} /></button>}
            </li>
          ))}
        </ul>
      )}
      <AnimatePresence>
        {view && (
          <motion.div key="lb" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[300] flex items-center justify-center bg-black/85 p-4" onClick={() => setView(null)} role="dialog" aria-label={view.name}>
            <button type="button" aria-label="Close" className="absolute right-4 top-4 rounded-full bg-white/15 p-2.5 text-white hover:bg-white/25" onClick={() => setView(null)}><X size={20} /></button>
            <div className="max-h-full max-w-5xl" onClick={(e) => e.stopPropagation()}>
              {view.kind === 'video'
                ? <video src={view.url} controls autoPlay className="max-h-[82vh] max-w-full rounded-xl bg-black" />
                // eslint-disable-next-line @next/next/no-img-element
                : <img src={view.url.replace('/upload/', '/upload/f_auto,q_auto/')} alt={view.name} className="max-h-[82vh] max-w-full rounded-xl object-contain" />}
              <div className="mt-3 flex items-center justify-between gap-3 text-sm text-white/80"><span className="truncate">{view.name} · {fmtBytes(view.bytes)}</span>
                <a className="inline-flex items-center gap-1.5 rounded-lg bg-white/15 px-3 py-1.5 hover:bg-white/25" href={downloadUrl(view)} download={view.name}><Download size={14} /> Download</a></div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export { ALLOWED_EXT };
