"use client"

import { useState } from "react"
import type { User } from "firebase/auth"
import { doc, updateDoc, arrayUnion, collection, addDoc } from "firebase/firestore"
import { db } from "@/lib/firebase"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { ScrollArea } from "@/components/ui/scroll-area"
import { useToast } from "@/hooks/use-toast"
import { Users, Eye, Clock, Send, ThumbsUp, ThumbsDown } from "lucide-react"
import type { Discussion, Message, ParticipantRole } from "@/types/discussion"

interface DiscussionRoomProps {
  discussion: Discussion
  messages: Message[]
  currentUser: User
}

export default function DiscussionRoom({ discussion, messages, currentUser }: DiscussionRoomProps) {
  const [newMessage, setNewMessage] = useState("")
  const [selectedRole, setSelectedRole] = useState<ParticipantRole | null>(null)
  const [finalVote, setFinalVote] = useState<"pros" | "cons" | "draw" | null>(null)
  const { toast } = useToast()

  const currentParticipant = discussion.participants.find((p) => p.userId === currentUser.uid)
  const isObserver = discussion.observers.includes(currentUser.uid)
  const isParticipant = !!currentParticipant
  const canJoin = !isParticipant && !isObserver && discussion.status === "waiting"
  const canObserve = !isParticipant && !isObserver && discussion.allowObservers

  const handleJoinDiscussion = async (role: ParticipantRole) => {
    try {
      const participant = {
        userId: currentUser.uid,
        username: currentUser.email?.split("@")[0] || "Anonymous",
        role,
        joinedAt: new Date(),
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

    try {
      const message = {
        discussionId: discussion.id,
        userId: currentUser.uid,
        username: currentParticipant.username,
        content: newMessage,
        timestamp: new Date(),
        role: currentParticipant.role,
        messageType: "argument" as const,
      }

      await addDoc(collection(db, "messages"), message)
      setNewMessage("")
    } catch (error) {
      console.error("Error sending message:", error)
      toast({
        title: "메시지 전송 실패",
        description: "다시 시도해주세요.",
        variant: "destructive",
      })
    }
  }

  const handleFinalVote = async (vote: "pros" | "cons" | "draw") => {
    if (!isObserver) return

    try {
      const voteData = {
        userId: currentUser.uid,
        vote,
        timestamp: new Date(),
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

  const renderJoinOptions = () => {
    if (discussion.type === "pros-cons") {
      return (
        <div className="space-y-4">
          <p className="text-center text-muted-foreground">입장을 선택하여 토론에 참여하세요</p>
          <div className="flex gap-4 justify-center">
            <Button onClick={() => handleJoinDiscussion("pros")} className="bg-green-600 hover:bg-green-700">
              찬성 입장으로 참여
            </Button>
            <Button onClick={() => handleJoinDiscussion("cons")} className="bg-red-600 hover:bg-red-700">
              반대 입장으로 참여
            </Button>
          </div>
          {canObserve && (
            <div className="text-center">
              <Button variant="outline" onClick={handleJoinAsObserver}>
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
          <div className="flex gap-4 justify-center">
            <Button
              onClick={() => handleJoinDiscussion("pros")}
              disabled={prosCount >= 1}
              className="bg-green-600 hover:bg-green-700"
            >
              찬성 입장 ({prosCount}/1)
            </Button>
            <Button
              onClick={() => handleJoinDiscussion("cons")}
              disabled={consCount >= 1}
              className="bg-red-600 hover:bg-red-700"
            >
              반대 입장 ({consCount}/1)
            </Button>
          </div>
          {canObserve && (
            <div className="text-center">
              <Button variant="outline" onClick={handleJoinAsObserver}>
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
          <Button onClick={() => handleJoinDiscussion("participant")}>토론 참여하기</Button>
          {canObserve && (
            <Button variant="outline" onClick={handleJoinAsObserver}>
              참관자로 참여
            </Button>
          )}
        </div>
      </div>
    )
  }

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
                참관자로 참여하기
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <div className="lg:col-span-3">
          <Card>
            <CardHeader>
              <CardTitle>토론 내용</CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-96 mb-4">
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

              {isParticipant && discussion.status === "active" && (
                <div className="flex gap-2">
                  <Textarea
                    placeholder="의견을 입력하세요..."
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    className="flex-1"
                    rows={2}
                  />
                  <Button onClick={handleSendMessage} disabled={!newMessage.trim()}>
                    <Send className="h-4 w-4" />
                  </Button>
                </div>
              )}
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
