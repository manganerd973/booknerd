// AI is an optional server-only extension. No provider, key or automatic request is
// configured in BOOKNERD, so the deterministic knowledge service remains the safe
// default and the site never spends money merely because a page was opened.
export async function answerWithOptionalMascotAi({ enabled = false } = {}) {
  if (!enabled) return null;
  return null;
}
