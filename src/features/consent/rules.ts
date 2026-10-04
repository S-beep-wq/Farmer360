/** The person must tick the box; anything else is not agreement. */
export function isNoticeAgreed(formData: FormData) {
  return formData.get("agree") === "yes";
}

/** A second acceptance of the same version (two taps, two tabs) is not an error. */
export function isAlreadyAccepted(error: { code?: string } | null) {
  return error?.code === "23505";
}
