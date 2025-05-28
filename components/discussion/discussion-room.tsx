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
  Timer,
  MessageSquare,
  Crown,
  AlertCircle,
} from "lucide-react"
import type { Discussion, Message, ParticipantRole } from "@/types"
import Link from "next/link"

interface DiscussionRoomProps {
  discussion: Discussion
  messages: Message[]
  currentUser: User | null
}

export default function DiscussionRoom({ discussion, messages, currentUser }: DiscussionRoomProps) {
  const [newMessage, setNewMessage] = useState("")
  const [finalVote, setFinalVote] = useState<"pros" | "cons" | "draw" | null>(null)
  const [timeRemaining, setTimeRemaining] = useState<number | null>(null)
  const [isTyping, setIsTyping] = useState(false)
  const { toast } = useToast()

  // 타이머 로직
  useEffect(() => {
    if (discussion.status === "active" && discussion.timeLimit) {
      const startTime = discussion.createdAt?.getTime() || Date.now()
      const endTime = startTime + discussion.timeLimit * 60 * 1000

      const timer = setInterval(() => {
        const now = Date.now()
        const remaining = Math.max(0, endTime - now)
        setTimeRemaining(remaining)

        if (remaining === 0 && discussion.status === "active") {
          handleEndDiscussion()
        }
      }, 1000)

      return () => clearInterval(timer)
    }
  }, [discussion.status, discussion.timeLimit, discussion.createdAt])

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

  const handleStartDiscussion = async () => {
    if (!isCreator || discussion.status !== "waiting") return

    // 최소 참여자 확인
    if (discussion.participants.length === 0) {
      toast({
        title: "토론을 시작할 수 없습니다",
        description: "최소 1명의 참여자가 필요합니다.",
        variant: "destructive",
      })
      return
    }

    if (discussion.type === "pros-cons") {
      const prosCount = discussion.participants.filter((p) => p.role === "pros").length
      const consCount = discussion.participants.filter((p) => p.role === "cons").length

      if (prosCount === 0 || consCount === 0) {
        toast({
          title: "토론을 시작할 수 없습니다",
          description: "찬성과 반대 측에 각각 최소 1명의 참여자가 필요합니다.",
          variant: "destructive",
        })
        return
      }
    }

    try {
      await updateDoc(doc(db, "discussions", discussion.id), {
        status: "active",
      })

      toast({
        title: "토론이 시작되었습니다!",
        description: "참여자들이 의견을 나눌 수 있습니다.",
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

  const handleEndDiscussion = async () => {
    if (!isCreator || discussion.status !== "active") return

    try {
      await updateDoc(doc(db, "discussions", discussion.id), {
        status: "ended",
        endedAt: serverTimestamp(),
      })

      toast({
        title: "토론이 종료되었습니다!",
        description: "참관자들이 투표할 수 있습니다.",
      })
    } catch (error) {
      console.error("Error ending discussion:", error)
      toast({
        title: "토론 종료 실패",
        description: "다시 시도해주세요.",
        variant: "destructive",
      })
    }
  }

  const handleJoinDiscussion = async (role: ParticipantRole) => {
    try {
      const participant = {
        userId: currentUser.uid,
        username: currentUser.email?.split("@")[0] || "Anonymous",
        role,
        joinedAt: serverTimestamp(),
      }

      await updateDoc(doc(db, "discussions", discussion.id), {
        participants: arrayUnion(participant),
      })

      toast({
        title: "토론에 참여했습니다!",
        description: `${role === "pros" ? "찬성" : role === "cons" ? "반대" : "참여자"} 입장으로 참여합니다.`,
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
      const message = {
        discussionId: discussion.id,
        userId: currentUser.uid,
        username: currentParticipant.username,
        content: newMessage,
        timestamp: serverTimestamp(),
        role: currentParticipant.role,
        messageType: "argument" as const,
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

  const renderJoinOptions = () => {
    if (discussion.type === "pros-cons") {
      const prosCount = discussion.participants.filter((p) => p.role === "pros").length
      const consCount = discussion.participants.filter((p) => p.role === "cons").length

      return (
        <div className="space-y-4">
          <p className="text-center text-muted-foreground">입장을 선택하여 토론에 참여하세요</p>
          <div className="grid grid-cols-2 gap-4">
            <Button
              onClick={() => handleJoinDiscussion("pros")}
              className="bg-green-600 hover:bg-green-700"
              disabled={discussion.maxParticipants && prosCount >= discussion.maxParticipants / 2}
            >
              <ThumbsUp className="h-4 w-4 mr-2" />
              찬성 입장 ({prosCount}명)
            </Button>
            <Button
              onClick={() => handleJoinDiscussion("cons")}
              className="bg-red-600 hover:bg-red-700"
              disabled={discussion.maxParticipants && consCount >= discussion.maxParticipants / 2}
            >
              <ThumbsDown className="h-4 w-4 mr-2" />
              반대 입장 ({consCount}명)
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

    if (discussion.type === "one-on-one") {
      const prosCount = discussion.participants.filter((p) => p.role === "pros").length
      const consCount = discussion.participants.filter((p) => p.role === "cons").length

      return (
        <div className="space-y-4">
          <p className="text-center text-muted-foreground">1:1 대결에 참여하세요</p>
          <div className="grid grid-cols-2 gap-4">
            <Button
              onClick={() => handleJoinDiscussion("pros")}
              disabled={prosCount >= 1}
              className="bg-green-600 hover:bg-green-700"
            >
              <ThumbsUp className="h-4 w-4 mr-2" />
              찬성 입장 ({prosCount}/1)
            </Button>
            <Button
              onClick={() => handleJoinDiscussion("cons")}
              disabled={consCount >= 1}
              className="bg-red-600 hover:bg-red-700"
            >
              <ThumbsDown className="h-4 w-4 mr-2" />
              반대 입장 ({consCount}/1)
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

          {/* 토론 통계 */}
          <div className="flex items-center gap-6 mt-4 text-sm text-muted-foreground">
            <div className="flex items-center gap-1">
              <Users className="h-4 w-4" />
              <span>참여자 {discussion.participants.length}명</span>
            </div>
            {discussion.allowObservers && (
              <div className="flex items-center gap-1">
                <Eye className="h-4 w-4" />
                <span>참관자 {discussion.observers.length}명</span>
              </div>
            )}
            <div className="flex items-center gap-1">
              <MessageSquare className="h-4 w-4" />
              <span>메시지 {messages.length}개</span>
            </div>
            {discussion.timeLimit && (
              <div className="flex items-center gap-1">
                <Clock className="h-4 w-4" />
                <span>{discussion.timeLimit}분 제한</span>
              </div>
            )}
          </div>

          {/* 타이머 */}
          {discussion.status === "active" && discussion.timeLimit && timeRemaining !== null && (
            <div className="mt-4 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Timer className="h-4 w-4" />
                  <span className="font-medium">남은 시간: {formatTime(timeRemaining)}</span>
                </div>
                {timeRemaining < 60000 && (
                  <Badge variant="destructive" className="animate-pulse">
                    <AlertCircle className="h-3 w-3 mr-1" />곧 종료
                  </Badge>
                )}
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className="bg-blue-600 h-2 rounded-full transition-all duration-1000"
                  style={{
                    width: `${discussion.timeLimit ? ((discussion.timeLimit * 60 * 1000 - timeRemaining) / (discussion.timeLimit * 60 * 1000)) * 100 : 0}%`,
                  }}
                ></div>
              </div>
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
              {discussion.status === "active" && (
                <Button onClick={handleEndDiscussion} variant="destructive">
                  <Square className="h-4 w-4 mr-2" />
                  토론 종료하기
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
                토론 내용
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-96 mb-4">
                <div className="space-y-4">
                  {messages.length === 0 ? (
                    <div className="text-center text-muted-foreground py-8">
                      아직 메시지가 없습니다. 첫 번째 의견을 남겨보세요!
                    </div>
                  ) : (
                    messages.map((message) => (
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
              {isParticipant && discussion.status === "active" && (
                <div className="space-y-2">
                  <Textarea
                    placeholder="의견을 입력하세요... (Enter로 전송, Shift+Enter로 줄바꿈)"
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
              <div className="space-y-3">
                {discussion.participants.length === 0 ? (
                  <div className="text-center text-muted-foreground text-sm">아직 참여자가 없습니다.</div>
                ) : discussion.type === "pros-cons" ? (
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
                              {participant.userId === discussion.createdBy && (
                                <Crown className="h-3 w-3 text-yellow-500" />
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
                              {participant.userId === discussion.createdBy && (
                                <Crown className="h-3 w-3 text-yellow-500" />
                              )}
                            </div>
                          ))}
                      </div>
                    </div>
                  </div>
                ) : (
                  discussion.participants.map((participant) => (
                    <div key={participant.userId} className="flex items-center gap-2">
                      <Avatar className="h-6 w-6">
                        <AvatarFallback>{participant.username[0]}</AvatarFallback>
                      </Avatar>
                      <span className="text-sm flex-1">{participant.username}</span>
                      <Badge
                        variant={
                          participant.role === "pros"
                            ? "default"
                            : participant.role === "cons"
                              ? "destructive"
                              : "secondary"
                        }
                        className="text-xs"
                      >
                        {participant.role === "pros" ? "찬성" : participant.role === "cons" ? "반대" : "참여자"}
                      </Badge>
                      {participant.userId === discussion.createdBy && <Crown className="h-3 w-3 text-yellow-500" />}
                    </div>
                  ))
                )}
              </div>
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
          {isObserver && discussion.status === "ended" && !finalVote && (
            <Card>
              <CardHeader>
                <CardTitle>최종 투표</CardTitle>
                <CardDescription>참관자로서 승부를 결정해주세요</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <Button onClick={() => handleFinalVote("pros")} className="w-full bg-green-600 hover:bg-green-700">
                    <ThumbsUp className="h-4 w-4 mr-2" />
                    찬성 승리
                  </Button>
                  <Button onClick={() => handleFinalVote("cons")} className="w-full bg-red-600 hover:bg-red-700">
                    <ThumbsDown className="h-4 w-4 mr-2" />
                    반대 승리
                  </Button>
                  <Button onClick={() => handleFinalVote("draw")} variant="outline" className="w-full">
                    무승부
                  </Button>
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
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span>찬성 승리</span>
                    <span>{discussion.finalVotes.filter((v) => v.vote === "pros").length}표</span>
                  </div>
                  <div className="flex justify-between">
                    <span>반대 승리</span>
                    <span>{discussion.finalVotes.filter((v) => v.vote === "cons").length}표</span>
                  </div>
                  <div className="flex justify-between">
                    <span>무승부</span>
                    <span>{discussion.finalVotes.filter((v) => v.vote === "draw").length}표</span>
                  </div>
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
              <Badge variant={discussion.status === "active" ? "default" : "secondary"}>
                {discussion.status === "waiting" ? "대기중" : discussion.status === "active" ? "진행중" : "종료됨"}
              </Badge>
              <Badge variant="outline">{discussion.type}</Badge>
            </div>
          </div>

          <div className="flex items-center gap-4 mt-4 text-sm text-muted-foreground">
            <div className="flex items-center gap-1">
              <Users className="h-4 w-4" />
              <span>참여자 {discussion.participants.length}명</span>
            </div>
            {discussion.allowObservers && (
              <div className="flex items-center gap-1">
                <Eye className="h-4 w-4" />
                <span>참관자 {discussion.observers.length}명</span>
              </div>
            )}
            {discussion.timeLimit && (
              <div className="flex items-center gap-1">
                <Clock className="h-4 w-4" />
                <span>{discussion.timeLimit}분 제한</span>
              </div>
            )}
          </div>
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
              <CardTitle>토론 내용</CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-96">
                <div className="space-y-4">
                  {messages.map((message) => (
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
              <div className="space-y-2">
                {discussion.participants.map((participant) => (
                  <div key={participant.userId} className="flex items-center gap-2">
                    <Avatar className="h-6 w-6">
                      <AvatarFallback>{participant.username[0]}</AvatarFallback>
                    </Avatar>
                    <span className="text-sm">{participant.username}</span>
                    <Badge
                      variant={
                        participant.role === "pros"
                          ? "default"
                          : participant.role === "cons"
                            ? "destructive"
                            : "secondary"
                      }
                      className="text-xs"
                    >
                      {participant.role === "pros" ? "찬성" : participant.role === "cons" ? "반대" : "참여자"}
                    </Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
