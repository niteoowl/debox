"use client"
import { useAuth } from "@/hooks/useAuth"
import AuthForm from "@/components/auth/auth-form"
import DiscussionList from "@/components/discussion/discussion-list"
import { Toaster } from "@/components/ui/toaster"

export default function Home() {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-lg">로딩 중...</div>
      </div>
    )
  }

  if (!user) {
    return (
      <>
        <AuthForm />
        <Toaster />
      </>
    )
  }

  return (
    <>
      <DiscussionList />
      <Toaster />
    </>
  )
}
