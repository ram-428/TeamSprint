import { smtpConfigured } from './mail';

/** Email one-time code at login: on when LOGIN_OTP=true and SMTP is configured. */
export function otpRequired(_email?: string) {
  if (process.env.LOGIN_OTP !== 'true' || !smtpConfigured()) return false;
  return true;
}

export const maskEmail = (e: string) => e.replace(/^(.).*(@.*)$/, '$1•••$2');
