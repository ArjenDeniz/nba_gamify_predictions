import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Fragment, useState } from 'react'
import { PickTag, Sheet, TeamLogo } from '../components'
import { TEAM_BY_ID, teamsIn, type Conference } from '../data/winTotals'
import {
  autoOrder,
  closenessPoints,
  gamesPlayed,
  savedOrder,
  type Pick,
  type Prediction,
  type Standings as LiveStandings,
} from '../lib/scoring'

type Props = {
  pred: Prediction
  locked: boolean
  standings: LiveStandings | null
  onOrder: (conf: Conference, ids: string[]) => void
}

const ZONES = [
  { from: 1, label: 'Playoffs', seedCls: 'bg-paint text-white' },
  { from: 7, label: 'Play-in', seedCls: 'bg-playin text-white' },
  { from: 11, label: 'Lottery', seedCls: 'bg-ink/10 text-ink' },
]
const zoneFor = (seed: number) => [...ZONES].reverse().find((z) => seed >= z.from)!

export function Standings({ pred, locked, standings, onOrder }: Props) {
  return (
    <div className="space-y-5">
      <header className="px-1">
        <h1 className="font-display text-4xl font-extrabold leading-none sm:text-5xl">Final standings</h1>
        <p className="mt-2 max-w-prose text-ink-soft">
          {locked
            ? 'Picks are locked. Exact spot is 3 points, one off is 2, two off is 1.'
            : 'We start from the Vegas lines, moved 3 wins toward each of your over/under calls. Drag teams into the order you believe, then save.'}
        </p>
      </header>
      <div className="grid gap-5 lg:grid-cols-2">
        {(['East', 'West'] as Conference[]).map((conf) => (
          <ConferenceBoard
            key={conf}
            conf={conf}
            pred={pred}
            locked={locked}
            standings={standings}
            onOrder={(ids) => onOrder(conf, ids)}
          />
        ))}
      </div>
    </div>
  )
}

function ConferenceBoard({
  conf,
  pred,
  locked,
  standings,
  onOrder,
}: {
  conf: Conference
  pred: Prediction
  locked: boolean
  standings: LiveStandings | null
  onOrder: (ids: string[]) => void
}) {
  const saved = savedOrder(pred, conf)
  const auto = autoOrder(teamsIn(conf), pred.overUnder ?? {})

  // Holds a dropped order until Firestore echoes it back, so rows don't snap back.
  const savedKey = saved?.join() ?? ''
  const [draft, setDraft] = useState<{ ids: string[]; base: string } | null>(null)
  const order = (draft?.base === savedKey ? draft.ids : null) ?? saved ?? auto

  const move = (next: string[]) => {
    setDraft({ ids: next, base: savedKey })
    onOrder(next)
  }

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  const onDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return
    move(arrayMove(order, order.indexOf(String(active.id)), order.indexOf(String(over.id))))
  }

  const started = standings && Object.values(standings).some((r) => gamesPlayed(r) > 0)
  const points = started
    ? order.reduce((sum, id, i) => sum + closenessPoints(i + 1, standings[id]?.seed ?? 99), 0)
    : null

  return (
    <Sheet className="overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-4 py-3">
        <h2 className="font-display text-2xl font-extrabold">{conf}</h2>
        {locked ? (
          points !== null && <span className="tabular text-sm font-semibold">{points} of 45 points</span>
        ) : saved ? (
          <div className="flex items-center gap-3 text-sm">
            <span className="font-semibold text-over">Saved</span>
            {saved.join() !== auto.join() && (
              <button type="button" className="underline decoration-ink/30 underline-offset-2 hover:decoration-ink" onClick={() => move(auto)}>
                Rebuild from my picks
              </button>
            )}
          </div>
        ) : (
          <button
            type="button"
            className="rounded-md bg-ink px-3 py-1.5 text-sm font-semibold text-sheet hover:bg-ink/85"
            onClick={() => move(order)}
          >
            Save this order
          </button>
        )}
      </div>

      {!locked && !saved && (
        <p className="border-b border-line bg-playin/10 px-4 py-2 text-sm">
          Not saved yet. This order follows your over/under picks until you save or drag.
        </p>
      )}

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
        <SortableContext items={order} strategy={verticalListSortingStrategy}>
          <ol>
            {order.map((id, i) => {
              const seed = i + 1
              const zone = ZONES.find((z) => z.from === seed)
              return (
                <Fragment key={id}>
                  {zone && (
                    <li aria-hidden className="bg-ink/5 px-4 py-1 text-xs font-semibold text-ink-soft">
                      {zone.label}
                    </li>
                  )}
                  <TeamSlot
                    id={id}
                    seed={seed}
                    pick={pred.overUnder?.[id]}
                    locked={locked}
                    actualSeed={started ? standings[id]?.seed : undefined}
                    onUp={i > 0 ? () => move(arrayMove(order, i, i - 1)) : undefined}
                    onDown={i < order.length - 1 ? () => move(arrayMove(order, i, i + 1)) : undefined}
                  />
                </Fragment>
              )
            })}
          </ol>
        </SortableContext>
      </DndContext>
    </Sheet>
  )
}

function TeamSlot({
  id,
  seed,
  pick,
  locked,
  actualSeed,
  onUp,
  onDown,
}: {
  id: string
  seed: number
  pick?: Pick
  locked: boolean
  actualSeed?: number
  onUp?: () => void
  onDown?: () => void
}) {
  const team = TEAM_BY_ID[id]
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({
    id,
    disabled: locked,
  })

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={`relative flex items-center gap-3 border-b border-line bg-sheet px-3 py-2 last:border-b-0 ${
        isDragging ? 'z-10 shadow-lg ring-2 ring-ink/20' : ''
      }`}
    >
      <span
        className={`tabular grid h-8 w-8 shrink-0 place-items-center rounded font-display text-lg font-extrabold ${zoneFor(seed).seedCls}`}
      >
        {seed}
      </span>
      <TeamLogo team={team} size={28} />
      <div className="min-w-0 flex-1">
        <div className="truncate font-semibold">{team.name}</div>
        <div className="flex items-center gap-2 text-xs text-ink-soft">
          <span className="tabular">Line {team.line}</span>
          {pick && <PickTag pick={pick} />}
        </div>
      </div>

      {actualSeed !== undefined && (
        <div className="text-right text-xs">
          <div className="tabular font-semibold">Now #{actualSeed}</div>
          <div className="text-ink-soft">+{closenessPoints(seed, actualSeed)}</div>
        </div>
      )}

      {!locked && (
        <div className="flex items-center">
          <div className="flex flex-col">
            <NudgeButton label={`Move ${team.name} up`} onClick={onUp} dir="up" />
            <NudgeButton label={`Move ${team.name} down`} onClick={onDown} dir="down" />
          </div>
          <button
            type="button"
            ref={setActivatorNodeRef}
            {...attributes}
            {...listeners}
            aria-label={`Drag ${team.name}`}
            className="grid h-10 w-9 cursor-grab touch-none place-items-center rounded text-ink-soft hover:bg-ink/5 active:cursor-grabbing"
          >
            <svg width="14" height="18" viewBox="0 0 14 18" aria-hidden>
              {[3, 9, 15].map((y) => (
                <g key={y} fill="currentColor">
                  <circle cx="4" cy={y} r="1.6" />
                  <circle cx="10" cy={y} r="1.6" />
                </g>
              ))}
            </svg>
          </button>
        </div>
      )}
    </li>
  )
}

function NudgeButton({ label, onClick, dir }: { label: string; onClick?: () => void; dir: 'up' | 'down' }) {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={!onClick}
      onClick={onClick}
      className="grid h-5 w-7 place-items-center rounded text-ink-soft hover:bg-ink/5 disabled:opacity-25"
    >
      <svg width="10" height="6" viewBox="0 0 10 6" aria-hidden className={dir === 'down' ? 'rotate-180' : ''}>
        <path d="M1 5l4-4 4 4" fill="none" stroke="currentColor" strokeWidth="1.8" />
      </svg>
    </button>
  )
}
