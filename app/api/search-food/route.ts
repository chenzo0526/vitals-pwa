import { NextRequest, NextResponse } from 'next/server'

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
  water_ml: 1051,       // Water
}

function pickNutrient(nutrients: Array<{ nutrientId: number; value: number }> | undefined, id: number): number {
  if (!nutrients) return 0
  const n = nutrients.find((x) => x.nutrientId === id)
  return n?.value ?? 0
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
        water_ml: Math.round(pickNutrient(nutrients, NUTRIENT_IDS.water_ml)),
      }
    })

    return NextResponse.json({ ok: true, results, count: results.length })
  } catch (err) {
    console.error('[search-food] error:', err)
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Search failed' }, { status: 500 })
  }
}
