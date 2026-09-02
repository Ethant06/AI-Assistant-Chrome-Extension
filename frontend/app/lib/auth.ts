/**
 * Auth helpers
 *
 * The JWT lives in an HTTPOnly cookie set by the backend - JavaScript cannot read
 * or write it. There is no token storage here.
 *
 * To check authentication status, call the API rather than checking local state,
 * since the cookie is invisible to JavaScript
 */

import { getCurrentUser } from "@/lib/api"
import type { User } from "@/types/api"


/**
 * Verifies authentication by calling GET /auth/me.
 * Returns the user if the cookie is valid, null otherwise
 */
export async function checkAuth(): Promise<User | null> {
  try {
    return await getCurrentUser()
  } catch {
    return null
  }
}