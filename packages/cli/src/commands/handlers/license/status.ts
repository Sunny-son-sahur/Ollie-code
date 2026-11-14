import { EOL } from "node:os"
import { Effect } from "effect"
import { Commands } from "../../commands"
import { Runtime } from "../../../framework/runtime"
import { Licensing } from "../../../services/licensing"

export default Runtime.handler(
  Commands.commands.license.commands.status,
  Effect.fn("cli.license.status")(function* () {
    const s = yield* Licensing.status.pipe(Effect.provide(Licensing.layer))
    if (!s.active) {
      process.stdout.write(`inactive${s.reason ? ` (${s.reason})` : ""}${EOL}`)
      process.exitCode = 1
      return
    }
    const expires = s.expires_at === 0 ? "never" : new Date(s.expires_at * 1000).toISOString().slice(0, 10)
    process.stdout.write(`active${EOL}  key:     ${s.key}${EOL}  tier:    ${s.tier}${EOL}  expires: ${expires}${EOL}`)
  }),
)
