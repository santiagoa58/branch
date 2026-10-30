import pg from "pg";
import { attachDatabasePool } from "@vercel/functions";
import { serverEnvSchema } from "../src/schemas/server";
import type { Database, Queryable } from "./repository";

let pool: pg.Pool | undefined;
function getPool() {
  if (!pool) {
    const env = serverEnvSchema.parse(process.env);
    pool = new pg.Pool({
      connectionString: env.DATABASE_URL,
      max: 5,
      idleTimeoutMillis: 5000,
      connectionTimeoutMillis: 10000,
    });
    attachDatabasePool(pool);
    pool.on("error", (error) => console.error("Idle database connection failed", error));
  }
  return pool;
}
function queries(client: pg.Pool | pg.PoolClient): Queryable {
  return {
    query: async (text, values = []) => {
      const result = await client.query(text, [...values]);
      return { rows: result.rows, rowCount: result.rowCount };
    },
  };
}
export const database: Database = {
  query: (text, values) => queries(getPool()).query(text, values),
  transaction: async (run) => {
    const client = await getPool().connect();
    try {
      await client.query("BEGIN");
      const result = await run(queries(client));
      await client.query("COMMIT");
      return result;
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  },
};
