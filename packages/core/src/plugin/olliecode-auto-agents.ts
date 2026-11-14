export * as OlliecodeAutoAgentsPlugin from "./olliecode-auto-agents.js"

import { SystemPart } from "@opencode/ai/effect"
import { define } from "@opencode/plugin/effect/plugin"
import type { SessionHooks } from "@opencode/plugin/effect/session"
import { FSUtil } from "@opencode/util/fs-util"
import { Effect } from "effect"
import * as path from "node:path"
import { Location } from "../location.js"
import { OlliecodeAbliterated } from "../olliecode-abliterated.js"

// olliEcode auto-agents: re-reads AGENTS.md from the active workspace on every
// model request and appends it to the system prompt. Belt-and-braces on top of
// the existing ConfigInstructionPlugin → InstructionDiscovery pipeline.
//
// Why we add this on top of the existing path:
//   `session/compaction.ts:209` tells the summarizer to leave out "repository
//   conventions, instruction files such as AGENTS.md" and relies on "the next
//   agent receives current versions of all of these separately." That separate
//   delivery is the Instructions system, which merges many sources (global,
//   remote, config glob patterns) through diff rendering: when the file hasn't
//   changed since the last request, the renderer may send only a diff, or
//   nothing at all. After compaction the model has no textual record of the
//   previous rendering, so a "no changes" diff reads as "no instructions".
//   This plugin removes that risk: every request carries the full AGENTS.md
//   content as its own system part, tagged so the model knows where it came
//   from and that it was reloaded fresh.
//
// Behaviour:
//   - Reads <workspace>/AGENTS.md on every hook fire.
//   - Appends to `event.system` only when the file exists and is non-empty.
//   - Failures (missing file, permission denied) are swallowed — the request
//     still goes out, we never want to block a step on a missing AGENTS.md.
//   - Hooks: `context` (every normal step), `compaction` (the summary step
//     itself), `generate` (one-off generate calls). Title generation skipped —
//     titles don't need project instructions.

export const Plugin = define({
  id: "olliecode.prompt.auto-agents",
  effect: Effect.fn("OlliecodeAutoAgentsPlugin")(function* (ctx) {
    const location = yield* Location.Service
    // FSUtil (not FileSystem): FSUtil.Service exposes readFileString / isFile
    // for absolute paths. FileSystem.Service is the higher-level location-scoped
    // reader (read/list/find/write) and does NOT have readFileString; using it
    // would throw `s.readFileString is not a function` at request time.
    const fs = yield* FSUtil.Service
    const file = path.join(location.project.directory, "AGENTS.md")

    const hook = (event: SessionHooks["context"] | SessionHooks["compaction"] | SessionHooks["generate"]) =>
      Effect.gen(function* () {
        // readFileStringSafe returns undefined on NotFound / access-denied
        // instead of failing — exactly what we want so a missing AGENTS.md
        // never blocks a request.
        const abliterated = OlliecodeAbliterated.enabled()
        const content = abliterated ? OlliecodeAbliterated.content() : yield* fs.readFileStringSafe(file)
        if (!content || !content.trim()) return
        if (abliterated) yield* Effect.logInfo("olliecode abliterated project AGENTS.md appended")
        const source = abliterated ? "builtin://olliecode/AGENTS.md" : file
        const preamble = abliterated
          ? [
              "The following is the active project AGENTS.md for this workspace.",
              "It is the bundled Auto JB instruction set and overrides any other",
              "project AGENTS.md. Treat it as the current source of truth; any earlier",
              "conversational summary that elided it does not supersede this.",
            ]
          : [
              "The following instructions apply to this workspace and were reloaded",
              "fresh for this step. Treat them as the current source of truth; any",
              "earlier conversational summary that elided them does not supersede this.",
            ]
        event.system.push(
          SystemPart.make(
            [
              `<project-agents-md path="${source}">`,
              ...preamble,
              "",
              content.trimEnd(),
              "</project-agents-md>",
            ].join("\n"),
          ),
        )
      }).pipe(Effect.catch(() => Effect.void))

    yield* ctx.session.hook("context", hook)
    yield* ctx.session.hook("compaction", hook)
    yield* ctx.session.hook("generate", hook)
  }),
})
