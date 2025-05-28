import { initializeApp } from "firebase/app"
import { getAuth } from "firebase/auth"
import { getFirestore } from "firebase/firestore"
import { getAnalytics } from "firebase/analytics"

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
let app
let auth
let db
let analytics = null

try {
  app = initializeApp(firebaseConfig)
  auth = getAuth(app)
  db = getFirestore(app)

  // Analytics는 클라이언트에서만 초기화
  if (typeof window !== "undefined") {
    analytics = getAnalytics(app)
  }

  console.log("Firebase initialized successfully")
} catch (error) {
  console.error("Firebase initialization error:", error)
}

export { auth, db, analytics }
