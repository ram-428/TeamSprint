import nodemailer, { type Transporter } from 'nodemailer';

export const smtpConfigured = () => !!(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);

let tx: Transporter | null = null;
const transport = () => (tx ||= nodemailer.createTransport({
  host: process.env.SMTP_HOST, port: Number(process.env.SMTP_PORT || 587), secure: Number(process.env.SMTP_PORT) === 465,
  auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
}));

export async function sendMail(to: string, subject: string, html: string, text: string) {
  const from = process.env.MAIL_FROM || `Team Sprint <${process.env.SMTP_USER}>`;
  await transport().sendMail({ from, to, subject, html, text });
}

export const sendResetCode = (to: string, name: string, code: string) =>
  sendMail(to, `${code} is your Team Sprint password reset code`,
    `<div style="font-family:Arial,sans-serif;max-width:420px"><h2>Hi ${name.replace(/[<>&"]/g, '')},</h2><p>Use this code to reset your Team Sprint password:</p><p style="font-size:32px;letter-spacing:6px;font-weight:700">${code}</p><p>It expires in 10 minutes. If you didn't ask for this, you can ignore this email — your password won't change.</p></div>`,
    `Your Team Sprint password reset code is ${code}. It expires in 10 minutes. If you didn't request it, ignore this email.`);

const esc = (s: string) => s.replace(/[<>&"]/g, '');
/** Emails a new member their one-time temporary password. Never throws; returns whether it was sent. */
export async function sendInviteMail(to: string, name: string, tmp: string, invitedBy: string, orgName?: string): Promise<boolean> {
  if (!smtpConfigured()) return false;
  const url = (process.env.APP_URL || 'http://localhost:7000') + '/login';
  try {
    await sendMail(to, `You're invited to Team Sprint${orgName ? ` · ${esc(orgName)}` : ''}`,
      `<div style="font-family:Arial,sans-serif;max-width:460px"><h2>Hi ${esc(name)},</h2><p>${esc(invitedBy)} invited you to Team Sprint${orgName ? ` (${esc(orgName)})` : ''}.</p><p>Your one-time temporary password:</p><p style="font-size:22px;font-family:monospace;font-weight:700;background:#f1f2f4;padding:12px 16px;border-radius:8px;display:inline-block">${esc(tmp)}</p><p>Sign in with <b>${esc(to)}</b> at <a href="${url}">${url}</a>. Please change your password after your first sign-in.</p></div>`,
      `Hi ${name}, ${invitedBy} invited you to Team Sprint. Your one-time temporary password: ${tmp}\nSign in with ${to} at ${url} and change it after your first sign-in.`);
    return true;
  } catch (e) { console.error('[mail] invite failed', e); return false; }
}
