import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "./generated/prisma/client.js";
import { config } from "./config.js";

// One PrismaClient (and therefore one pg pool) per process.
const adapter = new PrismaPg({
  connectionString: config.databaseUrl,
  max: config.dbPoolMax,
});

export const prisma = new PrismaClient({ adapter });
