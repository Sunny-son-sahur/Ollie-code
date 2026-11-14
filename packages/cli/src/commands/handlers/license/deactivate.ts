import { EOL } from "node:os"
import { Effect } from "effect"
import { Commands } from "../../commands"
import { Runtime } from "../../../framework/runtime"
import { Licensing } from "../../../services/licensing"

export default Runtime.handler(
  Commands.commands.license.commands.deactivate,
  Effect.fn("cli.license.deactivate")(function* () {
    yield* Licensing.deactivate.pipe(Effect.provide(Licensing.layer))
    process.stdout.write(`deactivated${EOL}`)
  }),
)
