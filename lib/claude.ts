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
