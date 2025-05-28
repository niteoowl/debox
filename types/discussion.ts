export type DiscussionType = "pros-cons" | "free" | "one-on-one"

export type DiscussionStatus = "waiting" | "active" | "ended"

export type ParticipantRole = "pros" | "cons" | "participant" | "observer"

export interface Discussion {
  id: string
  title: string
  description: string
  type: DiscussionType
  status: DiscussionStatus
  createdBy: string
  createdAt: Date
  endedAt?: Date
  allowObservers: boolean
  maxParticipants?: number
  timeLimit?: number // 분 단위
  category: string
  participants: Participant[]
  observers: string[]
  finalVotes?: FinalVote[]
  winner?: "pros" | "cons" | "draw"
}

export interface Participant {
  userId: string
  username: string
  role: ParticipantRole
  joinedAt: Date
}

export interface Message {
  id: string
  discussionId: string
  userId: string
  username: string
  content: string
  timestamp: Date
  role: ParticipantRole
  messageType: "argument" | "rebuttal" | "comment"
  replyTo?: string
}

export interface FinalVote {
  userId: string
  vote: "pros" | "cons" | "draw"
  timestamp: Date
}

export interface User {
  uid: string
  email: string
  username: string
  createdAt: Date
}
