'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Play, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { supabase } from '@/lib/supabase'

export default function WorkoutPage() {
  const router = useRouter()
  const [focus, setFocus] = useState('')
  const [energyPre, setEnergyPre] = useState(7)
  const [starting, setStarting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function startSession() {
    setStarting(true)
    setError(null)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      const payload: Record<string, unknown> = {
        focus: focus || null,
        energy_pre: energyPre,
        started_at: new Date().toISOString(),
      }
      if (user?.id) payload.user_id = user.id

      const { data, error: insertErr } = await supabase
        .from('workout_sessions')
        .insert(payload)
        .select()
        .single()

      if (insertErr || !data) {
        throw new Error(insertErr?.message || 'Could not start session')
      }
      router.push(`/workout/active?session=${data.id}`)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to start session')
      setStarting(false)
    }
  }

  return (
    <div className="px-4 pt-6 space-y-4">
      <h1 className="text-xl font-bold text-white">Workout</h1>

      <Card className="border-white/10 bg-white/5">
        <CardContent className="py-4 space-y-4">
          <div>
            <p className="text-white/40 text-xs uppercase tracking-wider mb-2">Focus</p>
            <input
              value={focus}
              onChange={(e) => setFocus(e.target.value)}
              placeholder="e.g. push, pull, legs, conditioning"
              className="w-full bg-white/5 border border-white/10 rounded-md px-3 py-2 text-sm text-white placeholder:text-white/20 focus:outline-none focus:border-amber-400/50"
            />
          </div>

          <div>
            <p className="text-white/40 text-xs uppercase tracking-wider mb-2">Energy level (1-10)</p>
            <div className="flex gap-1">
              {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => (
                <button
                  key={n}
                  onClick={() => setEnergyPre(n)}
                  className={`flex-1 py-2 rounded text-xs font-bold transition-colors ${
                    energyPre === n ? 'bg-amber-400 text-black' : 'bg-white/5 text-white/40 hover:bg-white/10'
                  }`}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>

          <Button
            onClick={startSession}
            disabled={starting}
            className="w-full bg-green-400 text-black font-bold hover:bg-green-300"
          >
            {starting ? (
              <><Loader2 size={16} className="mr-2 animate-spin" /> Starting…</>
            ) : (
              <><Play size={16} className="mr-2" /> Start Session</>
            )}
          </Button>

          {error && (
            <p className="text-xs text-rose-300 bg-rose-500/10 border border-rose-400/30 rounded-md p-2">
              {error}
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
