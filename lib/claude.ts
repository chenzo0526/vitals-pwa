import Anthropic from '@anthropic-ai/sdk'
import { wrapSystemPrompt } from './disclaimer'

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY || '',
})

export const FOOD_ANALYSIS_PROMPT = `Identify all foods visible on this plate with estimated quantities. Return ONLY valid JSON:
{
  "items": [
    {"name": string, "qty_estimate": string, "calories": number, "protein_g": number, "carbs_g": number, "fat_g": number}
  ],
  "total_macros": {"calories": number, "protein_g": number, "carbs_g": number, "fat_g": number},
  "confidence": "high" | "medium" | "low",
  "notes": string
}`

export const LABEL_OCR_PROMPT = `Extract all nutrition facts from this food label. Return ONLY valid JSON:
{
  "product_name": string,
  "serving_size": string,
  "servings_per_container": number | null,
  "calories": number,
  "protein_g": number,
  "carbs_g": number,
  "fat_g": number,
  "fiber_g": number | null,
  "sugar_g": number | null,
  "sodium_mg": number | null,
  "confidence": "high" | "medium" | "low"
}`

export const PHYSIQUE_ANALYSIS_PROMPT = `Analyze this body progress photo objectively and scientifically. Return ONLY valid JSON:
{
  "estimated_bf_percent": number,
  "muscle_development": {
    "chest": number, "back": number, "shoulders": number, "arms": number,
    "quads": number, "hams": number, "glutes": number, "calves": number, "abs": number
  },
  "symmetry_issues": string[],
  "posture_flags": string[],
  "top_3_weak_points": string[],
  "suggested_focus_next_30_days": string,
  "overall_condition": "cutting" | "maintaining" | "bulking" | "recomping",
  "notes": string
}`

export const PHYSIQUE_MULTI_ANGLE_PROMPT = `You are analyzing 1-4 body progress photos of the same person from different angles: FRONT (anterior), LEFT (left side profile, subject facing right), RIGHT (right side profile, subject facing left), BACK (posterior). When multiple angles are provided, TRIANGULATE across them for a single calibrated reading — not multiple separate estimates.

Angle responsibilities:
- FRONT: abdominal definition, chest/shoulder/arm development, anterior symmetry, frontal posture
- LEFT and RIGHT: lateral posture, lumbar curve, anterior vs. visceral fat distribution, shoulder protraction, mirror-check left-vs-right asymmetry
- BACK: lats, traps, rhomboids, glute development, hamstring detail, posterior chain symmetry

Score each muscle group 1-10 using the best angle that shows it. Estimate body fat % once, weighted across all available angles. Multi-angle estimates are materially more accurate than single-angle. If only one photo is provided, set bf_confidence to "low" and note the limitation in the notes field. With 4 angles + good lighting, you can usually achieve "high" confidence.

When LEFT and RIGHT are both present, explicitly check for left-vs-right asymmetry and surface it in symmetry_issues.

Return ONLY valid JSON:
{
  "estimated_bf_percent": number,
  "bf_confidence": "high" | "medium" | "low",
  "angles_analyzed": ("front" | "left" | "right" | "back")[],
  "muscle_development": {
    "chest": number, "back": number, "shoulders": number, "arms": number,
    "quads": number, "hams": number, "glutes": number, "calves": number, "abs": number
  },
  "symmetry_issues": string[],
  "posture_flags": string[],
  "top_3_weak_points": string[],
  "suggested_focus_next_30_days": string,
  "overall_condition": "cutting" | "maintaining" | "bulking" | "recomping",
  "notes": string
}`

export const BLOODWORK_PARSE_PROMPT = `Extract every marker from this bloodwork report. Return ONLY valid JSON:
{
  "panel_name": string,
  "lab_provider": string | null,
  "drawn_on": string | null,
  "markers": [
    {
      "marker": string,
      "category": "hormones" | "metabolic" | "lipids" | "cbc" | "thyroid" | "vitamins" | "liver" | "kidney" | "inflammation" | "other",
      "value": number,
      "unit": string,
      "ref_low": number | null,
      "ref_high": number | null,
      "flag": "low" | "normal" | "high" | "critical",
      "raw_text": string
    }
  ],
  "confidence": "high" | "medium" | "low"
}
Extract every marker visible. If reference range missing, set ref_low and ref_high to null. Determine flag from value vs ref range.`

// Updated voice/text food parsing prompt — handles natural speech "8 little potatoes" correctly.
export const VOICE_FOOD_PARSE_SYSTEM = `You are parsing natural spoken food descriptions for a food tracking app.

CRITICAL: Numbers followed by SIZE words (little/small/medium/large/big/huge) or COUNT nouns (whole, each, slice, cup, handful, piece, stick, bar, can, bottle) describe COUNT, not weight.

Examples:
- "I ate 8 little potatoes" → 8 small potatoes, ~110 cal each, total ~880 cal
- "two slices of pizza" → 2 slices, ~285 cal each
- "a handful of almonds" → ~25g almonds, ~145 cal
- "8 grams of nuts" → 8g exactly (because "grams" was said explicitly)
- "three eggs" → 3 eggs, ~70 cal each
- "a cup of rice" → 1 cup cooked rice, ~205 cal

Default units when not explicitly stated:
- Solid food without a unit word: COUNT (each)
- Liquids without a unit word: VOLUME (oz or ml)
- ONLY use grams when the user explicitly says "grams" or "g"

Return JSON shape:
{
  "items": [
    {"name": string, "quantity": number, "unit": string, "qty_estimate": string, "estimated_calories": number, "protein_g": number, "carbs_g": number, "fat_g": number}
  ],
  "total_macros": {"calories": number, "protein_g": number, "carbs_g": number, "fat_g": number},
  "confidence": "high" | "medium" | "low"
}

"qty_estimate" is the human-readable label, e.g. "8 small potatoes" or "1 cup".

Be generous with macro estimates when ambiguous — better to log SOMETHING than block on perfect numbers. Return ONLY the JSON object, no preamble or markdown.`

export async function analyzeImageWithClaude(
  base64Image: string,
  mediaType: 'image/jpeg' | 'image/png' | 'image/webp',
  prompt: string,
  model: string = 'claude-sonnet-4-5'
): Promise<string> {
  const response = await anthropic.messages.create({
    model,
    max_tokens: 2048,
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'image',
            source: {
              type: 'base64',
              media_type: mediaType,
              data: base64Image,
            },
          },
          {
            type: 'text',
            text: prompt,
          },
        ],
      },
    ],
  })

  const content = response.content[0]
  if (content.type === 'text') return content.text
  return ''
}

export type AngleLabel = 'front' | 'left' | 'right' | 'back'
export type LabeledImage = {
  angle: AngleLabel
  base64: string
  mediaType: 'image/jpeg' | 'image/png' | 'image/webp'
}

// PDFs go through Claude as a `document` block (multi-page native parsing).
// Image-only path won't work for multi-page lab reports.
export async function analyzePdfWithClaude(
  base64Pdf: string,
  prompt: string,
  model: string = 'claude-sonnet-4-5',
  maxTokens: number = 4096
): Promise<string> {
  type DocumentBlock = {
    type: 'document'
    source: { type: 'base64'; media_type: 'application/pdf'; data: string }
  }
  type TextBlock = { type: 'text'; text: string }
  const content: Array<DocumentBlock | TextBlock> = [
    {
      type: 'document',
      source: { type: 'base64', media_type: 'application/pdf', data: base64Pdf },
    },
    { type: 'text', text: prompt },
  ]

  const response = await anthropic.messages.create({
    model,
    max_tokens: maxTokens,
    messages: [{ role: 'user', content }],
  })

  const out = response.content[0]
  if (out.type === 'text') return out.text
  return ''
}

export async function analyzeMultipleImagesWithClaude(
  images: LabeledImage[],
  prompt: string,
  model: string = 'claude-sonnet-4-5'
): Promise<string> {
  if (images.length === 0) throw new Error('No images provided')

  type TextBlock = { type: 'text'; text: string }
  type ImageBlock = {
    type: 'image'
    source: { type: 'base64'; media_type: 'image/jpeg' | 'image/png' | 'image/webp'; data: string }
  }
  type ContentBlock = TextBlock | ImageBlock

  const content: ContentBlock[] = []
  for (const img of images) {
    content.push({ type: 'text', text: `Angle: ${img.angle.toUpperCase()}` } as TextBlock)
    content.push({
      type: 'image',
      source: { type: 'base64', media_type: img.mediaType, data: img.base64 },
    } as ImageBlock)
  }
  content.push({ type: 'text', text: prompt } as TextBlock)

  const response = await anthropic.messages.create({
    model,
    max_tokens: 2048,
    messages: [{ role: 'user', content }],
  })

  const out = response.content[0]
  if (out.type === 'text') return out.text
  return ''
}

export async function parseTextWithClaude(text: string): Promise<string> {
  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-5',
    max_tokens: 1024,
    temperature: 0.2,
    system: VOICE_FOOD_PARSE_SYSTEM,
    messages: [
      {
        role: 'user',
        content: `Parse this spoken food description into the JSON shape above:\n\n"${text}"`,
      },
    ],
  })
  const content = response.content[0]
  if (content.type === 'text') return content.text
  return ''
}

export async function parseWorkoutWithClaude(text: string): Promise<string> {
  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-5',
    max_tokens: 512,
    messages: [
      {
        role: 'user',
        content: `Parse this workout description and extract exercise sets. Return ONLY valid JSON:
{
  "sets": [
    {"exercise": string, "set_num": number, "reps": number | null, "weight_lb": number | null, "rpe": number | null, "notes": string | null}
  ],
  "focus": string,
  "estimated_duration_min": number | null
}

Input: "${text}"`,
      },
    ],
  })
  const content = response.content[0]
  if (content.type === 'text') return content.text
  return ''
}

// AI Coach daily insights — generates 1-3 specific, actionable cards based on the
// user's full cross-stream context (stack, bloodwork, food, training, body comp).
// This is the WOW feature. Information framing — never prescriptive.
export const COACH_INSIGHTS_SYSTEM_PROMPT = `You are Vitals — an AI operator embedded inside a biohacker's health-tracking app. The user has shared their complete profile: hormonal stack, bloodwork, training schedule, food logs, body composition photos.

Your job: produce 1-3 SPECIFIC, ACTIONABLE insight cards for them today. Each card should connect at least TWO data streams (e.g., bloodwork + stack, scheduled workout + nutrition, body comp + training, etc.). This cross-data intelligence is what makes Vitals different from MyFitnessPal/WHOOP/InsideTracker — none of them have all the streams in one place.

CRITICAL FRAMING (legal):
- Information, never advice. "Research suggests…", "Common protocols are…", "Consider discussing with a knowledgeable practitioner."
- Never diagnose. Never prescribe. Never tell them to take/stop a substance.
- For any specific dose suggestion, frame as "research literature commonly cites X mg" and pair with "verify with a credentialed practitioner."
- Do not invent specifics you don't have data for. If a stream is missing, say so.

QUALITY BAR:
- Each insight must be FORENSIC — connect specific data points to a specific actionable insight. Not "drink more water." Yes "Your alk phos was 39 (low end). You log heavy training and no zinc in your stack. Research commonly cites 25mg zinc/day at bedtime as a cofactor for alkaline phosphatase production."
- Reference exact numbers from their data. Use specific marker values, dose amounts, dates.
- Tone: a sharp, well-read training partner who happens to know endocrinology. NOT a Webmd cheerleader. NOT corporate. Direct, slightly informal, evidence-aware.
- Avoid generic wellness platitudes. Be SPECIFIC to THIS user TODAY.

Return ONLY valid JSON in this shape:
{
  "insights": [
    {
      "type": "nutrition" | "training" | "protocol" | "recovery" | "bloodwork" | "body_comp" | "general",
      "title": string,
      "body": string,
      "urgency": "low" | "medium" | "high",
      "data_sources": string[]
    }
  ],
  "context_summary": string
}

"title" is 5-9 words, action-oriented. "body" is 2-4 sentences with specific numbers + reasoning. "urgency" is "high" only for time-sensitive items (workout today, deficiency flagged, protocol decision pending). "data_sources" lists which streams informed the insight (e.g., ["bloodwork", "stack"]). "context_summary" is one sentence describing what you used and what was missing.

If a user has very little data (no bloodwork, empty stack, no workouts), still produce at least ONE insight using whatever they have — even if it's just "Log your stack so I can give you better intelligence tomorrow." Don't refuse to produce output.`

export async function generateCoachInsights(
  userContextJson: string,
  model: string = 'claude-sonnet-4-5'
): Promise<string> {
  const response = await anthropic.messages.create({
    model,
    max_tokens: 1500,
    temperature: 0.4,
    system: COACH_INSIGHTS_SYSTEM_PROMPT,
    messages: [
      {
        role: 'user',
        content: `Today is ${new Date().toISOString().split('T')[0]}. Here is the user's full context as JSON. Generate today's insights.\n\n${userContextJson}`,
      },
    ],
  })
  const content = response.content[0]
  if (content.type === 'text') return content.text
  return ''
}

// Bloodwork Interpreter v2 — the Vitals premium killer feature.
// Reads a bloodwork panel in the context of the user's stack, training, body comp, prior panels,
// goals, and lifestyle. Produces a forensic structured interpretation — not the generic
// "in range / not in range" read that InsideTracker / labs themselves produce.
// Information framing locked: "Research suggests…" / "Common protocols cite…" — never prescriptive.
export const BLOODWORK_INTERPRETER_SYSTEM_PROMPT = `You are Vitals' Bloodwork Interpreter — a forensic analyst trained on endocrinology, sports medicine, and longitudinal lab interpretation. You read each panel IN THE CONTEXT of the user's full profile: stack (substances/doses/start dates), training load, body comp, prior panels for trend analysis, age, sex, goals.

This is what makes Vitals different from InsideTracker, LabCorp's own report, or what most doctors will say. They read labs in a vacuum. You read them KNOWING what the user is doing.

CRITICAL LEGAL FRAMING:
- Information, NEVER advice. "Research suggests…", "Common protocols cite…", "Consider discussing with a knowledgeable practitioner."
- Never diagnose. Never prescribe specific drugs or doses to start/stop. You may note that "common community protocols cite X mg" but always pair with "verify with a credentialed practitioner."
- For markers that look bad, acknowledge severity without alarmism. Cite the value, the range, what it could mean, and what to track / re-test.
- Reference ranges given by the lab are starting points — note when "in range" still means "suboptimal for the user's age/goals" (e.g., total T of 400 ng/dL is "in range" but suboptimal for a 31yo male targeting hormonal optimization).

CRITICAL — CONTEXT > NUMBERS:
- The numbers on a panel are a SNAPSHOT, not a diagnosis. Two people with identical labs can have wildly different stories.
- BEFORE drawing conclusions about WHY a marker moved, you MUST consider life context: cycle endings (especially cold-turkey vs tapered), caregiver stress, deaths in family, moves, breakups, sleep collapse, depression episodes, supplement gaps, training cessation, financial stress.
- If the user has provided panel_context_notes — USE THEM HEAVILY. They explain why the data looks the way it does.
- If context is MISSING (no panel_context_notes), do NOT make confident identity claims like "you have hypogonadism." Instead say "given the data alone X, but the trajectory depends entirely on what was happening in your life around this draw — what context can you add?"
- Always include an "unknowns" array in your output for context you'd want the user to fill in.
- Never make the user feel like a hormonal mess or a clinical case. Frame as a person engineering their own optimization.

QUALITY BAR:
- This is the FEATURE that pays for $199/mo Premium. Every interpretation must feel like a paid second opinion from a sharp endocrinology-literate operator.
- Cite specific values + units + reference ranges. Don't summarize without numbers.
- When prior panels exist, ALWAYS compute trends (percent change, direction) and call out movement >15%.
- Cross-reference markers with the user's active stack. Examples: T levels in context of TRT dose/duration. HCT trend in TRT context. Lipid changes if on TRT. LH/FSH suppression if on exogenous T. Prolactin in context of psych meds. Alk Phos low + heavy training = zinc suspicion.
- Connect dots no lab report does. If T crashed and the user just got off SSRI 1 week ago, name that connection explicitly.
- Identify what's MISSING that the user should order next time given their stack/goals (e.g., "your TRT protocol warrants tracking SHBG, Free T3, Reverse T3, ApoB — none of these were in this panel").
- "lifestyle_dials" must be specific and cheap. "Zinc 25mg at bedtime — research commonly cites this for low alkaline phosphatase paired with heavy training load" beats "consider eating more nuts."
- Tone: a sharp, well-read training partner who happens to know endocrinology. Not WebMD. Not corporate. Direct, slightly informal, evidence-aware, no hedging fluff.

Return ONLY valid JSON in this shape:
{
  "headline": "1 sentence — the single most important thing about this panel",
  "overall_read": "1-2 short paragraphs summarizing the panel in context of stack + goals",
  "hot_spots": [
    {
      "marker": "string",
      "value": number | string,
      "unit": "string",
      "ref_range": "string",
      "flag": "low" | "normal" | "high" | "critical",
      "what_it_means": "2-3 sentences explaining the value in the user's specific context",
      "context_with_stack": "string or null — only if there's an explicit interaction with their active stack",
      "trend_note": "string or null — only if prior panel exists and there's meaningful movement"
    }
  ],
  "trends": [
    {
      "marker": "string",
      "from_value": number | string,
      "to_value": number | string,
      "percent_change": number,
      "direction": "up" | "down",
      "likely_drivers": ["string"],
      "what_to_watch": "string"
    }
  ],
  "stack_interactions": [
    {
      "substance": "string",
      "marker": "string",
      "interaction": "string explaining how the substance affects this marker",
      "what_to_track": "specific marker(s) and cadence"
    }
  ],
  "suggested_next_labs": [
    "specific marker or panel name — be concrete (e.g., 'SHBG', 'Free T3 + Reverse T3', 'ApoB', 'HCT every 8 weeks')"
  ],
  "lifestyle_dials": [
    {
      "intervention": "string",
      "rationale": "string with specific evidence reference if known",
      "evidence_strength": "low" | "moderate" | "strong"
    }
  ],
  "unknowns": [
    "Specific questions / context gaps you would want the user to fill in to make this read more accurate. E.g., 'Were you on or coming off any exogenous hormones in the 6 months before this draw?' or 'What was your sleep / training pattern in the weeks leading up to this?'"
  ],
  "context_summary": "1 sentence describing what context data was used AND what was missing"
}

Produce 3-7 hot_spots (only the most relevant — don't list normal markers). 0-N trends (only if prior panels). 0-N stack_interactions (only if there are actual interactions). 3-6 suggested_next_labs. 2-4 lifestyle_dials.

If there's no prior panel for trends, return an empty trends array. If the user has no active stack, return an empty stack_interactions array. Always produce a meaningful headline + overall_read + hot_spots regardless.`

export async function generateBloodworkInterpretation(
  panelAndUserContextJson: string,
  model: string = 'claude-sonnet-4-5'
): Promise<string> {
  const response = await anthropic.messages.create({
    model,
    max_tokens: 4000,
    temperature: 0.3,
    system: BLOODWORK_INTERPRETER_SYSTEM_PROMPT,
    messages: [
      {
        role: 'user',
        content: `Generate a forensic interpretation of this bloodwork panel in the context of the user's full profile.\n\n${panelAndUserContextJson}`,
      },
    ],
  })
  const content = response.content[0]
  if (content.type === 'text') return content.text
  return ''
}

// Recommendation-generating helper: wraps the system prompt with legal guardrails.
export async function generateRecommendationWithClaude(
  taskPrompt: string,
  userDataContext: string,
  model: string = 'claude-sonnet-4-5',
  maxTokens: number = 2048
): Promise<string> {
  const response = await anthropic.messages.create({
    model,
    max_tokens: maxTokens,
    system: wrapSystemPrompt(taskPrompt),
    messages: [
      {
        role: 'user',
        content: userDataContext,
      },
    ],
  })
  const content = response.content[0]
  if (content.type === 'text') return content.text
  return ''
}

export default anthropic
