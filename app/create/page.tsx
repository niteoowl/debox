"use client"

import type React from "react"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { collection, addDoc, serverTimestamp } from "firebase/firestore"
import { db } from "@/lib/firebase"
import { useAuth } from "@/hooks/useAuth"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { useToast } from "@/hooks/use-toast"
import type { DiscussionType } from "@/types/discussion"

const discussionTypes = [
  {
    value: "pros-cons" as DiscussionType,
    label: "찬반토론",
    description: "찬성과 반대 입장으로 나뉘어 구조화된 토론을 진행합니다.",
  },
  {
    value: "free" as DiscussionType,
    label: "자유토론",
    description: "누구나 자유롭게 의견을 나눌 수 있는 열린 토론입니다.",
  },
  {
    value: "one-on-one" as DiscussionType,
    label: "1:1 대결",
    description: "두 명이 서로 다른 입장에서 교차 반론을 진행합니다.",
  },
]

export default function CreateDiscussionPage() {
  const router = useRouter()
  const { user } = useAuth()
  const { toast } = useToast()

  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [type, setType] = useState<DiscussionType>("pros-cons")
  const [category, setCategory] = useState("")
  const [allowObservers, setAllowObservers] = useState(true)
  const [timeLimit, setTimeLimit] = useState<number | undefined>(undefined)
  const [maxParticipants, setMaxParticipants] = useState<number | undefined>(undefined)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user) {
      toast({
        title: "로그인이 필요합니다",
        description: "토론을 생성하려면 먼저 로그인해주세요.",
        variant: "destructive",
      })
      return
    }

    setIsSubmitting(true)

    try {
      // 서버 타임스탬프 사용
      const discussionData = {
        title,
        description,
        type,
        category,
        allowObservers,
        timeLimit: timeLimit || null,
        maxParticipants: maxParticipants || null,
        status: "waiting",
        createdBy: user.uid,
        createdAt: serverTimestamp(), // 클라이언트 시간 대신 서버 타임스탬프 사용
        participants: [],
        observers: [],
      }

      // 콘솔에 데이터 출력 (디버깅용)
      console.log("Creating discussion with data:", discussionData)

      const docRef = await addDoc(collection(db, "discussions"), discussionData)
      console.log("Document written with ID: ", docRef.id)

      toast({
        title: "토론이 생성되었습니다!",
        description: "참여자를 기다리고 있습니다.",
      })

      router.push(`/discussion/${docRef.id}`)
    } catch (error: any) {
      console.error("Error creating discussion:", error)

      // 더 자세한 오류 메시지 표시
      let errorMessage = "다시 시도해주세요."
      if (error.code === "permission-denied") {
        errorMessage = "권한이 없습니다. 로그인 상태를 확인해주세요."
      } else if (error.message) {
        errorMessage = error.message
      }

      toast({
        title: "토론 생성 실패",
        description: errorMessage,
        variant: "destructive",
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="container mx-auto py-8 px-4">
      <Card className="max-w-2xl mx-auto">
        <CardHeader>
          <CardTitle>새 토론 만들기</CardTitle>
          <CardDescription>토론 주제와 형식을 설정하여 새로운 토론을 시작하세요.</CardDescription>
        </CardHeader>

        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="title">토론 제목</Label>
              <Input
                id="title"
                placeholder="토론 주제를 입력하세요"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">토론 설명</Label>
              <Textarea
                id="description"
                placeholder="토론 내용과 배경을 자세히 설명해주세요"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={4}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="type">토론 형식</Label>
              <Select value={type} onValueChange={(value: DiscussionType) => setType(value)}>
                <SelectTrigger>
                  <SelectValue placeholder="토론 형식 선택" />
                </SelectTrigger>
                <SelectContent>
                  {discussionTypes.map((discussionType) => (
                    <SelectItem key={discussionType.value} value={discussionType.value}>
                      <div>
                        <div className="font-medium">{discussionType.label}</div>
                        <div className="text-sm text-muted-foreground">{discussionType.description}</div>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="category">카테고리</Label>
              <Select value={category} onValueChange={setCategory} required>
                <SelectTrigger>
                  <SelectValue placeholder="카테고리 선택" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="정치">정치</SelectItem>
                  <SelectItem value="사회">사회</SelectItem>
                  <SelectItem value="경제">경제</SelectItem>
                  <SelectItem value="기술">기술</SelectItem>
                  <SelectItem value="문화">문화</SelectItem>
                  <SelectItem value="환경">환경</SelectItem>
                  <SelectItem value="교육">교육</SelectItem>
                  <SelectItem value="기타">기타</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center space-x-2">
              <Switch id="allow-observers" checked={allowObservers} onCheckedChange={setAllowObservers} />
              <Label htmlFor="allow-observers">참관자 허용</Label>
            </div>

            {(type === "pros-cons" || type === "one-on-one") && (
              <div className="space-y-2">
                <Label htmlFor="max-participants">최대 참여자 수 (선택사항)</Label>
                <Input
                  id="max-participants"
                  type="number"
                  min="2"
                  max="10"
                  placeholder="제한 없음"
                  value={maxParticipants || ""}
                  onChange={(e) => setMaxParticipants(e.target.value ? Number(e.target.value) : undefined)}
                />
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="time-limit">제한 시간 (분, 선택사항)</Label>
              <Input
                id="time-limit"
                type="number"
                min="5"
                max="180"
                placeholder="제한 없음"
                value={timeLimit || ""}
                onChange={(e) => setTimeLimit(e.target.value ? Number(e.target.value) : undefined)}
              />
            </div>
          </CardContent>

          <CardFooter className="flex justify-between">
            <Button type="button" variant="outline" onClick={() => router.back()}>
              취소
            </Button>
            <Button type="submit" disabled={isSubmitting || !title || !description || !category}>
              {isSubmitting ? "생성 중..." : "토론 시작하기"}
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  )
}
