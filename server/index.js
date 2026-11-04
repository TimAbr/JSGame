import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createClock } from "./data/common/Clock.js";
import { createPgStore } from "./data/common/PgStore.js";
import { createGameRepository } from "./data/game/GameRepository.js";
import { createStaticHandler } from "./api/common/static.js";
import { createGateway } from "./api/common/gateway.js";

const root = path.dirname(fileURLToPath(import.meta.url));
const port = Number(process.env.PORT) || 3000;
const databaseUrl = process.env.DATABASE_URL || "postgres://maze:maze@127.0.0.1:5432/maze";
const clock = createClock();
const store = await createPgStore(databaseUrl);
const repository = await createGameRepository(store, clock);
const serve = createStaticHandler(path.join(root, "..", "client"));

const server = http.createServer((req, res) => {
  if (req.method !== "GET" && req.method !== "HEAD") {
    res.writeHead(405);
    res.end("Method not allowed");
    return;
  }
  serve(req, res);
});

createGateway({ server, repository, clock });

server.listen(port, () => {
  console.log(`maze listening on ${port}`);
});
