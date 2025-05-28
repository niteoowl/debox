"use client"

import { useEffect, useState } from "react"
import { collection, query, orderBy, onSnapshot } from "firebase/firestore"

import { db } from "@/lib/firebase"
import type { Discussion } from "@/types"
import { useToast } from "@/hooks/use-toast"

interface DiscussionListProps {
  className?: string
}

const DiscussionList = ({ className }: DiscussionListProps) => {
  const [discussions, setDiscussions] = useState<Discussion[]>([])
  const [loading, setLoading] = useState(true)
  const { toast } = useToast()

  useEffect(() => {
    // 타임아웃 설정 (10초 후 에러 표시)
    const timeout = setTimeout(() => {
      setLoading(false)
      toast({
        title: "연결 오류",
        description: "Firebase 연결을 확인해주세요.",
        variant: "destructive",
      })
    }, 10000)

    const q = query(collection(db, "discussions"), orderBy("createdAt", "desc"))

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        clearTimeout(timeout)
        const discussionData = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
          createdAt: doc.data().createdAt?.toDate(),
          endedAt: doc.data().endedAt?.toDate(),
        })) as Discussion[]

        setDiscussions(discussionData)
        setLoading(false)
      },
      (error) => {
        clearTimeout(timeout)
        console.error("Firestore error:", error)
        setLoading(false)
        toast({
          title: "데이터 로딩 실패",
          description: "Firebase 설정을 확인해주세요.",
          variant: "destructive",
        })
      },
    )

    return () => {
      clearTimeout(timeout)
      unsubscribe()
    }
  }, [])

  if (loading) {
    return <div>Loading discussions...</div>
  }

  return (
    <div className={className}>
      {discussions.map((discussion) => (
        <div key={discussion.id}>
          {discussion.title} - {discussion.createdAt?.toLocaleDateString()}
        </div>
      ))}
    </div>
  )
}

export default DiscussionList
