import { NextRequest } from "next/server"

const API_ORIGIN = (
  process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8000"
).replace(/\/$/, "")

export const dynamic = "force-dynamic"
export const runtime = "nodejs"
export const maxDuration = 300

/**
 * Proxies the document event stream. Next rewrites buffer SSE, so the
 * Library never saw pushes from the extension. This route streams chunks
 * through as they arrive.
 */
export async function GET(request: NextRequest) {
  const upstream = await fetch(`${API_ORIGIN}/documents/events`, {
    headers: {
      Accept: "text/event-stream",
      Cookie: request.headers.get("cookie") ?? "",
    },
    cache: "no-store",
    signal: request.signal,
  })

  if (!upstream.ok || !upstream.body) {
    const detail = await upstream.text().catch(() => upstream.statusText)
    return new Response(detail || "Document events unavailable", {
      status: upstream.status || 502,
    })
  }

  return new Response(upstream.body, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  })
}
