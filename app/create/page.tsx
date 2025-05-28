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
    description: "체계적인 단계별 토론 (입론 → 작전타임 → 반론 → 최종변론 → 투표)",
  },
  {
    value: "free" as DiscussionType,
    label: "자유토론",
    description: "누구나 자유롭게 의견을 나눌 수 있는 열린 토론입니다.",
  },
  {
    value: "one-on-one" as DiscussionType,
    label: "1:1 대결",
    description: "두 명이 서로 다른 입장에서 체계적으로 토론합니다.",
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
  const [phaseTimeLimit, setPhaseTimeLimit] = useState(5) // 각 단계별 시간 제한
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
      const discussionData = {
        title,
        description,
        type,
        category,
        allowObservers,
        phaseTimeLimit, // 각 단계별 시간 제한
        maxParticipants: maxParticipants || null,
        status: "waiting",
        currentPhase: "waiting", // 초기 단계
        createdBy: user.uid,
        createdAt: serverTimestamp(),
        participants: [],
        observers: [],
        phaseMessages: {}, // 각 단계별 메시지 저장
      }

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
          <CardDescription>체계적인 토론 시스템으로 의견을 나누어보세요</CardDescription>
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

            <div className="space-y-2">
              <Label htmlFor="phase-time-limit">단계별 시간 제한 (분)</Label>
              <Select value={phaseTimeLimit.toString()} onValueChange={(value) => setPhaseTimeLimit(Number(value))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="3">3분</SelectItem>
                  <SelectItem value="5">5분</SelectItem>
                  <SelectItem value="7">7분</SelectItem>
                  <SelectItem value="10">10분</SelectItem>
                  <SelectItem value="15">15분</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-sm text-muted-foreground">각 토론 단계(입론, 반론, 최종변론 등)의 시간 제한입니다.</p>
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

            {type === "pros-cons" && (
              <div className="p-4 bg-muted rounded-lg">
                <h4 className="font-medium mb-2">찬반토론 진행 순서</h4>
                <ol className="text-sm text-muted-foreground space-y-1">
                  <li>1. 찬성 측 입론 ({phaseTimeLimit}분)</li>
                  <li>2. 반대 측 입론 ({phaseTimeLimit}분)</li>
                  <li>3. 찬성 팀 작전타임 ({phaseTimeLimit}분)</li>
                  <li>4. 반대 팀 작전타임 ({phaseTimeLimit}분)</li>
                  <li>5. 찬성 측 반론 ({phaseTimeLimit}분)</li>
                  <li>6. 반대 측 반론 ({phaseTimeLimit}분)</li>
                  <li>7. 찬성 측 최종변론 ({phaseTimeLimit}분)</li>
                  <li>8. 반대 측 최종변론 ({phaseTimeLimit}분)</li>
                  <li>9. 참관자 투표 및 결과 발표</li>
                </ol>
              </div>
            )}
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
