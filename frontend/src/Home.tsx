import { useState } from 'react'
import { api } from './api'
import { Sheet, Stamp, styles } from './ui'

export type Session = { roomCode: string; playerCode: string }

export function Home({ onEnter }: { onEnter: (session: Session) => void }) {
  const [name, setName] = useState('')
  const [code, setCode] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const run = async (fn: () => Promise<void>) => {
    setBusy(true)
    setError('')
    try {
      await fn()
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  const join = (roomCode: string) =>
    run(async () => {
      const { player_code } = await api.join(roomCode.trim(), name.trim())
      onEnter({ roomCode: roomCode.trim(), playerCode: player_code })
    })

  const open = () =>
    run(async () => {
      const { room_code } = await api.createRoom()
      const { player_code } = await api.join(room_code, name.trim())
      onEnter({ roomCode: room_code, playerCode: player_code })
    })

  const ready = name.trim().length > 0 && !busy

  return (
    <div className="mx-auto flex min-h-dvh max-w-lg flex-col justify-center gap-6 px-5 py-12">
      <Sheet tilt={-0.6} className="torn">
        <div className="flex items-start justify-between">
          <div>
            <div className={styles.field}>Department of Internal Affairs</div>
            <h1 className="typed mt-2 text-4xl leading-none tracking-tight text-ink">MISFIT</h1>
          </div>
          <Stamp>Confidential</Stamp>
        </div>

        <div className="rule my-4" />

        <p className="text-ink-soft">
          Everyone in the room is asked the same question.
          <br />
          One person is asked something else — and doesn't know it yet.
        </p>
        <p className="mt-3 text-sm italic text-ink-faint">
          Find them before they talk their way out.
        </p>
      </Sheet>

      <Sheet tilt={0.5} className="stagger">
        <div>
          <div className={styles.field}>Name of officer</div>
          <input
            className={styles.input}
            value={name}
            maxLength={16}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && ready && open()}
            placeholder="last name"
            autoFocus
          />
        </div>

        <button className={`${styles.key} mt-5 w-full py-3`} disabled={!ready} onClick={open}>
          Open a new case
        </button>

        <div className="my-5 flex items-center gap-3">
          <span className="rule flex-1" />
          <span className={styles.field}>or report to an existing one</span>
          <span className="rule flex-1" />
        </div>

        <div>
          <div className={styles.field}>Case file no.</div>
          <div className="flex items-end gap-3">
            <input
              className={styles.input}
              value={code}
              onChange={(e) => setCode(e.target.value.toLowerCase())}
              onKeyDown={(e) => e.key === 'Enter' && ready && code.trim() && join(code)}
              placeholder="panda-004217"
            />
            <button
              className={styles.key}
              disabled={!ready || !code.trim()}
              onClick={() => join(code)}
            >
              Report
            </button>
          </div>
        </div>

        {error && <p className="mt-4 text-sm text-stamp">⚠ {error}</p>}
      </Sheet>

      <p className="text-center text-xs text-paper-3/50">
        Open several tabs to sit in as different officers.
      </p>
    </div>
  )
}
