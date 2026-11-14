import { EOL } from "node:os"
import { Effect, Option } from "effect"
import { Commands } from "../../commands"
import { Runtime } from "../../../framework/runtime"
import { Licensing } from "../../../services/licensing"

export default Runtime.handler(
  Commands.commands.license.commands.activate,
  Effect.fn("cli.license.activate")(function* (input) {
    const email = Option.getOrUndefined(input.email)
    const result = yield* Licensing.activate(input.key, email).pipe(Effect.provide(Licensing.layer))
    const expires =
      result.expires_at === 0 ? "never" : new Date(result.expires_at * 1000).toISOString().slice(0, 10)
    process.stdout.write(`activated: tier ${result.tier}, expires ${expires}${EOL}`)
  }),
)
