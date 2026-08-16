// THROWAWAY dev harness client. Replace with a Phoenix channel.

export type Phase =
  | 'answering'
  | 'reveal_main_question'
  | 'discussion'
  | 'voting'
  | 'results'

export type PlayerView = {
  player_code: string
  name: string
  score: number
}

export type ChatMessage = {
  player_code: string
  name: string
  text: string
  at: string
}

export type AnswerView = {
  player_code: string
  name: string
  text: string
}

export type RoundView = {
  number: number
  phase: Phase
  your_question: string
  question: string | null
  you_answered: boolean
  you_voted: boolean
  your_vote: string | null
  answered_count: number
  voted_count: number
  answers: AnswerView[]
  chat: ChatMessage[]
  // Only present at :results
  misfit_player_code?: string
  you_were_misfit?: boolean
  tally?: Record<string, number>
  accused?: string[]
  caught?: boolean
  score_deltas?: Record<string, number>
}

export type RoomView = {
  room_code: string
  status: 'waiting' | 'in_play' | 'finished'
  current_round: number
  max_rounds: number
  players: PlayerView[]
  round: RoundView | null
}

async function request<T>(path: string, body?: unknown): Promise<T> {
  const response = await fetch(`/api${path}`, {
    method: body === undefined ? 'GET' : 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  })

  const payload = await response.json()
  if (!response.ok) throw new Error(payload.error ?? 'request failed')
  return payload as T
}

export const api = {
  createRoom: () => request<{ room_code: string }>('/rooms', {}),

  join: (code: string, name: string) =>
    request<{ player_code: string; name: string }>(`/rooms/${code}/join`, { name }),

  view: (code: string, playerCode: string) =>
    request<RoomView>(`/rooms/${code}?player_code=${encodeURIComponent(playerCode)}`),

  start: (code: string) => request(`/rooms/${code}/start`, {}),
  advance: (code: string) => request(`/rooms/${code}/advance`, {}),
  nextRound: (code: string) => request(`/rooms/${code}/next_round`, {}),

  answer: (code: string, playerCode: string, text: string) =>
    request(`/rooms/${code}/answer`, { player_code: playerCode, text }),

  chat: (code: string, playerCode: string, text: string) =>
    request(`/rooms/${code}/chat`, { player_code: playerCode, text }),

  vote: (code: string, playerCode: string, accused: string) =>
    request(`/rooms/${code}/vote`, { player_code: playerCode, accused }),
}
