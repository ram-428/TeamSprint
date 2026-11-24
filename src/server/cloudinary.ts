import { createHash, randomUUID } from 'node:crypto';
import { z } from 'zod';
import { ALLOWED_EXT, MAX_PER_ISSUE, kindOfExt, extOf, type Attachment } from '@/lib/attachments';

/** Cloudinary uploads via the signed REST API (no SDK needed). Keys come from env, never from code. */
const cfg = () => ({ cloud: process.env.CLOUDINARY_CLOUD_NAME, key: process.env.CLOUDINARY_API_KEY, secret: process.env.CLOUDINARY_API_SECRET });
export const cloudinaryConfigured = () => { const c = cfg(); return !!(c.cloud && c.key && c.secret); };

/** Cloudinary signature: sha1 of the sorted "k=v" params (without file/api_key/resource_type) joined by & plus the secret. */
export function sign(params: Record<string, string | number | boolean>, secret: string) {
  const base = Object.keys(params).sort().map((k) => `${k}=${params[k]}`).join('&');
  return createHash('sha1').update(base + secret).digest('hex');
}

export type Uploaded = { url: string; publicId: string; bytes: number; width?: number; height?: number };

export async function uploadImage(file: Blob, opts: { folder: string; publicId: string }): Promise<Uploaded> {
  const { cloud, key, secret } = cfg();
  if (!cloud || !key || !secret) throw new Error('CLOUDINARY_NOT_CONFIGURED');
  const timestamp = Math.floor(Date.now() / 1000);
  const params = { folder: opts.folder, invalidate: 'true', overwrite: 'true', public_id: opts.publicId, timestamp };
  const form = new FormData();
  form.set('file', file);
  form.set('api_key', key);
  form.set('signature', sign(params, secret));
  for (const [k, v] of Object.entries(params)) form.set(k, String(v));
  const res = await fetch(`https://api.cloudinary.com/v1_1/${cloud}/image/upload`, { method: 'POST', body: form });
  const j: any = await res.json().catch(() => ({}));
  if (!res.ok || !j.secure_url) throw new Error(j?.error?.message || `Cloudinary upload failed (${res.status})`);
  return { url: j.secure_url, publicId: j.public_id, bytes: j.bytes, width: j.width, height: j.height };
}

export async function destroyImage(publicId: string) {
  const { cloud, key, secret } = cfg();
  if (!cloud || !key || !secret) return;
  const timestamp = Math.floor(Date.now() / 1000);
  const params = { invalidate: 'true', public_id: publicId, timestamp };
  const form = new FormData();
  form.set('api_key', key); form.set('signature', sign(params, secret));
  for (const [k, v] of Object.entries(params)) form.set(k, String(v));
  await fetch(`https://api.cloudinary.com/v1_1/${cloud}/image/destroy`, { method: 'POST', body: form }).catch(() => {});
}

// ───────── issue attachments (browser uploads straight to Cloudinary with a server-made signature) ─────────
export const issueFolder = (orgId: string) => `team-sprint/issues/${orgId}`;

/** Signature the browser needs to upload ONE file into this organization's folder. Cloudinary enforces folder + allowed formats. */
export function signIssueUpload(orgId: string) {
  const { cloud, key, secret } = cfg();
  if (!cloud || !key || !secret) throw new Error('CLOUDINARY_NOT_CONFIGURED');
  const params = { allowed_formats: ALLOWED_EXT.join(','), folder: issueFolder(orgId), timestamp: Math.floor(Date.now() / 1000) };
  return { endpoint: `https://api.cloudinary.com/v1_1/${cloud}/auto/upload`, apiKey: key, params, signature: sign(params, secret) };
}

const attachmentSchema = z.object({
  name: z.string().trim().min(1).max(200), url: z.string().url().max(600), publicId: z.string().min(3).max(400),
  resourceType: z.enum(['image', 'video', 'raw']), format: z.string().max(12).optional(),
  bytes: z.number().int().min(1).max(200 * 1024 ** 2), width: z.number().int().optional(), height: z.number().int().optional(),
});
export const attachmentListSchema = z.array(attachmentSchema).max(MAX_PER_ISSUE);

/**
 * Re-validates attachment metadata coming back from the browser: the file must live in OUR Cloudinary account,
 * inside THIS organization's folder, and be an allowed type. Anything else is rejected.
 */
export function cleanAttachments(input: unknown, orgId: string, userId: string): Attachment[] {
  const list = attachmentListSchema.parse(input ?? []);
  const { cloud } = cfg();
  const folder = issueFolder(orgId) + '/';
  return list.map((a) => {
    let u: URL;
    try { u = new URL(a.url); } catch { throw new Error('BAD_ATTACHMENT'); }
    const okHost = u.protocol === 'https:' && u.hostname === 'res.cloudinary.com' && u.pathname.startsWith(`/${cloud}/`);
    if (!okHost || !a.publicId.startsWith(folder) || !a.url.includes(a.publicId)) throw new Error('BAD_ATTACHMENT');
    const ext = (a.format || extOf(a.name) || extOf(a.publicId)).toLowerCase();
    const kind = kindOfExt(ext);
    if (!kind) throw new Error('BAD_ATTACHMENT');
    return {
      id: randomUUID(), name: a.name.replace(/[<>"\\]/g, ''), url: a.url, publicId: a.publicId, resourceType: a.resourceType, kind,
      format: ext, bytes: a.bytes, width: a.width, height: a.height, uploadedBy: userId, createdAt: new Date().toISOString(),
    };
  });
}

export async function destroyAsset(publicId: string, resourceType: string) {
  const { cloud, key, secret } = cfg();
  if (!cloud || !key || !secret) return;
  const timestamp = Math.floor(Date.now() / 1000);
  const params = { invalidate: 'true', public_id: publicId, timestamp };
  const form = new FormData();
  form.set('api_key', key); form.set('signature', sign(params, secret));
  for (const [k, v] of Object.entries(params)) form.set(k, String(v));
  const type = resourceType === 'raw' || resourceType === 'video' ? resourceType : 'image';
  await fetch(`https://api.cloudinary.com/v1_1/${cloud}/${type}/destroy`, { method: 'POST', body: form }).catch(() => {});
}

/** Square, face-aware, auto-format/quality thumbnail URL for an uploaded avatar. */
export const avatarThumb = (url: string, px = 256) => url.replace('/upload/', `/upload/c_fill,g_face,w_${px},h_${px},f_auto,q_auto/`);
