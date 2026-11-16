import { afterAll, beforeAll, expect, test } from "bun:test"
import { installFreeLimitFallbackOverride } from "./olliecode-impersonate-fetch.js"

const OPENCODE_CHAT = "https://opencode.ai/inference/openai/v1/chat/completions"
const POLLINATIONS = "https://text.pollinations.ai/openai"

const CHAT_BODY = JSON.stringify({
  model: "deepseek-v4.1-flash-free",
  messages: [{ role: "user", content: "say ok" }],
})

type Call = { url: string; method: string }
const calls: Call[] = []

// What the doomed opencode.ai probe answers. Swapped per test below.
let chatBehaviour: () => Response = () =>
  new Response('{"ok":true}', { status: 200, headers: { "content-type": "application/json" } })

const realFetch = globalThis.fetch

// The override captures globalThis.fetch at install time, so the stub has to
// be in place first. Everything the fallback chain reaches (relay, deepseek,
// pollinations) lands here too — no test traffic leaves the process.
function stubFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const url =
    typeof input === "string" ? input : input instanceof URL ? input.href : (input as Request).url
  const method = (init?.method ?? (input instanceof Request ? input.method : "GET")).toUpperCase()
  calls.push({ url, method })

  if (url === OPENCODE_CHAT) return Promise.resolve(chatBehaviour())
  if (url === POLLINATIONS) {
    return Promise.resolve(
      new Response(JSON.stringify({ choices: [{ message: { role: "assistant", content: "ok" } }] }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    )
  }
  // The dead default relay and any other downstream: refuse, chain moves on.
  return Promise.resolve(new Response("downstream unavailable", { status: 503 }))
}

beforeAll(() => {
  // Pin the chain to pollinations so the deepseek-key lookup (auth.json /
  // credential db on the host) can't change the outcome between machines.
  process.env.OLLIECODE_FREE_FALLBACK_PROVIDER = "pollinations"
  ;(globalThis as { fetch: typeof globalThis.fetch }).fetch = stubFetch as typeof globalThis.fetch
  const result = installFreeLimitFallbackOverride()
  expect(result.installed).toBe(true)
})

afterAll(() => {
  ;(globalThis as { fetch: typeof globalThis.fetch }).fetch = realFetch
  delete process.env.OLLIECODE_FREE_FALLBACK_PROVIDER
})

test("non-opencode hosts pass straight through", async () => {
  calls.length = 0
  const res = await fetch("https://example.com/v1/chat/completions", {
    method: "POST",
    body: CHAT_BODY,
  })
  expect(res.status).toBe(503)
  expect(calls).toHaveLength(1)
  expect(calls[0]!.url).toBe("https://example.com/v1/chat/completions")
})

test("opencode.ai routes that are not chat completions pass straight through", async () => {
  calls.length = 0
  const res = await fetch("https://opencode.ai/models", { method: "GET" })
  expect(res.status).toBe(503)
  expect(calls).toHaveLength(1)
  expect(calls[0]!.url).toBe("https://opencode.ai/models")
})

test("a healthy opencode.ai chat response is returned untouched, with no fallback probing", async () => {
  calls.length = 0
  const res = await fetch(OPENCODE_CHAT, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: CHAT_BODY,
  })
  expect(res.status).toBe(200)
  expect(await res.text()).toBe('{"ok":true}')
  expect(calls).toHaveLength(1)
  expect(calls.some((c) => c.url === POLLINATIONS)).toBe(false)
})

test("a 429 that is not FreeUsageLimit comes back unchanged, without touching the fallback", async () => {
  chatBehaviour = () =>
    new Response(JSON.stringify({ error: { message: "slow down" } }), {
      status: 429,
      headers: { "content-type": "application/json", "retry-after": "5" },
    })
  calls.length = 0
  const res = await fetch(OPENCODE_CHAT, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: CHAT_BODY,
  })
  expect(res.status).toBe(429)
  expect(await res.text()).toContain("slow down")
  expect(calls).toHaveLength(1)
  expect(calls.some((c) => c.url === POLLINATIONS)).toBe(false)
})

// Last on purpose: the FreeUsageLimit 429 stamps the process-wide cooldown,
// which makes every later request skip the opencode.ai probe entirely.
test("a FreeUsageLimit 429 is served from the fallback chain", async () => {
  chatBehaviour = () =>
    new Response(
      JSON.stringify({
        type: "error",
        error: { type: "FreeUsageLimitError", message: "Free usage limit reached." },
      }),
      { status: 429, headers: { "content-type": "application/json", "retry-after": "79053" } },
    )
  calls.length = 0
  const res = await fetch(OPENCODE_CHAT, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: CHAT_BODY,
  })
  expect(res.status).toBe(200)
  expect(await res.text()).toContain('"content":"ok"')

  const urls = calls.map((c) => c.url)
  expect(urls[0]).toBe(OPENCODE_CHAT)
  expect(urls).toContain("https://license.example.com/api/free/chat")
  expect(urls).toContain(POLLINATIONS)
})
