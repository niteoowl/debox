"use client"

import { useState, useEffect } from "react"
import {
  type User,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
} from "firebase/auth"
import { doc, setDoc, getDoc } from "firebase/firestore"
import { auth, db } from "@/lib/firebase"

export function useAuth() {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // 빠른 초기화를 위한 타임아웃
    const timeout = setTimeout(() => {
      setLoading(false)
    }, 2000)

    const unsubscribe = onAuthStateChanged(auth, (user) => {
      clearTimeout(timeout)
      setUser(user)
      setLoading(false)
    })

    return () => {
      clearTimeout(timeout)
      unsubscribe()
    }
  }, [])

  const signIn = async (email: string, password: string) => {
    try {
      await signInWithEmailAndPassword(auth, email, password)
    } catch (error) {
      throw error
    }
  }

  const signUp = async (email: string, password: string, username: string) => {
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password)

      // Firestore에 사용자 정보 저장 (에러 시 무시)
      try {
        await setDoc(doc(db, "users", userCredential.user.uid), {
          uid: userCredential.user.uid,
          email: userCredential.user.email,
          username,
          createdAt: new Date(),
        })
      } catch (firestoreError) {
        console.log("사용자 정보 저장 실패:", firestoreError)
      }
    } catch (error) {
      throw error
    }
  }

  const logout = async () => {
    try {
      await signOut(auth)
    } catch (error) {
      throw error
    }
  }

  const getUserData = async (uid: string) => {
    try {
      const userDoc = await getDoc(doc(db, "users", uid))
      return userDoc.exists() ? userDoc.data() : null
    } catch (error) {
      console.error("Error fetching user data:", error)
      return null
    }
  }

  return {
    user,
    loading,
    signIn,
    signUp,
    logout,
    getUserData,
  }
}
