"use client"

import { useState, useEffect } from "react"
import { useParams } from "next/navigation"
import { doc, onSnapshot, collection, query, where, orderBy } from "firebase/firestore"
import { db } from "@/lib/firebase"
import { useAuth } from "@/hooks/useAuth"
import DiscussionRoom from "@/components/discussion/discussion-room"
import type { Discussion, Message } from "@/types/discussion"

export default function DiscussionPage() {
  const { id } = useParams()
  const { user } = useAuth()
  const [discussion, setDiscussion] = useState<Discussion | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!id) return

    // 토론 정보 실시간 구독
    const discussionRef = doc(db, "discussions", id as string)
    const unsubscribeDiscussion = onSnapshot(discussionRef, (doc) => {
      if (doc.exists()) {
        const data = doc.data()
        setDiscussion({
          id: doc.id,
          ...data,
          createdAt: data.createdAt?.toDate(),
          endedAt: data.endedAt?.toDate(),
        } as Discussion)
      }
      setLoading(false)
    })

    // 메시지 실시간 구독
    const messagesQuery = query(
      collection(db, "messages"),
      where("discussionId", "==", id),
      orderBy("timestamp", "asc"),
    )

    const unsubscribeMessages = onSnapshot(messagesQuery, (snapshot) => {
      const messageData = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
        timestamp: doc.data().timestamp?.toDate(),
      })) as Message[]

      setMessages(messageData)
    })

    return () => {
      unsubscribeDiscussion()
      unsubscribeMessages()
    }
  }, [id])

  if (loading) {
    return (
      <div className="container mx-auto py-8 px-4">
        <div className="text-center">토론을 불러오는 중...</div>
      </div>
    )
  }

  if (!discussion) {
    return (
      <div className="container mx-auto py-8 px-4">
        <div className="text-center">토론을 찾을 수 없습니다.</div>
      </div>
    )
  }

  return <DiscussionRoom discussion={discussion} messages={messages} currentUser={user} />
}
