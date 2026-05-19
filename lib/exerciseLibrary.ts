// Curated exercise library — categorized common lifts with aliases.
// Powers the exercise picker in /workout/active so users don't have to type from scratch
// and beginners can find lifts they know by sight but not by name.

export type ExerciseCategory =
  | 'squat' | 'hinge' | 'horizontal_push' | 'vertical_push'
  | 'horizontal_pull' | 'vertical_pull' | 'olympic' | 'isolation_arms'
  | 'isolation_legs' | 'isolation_shoulders' | 'isolation_back' | 'core'
  | 'cardio' | 'plyometric' | 'mobility'

export type ExerciseDef = {
  name: string                // canonical display name
  category: ExerciseCategory
  aliases: string[]           // common alternate names users might type
  primary_muscles: string[]   // for AI Coach intelligence
  level: 'beginner' | 'intermediate' | 'advanced'
}

export const CATEGORY_LABELS: Record<ExerciseCategory, string> = {
  squat: 'Squat',
  hinge: 'Hinge / Deadlift',
  horizontal_push: 'Horizontal Push',
  vertical_push: 'Overhead Push',
  horizontal_pull: 'Horizontal Pull (Row)',
  vertical_pull: 'Vertical Pull',
  olympic: 'Olympic',
  isolation_arms: 'Arms',
  isolation_legs: 'Legs Isolation',
  isolation_shoulders: 'Shoulders Isolation',
  isolation_back: 'Back / Posterior',
  core: 'Core',
  cardio: 'Cardio / Conditioning',
  plyometric: 'Plyometric',
  mobility: 'Mobility / Stretch',
}

export const EXERCISE_LIBRARY: ExerciseDef[] = [
  // SQUAT
  { name: 'Back Squat', category: 'squat', aliases: ['squat', 'high bar squat', 'low bar squat', 'bb squat'], primary_muscles: ['quads', 'glutes'], level: 'intermediate' },
  { name: 'Front Squat', category: 'squat', aliases: ['front squat'], primary_muscles: ['quads', 'upper back'], level: 'intermediate' },
  { name: 'Goblet Squat', category: 'squat', aliases: ['db squat', 'kettlebell squat'], primary_muscles: ['quads', 'glutes'], level: 'beginner' },
  { name: 'Hack Squat', category: 'squat', aliases: ['hack', 'machine hack squat'], primary_muscles: ['quads'], level: 'beginner' },
  { name: 'Bulgarian Split Squat', category: 'squat', aliases: ['bss', 'rear foot elevated split squat', 'rfess', 'split squat'], primary_muscles: ['quads', 'glutes'], level: 'intermediate' },
  { name: 'Walking Lunge', category: 'squat', aliases: ['lunge', 'walking lunges'], primary_muscles: ['quads', 'glutes'], level: 'beginner' },
  { name: 'Leg Press', category: 'squat', aliases: ['machine leg press'], primary_muscles: ['quads', 'glutes'], level: 'beginner' },
  { name: 'Box Squat', category: 'squat', aliases: ['box squat'], primary_muscles: ['glutes', 'quads', 'hamstrings'], level: 'intermediate' },

  // HINGE / DEADLIFT
  { name: 'Conventional Deadlift', category: 'hinge', aliases: ['deadlift', 'dl', 'conventional dl'], primary_muscles: ['hamstrings', 'glutes', 'lower back'], level: 'intermediate' },
  { name: 'Romanian Deadlift', category: 'hinge', aliases: ['rdl', 'romanian dl', 'straight leg deadlift', 'straight leg dl', 'sldl'], primary_muscles: ['hamstrings', 'glutes'], level: 'intermediate' },
  { name: 'Sumo Deadlift', category: 'hinge', aliases: ['sumo dl', 'wide stance deadlift'], primary_muscles: ['glutes', 'hamstrings', 'inner thighs'], level: 'intermediate' },
  { name: 'Trap Bar Deadlift', category: 'hinge', aliases: ['hex bar deadlift', 'trap bar dl'], primary_muscles: ['quads', 'glutes', 'hamstrings'], level: 'beginner' },
  { name: 'Stiff Leg Deadlift', category: 'hinge', aliases: ['sldl', 'stiff legged deadlift'], primary_muscles: ['hamstrings', 'glutes'], level: 'intermediate' },
  { name: 'Single Leg RDL', category: 'hinge', aliases: ['sl rdl', 'one leg rdl', 'kickstand rdl'], primary_muscles: ['hamstrings', 'glutes'], level: 'intermediate' },
  { name: 'Good Morning', category: 'hinge', aliases: ['gm', 'goodmorning'], primary_muscles: ['hamstrings', 'lower back'], level: 'intermediate' },
  { name: 'Hip Thrust', category: 'hinge', aliases: ['barbell hip thrust', 'bb hip thrust'], primary_muscles: ['glutes'], level: 'beginner' },
  { name: 'Glute Bridge', category: 'hinge', aliases: ['bridge', 'bb glute bridge'], primary_muscles: ['glutes', 'hamstrings'], level: 'beginner' },
  { name: 'Kettlebell Swing', category: 'hinge', aliases: ['kb swing', 'swing'], primary_muscles: ['glutes', 'hamstrings', 'lower back'], level: 'beginner' },

  // HORIZONTAL PUSH (chest)
  { name: 'Barbell Bench Press', category: 'horizontal_push', aliases: ['bench', 'bb bench', 'flat bench', 'bench press'], primary_muscles: ['chest', 'triceps', 'front delts'], level: 'intermediate' },
  { name: 'Dumbbell Bench Press', category: 'horizontal_push', aliases: ['db bench', 'db press', 'dumbbell press'], primary_muscles: ['chest', 'triceps'], level: 'beginner' },
  { name: 'Incline Barbell Bench', category: 'horizontal_push', aliases: ['incline bench', 'incline bb bench', 'incline press'], primary_muscles: ['upper chest', 'front delts'], level: 'intermediate' },
  { name: 'Incline Dumbbell Bench', category: 'horizontal_push', aliases: ['incline db', 'incline dumbbell press'], primary_muscles: ['upper chest'], level: 'beginner' },
  { name: 'Decline Bench Press', category: 'horizontal_push', aliases: ['decline bench'], primary_muscles: ['lower chest', 'triceps'], level: 'intermediate' },
  { name: 'Push-Up', category: 'horizontal_push', aliases: ['pushup', 'push up'], primary_muscles: ['chest', 'triceps', 'core'], level: 'beginner' },
  { name: 'Dip', category: 'horizontal_push', aliases: ['dips', 'chest dip', 'parallel bar dip'], primary_muscles: ['chest', 'triceps'], level: 'intermediate' },
  { name: 'Cable Fly', category: 'horizontal_push', aliases: ['cable crossover', 'crossover'], primary_muscles: ['chest'], level: 'beginner' },
  { name: 'Dumbbell Fly', category: 'horizontal_push', aliases: ['db fly', 'flat fly'], primary_muscles: ['chest'], level: 'beginner' },

  // VERTICAL PUSH (overhead)
  { name: 'Overhead Press', category: 'vertical_push', aliases: ['ohp', 'military press', 'mp', 'standing press', 'bb ohp'], primary_muscles: ['shoulders', 'triceps'], level: 'intermediate' },
  { name: 'Push Press', category: 'vertical_push', aliases: ['pp'], primary_muscles: ['shoulders', 'triceps', 'legs'], level: 'intermediate' },
  { name: 'Seated Dumbbell Press', category: 'vertical_push', aliases: ['seated db press', 'db shoulder press', 'dumbbell shoulder press'], primary_muscles: ['shoulders', 'triceps'], level: 'beginner' },
  { name: 'Arnold Press', category: 'vertical_push', aliases: ['arnold'], primary_muscles: ['shoulders'], level: 'intermediate' },
  { name: 'Landmine Press', category: 'vertical_push', aliases: ['landmine'], primary_muscles: ['shoulders', 'upper chest'], level: 'intermediate' },

  // HORIZONTAL PULL (rows)
  { name: 'Barbell Row', category: 'horizontal_pull', aliases: ['bb row', 'bent over row', 'pendlay row'], primary_muscles: ['lats', 'mid back', 'biceps'], level: 'intermediate' },
  { name: 'Dumbbell Row', category: 'horizontal_pull', aliases: ['db row', 'single arm row', 'one arm row'], primary_muscles: ['lats', 'mid back'], level: 'beginner' },
  { name: 'Cable Row', category: 'horizontal_pull', aliases: ['seated cable row', 'cable seated row'], primary_muscles: ['mid back', 'lats'], level: 'beginner' },
  { name: 'T-Bar Row', category: 'horizontal_pull', aliases: ['t bar', 'tbar row'], primary_muscles: ['mid back', 'lats'], level: 'intermediate' },
  { name: 'Chest Supported Row', category: 'horizontal_pull', aliases: ['chest supported', 'incline row'], primary_muscles: ['mid back', 'rear delts'], level: 'beginner' },
  { name: 'Face Pull', category: 'horizontal_pull', aliases: ['face pulls'], primary_muscles: ['rear delts', 'upper back'], level: 'beginner' },
  { name: 'Inverted Row', category: 'horizontal_pull', aliases: ['australian pull up', 'body row'], primary_muscles: ['mid back', 'lats'], level: 'beginner' },

  // VERTICAL PULL (pulldowns / pull-ups)
  { name: 'Pull-Up', category: 'vertical_pull', aliases: ['pullup', 'pull up'], primary_muscles: ['lats', 'biceps'], level: 'intermediate' },
  { name: 'Chin-Up', category: 'vertical_pull', aliases: ['chinup', 'chin up'], primary_muscles: ['lats', 'biceps'], level: 'intermediate' },
  { name: 'Lat Pulldown', category: 'vertical_pull', aliases: ['pulldown', 'wide grip pulldown'], primary_muscles: ['lats'], level: 'beginner' },
  { name: 'Neutral Grip Pulldown', category: 'vertical_pull', aliases: ['hammer grip pulldown', 'close grip pulldown'], primary_muscles: ['lats', 'biceps'], level: 'beginner' },
  { name: 'Straight Arm Pulldown', category: 'vertical_pull', aliases: ['straight arm', 'lat pullover'], primary_muscles: ['lats'], level: 'intermediate' },

  // OLYMPIC
  { name: 'Power Clean', category: 'olympic', aliases: ['clean'], primary_muscles: ['posterior chain', 'shoulders', 'traps'], level: 'advanced' },
  { name: 'Hang Clean', category: 'olympic', aliases: ['hang power clean'], primary_muscles: ['posterior chain', 'shoulders'], level: 'advanced' },
  { name: 'Snatch', category: 'olympic', aliases: ['power snatch'], primary_muscles: ['posterior chain', 'shoulders'], level: 'advanced' },

  // ISOLATION — ARMS
  { name: 'Barbell Curl', category: 'isolation_arms', aliases: ['bb curl', 'barbell biceps curl'], primary_muscles: ['biceps'], level: 'beginner' },
  { name: 'Dumbbell Curl', category: 'isolation_arms', aliases: ['db curl', 'alternating curl'], primary_muscles: ['biceps'], level: 'beginner' },
  { name: 'Hammer Curl', category: 'isolation_arms', aliases: ['hammers'], primary_muscles: ['biceps', 'brachialis'], level: 'beginner' },
  { name: 'Preacher Curl', category: 'isolation_arms', aliases: ['preacher'], primary_muscles: ['biceps'], level: 'beginner' },
  { name: 'Incline Dumbbell Curl', category: 'isolation_arms', aliases: ['incline curl'], primary_muscles: ['biceps long head'], level: 'beginner' },
  { name: 'Tricep Pushdown', category: 'isolation_arms', aliases: ['cable pushdown', 'rope pushdown', 'pushdown'], primary_muscles: ['triceps'], level: 'beginner' },
  { name: 'Skull Crusher', category: 'isolation_arms', aliases: ['lying tricep extension', 'skullcrusher', 'lying triceps press'], primary_muscles: ['triceps'], level: 'beginner' },
  { name: 'Overhead Tricep Extension', category: 'isolation_arms', aliases: ['ohte', 'french press'], primary_muscles: ['triceps long head'], level: 'beginner' },
  { name: 'Close Grip Bench Press', category: 'isolation_arms', aliases: ['cgbp', 'close grip bench'], primary_muscles: ['triceps', 'chest'], level: 'intermediate' },

  // ISOLATION — LEGS
  { name: 'Leg Extension', category: 'isolation_legs', aliases: ['leg ext'], primary_muscles: ['quads'], level: 'beginner' },
  { name: 'Leg Curl', category: 'isolation_legs', aliases: ['hamstring curl', 'lying leg curl', 'seated leg curl'], primary_muscles: ['hamstrings'], level: 'beginner' },
  { name: 'Calf Raise', category: 'isolation_legs', aliases: ['standing calf raise', 'seated calf raise', 'calves'], primary_muscles: ['calves'], level: 'beginner' },
  { name: 'Adductor Machine', category: 'isolation_legs', aliases: ['inner thigh machine', 'adductors'], primary_muscles: ['adductors'], level: 'beginner' },
  { name: 'Abductor Machine', category: 'isolation_legs', aliases: ['outer thigh machine', 'glute machine'], primary_muscles: ['glutes', 'abductors'], level: 'beginner' },

  // ISOLATION — SHOULDERS
  { name: 'Lateral Raise', category: 'isolation_shoulders', aliases: ['side raise', 'side lateral', 'db lateral raise'], primary_muscles: ['side delts'], level: 'beginner' },
  { name: 'Rear Delt Fly', category: 'isolation_shoulders', aliases: ['reverse fly', 'rear fly', 'bent over rear delt'], primary_muscles: ['rear delts'], level: 'beginner' },
  { name: 'Front Raise', category: 'isolation_shoulders', aliases: ['db front raise', 'plate front raise'], primary_muscles: ['front delts'], level: 'beginner' },
  { name: 'Cable Lateral Raise', category: 'isolation_shoulders', aliases: ['cable lateral'], primary_muscles: ['side delts'], level: 'beginner' },
  { name: 'Upright Row', category: 'isolation_shoulders', aliases: ['upright rows'], primary_muscles: ['traps', 'side delts'], level: 'intermediate' },
  { name: 'Shrug', category: 'isolation_shoulders', aliases: ['bb shrug', 'db shrug', 'trap shrug'], primary_muscles: ['traps'], level: 'beginner' },

  // ISOLATION — BACK
  { name: 'Back Extension', category: 'isolation_back', aliases: ['hyperextension', 'roman chair', '45 degree back extension'], primary_muscles: ['lower back', 'glutes', 'hamstrings'], level: 'beginner' },
  { name: 'Reverse Hyper', category: 'isolation_back', aliases: ['reverse hyperextension'], primary_muscles: ['lower back', 'glutes'], level: 'intermediate' },
  { name: 'Pullover', category: 'isolation_back', aliases: ['db pullover'], primary_muscles: ['lats', 'chest'], level: 'beginner' },

  // CORE
  { name: 'Hanging Leg Raise', category: 'core', aliases: ['leg raise', 'hanging knee raise'], primary_muscles: ['abs', 'hip flexors'], level: 'intermediate' },
  { name: 'Cable Crunch', category: 'core', aliases: ['kneeling cable crunch'], primary_muscles: ['abs'], level: 'beginner' },
  { name: 'Plank', category: 'core', aliases: ['front plank'], primary_muscles: ['abs', 'core'], level: 'beginner' },
  { name: 'Side Plank', category: 'core', aliases: ['side bridge'], primary_muscles: ['obliques'], level: 'beginner' },
  { name: 'Ab Wheel Rollout', category: 'core', aliases: ['ab roller', 'wheel'], primary_muscles: ['abs', 'core'], level: 'intermediate' },
  { name: 'Russian Twist', category: 'core', aliases: ['twist'], primary_muscles: ['obliques'], level: 'beginner' },
  { name: 'Pallof Press', category: 'core', aliases: ['pallof'], primary_muscles: ['core', 'obliques'], level: 'beginner' },
  { name: 'Dead Bug', category: 'core', aliases: ['deadbug'], primary_muscles: ['core'], level: 'beginner' },

  // CARDIO
  { name: 'Zone 2', category: 'cardio', aliases: ['zone two', 'low intensity'], primary_muscles: ['heart', 'mitochondria'], level: 'beginner' },
  { name: 'Sprint', category: 'cardio', aliases: ['sprints', 'hill sprints'], primary_muscles: ['posterior chain', 'heart'], level: 'intermediate' },
  { name: 'Rowing Machine', category: 'cardio', aliases: ['rower', 'erg', 'row'], primary_muscles: ['heart', 'full body'], level: 'beginner' },
  { name: 'Assault Bike', category: 'cardio', aliases: ['airbike', 'air bike', 'echo bike'], primary_muscles: ['heart', 'full body'], level: 'beginner' },
  { name: 'Sled Push', category: 'cardio', aliases: ['prowler push', 'prowler'], primary_muscles: ['legs', 'heart'], level: 'beginner' },
  { name: 'Stair Master', category: 'cardio', aliases: ['stairmaster', 'stair climber'], primary_muscles: ['legs', 'heart'], level: 'beginner' },
  { name: 'Jump Rope', category: 'cardio', aliases: ['skipping', 'rope'], primary_muscles: ['calves', 'heart'], level: 'beginner' },
  { name: 'Treadmill Run', category: 'cardio', aliases: ['running', 'jog', 'treadmill'], primary_muscles: ['heart', 'legs'], level: 'beginner' },
  { name: 'Incline Walk', category: 'cardio', aliases: ['12-3-30', 'incline treadmill', 'walking'], primary_muscles: ['heart', 'legs'], level: 'beginner' },

  // PLYOMETRIC
  { name: 'Box Jump', category: 'plyometric', aliases: ['box jumps'], primary_muscles: ['legs', 'power'], level: 'intermediate' },
  { name: 'Broad Jump', category: 'plyometric', aliases: ['standing broad jump'], primary_muscles: ['legs', 'power'], level: 'intermediate' },
  { name: 'Medicine Ball Slam', category: 'plyometric', aliases: ['med ball slam', 'ball slam'], primary_muscles: ['full body'], level: 'beginner' },

  // MOBILITY
  { name: '90/90 Hip Stretch', category: 'mobility', aliases: ['90 90', 'hip rotation'], primary_muscles: ['hips'], level: 'beginner' },
  { name: 'Couch Stretch', category: 'mobility', aliases: ['quad stretch'], primary_muscles: ['quads', 'hip flexors'], level: 'beginner' },
  { name: 'Pigeon Pose', category: 'mobility', aliases: ['pigeon'], primary_muscles: ['hips', 'glutes'], level: 'beginner' },
  { name: 'Cat-Cow', category: 'mobility', aliases: ['cat cow', 'spinal flow'], primary_muscles: ['spine'], level: 'beginner' },
]

// Search across canonical name + all aliases (case-insensitive)
export function searchExercises(query: string, limit = 12): ExerciseDef[] {
  const q = query.trim().toLowerCase()
  if (!q) return []
  const exact: ExerciseDef[] = []
  const startsWith: ExerciseDef[] = []
  const contains: ExerciseDef[] = []
  for (const ex of EXERCISE_LIBRARY) {
    const haystack = [ex.name.toLowerCase(), ...ex.aliases.map(a => a.toLowerCase())]
    if (haystack.some(h => h === q)) {
      exact.push(ex)
    } else if (haystack.some(h => h.startsWith(q))) {
      startsWith.push(ex)
    } else if (haystack.some(h => h.includes(q))) {
      contains.push(ex)
    }
  }
  return [...exact, ...startsWith, ...contains].slice(0, limit)
}

// Group exercises by category for the picker view
export function groupedByCategory(): Array<[ExerciseCategory, ExerciseDef[]]> {
  const map = new Map<ExerciseCategory, ExerciseDef[]>()
  for (const ex of EXERCISE_LIBRARY) {
    if (!map.has(ex.category)) map.set(ex.category, [])
    map.get(ex.category)!.push(ex)
  }
  return Array.from(map.entries())
}
