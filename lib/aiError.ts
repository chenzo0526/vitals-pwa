// Shared graceful-error helper for every AI surface.
// Turns a raw Anthropic/SDK error into a friendly, user-facing message so we never
// leak a blob like "Your credit balance is too low to access the Anthropic API".
// Pattern mirrors app/api/coach-today/route.ts.

export type AiErrorInfo = {
  message: string
  code: 'ai_credit' | 'ai_error'
  status: number
}

/**
 * @param err     the caught error
 * @param subject what the AI was doing, lowercase noun phrase, e.g. "read your bloodwork",
 *                "parse your check-in". Used in the generic fallback message.
 */
export function friendlyAiError(err: unknown, subject = 'do that'): AiErrorInfo {
  const msg = err instanceof Error ? err.message : String(err)
  const low = /credit balance|insufficient_quota|rate_limit|overloaded|quota/i.test(msg)
  if (low) {
    return {
      message: 'The AI service is out of credit or rate-limited — top up at console.anthropic.com to restore it. Your data is safe.',
      code: 'ai_credit',
      status: 503,
    }
  }
  return {
    message: `Couldn't ${subject} just now. Try again in a moment.`,
    code: 'ai_error',
    status: 503,
  }
}
