import type { Phase } from './api'

export const styles = {
  input:
    'w-full border-b-2 border-ink-faint bg-transparent px-1 py-2 font-body text-ink placeholder-ink-faint outline-none transition focus:border-stamp',
  key: 'typed border-2 border-ink bg-paper-2 px-4 py-2 text-sm uppercase tracking-[0.12em] text-ink shadow-[3px_3px_0_0_var(--color-ink)] transition active:translate-x-[3px] active:translate-y-[3px] active:shadow-none disabled:cursor-not-allowed disabled:border-ink-faint disabled:text-ink-faint disabled:shadow-none',
  keyDark:
    'typed border-2 border-paper-3 bg-transparent px-3 py-1.5 text-xs uppercase tracking-[0.12em] text-paper-3 transition hover:border-paper hover:text-paper disabled:opacity-40',
  field: 'typed text-[10px] uppercase tracking-[0.22em] text-ink-faint',
  fieldDark: 'typed text-[10px] uppercase tracking-[0.22em] text-paper-3/60',
}

/** Case-file label for each round phase. */
const PHASES: { key: Phase; label: string }[] = [
  { key: 'answering', label: 'Statements' },
  { key: 'reveal_main_question', label: 'Disclosure' },
  { key: 'discussion', label: 'Cross-Exam' },
  { key: 'voting', label: 'Ballot' },
  { key: 'results', label: 'Verdict' },
]

export function phaseLabel(phase: Phase) {
  return PHASES.find((p) => p.key === phase)?.label ?? phase
}

export function CaseProgress({ phase }: { phase: Phase }) {
  const active = PHASES.findIndex((p) => p.key === phase)

  return (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
      {PHASES.map((p, i) => (
        <span key={p.key} className="flex items-center gap-2">
          <span
            className={`typed text-[10px] uppercase tracking-[0.18em] ${
              i === active
                ? 'text-stamp'
                : i < active
                  ? 'text-ink-faint line-through'
                  : 'text-ink-faint/45'
            }`}
          >
            {p.label}
          </span>
          {i < PHASES.length - 1 && <span className="text-ink-faint/40">·</span>}
        </span>
      ))}
    </div>
  )
}

/** Evidence photo badge — initials on sepia stock. */
export function Badge({
  name,
  code,
  size = 'md',
  flagged,
}: {
  name: string
  code: string
  size?: 'sm' | 'md' | 'lg'
  flagged?: boolean
}) {
  const box = {
    sm: 'size-7 text-[10px]',
    md: 'size-9 text-xs',
    lg: 'size-14 text-base',
  }[size]

  return (
    <span
      title={name}
      className={`${box} typed grid shrink-0 place-items-center border-2 ${
        flagged ? 'border-stamp text-stamp' : 'border-ink/50 text-ink/80'
      }`}
      style={{ background: tintOf(code) }}
    >
      {name.slice(0, 2).toUpperCase()}
    </span>
  )
}

const TINTS = ['#d8cfb8', '#cfc4ab', '#dcd0b4', '#c9c0a8', '#d5c9ae', '#cdc5b2']

function tintOf(seed: string) {
  let hash = 0
  for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) | 0
  return TINTS[Math.abs(hash) % TINTS.length]
}

export function Stamp({
  tone = 'stamp',
  slam,
  children,
}: {
  tone?: 'stamp' | 'verdict' | 'pen'
  slam?: boolean
  children: React.ReactNode
}) {
  const color = { stamp: 'text-stamp', verdict: 'text-verdict', pen: 'text-pen' }[tone]
  return <span className={`stamp ${color} ${slam ? 'slam' : ''} inline-block`}>{children}</span>
}

export function Sheet({
  tilt = 0,
  className = '',
  children,
}: {
  tilt?: number
  className?: string
  children: React.ReactNode
}) {
  return (
    <div
      className={`paper sheet-in p-5 ${className}`}
      style={{ ['--tilt' as string]: `${tilt}deg`, transform: `rotate(${tilt}deg)` }}
    >
      {children}
    </div>
  )
}
