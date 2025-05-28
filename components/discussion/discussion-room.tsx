"use client"

import { useState, useEffect } from "react"
import type { User } from "firebase/auth"
import { doc, updateDoc, arrayUnion, collection, addDoc, serverTimestamp } from "firebase/firestore"
import { db } from "@/lib/firebase"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Progress } from "@/components/ui/progress"
import { useToast } from "@/hooks/use-toast"
import {
  Users,
  Eye,
  Clock,
  Send,
  ThumbsUp,
  ThumbsDown,
  Play,
  Square,
  MessageSquare,
  Crown,
  AlertCircle,
  ArrowRight,
  Users2,
  Gavel,
  Target,
  Shield,
} from "lucide-react"
import type { Discussion, Message, ParticipantRole, DebatePhase } from "@/types/discussion"
import Link from "next/link"

interface DiscussionRoomProps {
  discussion: Discussion
  messages: Message[]
  currentUser: User | null
}

// 토론 단계 정보
const PHASE_INFO = {
  waiting: { name: "대기중", icon: Clock, color: "bg-gray-500", description: "참여자를 기다리고 있습니다" },
  opening_pros: { name: "찬성 입론", icon: Target, color: "bg-green-600", description: "찬성 측이 주장을 제시합니다" },
  opening_cons: { name: "반대 입론", icon: Target, color: "bg-red-600", description: "반대 측이 주장을 제시합니다" },
  strategy_pros: { name: "찬성 작전타임", icon: Users2, color: "bg-green-500", description: "찬성 팀 내부 토론 시간" },
  strategy_cons: { name: "반대 작전타임", icon: Users2, color: "bg-red-500", description: "반대 팀 내부 토론 시간" },
  rebuttal_pros: {
    name: "찬성 반론",
    icon: Shield,
    color: "bg-green-700",
    description: "찬성 측이 반대 주장에 반박합니다",
  },
  rebuttal_cons: {
    name: "반대 반론",
    icon: Shield,
    color: "bg-red-700",
    description: "반대 측이 찬성 주장에 반박합니다",
  },
  closing_pros: { name: "찬성 최종변론", icon: Gavel, color: "bg-green-800", description: "찬성 측 최종 주장" },
  closing_cons: { name: "반대 최종변론", icon: Gavel, color: "bg-red-800", description: "반대 측 최종 주장" },
  voting: { name: "참관자 투표", icon: ThumbsUp, color: "bg-blue-600", description: "참관자들이 승부를 결정합니다" },
  ended: { name: "토론 종료", icon: Square, color: "bg-gray-600", description: "토론이 완료되었습니다" },
}

export default function DiscussionRoom({ discussion, messages, currentUser }: DiscussionRoomProps) {
  const [newMessage, setNewMessage] = useState("")
  const [finalVote, setFinalVote] = useState<"pros" | "cons" | "draw" | null>(null)
  const [voteReasoning, setVoteReasoning] = useState("")
  const [phaseTimeRemaining, setPhaseTimeRemaining] = useState<number | null>(null)
  const [isTyping, setIsTyping] = useState(false)
  const { toast } = useToast()

  // 기본값 설정 (기존 데이터 호환성)
  const currentPhase = discussion.currentPhase || "waiting"
  const phaseTimeLimit = discussion.phaseTimeLimit || 5 // 기본 5분
  const isStructuredDebate = discussion.type === "pros-cons" && discussion.currentPhase // 체계적 토론 여부

  // 단계별 타이머 (체계적 토론일 때만)
  useEffect(() => {
    if (isStructuredDebate && currentPhase !== "waiting" && currentPhase !== "ended" && discussion.phaseStartTime) {
      const phaseStartTime = discussion.phaseStartTime.getTime()
      const phaseDuration = phaseTimeLimit * 60 * 1000
      const phaseEndTime = phaseStartTime + phaseDuration

      const timer = setInterval(() => {
        const now = Date.now()
        const remaining = Math.max(0, phaseEndTime - now)
        setPhaseTimeRemaining(remaining)

        if (remaining === 0 && currentPhase !== "ended") {
          handleNextPhase()
        }
      }, 1000)

      return () => clearInterval(timer)
    }
  }, [currentPhase, discussion.phaseStartTime, phaseTimeLimit, isStructuredDebate])

  // 로그인하지 않은 사용자 처리
  if (!currentUser) {
    return <GuestView discussion={discussion} messages={messages} />
  }

  const currentParticipant = discussion.participants.find((p) => p.userId === currentUser.uid)
  const isObserver = discussion.observers.includes(currentUser.uid)
  const isParticipant = !!currentParticipant
  const isCreator = discussion.createdBy === currentUser.uid
  const canJoin = !isParticipant && !isObserver && discussion.status === "waiting"
  const canObserve = !isParticipant && !isObserver && discussion.allowObservers

  // 현재 단계에서 메시지를 보낼 수 있는지 확인
  const canSendMessage = () => {
    if (!isParticipant || discussion.status !== "active") return false

    // 체계적 토론이 아닌 경우 (기존 방식)
    if (!isStructuredDebate) {
      return true
    }

    const userRole = currentParticipant?.role
    const phase = currentPhase

    // 작전타임은 해당 팀만 참여 가능
    if (phase === "strategy_pros" && userRole === "pros") return true
    if (phase === "strategy_cons" && userRole === "cons") return true

    // 입론과 최종변론은 팀 리더만 가능
    if (
      (phase === "opening_pros" || phase === "closing_pros") &&
      userRole === "pros" &&
      currentParticipant?.isTeamLeader
    )
      return true
    if (
      (phase === "opening_cons" || phase === "closing_cons") &&
      userRole === "cons" &&
      currentParticipant?.isTeamLeader
    )
      return true

    // 반론은 해당 팀 모든 구성원 가능
    if (phase === "rebuttal_pros" && userRole === "pros") return true
    if (phase === "rebuttal_cons" && userRole === "cons") return true

    return false
  }

  const handleStartDiscussion = async () => {
    if (!isCreator || discussion.status !== "waiting") return

    // 최소 참여자 확인
    const prosCount = discussion.participants.filter((p) => p.role === "pros").length
    const consCount = discussion.participants.filter((p) => p.role === "cons").length

    if (discussion.type === "pros-cons" && (prosCount === 0 || consCount === 0)) {
      toast({
        title: "토론을 시작할 수 없습니다",
        description: "찬성과 반대 측에 각각 최소 1명의 참여자가 필요합니다.",
        variant: "destructive",
      })
      return
    }

    if (discussion.participants.length === 0) {
      toast({
        title: "토론을 시작할 수 없습니다",
        description: "최소 1명의 참여자가 필요합니다.",
        variant: "destructive",
      })
      return
    }

    try {
      const updateData: any = {
        status: "active",
        startedAt: serverTimestamp(),
      }

      // 체계적 토론인 경우에만 단계 설정
      if (discussion.type === "pros-cons") {
        updateData.currentPhase = "opening_pros"
        updateData.phaseStartTime = serverTimestamp()
        updateData.phaseTimeLimit = phaseTimeLimit
      }

      await updateDoc(doc(db, "discussions", discussion.id), updateData)

      toast({
        title: "토론이 시작되었습니다!",
        description: discussion.type === "pros-cons" ? "찬성 측 입론부터 시작합니다." : "자유롭게 토론해보세요.",
      })
    } catch (error) {
      console.error("Error starting discussion:", error)
      toast({
        title: "토론 시작 실패",
        description: "다시 시도해주세요.",
        variant: "destructive",
      })
    }
  }

  const handleNextPhase = async () => {
    if (!isCreator || !isStructuredDebate) return

    const phaseOrder: DebatePhase[] = [
      "opening_pros",
      "opening_cons",
      "strategy_pros",
      "strategy_cons",
      "rebuttal_pros",
      "rebuttal_cons",
      "closing_pros",
      "closing_cons",
      "voting",
      "ended",
    ]

    const currentIndex = phaseOrder.indexOf(currentPhase)
    const nextPhase = phaseOrder[currentIndex + 1]

    if (!nextPhase) return

    try {
      const updateData: any = {
        currentPhase: nextPhase,
        phaseStartTime: serverTimestamp(),
      }

      if (nextPhase === "ended") {
        updateData.status = "ended"
        updateData.endedAt = serverTimestamp()
      }

      await updateDoc(doc(db, "discussions", discussion.id), updateData)

      const phaseInfo = PHASE_INFO[nextPhase]
      toast({
        title: `${phaseInfo.name} 단계로 진행`,
        description: phaseInfo.description,
      })
    } catch (error) {
      console.error("Error moving to next phase:", error)
      toast({
        title: "단계 진행 실패",
        description: "다시 시도해주세요.",
        variant: "destructive",
      })
    }
  }

  const handleJoinDiscussion = async (role: ParticipantRole) => {
    try {
      // 팀 리더 여부 결정 (각 팀의 첫 번째 참여자가 리더)
      const teamMembers = discussion.participants.filter((p) => p.role === role)
      const isTeamLeader = teamMembers.length === 0

      const participant = {
        userId: currentUser.uid,
        username: currentUser.email?.split("@")[0] || "Anonymous",
        role,
        joinedAt: serverTimestamp(),
        isTeamLeader,
      }

      await updateDoc(doc(db, "discussions", discussion.id), {
        participants: arrayUnion(participant),
      })

      toast({
        title: "토론에 참여했습니다!",
        description: `${role === "pros" ? "찬성" : role === "cons" ? "반대" : "참여자"} ${
          isTeamLeader ? "팀 리더" : "팀원"
        }로 참여합니다.`,
      })
    } catch (error) {
      console.error("Error joining discussion:", error)
      toast({
        title: "참여 실패",
        description: "다시 시도해주세요.",
        variant: "destructive",
      })
    }
  }

  const handleJoinAsObserver = async () => {
    try {
      await updateDoc(doc(db, "discussions", discussion.id), {
        observers: arrayUnion(currentUser.uid),
      })

      toast({
        title: "참관자로 참여했습니다!",
        description: "토론을 관찰하고 마지막에 투표할 수 있습니다.",
      })
    } catch (error) {
      console.error("Error joining as observer:", error)
      toast({
        title: "참여 실패",
        description: "다시 시도해주세요.",
        variant: "destructive",
      })
    }
  }

  const handleSendMessage = async () => {
    if (!newMessage.trim() || !currentParticipant) return

    setIsTyping(true)
    try {
      const messageType = isStructuredDebate
        ? currentPhase.includes("opening")
          ? "opening"
          : currentPhase.includes("strategy")
            ? "strategy"
            : currentPhase.includes("rebuttal")
              ? "rebuttal"
              : currentPhase.includes("closing")
                ? "closing"
                : "comment"
        : "argument"

      const message = {
        discussionId: discussion.id,
        userId: currentUser.uid,
        username: currentParticipant.username,
        content: newMessage,
        timestamp: serverTimestamp(),
        role: currentParticipant.role,
        phase: isStructuredDebate ? currentPhase : undefined,
        messageType,
        likes: 0,
        likedBy: [],
      }

      await addDoc(collection(db, "messages"), message)
      setNewMessage("")

      toast({
        title: "메시지가 전송되었습니다!",
      })
    } catch (error) {
      console.error("Error sending message:", error)
      toast({
        title: "메시지 전송 실패",
        description: "다시 시도해주세요.",
        variant: "destructive",
      })
    } finally {
      setIsTyping(false)
    }
  }

  const handleFinalVote = async (vote: "pros" | "cons" | "draw") => {
    if (!isObserver) return

    try {
      const voteData = {
        userId: currentUser.uid,
        vote,
        timestamp: serverTimestamp(),
        reasoning: voteReasoning || undefined,
      }

      await updateDoc(doc(db, "discussions", discussion.id), {
        finalVotes: arrayUnion(voteData),
      })

      setFinalVote(vote)
      toast({
        title: "투표 완료!",
        description: `${vote === "pros" ? "찬성" : vote === "cons" ? "반대" : "무승부"}에 투표했습니다.`,
      })
    } catch (error) {
      console.error("Error voting:", error)
      toast({
        title: "투표 실패",
        description: "다시 시도해주세요.",
        variant: "destructive",
      })
    }
  }

  const formatTime = (ms: number) => {
    const minutes = Math.floor(ms / 60000)
    const seconds = Math.floor((ms % 60000) / 1000)
    return `${minutes}:${seconds.toString().padStart(2, "0")}`
  }

  const getPhaseProgress = () => {
    if (!phaseTimeRemaining || !phaseTimeLimit) return 100
    const totalTime = phaseTimeLimit * 60 * 1000
    return ((totalTime - phaseTimeRemaining) / totalTime) * 100
  }

  const currentPhaseInfo = PHASE_INFO[currentPhase] || PHASE_INFO.waiting
  const PhaseIcon = currentPhaseInfo.icon

  // 현재 단계의 메시지만 필터링 (체계적 토론인 경우)
  const displayMessages = isStructuredDebate ? messages.filter((m) => m.phase === currentPhase || !m.phase) : messages

  const renderJoinOptions = () => {
    if (discussion.type === "pros-cons") {
      const prosCount = discussion.participants.filter((p) => p.role === "pros").length
      const consCount = discussion.participants.filter((p) => p.role === "cons").length

      return (
        <div className="space-y-4">
          <p className="text-center text-muted-foreground">팀을 선택하여 토론에 참여하세요</p>
          <div className="grid grid-cols-2 gap-4">
            <Button
              onClick={() => handleJoinDiscussion("pros")}
              className="bg-green-600 hover:bg-green-700"
              disabled={discussion.maxParticipants && prosCount >= discussion.maxParticipants / 2}
            >
              <ThumbsUp className="h-4 w-4 mr-2" />
              찬성 팀 ({prosCount}명)
              {prosCount === 0 && <Crown className="h-3 w-3 ml-1" />}
            </Button>
            <Button
              onClick={() => handleJoinDiscussion("cons")}
              className="bg-red-600 hover:bg-red-700"
              disabled={discussion.maxParticipants && consCount >= discussion.maxParticipants / 2}
            >
              <ThumbsDown className="h-4 w-4 mr-2" />
              반대 팀 ({consCount}명)
              {consCount === 0 && <Crown className="h-3 w-3 ml-1" />}
            </Button>
          </div>
          {canObserve && (
            <div className="text-center">
              <Button variant="outline" onClick={handleJoinAsObserver}>
                <Eye className="h-4 w-4 mr-2" />
                참관자로 참여
              </Button>
            </div>
          )}
        </div>
      )
    }

    return (
      <div className="space-y-4">
        <p className="text-center text-muted-foreground">토론에 참여하세요</p>
        <div className="flex gap-4 justify-center">
          <Button onClick={() => handleJoinDiscussion("participant")}>
            <MessageSquare className="h-4 w-4 mr-2" />
            토론 참여하기
          </Button>
          {canObserve && (
            <Button variant="outline" onClick={handleJoinAsObserver}>
              <Eye className="h-4 w-4 mr-2" />
              참관자로 참여
            </Button>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto py-8 px-4">
      {/* 토론 헤더 */}
      <Card className="mb-6">
        <CardHeader>
          <div className="flex justify-between items-start">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                <CardTitle className="text-2xl">{discussion.title}</CardTitle>
                {isCreator && <Crown className="h-5 w-5 text-yellow-500" />}
              </div>
              <CardDescription className="mt-2">{discussion.description}</CardDescription>
            </div>
            <div className="flex gap-2">
              <Badge
                variant={
                  discussion.status === "active" ? "default" : discussion.status === "waiting" ? "secondary" : "outline"
                }
              >
                {discussion.status === "waiting" ? "대기중" : discussion.status === "active" ? "진행중" : "종료됨"}
              </Badge>
              <Badge variant="outline">{discussion.type}</Badge>
              <Badge variant="outline">{discussion.category}</Badge>
            </div>
          </div>

          {/* 체계적 토론인 경우에만 단계 표시 */}
          {isStructuredDebate && (
            <div className="mt-4">
              <div
                className="flex items-center gap-3 p-4 rounded-lg"
                style={{ backgroundColor: `${currentPhaseInfo.color}20` }}
              >
                <div className={`p-2 rounded-full ${currentPhaseInfo.color} text-white`}>
                  <PhaseIcon className="h-5 w-5" />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-lg">{currentPhaseInfo.name}</h3>
                  <p className="text-sm text-muted-foreground">{currentPhaseInfo.description}</p>
                </div>
                {phaseTimeRemaining !== null && currentPhase !== "waiting" && currentPhase !== "ended" && (
                  <div className="text-right">
                    <div className="font-mono text-lg font-bold">{formatTime(phaseTimeRemaining)}</div>
                    <div className="text-xs text-muted-foreground">남은 시간</div>
                  </div>
                )}
              </div>

              {/* 진행률 바 */}
              {phaseTimeRemaining !== null && currentPhase !== "waiting" && currentPhase !== "ended" && (
                <div className="mt-2">
                  <Progress value={getPhaseProgress()} className="h-2" />
                  {phaseTimeRemaining < 30000 && (
                    <div className="flex justify-center mt-1">
                      <Badge variant="destructive" className="animate-pulse">
                        <AlertCircle className="h-3 w-3 mr-1" />곧 다음 단계로
                      </Badge>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* 토론 제어 버튼 (생성자만) */}
          {isCreator && (
            <div className="flex gap-2 mt-4">
              {discussion.status === "waiting" && (
                <Button onClick={handleStartDiscussion} className="bg-green-600 hover:bg-green-700">
                  <Play className="h-4 w-4 mr-2" />
                  토론 시작하기
                </Button>
              )}
              {isStructuredDebate && currentPhase !== "waiting" && currentPhase !== "ended" && (
                <Button onClick={handleNextPhase} variant="outline">
                  <ArrowRight className="h-4 w-4 mr-2" />
                  다음 단계로
                </Button>
              )}
            </div>
          )}
        </CardHeader>
      </Card>

      {/* 참여 옵션 */}
      {canJoin && (
        <Card className="mb-6">
          <CardContent className="pt-6">{renderJoinOptions()}</CardContent>
        </Card>
      )}

      {canObserve && !canJoin && (
        <Card className="mb-6">
          <CardContent className="pt-6">
            <div className="text-center">
              <Button variant="outline" onClick={handleJoinAsObserver}>
                <Eye className="h-4 w-4 mr-2" />
                참관자로 참여하기
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* 메인 토론 영역 */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <div className="lg:col-span-3">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MessageSquare className="h-5 w-5" />
                {isStructuredDebate ? `${currentPhaseInfo.name} - 토론 내용` : "토론 내용"}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-96 mb-4">
                <div className="space-y-4">
                  {displayMessages.length === 0 ? (
                    <div className="text-center text-muted-foreground py-8">
                      {discussion.status === "waiting"
                        ? "토론이 시작되면 메시지가 표시됩니다."
                        : "아직 메시지가 없습니다. 첫 번째 의견을 남겨보세요!"}
                    </div>
                  ) : (
                    displayMessages.map((message) => (
                      <div key={message.id} className="flex items-start gap-3 p-3 rounded-lg hover:bg-muted/50">
                        <Avatar className="h-8 w-8">
                          <AvatarFallback>{message.username[0]}</AvatarFallback>
                        </Avatar>
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{message.username}</span>
                            <Badge
                              variant={
                                message.role === "pros"
                                  ? "default"
                                  : message.role === "cons"
                                    ? "destructive"
                                    : "secondary"
                              }
                              className="text-xs"
                            >
                              {message.role === "pros" ? "찬성" : message.role === "cons" ? "반대" : "참여자"}
                            </Badge>
                            {discussion.participants.find((p) => p.userId === message.userId)?.isTeamLeader && (
                              <Crown className="h-3 w-3 text-yellow-500" />
                            )}
                            <span className="text-xs text-muted-foreground">
                              {message.timestamp?.toLocaleTimeString()}
                            </span>
                          </div>
                          <p className="mt-1 text-sm leading-relaxed">{message.content}</p>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </ScrollArea>

              {/* 메시지 입력 */}
              {canSendMessage() && (
                <div className="space-y-2">
                  {/* 체계적 토론인 경우 단계별 안내 메시지 */}
                  {isStructuredDebate && (
                    <div className="text-xs text-muted-foreground p-2 bg-muted rounded">
                      {currentPhase.includes("opening") && "주장과 근거를 명확히 제시해주세요."}
                      {currentPhase.includes("strategy") && "팀 내부에서만 보이는 메시지입니다. 전략을 논의하세요."}
                      {currentPhase.includes("rebuttal") && "상대방의 주장에 논리적으로 반박해주세요."}
                      {currentPhase.includes("closing") && "최종 주장을 정리하여 제시해주세요."}
                    </div>
                  )}

                  <Textarea
                    placeholder="의견을 입력하세요..."
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault()
                        handleSendMessage()
                      }
                    }}
                    className="flex-1 min-h-[80px]"
                    disabled={isTyping}
                  />
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-muted-foreground">{newMessage.length}/1000자</span>
                    <Button
                      onClick={handleSendMessage}
                      disabled={!newMessage.trim() || isTyping || newMessage.length > 1000}
                      size="sm"
                    >
                      {isTyping ? (
                        "전송 중..."
                      ) : (
                        <>
                          <Send className="h-4 w-4 mr-2" />
                          전송
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              )}

              {!canSendMessage() && isParticipant && discussion.status === "active" && (
                <div className="text-center text-muted-foreground py-4">
                  {isStructuredDebate ? "현재 단계에서는 메시지를 보낼 수 없습니다." : "메시지를 보낼 수 있습니다."}
                </div>
              )}

              {discussion.status === "waiting" && isParticipant && (
                <div className="text-center text-muted-foreground py-4">토론이 시작되면 메시지를 보낼 수 있습니다.</div>
              )}

              {discussion.status === "ended" && (
                <div className="text-center text-muted-foreground py-4">토론이 종료되었습니다.</div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* 사이드바 */}
        <div className="space-y-6">
          {/* 참여자 목록 */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                참여자 ({discussion.participants.length}명)
              </CardTitle>
            </CardHeader>
            <CardContent>
              {discussion.type === "pros-cons" ? (
                <div className="space-y-4">
                  {/* 찬성 팀 */}
                  <div>
                    <h4 className="font-medium text-green-600 mb-2 flex items-center gap-2">
                      <ThumbsUp className="h-4 w-4" />
                      찬성 팀 ({discussion.participants.filter((p) => p.role === "pros").length}명)
                    </h4>
                    <div className="space-y-2 ml-6">
                      {discussion.participants
                        .filter((p) => p.role === "pros")
                        .map((participant) => (
                          <div key={participant.userId} className="flex items-center gap-2">
                            <Avatar className="h-6 w-6">
                              <AvatarFallback>{participant.username[0]}</AvatarFallback>
                            </Avatar>
                            <span className="text-sm flex-1">{participant.username}</span>
                            {participant.isTeamLeader && <Crown className="h-3 w-3 text-yellow-500" />}
                            {participant.userId === discussion.createdBy && (
                              <Badge variant="outline" className="text-xs">
                                생성자
                              </Badge>
                            )}
                          </div>
                        ))}
                    </div>
                  </div>

                  {/* 반대 팀 */}
                  <div>
                    <h4 className="font-medium text-red-600 mb-2 flex items-center gap-2">
                      <ThumbsDown className="h-4 w-4" />
                      반대 팀 ({discussion.participants.filter((p) => p.role === "cons").length}명)
                    </h4>
                    <div className="space-y-2 ml-6">
                      {discussion.participants
                        .filter((p) => p.role === "cons")
                        .map((participant) => (
                          <div key={participant.userId} className="flex items-center gap-2">
                            <Avatar className="h-6 w-6">
                              <AvatarFallback>{participant.username[0]}</AvatarFallback>
                            </Avatar>
                            <span className="text-sm flex-1">{participant.username}</span>
                            {participant.isTeamLeader && <Crown className="h-3 w-3 text-yellow-500" />}
                            {participant.userId === discussion.createdBy && (
                              <Badge variant="outline" className="text-xs">
                                생성자
                              </Badge>
                            )}
                          </div>
                        ))}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  {discussion.participants.length === 0 ? (
                    <div className="text-center text-muted-foreground text-sm">아직 참여자가 없습니다.</div>
                  ) : (
                    discussion.participants.map((participant) => (
                      <div key={participant.userId} className="flex items-center gap-2">
                        <Avatar className="h-6 w-6">
                          <AvatarFallback>{participant.username[0]}</AvatarFallback>
                        </Avatar>
                        <span className="text-sm flex-1">{participant.username}</span>
                        {participant.userId === discussion.createdBy && <Crown className="h-3 w-3 text-yellow-500" />}
                      </div>
                    ))
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* 참관자 목록 */}
          {discussion.allowObservers && discussion.observers.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Eye className="h-5 w-5" />
                  참관자 ({discussion.observers.length}명)
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {discussion.observers.map((observerId, index) => (
                    <div key={observerId} className="flex items-center gap-2">
                      <Avatar className="h-6 w-6">
                        <AvatarFallback>O{index + 1}</AvatarFallback>
                      </Avatar>
                      <span className="text-sm">참관자 {index + 1}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* 최종 투표 */}
          {isObserver &&
            ((isStructuredDebate && currentPhase === "voting") ||
              (!isStructuredDebate && discussion.status === "ended")) &&
            !finalVote && (
              <Card>
                <CardHeader>
                  <CardTitle>최종 투표</CardTitle>
                  <CardDescription>어느 팀이 더 설득력 있었나요?</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <Textarea
                      placeholder="투표 이유를 간단히 적어주세요 (선택사항)"
                      value={voteReasoning}
                      onChange={(e) => setVoteReasoning(e.target.value)}
                      rows={3}
                    />
                    <div className="space-y-2">
                      <Button
                        onClick={() => handleFinalVote("pros")}
                        className="w-full bg-green-600 hover:bg-green-700"
                      >
                        <ThumbsUp className="h-4 w-4 mr-2" />
                        찬성 팀 승리
                      </Button>
                      <Button onClick={() => handleFinalVote("cons")} className="w-full bg-red-600 hover:bg-red-700">
                        <ThumbsDown className="h-4 w-4 mr-2" />
                        반대 팀 승리
                      </Button>
                      <Button onClick={() => handleFinalVote("draw")} variant="outline" className="w-full">
                        무승부
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

          {/* 투표 결과 */}
          {discussion.finalVotes && discussion.finalVotes.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>투표 결과</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {(() => {
                    const prosVotes = discussion.finalVotes.filter((v) => v.vote === "pros").length
                    const consVotes = discussion.finalVotes.filter((v) => v.vote === "cons").length
                    const drawVotes = discussion.finalVotes.filter((v) => v.vote === "draw").length
                    const totalVotes = prosVotes + consVotes + drawVotes

                    return (
                      <>
                        <div className="space-y-2">
                          <div className="flex justify-between items-center">
                            <span className="flex items-center gap-2">
                              <ThumbsUp className="h-4 w-4 text-green-600" />
                              찬성 팀 승리
                            </span>
                            <span className="font-medium">{prosVotes}표</span>
                          </div>
                          <Progress value={(prosVotes / totalVotes) * 100} className="h-2" />
                        </div>

                        <div className="space-y-2">
                          <div className="flex justify-between items-center">
                            <span className="flex items-center gap-2">
                              <ThumbsDown className="h-4 w-4 text-red-600" />
                              반대 팀 승리
                            </span>
                            <span className="font-medium">{consVotes}표</span>
                          </div>
                          <Progress value={(consVotes / totalVotes) * 100} className="h-2" />
                        </div>

                        <div className="space-y-2">
                          <div className="flex justify-between items-center">
                            <span>무승부</span>
                            <span className="font-medium">{drawVotes}표</span>
                          </div>
                          <Progress value={(drawVotes / totalVotes) * 100} className="h-2" />
                        </div>

                        <div className="pt-2 border-t">
                          <div className="text-center">
                            <span className="text-sm text-muted-foreground">총 {totalVotes}명 투표</span>
                          </div>
                        </div>
                      </>
                    )
                  })()}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}

// 비로그인 사용자를 위한 컴포넌트
function GuestView({ discussion, messages }: { discussion: Discussion; messages: Message[] }) {
  const currentPhase = discussion.currentPhase || "waiting"
  const isStructuredDebate = discussion.type === "pros-cons" && discussion.currentPhase
  const currentPhaseInfo = PHASE_INFO[currentPhase] || PHASE_INFO.waiting
  const PhaseIcon = currentPhaseInfo.icon

  return (
    <div className="container mx-auto py-8 px-4">
      <Card className="mb-6">
        <CardHeader>
          <div className="flex justify-between items-start">
            <div>
              <CardTitle className="text-2xl">{discussion.title}</CardTitle>
              <CardDescription className="mt-2">{discussion.description}</CardDescription>
            </div>
            <div className="flex gap-2">
              <Badge
                variant={
                  discussion.status === "active" ? "default" : discussion.status === "waiting" ? "secondary" : "outline"
                }
              >
                {discussion.status === "waiting" ? "대기중" : discussion.status === "active" ? "진행중" : "종료됨"}
              </Badge>
              <Badge variant="outline">{discussion.type}</Badge>
              <Badge variant="outline">{discussion.category}</Badge>
            </div>
          </div>

          {/* 체계적 토론인 경우에만 현재 단계 표시 */}
          {isStructuredDebate && (
            <div className="mt-4">
              <div
                className="flex items-center gap-3 p-4 rounded-lg"
                style={{ backgroundColor: `${currentPhaseInfo.color}20` }}
              >
                <div className={`p-2 rounded-full ${currentPhaseInfo.color} text-white`}>
                  <PhaseIcon className="h-5 w-5" />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-lg">{currentPhaseInfo.name}</h3>
                  <p className="text-sm text-muted-foreground">{currentPhaseInfo.description}</p>
                </div>
              </div>
            </div>
          )}
        </CardHeader>
      </Card>

      <Card className="mb-6">
        <CardContent className="pt-6">
          <div className="text-center space-y-4">
            <p className="text-muted-foreground">토론에 참여하려면 로그인이 필요합니다</p>
            <Link href="/auth">
              <Button>로그인 / 회원가입</Button>
            </Link>
          </div>
        </CardContent>
      </Card>

      {/* 메시지는 읽기 전용으로 표시 */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <div className="lg:col-span-3">
          <Card>
            <CardHeader>
              <CardTitle>{isStructuredDebate ? `${currentPhaseInfo.name} - 토론 내용` : "토론 내용"}</CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-96">
                <div className="space-y-4">
                  {messages
                    .filter((m) => (isStructuredDebate ? m.phase === currentPhase || !m.phase : true))
                    .map((message) => (
                      <div key={message.id} className="flex items-start gap-3">
                        <Avatar className="h-8 w-8">
                          <AvatarFallback>{message.username[0]}</AvatarFallback>
                        </Avatar>
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{message.username}</span>
                            <Badge
                              variant={
                                message.role === "pros"
                                  ? "default"
                                  : message.role === "cons"
                                    ? "destructive"
                                    : "secondary"
                              }
                              className="text-xs"
                            >
                              {message.role === "pros" ? "찬성" : message.role === "cons" ? "반대" : "참여자"}
                            </Badge>
                            <span className="text-xs text-muted-foreground">
                              {message.timestamp?.toLocaleTimeString()}
                            </span>
                          </div>
                          <p className="mt-1">{message.content}</p>
                        </div>
                      </div>
                    ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>참여자</CardTitle>
            </CardHeader>
            <CardContent>
              {discussion.type === "pros-cons" ? (
                <div className="space-y-4">
                  <div>
                    <h4 className="font-medium text-green-600 mb-2">찬성 팀</h4>
                    <div className="space-y-2 ml-4">
                      {discussion.participants
                        .filter((p) => p.role === "pros")
                        .map((participant) => (
                          <div key={participant.userId} className="flex items-center gap-2">
                            <Avatar className="h-6 w-6">
                              <AvatarFallback>{participant.username[0]}</AvatarFallback>
                            </Avatar>
                            <span className="text-sm">{participant.username}</span>
                            {participant.isTeamLeader && <Crown className="h-3 w-3 text-yellow-500" />}
                          </div>
                        ))}
                    </div>
                  </div>
                  <div>
                    <h4 className="font-medium text-red-600 mb-2">반대 팀</h4>
                    <div className="space-y-2 ml-4">
                      {discussion.participants
                        .filter((p) => p.role === "cons")
                        .map((participant) => (
                          <div key={participant.userId} className="flex items-center gap-2">
                            <Avatar className="h-6 w-6">
                              <AvatarFallback>{participant.username[0]}</AvatarFallback>
                            </Avatar>
                            <span className="text-sm">{participant.username}</span>
                            {participant.isTeamLeader && <Crown className="h-3 w-3 text-yellow-500" />}
                          </div>
                        ))}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  {discussion.participants.map((participant) => (
                    <div key={participant.userId} className="flex items-center gap-2">
                      <Avatar className="h-6 w-6">
                        <AvatarFallback>{participant.username[0]}</AvatarFallback>
                      </Avatar>
                      <span className="text-sm">{participant.username}</span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
