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
