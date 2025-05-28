"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { collection, query, orderBy, onSnapshot } from "firebase/firestore"
import { db } from "@/lib/firebase"
import { useAuth } from "@/hooks/useAuth"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Users, Eye, Clock, Trophy, AlertCircle } from "lucide-react"
import type { Discussion } from "@/types/discussion"

const discussionTypeLabels = {
  "pros-cons": "찬반토론",
  free: "자유토론",
  "one-on-one": "1:1 대결",
}

const statusLabels = {
  waiting: "대기중",
  active: "진행중",
  ended: "종료됨",
}

export default function DiscussionList() {
  const [discussions, setDiscussions] = useState<Discussion[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const { user } = useAuth()

  useEffect(() => {
    const q = query(collection(db, "discussions"), orderBy("createdAt", "desc"))

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const discussionData = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
          createdAt: doc.data().createdAt?.toDate(),
          endedAt: doc.data().endedAt?.toDate(),
        })) as Discussion[]

        setDiscussions(discussionData)
        setLoading(false)
        setError(null)
      },
      (error) => {
        console.error("Firestore error:", error)
        setError("데이터를 불러오는 중 오류가 발생했습니다. Firebase 규칙을 확인해주세요.")
        setLoading(false)
      },
    )

    return unsubscribe
  }, [])

  if (loading) {
    return (
      <div className="container mx-auto py-8 px-4">
        <div className="text-center">로딩 중...</div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="container mx-auto py-8 px-4">
        <div className="flex flex-col items-center justify-center py-12">
          <AlertCircle className="h-12 w-12 text-red-500 mb-4" />
          <h2 className="text-xl font-semibold mb-2">데이터 로딩 오류</h2>
          <p className="text-muted-foreground text-center mb-4">{error}</p>
          <Button onClick={() => window.location.reload()}>다시 시도</Button>
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold">토론 광장</h1>
          <p className="text-muted-foreground mt-2">다양한 형태의 토론에 참여해보세요</p>
        </div>
        <div className="flex gap-2">
          {user ? (
            <Link href="/create">
              <Button>새 토론 만들기</Button>
            </Link>
          ) : (
            <div className="text-sm text-muted-foreground">토론을 만들려면 로그인이 필요합니다</div>
          )}
        </div>
      </div>

      {discussions.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-muted-foreground mb-4">아직 토론이 없습니다.</p>
          {user && (
            <Link href="/create">
              <Button>첫 번째 토론을 만들어보세요</Button>
            </Link>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {discussions.map((discussion) => (
            <Card key={discussion.id} className="hover:shadow-md transition-shadow">
              <CardHeader>
                <div className="flex justify-between items-start mb-2">
                  <Badge
                    variant={
                      discussion.status === "active"
                        ? "default"
                        : discussion.status === "waiting"
                          ? "secondary"
                          : "outline"
                    }
                  >
                    {statusLabels[discussion.status]}
                  </Badge>
                  <Badge variant="outline">{discussionTypeLabels[discussion.type]}</Badge>
                </div>
                <CardTitle className="text-lg line-clamp-2">{discussion.title}</CardTitle>
                <CardDescription className="line-clamp-3">{discussion.description}</CardDescription>
              </CardHeader>

              <CardContent>
                <div className="flex items-center gap-4 text-sm text-muted-foreground">
                  <div className="flex items-center gap-1">
                    <Users className="h-4 w-4" />
                    <span>{discussion.participants?.length || 0}</span>
                  </div>
                  {discussion.allowObservers && (
                    <div className="flex items-center gap-1">
                      <Eye className="h-4 w-4" />
                      <span>{discussion.observers?.length || 0}</span>
                    </div>
                  )}
                  {discussion.timeLimit && (
                    <div className="flex items-center gap-1">
                      <Clock className="h-4 w-4" />
                      <span>{discussion.timeLimit}분</span>
                    </div>
                  )}
                  {discussion.winner && (
                    <div className="flex items-center gap-1">
                      <Trophy className="h-4 w-4" />
                      <span>
                        {discussion.winner === "pros" ? "찬성" : discussion.winner === "cons" ? "반대" : "무승부"}
                      </span>
                    </div>
                  )}
                </div>
              </CardContent>

              <CardFooter>
                <Link href={`/discussion/${discussion.id}`} className="w-full">
                  <Button className="w-full">
                    {discussion.status === "waiting"
                      ? "참여하기"
                      : discussion.status === "active"
                        ? "토론 보기"
                        : "결과 보기"}
                  </Button>
                </Link>
              </CardFooter>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
