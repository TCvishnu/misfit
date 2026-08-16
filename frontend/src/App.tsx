import { useCallback, useEffect, useState } from 'react'
import { api, type ChatMessage, type RoomView } from './api'

// sessionStorage is per-tab, so each browser tab is naturally its own player.
type Session = { roomCode: string; playerCode: string }

const input =
  'w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-zinc-100 placeholder-zinc-600 outline-none focus:border-indigo-500'
const button =
  'rounded-lg bg-indigo-600 px-4 py-2 font-medium text-white hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-40'
const ghost =
  'rounded-lg border border-zinc-700 px-3 py-1.5 text-sm text-zinc-400 hover:border-zinc-500 hover:text-zinc-200'
const label = 'text-xs uppercase tracking-widest text-zinc-500'
const card = 'rounded-xl border border-zinc-800 bg-zinc-900/60 p-4'

function loadSession(): Session | null {
  const roomCode = sessionStorage.getItem('roomCode')
  const playerCode = sessionStorage.getItem('playerCode')
  return roomCode && playerCode ? { roomCode, playerCode } : null
}

export default function App() {
  const [session, setSession] = useState<Session | null>(loadSession)

  const enter = (next: Session) => {
    sessionStorage.setItem('roomCode', next.roomCode)
    sessionStorage.setItem('playerCode', next.playerCode)
    setSession(next)
  }

  const exit = () => {
    sessionStorage.clear()
    setSession(null)
  }

  return session ? <Game session={session} onExit={exit} /> : <Home onEnter={enter} />
}

function Home({ onEnter }: { onEnter: (session: Session) => void }) {
  const [name, setName] = useState('')
  const [code, setCode] = useState('')
  const [error, setError] = useState('')

  const join = async (roomCode: string) => {
    try {
      const { player_code } = await api.join(roomCode.trim(), name.trim())
      onEnter({ roomCode: roomCode.trim(), playerCode: player_code })
    } catch (e) {
      setError((e as Error).message)
    }
  }

  const createAndJoin = async () => {
    try {
      const { room_code } = await api.createRoom()
      await join(room_code)
    } catch (e) {
      setError((e as Error).message)
    }
  }

  const ready = name.trim().length > 0

  return (
    <div className="mx-auto flex max-w-md flex-col gap-4 px-5 py-12">
      <div>
        <h1 className="text-2xl font-semibold">Misfit</h1>
        <p className="text-sm text-zinc-500">
          One of you got a different question. Nobody knows who.
        </p>
      </div>

      <div className="flex flex-col gap-1.5">
        <span className={label}>Your name</span>
        <input
          className={input}
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Vishnu"
        />
      </div>

      <button className={button} disabled={!ready} onClick={createAndJoin}>
        Create a room
      </button>

      <div className="text-center text-sm text-zinc-600">or</div>

      <div className="flex flex-col gap-1.5">
        <span className={label}>Room code</span>
        <input
          className={input}
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder="panda-004217"
        />
      </div>

      <button className={button} disabled={!ready || !code.trim()} onClick={() => join(code)}>
        Join room
      </button>

      {error && <p className="text-sm text-rose-400">{error}</p>}
    </div>
  )
}

function Game({ session, onExit }: { session: Session; onExit: () => void }) {
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
    try {
      setError('')
      await fn()
      await refresh()
    } catch (e) {
      setError((e as Error).message)
    }
  }

  if (!view) return <div className="p-12 text-center text-zinc-500">Loading…</div>

  const { round } = view
  const nameOf = (code?: string) =>
    view.players.find((p) => p.player_code === code)?.name ?? '—'

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-4 px-5 py-8">
      <header className="flex items-start justify-between border-b border-zinc-800 pb-3">
        <div>
          <h1 className="text-xl font-semibold">Misfit</h1>
          <code className="text-sm text-indigo-400">{view.room_code}</code>
        </div>
        <div className="text-right">
          <div className="text-sm text-zinc-500">
            {view.status === 'in_play'
              ? `Round ${view.current_round}/${view.max_rounds} · ${round?.phase}`
              : view.status}
          </div>
          <button className="text-xs text-zinc-600 underline" onClick={onExit}>
            leave
          </button>
        </div>
      </header>

      <div className="flex flex-wrap gap-2">
        {view.players.map((p) => (
          <span
            key={p.player_code}
            className={`rounded-full border px-3 py-1 text-sm ${
              p.player_code === session.playerCode
                ? 'border-indigo-500 text-zinc-100'
                : 'border-zinc-800 text-zinc-400'
            }`}
          >
            {p.name} · {p.score}
            {round?.misfit_player_code === p.player_code && ' 🎭'}
          </span>
        ))}
      </div>

      {view.status === 'waiting' && (
        <div className={`${card} flex items-center justify-between`}>
          <span className="text-sm text-zinc-500">Waiting for players — share the code.</span>
          <button className={button} onClick={() => act(() => api.start(view.room_code))}>
            Start game
          </button>
        </div>
      )}

      {view.status === 'finished' && (
        <h2 className="text-center text-2xl font-semibold">Game over</h2>
      )}

      {round && (
        <>
          <div className={card}>
            {round.question ? (
              <>
                <div className={label}>The real question was</div>
                <h2 className="mt-1 text-lg font-medium">{round.question}</h2>
                {round.your_question !== round.question && (
                  <p className="mt-2 text-sm text-amber-400">
                    You were asked: “{round.your_question}” 🎭
                  </p>
                )}
              </>
            ) : (
              <>
                <div className={label}>Your question</div>
                <h2 className="mt-1 text-lg font-medium">{round.your_question}</h2>
              </>
            )}
          </div>

          {round.phase === 'answering' && (
            <Answering
              answered={round.you_answered}
              count={round.answered_count}
              total={view.players.length}
              onSubmit={(text) =>
                act(() => api.answer(view.room_code, session.playerCode, text))
              }
            />
          )}

          {round.answers.length > 0 && (
            <div className="flex flex-col gap-2">
              {round.answers.map((a) => (
                <div
                  key={a.player_code}
                  className="flex items-center gap-3 rounded-lg border border-zinc-800 bg-zinc-900/60 px-4 py-2.5"
                >
                  <strong className="w-24 shrink-0 truncate text-sm">{a.name}</strong>
                  <span className="flex-1">{a.text}</span>
                  {round.phase === 'voting' && a.player_code !== session.playerCode && (
                    <button
                      className={ghost}
                      disabled={round.you_voted}
                      onClick={() =>
                        act(() => api.vote(view.room_code, session.playerCode, a.player_code))
                      }
                    >
                      {round.your_vote === a.player_code ? 'voted' : 'accuse'}
                    </button>
                  )}
                  {round.phase === 'results' && round.tally?.[a.player_code] && (
                    <span className="shrink-0 text-sm text-zinc-500">
                      {round.tally[a.player_code]} votes
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}

          {round.phase === 'discussion' && (
            <Chat
              messages={round.chat}
              onSend={(text) => act(() => api.chat(view.room_code, session.playerCode, text))}
            />
          )}

          {round.phase === 'voting' && (
            <p className="text-sm text-zinc-500">
              {round.voted_count} of {view.players.length} voted
            </p>
          )}

          {round.phase === 'results' && (
            <div className={card}>
              <h3 className="text-lg font-semibold">
                {round.caught ? 'The misfit was caught 🎉' : 'The misfit escaped 🎭'}
              </h3>
              <p className="mt-1 text-zinc-300">
                It was <strong>{nameOf(round.misfit_player_code)}</strong>
                {round.you_were_misfit && ' — that was you'}
              </p>
              <div className="mt-3 flex flex-col gap-0.5 text-sm text-zinc-400">
                {Object.entries(round.score_deltas ?? {}).map(([code, points]) => (
                  <div key={code}>
                    {nameOf(code)} <span className="text-emerald-400">+{points}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      <footer className="mt-2 flex items-center gap-2 border-t border-dashed border-zinc-800 pt-4">
        <span className={label}>dev controls</span>
        <button className={ghost} onClick={() => act(() => api.advance(view.room_code))}>
          advance phase →
        </button>
        <button className={ghost} onClick={() => act(() => api.nextRound(view.room_code))}>
          next round →
        </button>
      </footer>

      {error && <p className="text-sm text-rose-400">{error}</p>}
    </div>
  )
}

function Answering({
  answered,
  count,
  total,
  onSubmit,
}: {
  answered: boolean
  count: number
  total: number
  onSubmit: (text: string) => void
}) {
  const [text, setText] = useState('')

  if (answered) {
    return (
      <p className="text-sm text-zinc-500">
        Answer locked in. {count} of {total} answered.
      </p>
    )
  }

  return (
    <div className="flex gap-2">
      <input
        className={input}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && text.trim() && onSubmit(text)}
        placeholder="Your answer…"
        autoFocus
      />
      <button className={button} disabled={!text.trim()} onClick={() => onSubmit(text)}>
        Submit
      </button>
    </div>
  )
}

function Chat({
  messages,
  onSend,
}: {
  messages: ChatMessage[]
  onSend: (text: string) => void
}) {
  const [text, setText] = useState('')

  const send = () => {
    if (!text.trim()) return
    onSend(text)
    setText('')
  }

  return (
    <div className={card}>
      <div className="mb-3 flex max-h-52 flex-col gap-1 overflow-y-auto text-sm">
        {messages.length === 0 && <span className="text-zinc-600">No messages yet.</span>}
        {messages.map((m, i) => (
          <div key={i}>
            <strong className="text-zinc-300">{m.name}</strong>{' '}
            <span className="text-zinc-400">{m.text}</span>
          </div>
        ))}
      </div>
      <div className="flex gap-2">
        <input
          className={input}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && send()}
          placeholder="Accuse someone…"
        />
        <button className={button} onClick={send}>
          Send
        </button>
      </div>
    </div>
  )
}
