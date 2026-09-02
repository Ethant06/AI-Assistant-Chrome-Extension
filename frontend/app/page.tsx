"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { Loader2 } from "lucide-react"
import { getCurrentUser } from "@/lib/api"


/**
 * Root route — decides where to send the user.
 *
 * Because the session lives in an httpOnly cookie that JavaScript can't
 * read, we call GET /auth/me to find out whether a valid session exists.
 * Success means they're logged in, failure means they aren't.
 */
export default function Home() {
  const router = useRouter()


  useEffect(() => {
    getCurrentUser()
      .then(() => router.replace("/documents"))
      .catch(() => router.replace("/login"))
  }, [router])


   return (
        <div className="min-h-screen flex items-center justify-center">
            <Loader2 className="size-6 animate-spin text-muted-foreground" />
        </div>
    )
}