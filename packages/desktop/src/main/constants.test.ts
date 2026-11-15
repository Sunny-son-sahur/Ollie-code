import { afterEach, expect, mock, test } from "bun:test"

// Contract: packaged builds resolve a real app identity for every channel —
// the regression this exists for is a channel-keyed map missing its key,
// which made APP_ID undefined and crashed path.join(appData, undefined)
// before ready. constants.ts bakes import.meta.env.OPENCODE_CHANNEL and
// app.isPackaged at module load, so each case re-imports a fresh instance
// with a cache-busting query. import.meta.env mirrors process.env under
// bun, which is what makes the channel settable here. The electron mock
// stays registered for the rest of the run, so its shape has to keep
// every electron import in this package loadable — hence the default.
const originalChannel = process.env.OPENCODE_CHANNEL

function load(channel: string, isPackaged: boolean) {
  // default mirrors electron's CJS export shape: store.ts does
  // `import electron from "electron"` and bun's module mock rejects a
  // default import unless the stub provides one, even if never called.
  const app = { isPackaged, getVersion: () => "2027.1.1.9", getPath: () => "/tmp" }
  mock.module("electron", () => ({ app, default: { app } }))
  process.env.OPENCODE_CHANNEL = channel
  return import(`./constants.ts?channel=${channel}&packaged=${isPackaged}`)
}

afterEach(() => {
  if (originalChannel === undefined) delete process.env.OPENCODE_CHANNEL
  else process.env.OPENCODE_CHANNEL = originalChannel
})

// local's appId is deliberately dev's: electron-builder.config resolveChannel
// maps local -> dev, and the packaged appId must match the runtime APP_ID or
// userData splits across two directories.
const packaged = [
  { channel: "local", appId: "ai.opencode.desktop.dev", name: "olliEcode" },
  { channel: "dev", appId: "ai.opencode.desktop.dev", name: "olliEcode Dev" },
  { channel: "beta", appId: "ai.opencode.desktop.beta", name: "olliEcode Beta" },
  { channel: "prod", appId: "ai.opencode.desktop", name: "olliEcode" },
] as const

test.each(packaged)("packaged identity for $channel", async ({ channel, appId, name }) => {
  const m = await load(channel, true)
  expect(m.CHANNEL).toBe(channel)
  expect(m.APP_ID).toBe(appId)
  expect(m.APP_NAME).toBe(name)
  expect(m.VERSION).toBe("2027.1.1.9")
})

test("unpacked builds keep the dev identity regardless of channel", async () => {
  const m = await load("prod", false)
  expect(m.APP_ID).toBe("ai.opencode.desktop.dev")
  expect(m.APP_NAME).toBe("olliEcode")
})

test("unknown channel falls back to local", async () => {
  const m = await load("nightly", true)
  expect(m.CHANNEL).toBe("local")
  expect(m.APP_ID).toBe("ai.opencode.desktop.dev")
})
