/**
 * utils/disposable-email.ts
 * -------------------------
 * Client-side email validation utilities.
 *
 * Functions:
 *   normalizeEmail(email)  — trim + lowercase
 *   maskEmail(email)       — "user@gmail.com" → "us***@gmail.com"
 *   isDisposableEmail(email) — check against known disposable domains
 *   validateEmail(email)   — full chain: normalize → format → disposable
 *
 * No external API calls. No DNS/MX checks. Intentionally lightweight.
 */

// ── Disposable email domain list ──────────────────────────────────────────────
// Extend this list as needed. Domains are matched case-insensitively after
// normalization (the input email is lowercased before domain extraction).

const DISPOSABLE_DOMAINS = new Set([
  // Classic temp-mail services
  "mailinator.com",
  "guerrillamail.com",
  "guerrillamail.net",
  "guerrillamail.org",
  "guerrillamail.de",
  "guerrillamail.biz",
  "guerrillamail.info",
  "10minutemail.com",
  "10minutemail.net",
  "10minutemail.org",
  "10minutemail.de",
  "temp-mail.org",
  "trashmail.com",
  "trashmail.me",
  "trashmail.net",
  "trashmail.at",
  "trashmail.io",
  "maildrop.cc",
  "sharklasers.com",
  "guerrillamailblock.com",
  "spam4.me",
  "yopmail.com",
  "yopmail.fr",
  "dispostable.com",
  "mailnull.com",
  "spamgourmet.com",
  "spamgourmet.net",
  "spamgourmet.org",
  "throwam.com",
  "throwaway.email",
  "getairmail.com",
  "fakeinbox.com",
  "mailnesia.com",
  "mailnull.com",
  "mailexpire.com",
  "spamherelots.com",
  "tempinbox.com",
  "tempinbox.co.uk",
  "tempr.email",
  "discard.email",
  "discardmail.com",
  "discardmail.de",
  "spamfree24.org",
  "spam.la",
  "binkmail.com",
  "bobmail.info",
  "chammy.info",
  "devnullmail.com",
  "dingbone.com",
  "dispostable.com",
  "emailondeck.com",
  "filzmail.com",
  "frapmail.com",
  "gishpuppy.com",
  "harakirimail.com",
  "jetable.fr.nf",
  "kontol.com",
  "lookugly.com",
  "lroid.com",
  "maileater.com",
  "mailme.lv",
  "mailmetrash.com",
  "mailmoat.com",
  "mailscrap.com",
  "mailsiphon.com",
  "mailzilla.com",
  "mbx.cc",
  "mega.zik.dj",
  "meltmail.com",
  "mintemail.com",
  "mt2009.com",
  "nwldx.com",
  "objectmail.com",
  "obobbo.com",
  "oneoffmail.com",
  "pookmail.com",
  "recursor.net",
  "rtrtr.com",
  "s0ny.net",
  "smellfear.com",
  "spamgob.com",
  "spamhereplease.com",
  "spamoff.de",
  "tittbit.in",
  "tradermail.info",
  "trash-me.com",
  "trbvm.com",
  "turual.com",
  "uggsrock.com",
  "webemail.me",
  "wh4f.org",
  "whyspam.me",
  "willselfdestruct.com",
  "xoxy.net",
  "yogamaven.com",
  "zetmail.com",
  "zoemail.net",
  "zomg.info",
]);

// ── Email format regex ────────────────────────────────────────────────────────
// Conservative pattern: local@domain.tld — does not allow:
//   - leading/trailing dots in local part
//   - consecutive dots
//   - missing TLD
const EMAIL_REGEX = /^[a-zA-Z0-9]([a-zA-Z0-9._%+\-]*[a-zA-Z0-9])?@[a-zA-Z0-9]([a-zA-Z0-9\-]*[a-zA-Z0-9])?(\.[a-zA-Z]{2,})+$/;

// ── normalizeEmail ────────────────────────────────────────────────────────────

/**
 * Trim whitespace and lowercase the email.
 * Called before every signUp / signIn call to prevent duplicate accounts
 * from casing differences like USER@gmail.com vs user@gmail.com.
 */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

// ── maskEmail ─────────────────────────────────────────────────────────────────

/**
 * Partially obscure an email address for display.
 *
 * Examples:
 *   "user@gmail.com"        → "us***@gmail.com"
 *   "a@gmail.com"           → "a***@gmail.com"
 *   "chaitanya@example.com" → "ch***@example.com"
 */
export function maskEmail(email: string): string {
  const normalized = normalizeEmail(email);
  const atIndex = normalized.indexOf("@");
  if (atIndex < 0) return normalized;

  const local = normalized.slice(0, atIndex);
  const domain = normalized.slice(atIndex); // includes @

  // Show first 2 chars (or 1 if local is very short), mask the rest
  const visibleChars = Math.min(2, local.length);
  const masked = local.slice(0, visibleChars) + "***";
  return masked + domain;
}

// ── isDisposableEmail ─────────────────────────────────────────────────────────

/**
 * Returns true if the email domain is on the known disposable list.
 * Input is normalized before checking.
 */
export function isDisposableEmail(email: string): boolean {
  const normalized = normalizeEmail(email);
  const atIndex = normalized.lastIndexOf("@");
  if (atIndex < 0) return false;
  const domain = normalized.slice(atIndex + 1);
  return DISPOSABLE_DOMAINS.has(domain);
}

// ── getEmailProvider ──────────────────────────────────────────────────────────

export type EmailProvider = {
  name: string;
  url: string;
};

/**
 * Returns the webmail URL for common email providers so the verify-email
 * page can offer an "Open Gmail / Open Outlook" shortcut.
 *
 * Returns null for unknown providers — fallback to generic "Open Inbox".
 */
export function getEmailProvider(email: string): EmailProvider | null {
  const normalized = normalizeEmail(email);
  const atIndex = normalized.lastIndexOf("@");
  if (atIndex < 0) return null;
  const domain = normalized.slice(atIndex + 1);

  const providers: Record<string, EmailProvider> = {
    "gmail.com":      { name: "Gmail",   url: "https://mail.google.com" },
    "googlemail.com": { name: "Gmail",   url: "https://mail.google.com" },
    "outlook.com":    { name: "Outlook", url: "https://outlook.live.com" },
    "hotmail.com":    { name: "Outlook", url: "https://outlook.live.com" },
    "live.com":       { name: "Outlook", url: "https://outlook.live.com" },
    "msn.com":        { name: "Outlook", url: "https://outlook.live.com" },
    "yahoo.com":      { name: "Yahoo",   url: "https://mail.yahoo.com" },
    "yahoo.co.uk":    { name: "Yahoo",   url: "https://mail.yahoo.com" },
    "yahoo.in":       { name: "Yahoo",   url: "https://mail.yahoo.com" },
    "icloud.com":     { name: "iCloud",  url: "https://www.icloud.com/mail" },
    "me.com":         { name: "iCloud",  url: "https://www.icloud.com/mail" },
    "mac.com":        { name: "iCloud",  url: "https://www.icloud.com/mail" },
    "protonmail.com": { name: "ProtonMail", url: "https://mail.proton.me" },
    "proton.me":      { name: "ProtonMail", url: "https://mail.proton.me" },
  };

  return providers[domain] ?? null;
}

// ── validateEmail ─────────────────────────────────────────────────────────────

export type ValidationResult =
  | { valid: true;  email: string }
  | { valid: false; error: string };

/**
 * Full email validation chain:
 * 1. Normalize (trim + lowercase)
 * 2. Format regex
 * 3. Disposable domain check
 *
 * Returns the normalized email on success so callers don't have to
 * normalize separately.
 *
 * Usage:
 *   const result = validateEmail(rawInput);
 *   if (!result.valid) { showError(result.error); return; }
 *   await signUp(result.email, password);
 */
export function validateEmail(rawEmail: string): ValidationResult {
  const email = normalizeEmail(rawEmail);

  if (!email) {
    return { valid: false, error: "Please enter your email address." };
  }

  if (!EMAIL_REGEX.test(email)) {
    return { valid: false, error: "Please enter a valid email address." };
  }

  if (isDisposableEmail(email)) {
    console.log("[Auth] blocked_disposable:", email.split("@")[1]);
    return { valid: false, error: "Please use a permanent email address." };
  }

  return { valid: true, email };
}
