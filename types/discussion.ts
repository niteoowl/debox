export type DiscussionType = "pros-cons" | "free" | "one-on-one"

export type DiscussionStatus = "waiting" | "active" | "ended"

export type DebatePhase =
  | "waiting" // 대기중
  | "opening_pros" // 찬성 입론
  | "opening_cons" // 반대 입론
  | "strategy_pros" // 찬성 작전타임
  | "strategy_cons" // 반대 작전타임
  | "rebuttal_pros" // 찬성 반론
  | "rebuttal_cons" // 반대 반론
  | "closing_pros" // 찬성 최종변론
  | "closing_cons" // 반대 최종변론
  | "voting" // 참관자 투표
  | "ended" // 종료

export type ParticipantRole = "pros" | "cons" | "participant" | "observer"

export interface Discussion {
  id: string
  title: string
  description: string
  type: DiscussionType
  status: DiscussionStatus
  currentPhase?: DebatePhase // 기존 데이터 호환을 위해 optional
  createdBy: string
  createdAt: Date
  startedAt?: Date
  endedAt?: Date
  allowObservers: boolean
  maxParticipants?: number
  timeLimit?: number // 전체 토론 시간 제한 (기존 필드)
  phaseTimeLimit?: number // 각 단계별 시간 제한 (새 필드, optional)
  category: string
  participants: Participant[]
  observers: string[]
  finalVotes?: FinalVote[]
  winner?: "pros" | "cons" | "draw"
  phaseStartTime?: Date
  phaseMessages?: { [key in DebatePhase]?: string[] } // optional
}

export interface Participant {
  userId: string
  username: string
  role: ParticipantRole
  joinedAt: Date
  isTeamLeader?: boolean // optional for backward compatibility
}

export interface Message {
  id: string
  discussionId: string
  userId: string
  username: string
  content: string
  timestamp: Date
  role: ParticipantRole
  phase?: DebatePhase // optional for backward compatibility
  messageType: "argument" | "rebuttal" | "comment" | "opening" | "strategy" | "closing"
  replyTo?: string
  likes?: number
  likedBy?: string[]
}

export interface FinalVote {
  userId: string
  vote: "pros" | "cons" | "draw"
  timestamp: Date
  reasoning?: string
}

export interface User {
  uid: string
  email: string
  username: string
  createdAt: Date
}
