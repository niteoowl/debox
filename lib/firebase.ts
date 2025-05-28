import { initializeApp } from "firebase/app"
import { getAuth } from "firebase/auth"
import { getFirestore } from "firebase/firestore"

const firebaseConfig = {
  apiKey: "AIzaSyCLw2SN3Cz0q6D5CW-cv94GJI0FfOWqy5g",
  authDomain: "debox-a.firebaseapp.com",
  projectId: "debox-a",
  storageBucket: "debox-a.firebasestorage.app",
  messagingSenderId: "850194349670",
  appId: "1:850194349670:web:3188c01f0f490fa3de77a7",
  measurementId: "G-246EDYRVFD",
}

// Initialize Firebase
const app = initializeApp(firebaseConfig)
export const auth = getAuth(app)
export const db = getFirestore(app)

// 개발 환경에서 에뮬레이터 연결 (로컬 테스트용)
if (typeof window !== "undefined" && process.env.NODE_ENV === "development") {
  // Firebase 에뮬레이터 설정 코드는 주석 처리
  // import { connectFirestoreEmulator } from "firebase/firestore";
  // connectFirestoreEmulator(db, "localhost", 8080);
}

// Analytics는 클라이언트에서만 초기화
let analytics: any = null
if (typeof window !== "undefined") {
  import("firebase/analytics").then(({ getAnalytics }) => {
    try {
      analytics = getAnalytics(app)
    } catch (error) {
      console.log("Analytics 초기화 실패")
    }
  })
}

export { analytics }
