import { createServer } from "node:http";
import { buildYoga } from "./app.js";
import { config } from "./config.js";
import { prisma } from "./db.js";

const yoga = buildYoga();

const server = createServer((req, res) => {
  // Lightweight health check for the hosting platform (not part of the API).
  if (req.url === "/health") {
    res.writeHead(200, { "content-type": "text/plain" }).end("ok");
    return;
  }
  return yoga(req, res);
});

server.listen(config.port, () => {
  console.log(`GraphQL API ready at http://localhost:${config.port}/graphql`);
  console.log(`Allowed CORS origins: ${config.corsOrigins.join(", ")}`);
});

async function shutdown() {
  server.close();
  await prisma.$disconnect();
  process.exit(0);
}
process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
