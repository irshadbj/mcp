import * as notes from "./notes.js";
import * as pages from "./pages.js";
import * as skills from "./skills.js";
import * as memories from "./memoryHandler.js";
import * as tasks from "./taskHandler.js";

const handlers = [notes, pages, skills, memories, tasks];

export const toolDefinitions = handlers.flatMap(handler => handler.tools);

export async function callTool(tool, args, env, origin) {
  for (const handler of handlers) {
    const result = await handler.call(tool, args, env, origin);
    if (result !== undefined) return result;
  }
  return undefined;
}
