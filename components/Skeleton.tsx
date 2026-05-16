'use client'

import { cn } from '@/lib/utils'

/** Shimmering rectangle used for loading placeholders. */
export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-md bg-white/5',
        'before:absolute before:inset-0',
        'before:-translate-x-full',
        'before:animate-[skeleton_1.4s_ease-in-out_infinite]',
        'before:bg-gradient-to-r before:from-transparent before:via-white/10 before:to-transparent',
        className,
      )}
    />
  )
}

export function SkeletonCard({ className }: { className?: string }) {
  return (
    <div className={cn('rounded-xl border border-white/10 bg-white/5 p-4 space-y-2', className)}>
      <Skeleton className="h-3 w-1/3" />
      <Skeleton className="h-6 w-2/3" />
      <Skeleton className="h-2 w-full mt-2" />
    </div>
  )
}

export function SkeletonRow({ className }: { className?: string }) {
  return (
    <div className={cn('flex items-center gap-3 rounded-xl border border-white/10 bg-white/5 p-3', className)}>
      <Skeleton className="h-9 w-9 rounded-lg" />
      <div className="flex-1 space-y-1.5">
        <Skeleton className="h-3.5 w-3/4" />
        <Skeleton className="h-2.5 w-1/2" />
      </div>
    </div>
  )
}
