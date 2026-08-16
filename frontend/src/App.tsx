import { useState } from 'react'
import { Home, type Session } from './Home'
import { Game } from './Game'

// sessionStorage is per-tab, so each browser tab is naturally its own player.
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
