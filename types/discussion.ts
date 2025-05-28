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
  currentPhase: DebatePhase
  createdBy: string
  createdAt: Date
  startedAt?: Date
  endedAt?: Date
  allowObservers: boolean
  maxParticipants?: number
  timeLimit?: number // 전체 토론 시간 제한
  phaseTimeLimit: number // 각 단계별 시간 제한 (분)
  category: string
  participants: Participant[]
  observers: string[]
  finalVotes?: FinalVote[]
  winner?: "pros" | "cons" | "draw"
  phaseStartTime?: Date
  phaseMessages: { [key in DebatePhase]?: string[] } // 각 단계별 메시지 ID 저장
}

export interface Participant {
  userId: string
  username: string
  role: ParticipantRole
  joinedAt: Date
  isTeamLeader?: boolean // 팀 대표 (입론, 최종변론 담당)
}

export interface Message {
  id: string
  discussionId: string
  userId: string
  username: string
  content: string
  timestamp: Date
  role: ParticipantRole
  phase: DebatePhase
  messageType: "opening" | "strategy" | "rebuttal" | "closing" | "comment"
  replyTo?: string
  likes?: number
  likedBy?: string[]
}

export interface FinalVote {
  userId: string
  vote: "pros" | "cons" | "draw"
  timestamp: Date
  reasoning?: string // 투표 이유
}

export interface User {
  uid: string
  email: string
  username: string
  createdAt: Date
}
