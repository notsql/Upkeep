import path from "node:path";

import dotenv from "dotenv";
import { defineConfig } from "prisma/config";

dotenv.config({
  path: ".env",
});

export default defineConfig({
  datasource: {
    // Not `env()`: that throws when unset, and `prisma generate` (run on
    // install) needs no database. Commands that do connect fail on their own.
    url: process.env.DATABASE_URL,
  },
  migrations: {
    path: path.join("prisma", "migrations"),
  },
  schema: path.join("prisma", "schema"),
});
