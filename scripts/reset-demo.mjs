import { unlinkSync } from "node:fs";
import { join } from "node:path";

const statePath = join(process.cwd(), ".data", "demo-state.json");
unlinkSync(statePath, { force: true });
console.log("Demo state cleared. The next app request will load the salon fixture.");
