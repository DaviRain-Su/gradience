import type { ToolRegistrar } from "./core/types.js";
import { registerMonadTools } from "./tools/monad-tools.js";

export default function registerOpenClawTools(registrar: ToolRegistrar): void {
  registerMonadTools(registrar);
}
