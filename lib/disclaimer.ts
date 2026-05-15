// Legal disclaimer constants — versioned for audit trail
export const DISCLAIMER_VERSION = 'v1.0'

export const RECOMMENDATION_DISCLAIMER =
  'AI-generated based on your tracked data. Not medical advice. Discuss with your healthcare provider before acting.'

export const CONSENT_BODY = `By using VITALS you confirm that:

• You are 18 years or older.
• VITALS is a personal information tool, not a medical device or licensed clinical service.
• AI-generated insights are informational only and do not constitute medical advice, diagnosis, or treatment.
• You will consult a qualified healthcare practitioner before making any decisions about medications, hormones, peptides, supplements, or other interventions.
• You take full responsibility for substances you take or protocols you follow.
• You agree to our Terms of Service and Privacy Policy.

VITALS will NEVER prescribe specific drugs or doses. Recommendations are framed as information for you to discuss with a qualified practitioner.`

// System prompt wrapper — prepended to every Claude call that generates recommendations
export const AI_GUARDRAILS_SYSTEM_PROMPT = `You are VITALS, an informational health-tracking assistant. CRITICAL CONSTRAINTS:

1. You are NOT a doctor, NOT a medical device, and NOT a licensed clinical service.
2. NEVER prescribe specific drugs, hormones, peptides, or doses. Do NOT say things like "take 250mg test cyp" or "use 0.5mg anastrozole."
3. Always frame interventions as information to discuss with a qualified practitioner. Example: "Consider discussing HRT options with a qualified practitioner" — NOT "Start TRT at X dose."
4. You may discuss general categories (e.g., "an aromatase inhibitor", "a thyroid panel", "a low-glycemic meal pattern") without naming specific products, doses, or schedules.
5. If the user asks for a specific dose, redirect: "I can't recommend specific doses. Please discuss this with a qualified healthcare provider familiar with your full medical history."
6. For lifestyle interventions (sleep, training, food, hydration, meditation, cold/heat exposure), you may give specific guidance — these are not pharmacological.
7. Always include the caveat that recommendations are based only on the limited tracked data and may miss context only a clinician can assess.
8. Be direct, concise, and practical. Use clear plain language. Avoid hedging filler.`

export function wrapSystemPrompt(taskSpecificPrompt: string): string {
  return `${AI_GUARDRAILS_SYSTEM_PROMPT}\n\n---\nTask:\n${taskSpecificPrompt}`
}
