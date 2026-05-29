import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// USDA FoodData Central search proxy.
// Lets users type "chicken breast" or "trader joes spinach ravioli" and get back proper macro data.
// Uses the public DEMO_KEY by default (limited 30 req/hour) — add USDA_API_KEY env var for production.
// Docs: https://fdc.nal.usda.gov/api-guide.html

type FdcSearchResult = {
  foods?: Array<{
    fdcId: number
    description: string
    brandName?: string
    brandOwner?: string
    dataType?: string
    servingSize?: number
    servingSizeUnit?: string
    foodCategory?: string
    foodNutrients?: Array<{
      nutrientId: number
      nutrientName: string
      value: number
      unitName: string
    }>
  }>
}

const NUTRIENT_IDS = {
  calories: 1008,       // Energy (kcal)
  calories_atwater: 2047, // Energy (Atwater)
  protein_g: 1003,      // Protein
  carbs_g: 1005,        // Carbohydrate, by difference
  fat_g: 1004,          // Total lipid (fat)
  fiber_g: 1079,        // Fiber, total dietary
  sugar_g: 2000,        // Sugars, total
  sodium_mg: 1093,      // Sodium, Na
  potassium_mg: 1092,   // Potassium, K
  water_ml: 1051,       // Water
}

function pickNutrient(nutrients: Array<{ nutrientId: number; value: number }> | undefined, id: number): number {
  if (!nutrients) return 0
  const n = nutrients.find((x) => x.nutrientId === id)
  return n?.value ?? 0
}

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY || '' })

// Fallback when USDA is rate-limited (DEMO_KEY) or returns nothing: estimate macros with Claude.
// Returns up to 3 plausible matches per 100g (or a sensible serving) so search never hard-fails.
async function estimateFoodWithClaude(query: string) {
  try {
    const resp = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 700,
      temperature: 0.2,
      system: 'You are a nutrition database. Return ONLY valid JSON: {"results":[{"name":string,"per_amount":string,"calories":number,"protein_g":number,"carbs_g":number,"fat_g":number,"water_ml":number}]}. CRITICAL: every result MUST be the food the user actually searched for (or an obvious variant of it) — NEVER substitute an unrelated food. If the query is a restaurant/composite dish (e.g. "spicy tuna roll", "chicken burrito"), estimate THAT dish at a realistic serving. 1-3 matches. Realistic macros. No prose.',
      messages: [{ role: 'user', content: `Food query: "${query}"` }],
    })
    const c = resp.content[0]
    const txt = c.type === 'text' ? c.text : ''
    const m = txt.match(/\{[\s\S]*\}/)
    if (!m) return []
    const parsed = JSON.parse(m[0]) as { results?: Array<Record<string, unknown>> }
    return (parsed.results || []).slice(0, 3).map((r, i) => ({
      fdc_id: -1 - i,
      name: String(r.name || query),
      brand: null,
      category: null,
      per_amount: String(r.per_amount || '100g'),
      is_branded_serving: false,
      calories: Math.round(Number(r.calories) || 0),
      protein_g: Math.round((Number(r.protein_g) || 0) * 10) / 10,
      carbs_g: Math.round((Number(r.carbs_g) || 0) * 10) / 10,
      fat_g: Math.round((Number(r.fat_g) || 0) * 10) / 10,
      fiber_g: 0,
      sugar_g: 0,
      sodium_mg: Math.round(Number(r.sodium_mg) || 0),
      potassium_mg: Math.round(Number(r.potassium_mg) || 0),
      water_ml: Math.round(Number(r.water_ml) || 0),
      estimated: true,
    }))
  } catch (e) {
    console.error('[search-food] claude fallback failed:', e)
    return []
  }
}

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url)
    const query = url.searchParams.get('q')?.trim()
    if (!query) {
      return NextResponse.json({ error: 'Provide ?q=...' }, { status: 400 })
    }
    const limit = Math.min(20, Number(url.searchParams.get('limit') || 8))

    const apiKey = process.env.USDA_API_KEY || 'DEMO_KEY'
    const fdcUrl = `https://api.nal.usda.gov/fdc/v1/foods/search?api_key=${encodeURIComponent(apiKey)}&query=${encodeURIComponent(query)}&pageSize=${limit}&dataType=Foundation,SR%20Legacy,Branded`

    const res = await fetch(fdcUrl, { headers: { Accept: 'application/json' } })
    if (!res.ok) {
      const txt = await res.text()
      console.error('[search-food] USDA error:', res.status, txt.slice(0, 200))
      const estimated = await estimateFoodWithClaude(query)
      if (estimated.length > 0) {
        return NextResponse.json({ ok: true, results: estimated, count: estimated.length, source: 'estimated' })
      }
      return NextResponse.json({ error: 'Food database unavailable. Try again in a minute.' }, { status: 502 })
    }
    const data = (await res.json()) as FdcSearchResult

    // Normalize to a clean shape per 100g (USDA nutrients are typically per 100g for Foundation/SR Legacy)
    const results = (data.foods || []).map((f) => {
      const nutrients = f.foodNutrients || []
      const cals = pickNutrient(nutrients, NUTRIENT_IDS.calories) || pickNutrient(nutrients, NUTRIENT_IDS.calories_atwater)
      const display = f.brandName
        ? `${f.brandName} · ${f.description}`
        : f.description
      return {
        fdc_id: f.fdcId,
        name: display,
        brand: f.brandName || null,
        category: f.foodCategory || null,
        per_amount: f.servingSize != null && f.dataType === 'Branded' ? `${f.servingSize}${f.servingSizeUnit || 'g'}` : '100g',
        is_branded_serving: f.dataType === 'Branded',
        calories: Math.round(cals),
        protein_g: Math.round(pickNutrient(nutrients, NUTRIENT_IDS.protein_g) * 10) / 10,
        carbs_g: Math.round(pickNutrient(nutrients, NUTRIENT_IDS.carbs_g) * 10) / 10,
        fat_g: Math.round(pickNutrient(nutrients, NUTRIENT_IDS.fat_g) * 10) / 10,
        fiber_g: Math.round(pickNutrient(nutrients, NUTRIENT_IDS.fiber_g) * 10) / 10,
        sugar_g: Math.round(pickNutrient(nutrients, NUTRIENT_IDS.sugar_g) * 10) / 10,
        sodium_mg: Math.round(pickNutrient(nutrients, NUTRIENT_IDS.sodium_mg)),
        potassium_mg: Math.round(pickNutrient(nutrients, NUTRIENT_IDS.potassium_mg)),
        water_ml: Math.round(pickNutrient(nutrients, NUTRIENT_IDS.water_ml)),
      }
    })

    if (results.length === 0) {
      const estimated = await estimateFoodWithClaude(query)
      if (estimated.length > 0) {
        return NextResponse.json({ ok: true, results: estimated, count: estimated.length, source: 'estimated' })
      }
    }

    return NextResponse.json({ ok: true, results, count: results.length })
  } catch (err) {
    console.error('[search-food] error:', err)
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Search failed' }, { status: 500 })
  }
}
