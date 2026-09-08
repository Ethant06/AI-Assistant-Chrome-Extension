const API_URL = "http://127.0.0.1:8000"
const MAX_INSTANT_CHARS = 50_000

const SUMMARIZE_PROMPT =
  "Summarize this page in a few short paragraphs. Cover the main idea and the most important points."

const SENSITIVE_PATTERNS = [
  /\.bank/i,
  /chase\.com/i,
  /wellsfargo\.com/i,
  /bankofamerica\.com/i,
  /paypal\.com/i,
  /mail\.google\.com/i,
  /outlook\.(live|office)\./i,
  /\/(account|settings|billing|checkout|password)/i,
]

const loginView = document.getElementById("loginView")
const mainView = document.getElementById("mainView")
const emailInput = document.getElementById("email")
const passwordInput = document.getElementById("password")
const loginBtn = document.getElementById("loginBtn")
const loginStatus = document.getElementById("loginStatus")
const pageTitleEl = document.getElementById("pageTitle")
const questionInput = document.getElementById("question")
const askBtn = document.getElementById("askBtn")
const summarizeBtn = document.getElementById("summarizeBtn")
const saveBtn = document.getElementById("saveBtn")
const logoutBtn = document.getElementById("logoutBtn")
const statusEl = document.getElementById("status")
const answerEl = document.getElementById("answer")

/** { title, url, content } from the active tab */
let pageData = null

function showLogin() {
  mainView.classList.add("hidden")
  loginView.classList.remove("hidden")
}

function showMain() {
  loginView.classList.add("hidden")
  mainView.classList.remove("hidden")
}

function setStatus(message, isError = false) {
  statusEl.textContent = message
  statusEl.className = isError ? "status error" : "status"
}

async function readError(res, fallback) {
  const err = await res.json().catch(() => ({ detail: fallback }))
  const detail = err.detail
  if (Array.isArray(detail)) {
    return detail.map((item) => item.msg ?? JSON.stringify(item)).join(", ")
  }
  return typeof detail === "string" ? detail : fallback
}

function networkMessage(err) {
  if (err instanceof TypeError) {
    return "Can't reach the API. Start FastAPI on port 8000 and try again."
  }
  return err.message
}

function extensionStorage() {
  if (!chrome?.storage?.local) {
    throw new Error(
      "Reload PagePilot on chrome://extensions. Open it from the toolbar icon, not by opening popup.html."
    )
  }
  return chrome.storage.local
}

async function getToken() {
  const { token } = await extensionStorage().get("token")
  return token ?? null
}

async function handleExpiredToken() {
  await extensionStorage().remove(["token", "email"])
  showLogin()
  loginStatus.textContent = "Session expired. Please sign in again."
  loginStatus.className = "status error"
}

async function getPageData() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
  const [injection] = await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: () => {
      const clone = document.body.cloneNode(true)
      clone
        .querySelectorAll(
          "script, style, nav, footer, header, aside, noscript, " +
            "iframe, svg, input, textarea, select, [contenteditable]"
        )
        .forEach((el) => el.remove())
      return {
        title: document.title,
        url: window.location.href,
        content: clone.innerText.replace(/\s+/g, " ").trim(),
      }
    },
  })
  return injection.result
}

async function loadPage() {
  try {
    pageData = await getPageData()
    pageTitleEl.textContent = pageData.title || pageData.url
    askBtn.disabled = false
    summarizeBtn.disabled = false
    saveBtn.disabled = false
  } catch {
    pageData = null
    pageTitleEl.textContent = "Can't read this page"
    askBtn.disabled = true
    summarizeBtn.disabled = true
    saveBtn.disabled = true
  }
}

async function handleLogin() {
  const email = emailInput.value.trim()
  const password = passwordInput.value

  if (!email || !password) {
    loginStatus.textContent = "Enter your email and password"
    loginStatus.className = "status error"
    return
  }

  loginBtn.disabled = true
  loginStatus.textContent = "Signing in..."
  loginStatus.className = "status"

  try {
    const res = await fetch(`${API_URL}/auth/login/token`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: email, password }),
    })
    if (!res.ok) throw new Error(await readError(res, "Sign in failed"))

    const { access_token } = await res.json()
    await extensionStorage().set({ token: access_token, email })
    passwordInput.value = ""
    loginStatus.textContent = ""
    showMain()
    await loadPage()
  } catch (err) {
    loginStatus.textContent = networkMessage(err)
    loginStatus.className = "status error"
  } finally {
    loginBtn.disabled = false
  }
}

async function handleLogout() {
  await extensionStorage().remove(["token", "email"])
  pageData = null
  showLogin()
}

async function streamAnswer(question) {
  const content = pageData?.content ?? ""
  if (!content) {
    setStatus("Nothing to ask about on this page.", true)
    return
  }
  if (content.length > MAX_INSTANT_CHARS) {
    setStatus("This is too long for a quick answer. Save it to your knowledge base instead.", true)
    return
  }

  askBtn.disabled = true
  summarizeBtn.disabled = true
  setStatus("Thinking...")
  answerEl.textContent = ""
  answerEl.classList.remove("hidden")

  try {
    const token = await getToken()
    const res = await fetch(`${API_URL}/chat/instant`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        question,
        page_content: content,
        page_url: pageData.url,
        page_title: pageData.title,
      }),
    })

    if (res.status === 401) return handleExpiredToken()
    if (!res.ok) throw new Error(await readError(res, "Request failed"))

    setStatus("")
    const reader = res.body.getReader()
    const decoder = new TextDecoder()
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      answerEl.textContent += decoder.decode(value)
      answerEl.scrollTop = answerEl.scrollHeight
    }
  } catch (err) {
    answerEl.classList.add("hidden")
    setStatus(err.message, true)
  } finally {
    askBtn.disabled = false
    summarizeBtn.disabled = false
  }
}

async function handleAsk() {
  const question = questionInput.value.trim()
  if (!question) {
    setStatus("Type a question first.", true)
    return
  }
  await streamAnswer(question)
}

async function waitUntilReady(id) {
  const started = Date.now()
  while (Date.now() - started < 120_000) {
    const token = await getToken()
    const res = await fetch(`${API_URL}/documents/${id}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (res.status === 401) {
      await handleExpiredToken()
      return false
    }
    if (!res.ok) throw new Error(await readError(res, "Could not check document status"))
    const doc = await res.json()
    if (doc.status === "ready") return true
    if (doc.status === "failed") throw new Error("Processing failed. Try saving again.")
    await new Promise((resolve) => setTimeout(resolve, 1000))
  }
  throw new Error("Still processing. Check the Library in a moment.")
}

async function handleSave() {
  if (!pageData?.content) {
    setStatus("Nothing to save on this page.", true)
    return
  }

  if (SENSITIVE_PATTERNS.some((pattern) => pattern.test(pageData.url))) {
    const proceed = confirm(
      "This page may contain private information.\n\nSave it to your knowledge base anyway?"
    )
    if (!proceed) return
  }

  saveBtn.disabled = true
  setStatus("Saving and processing...")

  try {
    const token = await getToken()
    const res = await fetch(`${API_URL}/documents/`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        title: pageData.title || pageData.url,
        raw_content: pageData.content,
        source_url: pageData.url,
      }),
    })

    if (res.status === 401) return handleExpiredToken()
    if (!res.ok) throw new Error(await readError(res, "Save failed"))

    const created = await res.json()
    const ready = await waitUntilReady(created.id)
    if (ready) setStatus("Saved and ready for chat in the Library.")
  } catch (err) {
    setStatus(err.message, true)
  } finally {
    saveBtn.disabled = false
  }
}

loginBtn.addEventListener("click", handleLogin)
logoutBtn.addEventListener("click", handleLogout)
askBtn.addEventListener("click", handleAsk)
summarizeBtn.addEventListener("click", () => streamAnswer(SUMMARIZE_PROMPT))
saveBtn.addEventListener("click", handleSave)

passwordInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") handleLogin()
})
questionInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault()
    handleAsk()
  }
})

try {
  extensionStorage().get(["token"]).then(async ({ token }) => {
    if (!token) {
      showLogin()
      return
    }
    showMain()
    await loadPage()
  })
} catch (err) {
  loginStatus.textContent = err.message
  loginStatus.className = "status error"
}
