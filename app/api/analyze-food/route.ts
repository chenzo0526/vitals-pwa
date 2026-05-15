import { NextRequest, NextResponse } from 'next/server'
import { analyzeImageWithClaude, FOOD_ANALYSIS_PROMPT } from '@/lib/claude'

export async function POST(req: NextRequest) {
  try {
    const { image, mediaType } = await req.json()
    if (!image) return NextResponse.json({ error: 'No image provided' }, { status: 400 })

    const raw = await analyzeImageWithClaude(image, mediaType || 'image/jpeg', FOOD_ANALYSIS_PROMPT)

    // Extract JSON from response
    const jsonMatch = raw.match(/\{[\s\S]*\}/)
    if (!jsonMatch) return NextResponse.json({ error: 'Failed to parse AI response' }, { status: 500 })

    const parsed = JSON.parse(jsonMatch[0])
    return NextResponse.json(parsed)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
