// Calorie target / TDEE calculator.
// Mifflin-St Jeor BMR × activity multiplier + goal adjustment.
// All inputs/outputs in metric (kg/cm), front-end converts.

export type ActivityLevel = 'sedentary' | 'light' | 'moderate' | 'active' | 'very_active'
export type CalorieGoal = 'aggressive_cut' | 'moderate_cut' | 'maintain' | 'lean_bulk' | 'aggressive_bulk'

export type CalorieTargetInputs = {
  age: number | null
  sex: 'male' | 'female'
  weight_kg: number | null
  height_cm: number | null
  training_days_per_week: number | null
  goal: CalorieGoal
}

export type CalorieTargetResult = {
  bmr: number
  tdee: number
  target: number
  delta: number
  protein_g_target: number
  carbs_g_target: number
  fat_g_target: number
  rationale: string
  activity_level: ActivityLevel
  is_complete: boolean
}

const ACTIVITY_MULTIPLIERS: Record<ActivityLevel, number> = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  active: 1.725,
  very_active: 1.9,
}

const GOAL_DELTA: Record<CalorieGoal, number> = {
  aggressive_cut: -600,
  moderate_cut: -400,
  maintain: 0,
  lean_bulk: 250,
  aggressive_bulk: 500,
}

function activityFromTrainingDays(days: number | null): ActivityLevel {
  if (days == null) return 'light'
  if (days <= 1) return 'sedentary'
  if (days <= 3) return 'light'
  if (days <= 4) return 'moderate'
  if (days <= 5) return 'active'
  return 'very_active'
}

export function computeCalorieTarget(input: CalorieTargetInputs): CalorieTargetResult {
  const { age, sex, weight_kg, height_cm, training_days_per_week, goal } = input

  // If we don't have enough data, return safe fallback target
  const haveCore = age && weight_kg && height_cm
  if (!haveCore) {
    return {
      bmr: 0,
      tdee: 0,
      target: 2400,
      delta: 0,
      protein_g_target: 180,
      carbs_g_target: 250,
      fat_g_target: 80,
      rationale: 'Default target — add age/height/weight in profile for a personalized number.',
      activity_level: 'moderate',
      is_complete: false,
    }
  }

  // Mifflin-St Jeor BMR
  const baseBmr = 10 * weight_kg + 6.25 * height_cm - 5 * age
  const bmr = sex === 'male' ? baseBmr + 5 : baseBmr - 161

  const activity = activityFromTrainingDays(training_days_per_week)
  const tdee = bmr * ACTIVITY_MULTIPLIERS[activity]
  const delta = GOAL_DELTA[goal]
  const target = Math.round(tdee + delta)

  // Macro split: prioritize protein for body comp goals
  const weight_lb = weight_kg * 2.20462
  let protein_g_target: number
  if (goal === 'aggressive_cut' || goal === 'moderate_cut') {
    // 1.2g per lb when cutting to preserve mass
    protein_g_target = Math.round(weight_lb * 1.2)
  } else if (goal === 'lean_bulk' || goal === 'aggressive_bulk') {
    protein_g_target = Math.round(weight_lb * 1.0)
  } else {
    protein_g_target = Math.round(weight_lb * 0.9)
  }

  // Fat: 25-30% of calories
  const fat_g_target = Math.round((target * 0.27) / 9)
  // Carbs: remainder
  const remainingKcal = target - protein_g_target * 4 - fat_g_target * 9
  const carbs_g_target = Math.max(0, Math.round(remainingKcal / 4))

  const goalLabel: Record<CalorieGoal, string> = {
    aggressive_cut: 'aggressive cut (-600 kcal/day)',
    moderate_cut: 'moderate cut (-400 kcal/day)',
    maintain: 'maintenance',
    lean_bulk: 'lean bulk (+250 kcal/day)',
    aggressive_bulk: 'aggressive bulk (+500 kcal/day)',
  }

  return {
    bmr: Math.round(bmr),
    tdee: Math.round(tdee),
    target,
    delta,
    protein_g_target,
    carbs_g_target,
    fat_g_target,
    rationale: `BMR ${Math.round(bmr)} × ${ACTIVITY_MULTIPLIERS[activity]} (${activity.replace('_', ' ')}) = ${Math.round(tdee)} kcal TDEE. ${goalLabel[goal]} = ${target} kcal/day target.`,
    activity_level: activity,
    is_complete: true,
  }
}
