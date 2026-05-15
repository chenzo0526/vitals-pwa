import { RECOMMENDATION_DISCLAIMER } from '@/lib/disclaimer'
import { Info } from 'lucide-react'

export default function Disclaimer({ className = '' }: { className?: string }) {
  return (
    <p className={`text-[10px] text-white/40 leading-snug flex items-start gap-1 ${className}`}>
      <Info size={11} className="mt-0.5 flex-shrink-0" />
      <span>{RECOMMENDATION_DISCLAIMER}</span>
    </p>
  )
}
