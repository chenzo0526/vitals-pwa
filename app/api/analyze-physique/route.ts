import { NextRequest, NextResponse } from 'next/server'
import {
  analyzeImageWithClaude,
  analyzeMultipleImagesWithClaude,
  PHYSIQUE_ANALYSIS_PROMPT,
  PHYSIQUE_MULTI_ANGLE_PROMPT,
  type LabeledImage,
  type AngleLabel,
} from '@/lib/claude'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const VALID_ANGLES: AngleLabel[] = ['front', 'left', 'right', 'back']

type IncomingImage = {
  angle?: string
  image?: string
  mediaType?: string
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()

    // New multi-angle path: { images: [{ angle, image, mediaType }, ...] }
    if (Array.isArray(body?.images) && body.images.length > 0) {
      const labeled: LabeledImage[] = []
      for (const raw of body.images as IncomingImage[]) {
        if (!raw?.image) continue
        const angle = (raw.angle || '').toLowerCase() as AngleLabel
        if (!VALID_ANGLES.includes(angle)) continue
        const media = (raw.mediaType || 'image/jpeg') as LabeledImage['mediaType']
        labeled.push({ angle, base64: raw.image, mediaType: media })
      }
      if (labeled.length === 0) {
        return NextResponse.json({ error: 'No valid images provided' }, { status: 400 })
      }

      // PRIVACY: Images are processed server-side and immediately discarded.
      const raw = await analyzeMultipleImagesWithClaude(labeled, PHYSIQUE_MULTI_ANGLE_PROMPT)
      const jsonMatch = raw.match(/\{[\s\S]*\}/)
      if (!jsonMatch) {
        console.error('[analyze-physique] no JSON in multi-angle response:', raw?.slice(0, 200))
        return NextResponse.json({ error: 'Failed to analyze physique. Please try again.' }, { status: 500 })
      }
      const parsed = JSON.parse(jsonMatch[0])
      // Echo back which angles were used (in case the model didn't include it).
      if (!parsed.angles_analyzed) parsed.angles_analyzed = labeled.map(l => l.angle)
      return NextResponse.json(parsed)
    }

    // Legacy single-image path: { image, mediaType }
    const { image, mediaType } = body
    if (!image) return NextResponse.json({ error: 'No image provided' }, { status: 400 })

    const raw = await analyzeImageWithClaude(image, mediaType || 'image/jpeg', PHYSIQUE_ANALYSIS_PROMPT)
    const jsonMatch = raw.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      console.error('[analyze-physique] no JSON in response:', raw?.slice(0, 200))
      return NextResponse.json({ error: 'Failed to analyze physique. Please try again.' }, { status: 500 })
    }

    return NextResponse.json(JSON.parse(jsonMatch[0]))
  } catch (err) {
    console.error('[analyze-physique] error:', err)
    return NextResponse.json({ error: 'Failed to analyze physique. Please try again.' }, { status: 500 })
  }
}
