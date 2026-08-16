import { useCallback, useEffect, useRef, useState } from 'react'
import { api, type ChatMessage, type RoomView } from './api'
import type { Session } from './Home'
import { Badge, CaseProgress, Sheet, Stamp, phaseLabel, styles } from './ui'

type Round = NonNullable<RoomView['round']>

/** A stable case number, so the same room always files under the same digits. */
function caseNumber(roomCode: string) {
  return roomCode.replace(/\D/g, '').slice(-4).padStart(4, '0')
}

export function Game({ session, onExit }: { session: Session; onExit: () => void }) {
  const [view, setView] = useState<RoomView | null>(null)
  const [error, setError] = useState('')

  const refresh = useCallback(async () => {
    try {
      setView(await api.view(session.roomCode, session.playerCode))
    } catch (e) {
      setError((e as Error).message)
    }
  }, [session])

  useEffect(() => {
    refresh()
    const timer = setInterval(refresh, 1000)
    return () => clearInterval(timer)
  }, [refresh])

  // Every mutation just pokes the server; the poll picks the new state up.
  const act = async (fn: () => Promise<unknown>) => {
    setError('')
    try {
      await fn()
      await refresh()
    } catch (e) {
      setError((e as Error).message)
    }
  }

  if (!view) {
    return (
      <div className="grid min-h-dvh place-items-center">
        <span className="stamped caret text-sm uppercase tracking-[0.2em] text-paper-3">
          Retrieving file
        </span>
      </div>
    )
  }

  const { round } = view
  const me = view.players.find((p) => p.player_code === session.playerCode)
  const others = view.players.filter((p) => p.player_code !== session.playerCode)
  const playerOf = (code?: string) => view.players.find((p) => p.player_code === code)

  // The transcript moves into a sticky right-hand column once there's room.
  const split = round?.phase === 'discussion'

  return (
    <div className={`mx-auto px-5 pb-24 pt-6 ${split ? 'max-w-6xl' : 'max-w-2xl'}`}>
      <div className="mb-5 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Badge name={me?.name ?? '??'} code={session.playerCode} />
          <div className="leading-tight">
            <div className={styles.fieldDark}>Officer</div>
            <div className="typed text-lg text-paper">{me?.name}</div>
          </div>
          <span className="ml-1 border border-paper-3/40 px-2 py-0.5 text-sm text-paper-2">
            {me?.score ?? 0} pts
          </span>
        </div>
        <button
          className="text-sm text-paper-3/70 underline underline-offset-4 hover:text-paper"
          onClick={onExit}
        >
          withdraw
        </button>
      </div>

      <div
        className={
          split ? 'lg:grid lg:grid-cols-[1fr_380px] lg:items-start lg:gap-6' : undefined
        }
      >
        <div className="flex flex-col gap-5">
          <Sheet tilt={-0.4}>
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className={styles.field}>Case file</div>
                <div className="stamped text-2xl leading-tight text-ink">
                  № {caseNumber(view.room_code)}
                </div>
              </div>
              <div className="text-right">
                <div className={styles.field}>Room</div>
                <RoomCode code={view.room_code} />
              </div>
            </div>

            <div className="rule my-3" />

            <div className="flex items-end justify-between gap-4">
              <div>
                <div className={styles.field}>Status</div>
                <div className="typed text-base uppercase tracking-[0.08em] text-ink">
                  {view.status === 'in_play'
                    ? round
                      ? phaseLabel(round.phase)
                      : 'In session'
                    : view.status === 'waiting'
                      ? 'Awaiting personnel'
                      : 'Closed'}
                </div>
              </div>
              <div className="text-right">
                <div className={styles.field}>Session</div>
                <div className="typed text-base text-ink">
                  {view.current_round || '—'} of {view.max_rounds}
                </div>
              </div>
            </div>

            {round && (
              <>
                <div className="rule my-3" />
                <CaseProgress phase={round.phase} />
              </>
            )}
          </Sheet>

          {others.length > 0 && (
            <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
              <span className={styles.fieldDark}>Also present</span>
              {others.map((p) => (
                <span key={p.player_code} className="flex items-center gap-2">
                  <Badge
                    name={p.name}
                    code={p.player_code}
                    size="sm"
                    flagged={round?.misfit_player_code === p.player_code}
                  />
                  <span className="text-paper-2">{p.name}</span>
                  <span className="typed text-sm text-paper-3">{p.score}</span>
                </span>
              ))}
            </div>
          )}

          {view.status === 'waiting' && (
            <Sheet tilt={0.4} className="text-center">
              <div className={styles.field}>Notice</div>
              <p className="typed mt-2 text-xl text-ink">Awaiting personnel</p>
              <p className="mt-2 text-ink-soft">
                {view.players.length < 2
                  ? 'Pass the case number to at least one other officer.'
                  : `${view.players.length} present. Proceed when ready.`}
              </p>
              <button
                className={`${styles.key} mt-4`}
                disabled={view.players.length < 2}
                onClick={() => act(() => api.start(view.room_code))}
              >
                Convene the session
              </button>
            </Sheet>
          )}

          {view.status === 'finished' && <Disposition view={view} me={me?.player_code} />}

          {round && (
            <>
              <QuestionSheet round={round} />

              {round.phase === 'answering' && (
                <Statement
                  view={view}
                  round={round}
                  onSubmit={(text) =>
                    act(() => api.answer(view.room_code, session.playerCode, text))
                  }
                />
              )}

              {round.answers.length > 0 && (
                <Sheet tilt={0.3}>
                  <div className={styles.field}>Statements on record</div>
                  <div className="rule my-3" />
                  <div className="stagger flex flex-col">
                    {round.answers.map((a) => {
                      const votes = round.tally?.[a.player_code] ?? 0
                      const flagged = round.misfit_player_code === a.player_code
                      return (
                        <div
                          key={a.player_code}
                          className={`flex items-center gap-3 border-b border-dashed border-ink-faint/40 py-3 last:border-0 ${
                            flagged ? 'bg-stamp/[0.08]' : ''
                          }`}
                        >
                          <Badge
                            name={a.name}
                            code={a.player_code}
                            size="sm"
                            flagged={flagged}
                          />
                          <div className="min-w-0 flex-1">
                            <div className={styles.field}>{a.name}</div>
                            <p className="text-ink">“{a.text}”</p>
                          </div>
                          {round.phase === 'voting' &&
                            a.player_code !== session.playerCode && (
                              <button
                                className={
                                  round.your_vote === a.player_code
                                    ? 'typed border-2 border-stamp px-3 py-2 text-sm uppercase tracking-[0.1em] text-stamp'
                                    : styles.key
                                }
                                disabled={round.you_voted}
                                onClick={() =>
                                  act(() =>
                                    api.vote(view.room_code, session.playerCode, a.player_code),
                                  )
                                }
                              >
                                {round.your_vote === a.player_code ? 'Accused' : 'Accuse'}
                              </button>
                            )}
                          {round.phase === 'results' && votes > 0 && (
                            <span className="typed shrink-0 text-sm uppercase tracking-[0.08em] text-stamp">
                              {votes} {votes === 1 ? 'vote' : 'votes'}
                            </span>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </Sheet>
              )}

              {round.phase === 'voting' && (
                <p className="text-center text-paper-3">
                  {round.voted_count} of {view.players.length} ballots cast
                </p>
              )}

              {round.phase === 'results' && (
                <Verdict view={view} round={round} playerOf={playerOf} />
              )}
            </>
          )}

          {error && (
            <p className="border-l-4 border-stamp bg-stamp/15 px-3 py-2 text-paper">⚠ {error}</p>
          )}
        </div>

        {split && round && (
          <aside className="mt-5 lg:sticky lg:top-6 lg:mt-0">
            <Transcript
              messages={round.chat}
              me={session.playerCode}
              onSend={(text) => act(() => api.chat(view.room_code, session.playerCode, text))}
            />
          </aside>
        )}
      </div>

      <footer className="fixed inset-x-0 bottom-0 border-t border-paper-3/20 bg-desk/95 backdrop-blur">
        <div
          className={`mx-auto flex items-center gap-3 px-5 py-3 ${split ? 'max-w-6xl' : 'max-w-2xl'}`}
        >
          <span className={styles.fieldDark}>Clerk</span>
          <button className={styles.keyDark} onClick={() => act(() => api.advance(view.room_code))}>
            Next phase
          </button>
          <button
            className={styles.keyDark}
            onClick={() => act(() => api.nextRound(view.room_code))}
          >
            Next session
          </button>
        </div>
      </footer>
    </div>
  )
}

function RoomCode({ code }: { code: string }) {
  const [copied, setCopied] = useState(false)

  return (
    <button
      className="typed text-base text-pen underline decoration-dotted underline-offset-4"
      onClick={() => {
        navigator.clipboard?.writeText(code)
        setCopied(true)
        setTimeout(() => setCopied(false), 1200)
      }}
    >
      {copied ? 'copied' : code}
    </button>
  )
}

function QuestionSheet({ round }: { round: Round }) {
  const disclosed = round.question !== null
  const youAreTheMisfit = disclosed && round.your_question !== round.question

  return (
    <div className="flex flex-col gap-4">
      <Sheet tilt={-0.5} key={round.question ?? round.your_question}>
        <div className={styles.field}>
          {disclosed ? 'The question put to the room' : 'Your assigned question'}
        </div>
        <blockquote className="typed mt-3 text-balance text-2xl leading-relaxed text-ink">
          “{disclosed ? round.question : round.your_question}”
        </blockquote>
      </Sheet>

      {youAreTheMisfit && (
        <Sheet tilt={0.8} className="border-2 border-stamp/40">
          <div className="flex items-start justify-between gap-3">
            <div className={styles.field}>Internal memorandum</div>
            <Stamp slam>Classified</Stamp>
          </div>
          <div className="rule my-3" />
          <p className="typed text-xl text-ink">You were handed a different document.</p>
          <p className="mt-2 text-ink-soft">Yours read: “{round.your_question}”</p>
          <p className="mt-3 text-ink-soft">
            <span className="redacted px-1">Nobody else knows this.</span> Do not let on.
          </p>
        </Sheet>
      )}
    </div>
  )
}

function Statement({
  view,
  round,
  onSubmit,
}: {
  view: RoomView
  round: Round
  onSubmit: (text: string) => void
}) {
  const [text, setText] = useState('')

  if (round.you_answered) {
    return (
      <Sheet tilt={0.3} className="text-center">
        <Stamp tone="pen">On record</Stamp>
        <p className="mt-4 text-ink-soft">
          {round.answered_count} of {view.players.length} statements taken.
          {round.answered_count < view.players.length && (
            <span className="caret"> awaiting the rest</span>
          )}
        </p>
      </Sheet>
    )
  }

  return (
    <Sheet tilt={0.3}>
      <div className={styles.field}>Your statement</div>
      <div className="mt-1 flex items-end gap-3">
        <input
          className={styles.input}
          value={text}
          maxLength={100}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && text.trim() && onSubmit(text)}
          placeholder="answer in a few words"
          autoFocus
        />
        <button className={styles.key} disabled={!text.trim()} onClick={() => onSubmit(text)}>
          Sign
        </button>
      </div>
      <p className="mt-3 text-sm text-ink-faint">Once signed it cannot be withdrawn.</p>
    </Sheet>
  )
}

function Transcript({
  messages,
  me,
  onSend,
}: {
  messages: ChatMessage[]
  me: string
  onSend: (text: string) => void
}) {
  const [text, setText] = useState('')
  const endRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages.length])

  const send = () => {
    if (!text.trim()) return
    onSend(text)
    setText('')
  }

  return (
    <Sheet tilt={-0.3}>
      <div className={styles.field}>Transcript</div>
      <div className="rule my-3" />

      <div className="flex max-h-64 flex-col gap-2 overflow-y-auto pr-1 lg:max-h-[calc(100dvh-19rem)]">
        {messages.length === 0 && (
          <p className="py-3 italic text-ink-faint">The room is silent. Somebody has to start.</p>
        )}
        {messages.map((m, i) => (
          <div key={i} className="text-base">
            <span
              className={`typed uppercase tracking-[0.06em] ${
                m.player_code === me ? 'text-stamp' : 'text-ink-soft'
              }`}
            >
              {m.name}:
            </span>{' '}
            <span className="text-ink">{m.text}</span>
          </div>
        ))}
        <div ref={endRef} />
      </div>

      <div className="mt-4 flex items-end gap-3">
        <input
          className={styles.input}
          value={text}
          maxLength={200}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && send()}
          placeholder="state your suspicion"
        />
        <button className={styles.key} onClick={send}>
          Enter
        </button>
      </div>
    </Sheet>
  )
}

function Verdict({
  view,
  round,
  playerOf,
}: {
  view: RoomView
  round: Round
  playerOf: (code?: string) => RoomView['players'][number] | undefined
}) {
  const misfit = playerOf(round.misfit_player_code)
  const deltas = Object.entries(round.score_deltas ?? {})

  return (
    <Sheet tilt={-0.7}>
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className={styles.field}>Finding of the room</div>
          <p className="typed mt-2 text-3xl text-ink">
            {round.caught ? 'Apprehended' : 'At large'}
          </p>
        </div>
        <Stamp tone={round.caught ? 'verdict' : 'stamp'} slam>
          {round.caught ? 'Closed' : 'Unsolved'}
        </Stamp>
      </div>

      <div className="rule my-4" />

      <div className="flex items-center gap-4">
        {misfit && <Badge name={misfit.name} code={misfit.player_code} size="lg" flagged />}
        <div>
          <div className={styles.field}>The misfit</div>
          <p className="typed text-2xl text-ink">
            {misfit?.name}
            {round.you_were_misfit && <span className="text-stamp"> — that was you</span>}
          </p>
        </div>
      </div>

      {deltas.length > 0 && (
        <>
          <div className="rule my-4" />
          <div className={styles.field}>Commendations</div>
          <div className="mt-2 flex flex-col gap-1">
            {deltas.map(([code, points]) => (
              <div key={code} className="flex items-baseline gap-3">
                <span className="text-ink">{playerOf(code)?.name}</span>
                <span className="flex-1 border-b border-dotted border-ink-faint" />
                <span className="typed text-verdict">+{points}</span>
              </div>
            ))}
          </div>
        </>
      )}

      {view.current_round >= view.max_rounds && (
        <p className="mt-4 text-sm italic text-ink-faint">
          Final session. File closes on the next advance.
        </p>
      )}
    </Sheet>
  )
}

function Disposition({ view, me }: { view: RoomView; me?: string }) {
  const ranked = [...view.players].sort((a, b) => b.score - a.score)

  return (
    <Sheet tilt={0.4} className="torn">
      <div className="flex items-start justify-between">
        <div className={styles.field}>Final disposition</div>
        <Stamp tone="verdict" slam>
          Case closed
        </Stamp>
      </div>
      <div className="rule my-4" />
      {ranked.map((p, i) => (
        <div
          key={p.player_code}
          className="flex items-baseline gap-3 border-b border-dashed border-ink-faint/40 py-2 last:border-0"
        >
          <span className="typed w-6 text-ink-faint">{i + 1}.</span>
          <span className={`${i === 0 ? 'typed' : ''} text-ink`}>
            {p.name}
            {p.player_code === me && <span className="text-ink-faint"> (you)</span>}
          </span>
          <span className="flex-1 border-b border-dotted border-ink-faint/60" />
          <span className="typed text-ink">{p.score}</span>
        </div>
      ))}
    </Sheet>
  )
}
