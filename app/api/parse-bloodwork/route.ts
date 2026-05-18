import { NextRequest, NextResponse } from 'next/server'
import {
  analyzeImageWithClaude,
  analyzePdfWithClaude,
  BLOODWORK_PARSE_PROMPT,
} from '@/lib/claude'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// Multi-page lab reports with 50-80 markers can exceed 4096 output tokens.
// A 7-page LabCorp panel with ~70 markers produces ~9KB of JSON. Bump to 8000.
const MAX_TOKENS_FOR_BLOODWORK = 8000

// If Claude's JSON output gets truncated mid-array (e.g., hit token limit),
// salvage what we can by closing the dangling structure.
function tolerantJsonExtract(raw: string): unknown {
  // First try the easy path — a clean JSON object somewhere in the response.
  const cleanMatch = raw.match(/\{[\s\S]*\}/)
  if (cleanMatch) {
    try { return JSON.parse(cleanMatch[0]) } catch { /* fall through to repair */ }
  }

  // Repair path: find the first { and start fixing.
  const start = raw.indexOf('{')
  if (start === -1) throw new Error('No JSON object in response')
  let candidate = raw.slice(start)

  // Strip any trailing non-JSON garbage.
  const lastBrace = candidate.lastIndexOf('}')
  if (lastBrace > 0) candidate = candidate.slice(0, lastBrace + 1)

  // First repair attempt: close trailing dangling commas/items in arrays.
  // Walk the string and track open brackets; close them at the end.
  const stack: Array<'{' | '['> = []
  let inString = false
  let escape = false
  let lastValidEnd = candidate.length
  for (let i = 0; i < candidate.length; i++) {
    const c = candidate[i]
    if (escape) { escape = false; continue }
    if (c === '\\') { escape = true; continue }
    if (c === '"') { inString = !inString; continue }
    if (inString) continue
    if (c === '{' || c === '[') stack.push(c)
    else if (c === '}') {
      if (stack[stack.length - 1] === '{') stack.pop()
    } else if (c === ']') {
      if (stack[stack.length - 1] === '[') stack.pop()
    }
    if (stack.length === 0) lastValidEnd = i + 1
  }

  // Try parsing what we have first
  try { return JSON.parse(candidate.slice(0, lastValidEnd)) } catch { /* keep repairing */ }

  // If still failing, strip back to the last comma at the current depth, then close remaining brackets.
  let working = candidate
  // Remove trailing commas before closing brackets ( , followed by whitespace then ] or } )
  working = working.replace(/,(\s*[}\]])/g, '$1')
  // Drop everything after the last comma (likely a half-written object/value)
  const lastComma = working.lastIndexOf(',')
  if (lastComma > 0 && lastComma > working.lastIndexOf('}')) {
    working = working.slice(0, lastComma)
  }
  // Close any remaining open structures
  const stack2: string[] = []
  let inStr = false
  let esc = false
  for (let i = 0; i < working.length; i++) {
    const c = working[i]
    if (esc) { esc = false; continue }
    if (c === '\\') { esc = true; continue }
    if (c === '"') { inStr = !inStr; continue }
    if (inStr) continue
    if (c === '{') stack2.push('}')
    else if (c === '[') stack2.push(']')
    else if (c === '}' || c === ']') stack2.pop()
  }
  while (stack2.length > 0) working += stack2.pop()
  return JSON.parse(working)
}

export async function POST(req: NextRequest) {
  try {
    const { image, mediaType } = await req.json()
    if (!image) return NextResponse.json({ error: 'No file provided' }, { status: 400 })

    const isPdf = mediaType === 'application/pdf'
    const raw = isPdf
      ? await analyzePdfWithClaude(image, BLOODWORK_PARSE_PROMPT, 'claude-sonnet-4-5', MAX_TOKENS_FOR_BLOODWORK)
      : await analyzeImageWithClaude(image, (mediaType || 'image/jpeg') as 'image/jpeg' | 'image/png' | 'image/webp', BLOODWORK_PARSE_PROMPT, 'claude-sonnet-4-5')

    try {
      const parsed = tolerantJsonExtract(raw)
      return NextResponse.json(parsed)
    } catch (parseErr) {
      console.error('[parse-bloodwork] JSON extract failed:', parseErr, 'raw len:', raw?.length, 'raw tail:', raw?.slice(-300))
      return NextResponse.json({
        error: 'Lab report parsed but the output was incomplete — usually means this panel has more markers than fit in one read. Try uploading page-by-page, or contact support with the PDF.',
      }, { status: 500 })
    }
  } catch (err) {
    console.error('[parse-bloodwork] error:', err)
    const msg = err instanceof Error ? err.message : 'Failed to parse bloodwork. Please try again.'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
