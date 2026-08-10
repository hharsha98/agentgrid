import { readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const confPath = join(root, "src-tauri", "tauri.conf.json");
const cargoPath = join(root, "src-tauri", "Cargo.toml");

if (!existsSync(confPath)) throw new Error(`missing ${confPath}`);
if (!existsSync(cargoPath)) throw new Error(`missing ${cargoPath}`);

const conf = JSON.parse(readFileSync(confPath, "utf8"));
if (conf.productName !== "agentgrid") {
  throw new Error(`expected productName agentgrid, got ${conf.productName}`);
}
if (conf.identifier !== "com.agentgrid.app") {
  throw new Error(`expected identifier com.agentgrid.app`);
}
if (!String(conf.build?.devUrl || "").includes("5318")) {
  throw new Error("devUrl must point at web port 5318");
}
if (!String(conf.build?.frontendDist || "").includes("web/dist")) {
  throw new Error("frontendDist must point at apps/web/dist");
}

console.log("desktop config ok:", conf.productName, conf.identifier);
