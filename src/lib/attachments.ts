/** Shared (browser + server) attachment rules. */
export type AttachmentKind = 'image' | 'video' | 'document';
export type Attachment = {
  id: string; name: string; url: string; publicId: string; resourceType: string; kind: AttachmentKind;
  format?: string; bytes: number; width?: number; height?: number; uploadedBy?: string; createdAt?: string;
};

export const IMAGE_EXT = ['jpg', 'jpeg', 'png', 'gif', 'webp'];
export const VIDEO_EXT = ['mp4', 'mov', 'webm', 'm4v'];
export const DOC_EXT = ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'txt', 'csv', 'zip'];
export const ALLOWED_EXT = [...IMAGE_EXT, ...VIDEO_EXT, ...DOC_EXT];

export const MAX_BYTES: Record<AttachmentKind, number> = { image: 10 * 1024 ** 2, video: 50 * 1024 ** 2, document: 10 * 1024 ** 2 };
export const MAX_PER_ISSUE = 20;
export const MAX_PER_COMMENT = 10;

export const extOf = (name: string) => (name.split('.').pop() || '').toLowerCase();
export function kindOfExt(ext: string): AttachmentKind | null {
  if (IMAGE_EXT.includes(ext)) return 'image';
  if (VIDEO_EXT.includes(ext)) return 'video';
  if (DOC_EXT.includes(ext)) return 'document';
  return null;
}

/** null when the file is acceptable, otherwise a user-facing reason. */
export function checkFile(name: string, size: number): string | null {
  const k = kindOfExt(extOf(name));
  if (!k) return `“${name}” isn’t a supported type. Use photos (JPG, PNG, GIF, WebP), videos (MP4, MOV, WebM) or documents (PDF, Word, Excel, PowerPoint, TXT, CSV, ZIP).`;
  if (size <= 0) return `“${name}” is empty.`;
  if (size > MAX_BYTES[k]) return `“${name}” is too large. ${k === 'video' ? 'Videos' : k === 'image' ? 'Photos' : 'Documents'} can be up to ${MAX_BYTES[k] / 1024 ** 2} MB.`;
  return null;
}
export const fmtBytes = (n: number) => (n >= 1024 ** 2 ? `${(n / 1024 ** 2).toFixed(1)} MB` : n >= 1024 ? `${Math.round(n / 1024)} KB` : `${n} B`);
