// Indian mobile numbers only for the MVP (initial geography: Bihar).

const INDIAN_MOBILE = /^[6-9]\d{9}$/;

/**
 * Normalises what a farmer types into E.164 (+91XXXXXXXXXX), or returns null.
 * Accepts spaces/dashes and an optional +91, 91 or 0 prefix.
 */
export function normalizeIndianMobile(input: string): string | null {
  let digits = input.replace(/[\s\-()]/g, "");
  if (digits.startsWith("+91")) {
    digits = digits.slice(3);
  } else if (digits.length === 12 && digits.startsWith("91")) {
    digits = digits.slice(2);
  } else if (digits.length === 11 && digits.startsWith("0")) {
    digits = digits.slice(1);
  }
  return INDIAN_MOBILE.test(digits) ? `+91${digits}` : null;
}

/** "+919876543210" → "+91 98765 43210" */
export function displayPhone(e164: string): string {
  const match = /^\+91(\d{5})(\d{5})$/.exec(e164);
  return match ? `+91 ${match[1]} ${match[2]}` : e164;
}

export function isOtpCode(input: string): boolean {
  return /^\d{6}$/.test(input);
}
