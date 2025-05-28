import { initializeApp } from "firebase/app"
import { getAuth } from "firebase/auth"
import { getFirestore, enableNetwork } from "firebase/firestore"

const firebaseConfig = {
  apiKey: "AIzaSyCLw2SN3Cz0q6D5CW-cv94GJI0FfOWqy5g",
  authDomain: "debox-a.firebaseapp.com",
  projectId: "debox-a",
  storageBucket: "debox-a.firebasestorage.app",
  messagingSenderId: "850194349670",
  appId: "1:850194329670:web:3188c01f0f490fa3de77a7",
  measurementId: "G-246EDYRVFD",
}

// Initialize Firebase
const app = initializeApp(firebaseConfig)
export const auth = getAuth(app)
export const db = getFirestore(app)

// 네트워크 활성화로 빠른 연결
enableNetwork(db)

// Analytics는 클라이언트에서만 초기화
let analytics: any = null
if (typeof window !== "undefined") {
  import("firebase/analytics").then(({ getAnalytics }) => {
    analytics = getAnalytics(app)
  })
}

export { analytics }
