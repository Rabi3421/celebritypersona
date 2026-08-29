/**
 * Starts a throwaway MongoDB on a fixed port for local development and for
 * verifying the migration without touching Atlas. Keeps running until killed.
 */
import { MongoMemoryServer } from "mongodb-memory-server";

const server = await MongoMemoryServer.create({
  instance: { port: 27018, dbName: "celebritypersona" },
});

console.log(`local mongodb ready: ${server.getUri()}`);
process.on("SIGINT", async () => { await server.stop(); process.exit(0); });
process.on("SIGTERM", async () => { await server.stop(); process.exit(0); });
setInterval(() => {}, 1 << 30);
