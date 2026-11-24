import nodemailer, { type Transporter } from 'nodemailer';

export const smtpConfigured = () => !!(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);

let tx: Transporter | null = null;
const transport = () => (tx ||= nodemailer.createTransport({
  host: process.env.SMTP_HOST, port: Number(process.env.SMTP_PORT || 587), secure: Number(process.env.SMTP_PORT) === 465,
  auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
}));

/**
 * Public base URL to put in emails: the domain the request came in on (honours reverse-proxy headers).
 * Set APP_URL to pin it (recommended in production, so a forged Host header can't change email links).
 */
export function siteUrl(req?: Request): string {
  if (process.env.APP_URL) return process.env.APP_URL.replace(/\/+$/, '');
  const h = req?.headers;
  const host = (h?.get('x-forwarded-host') || h?.get('host') || '').split(',')[0].trim();
  if (host && /^[a-z0-9.-]+(:\d+)?$/i.test(host)) {
    const proto = h?.get('x-forwarded-proto')?.split(',')[0].trim() || (/^(localhost|127\.|0\.0\.0\.0)/i.test(host) ? 'http' : 'https');
    return `${proto === 'http' || proto === 'https' ? proto : 'https'}://${host}`;
  }
  return 'http://localhost:7000';
}

export async function sendMail(to: string, subject: string, html: string, text: string) {
  const from = process.env.MAIL_FROM || `Team Sprint <${process.env.SMTP_USER}>`;
  await transport().sendMail({ from, to, subject, html, text });
}

export const sendResetCode = (to: string, name: string, code: string, baseUrl: string) =>
  sendMail(to, `${code} is your Team Sprint password reset code`,
    `<div style="font-family:Arial,sans-serif;max-width:420px"><h2>Hi ${name.replace(/[<>&"]/g, '')},</h2><p>Use this code to reset your Team Sprint password:</p><p style="font-size:32px;letter-spacing:6px;font-weight:700">${code}</p><p><a href="${baseUrl}/forgot-password" style="display:inline-block;background:#7c5cff;color:#fff;text-decoration:none;padding:10px 18px;border-radius:8px;font-weight:600">Open Team Sprint</a></p><p style="color:#666;font-size:13px">Or go to ${baseUrl}/forgot-password and enter the code.<br>It expires in 10 minutes. If you didn't ask for this, you can ignore this email — your password won't change.</p></div>`,
    `Your Team Sprint password reset code is ${code}. Enter it at ${baseUrl}/forgot-password. It expires in 10 minutes. If you didn't request it, ignore this email.`);

const esc = (s: string) => s.replace(/[<>&"]/g, '');
/** Emails a new member their one-time temporary password. Never throws; returns whether it was sent. */
export async function sendInviteMail(to: string, name: string, tmp: string, invitedBy: string, orgName: string | undefined, baseUrl: string): Promise<boolean> {
  if (!smtpConfigured()) return false;
  const url = `${baseUrl}/login`;
  try {
    await sendMail(to, `You're invited to Team Sprint${orgName ? ` · ${esc(orgName)}` : ''}`,
      `<div style="font-family:Arial,sans-serif;max-width:460px"><h2>Hi ${esc(name)},</h2><p>${esc(invitedBy)} invited you to Team Sprint${orgName ? ` (${esc(orgName)})` : ''}.</p><p>Your one-time temporary password:</p><p style="font-size:22px;font-family:monospace;font-weight:700;background:#f1f2f4;padding:12px 16px;border-radius:8px;display:inline-block">${esc(tmp)}</p><p>Sign in with <b>${esc(to)}</b> at <a href="${url}">${url}</a>. Please change your password after your first sign-in.</p></div>`,
      `Hi ${name}, ${invitedBy} invited you to Team Sprint. Your one-time temporary password: ${tmp}\nSign in with ${to} at ${url} and change it after your first sign-in.`);
    return true;
  } catch (e) { console.error('[mail] invite failed', e); return false; }
}
