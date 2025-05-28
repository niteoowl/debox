"use client"
import { useAuth } from "@/hooks/useAuth"
import DiscussionList from "@/components/discussion/discussion-list"
import { Toaster } from "@/components/ui/toaster"

export default function Home() {
  const { loading } = useAuth()

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-lg">로딩 중...</div>
      </div>
    )
  }

  return (
    <>
      <DiscussionList />
      <Toaster />
    </>
  )
}
