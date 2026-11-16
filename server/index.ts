import { z } from "zod";
import { accountIdSchema, classificationSchema, transactionIdSchema } from "../src/domain/types";
import { ImportError, parseWealthsimple } from "../src/import/wealthsimple";
import { planSchema } from "../src/model";
import {
  importParsed,
  openDb,
  reclassify,
  savePlan,
  setHomeShare,
  snapshot,
} from "./db";

const dbPath = process.env["FINGUIN_DB"] ?? `${import.meta.dir}/../data/finguin.db`;
const port = Number(process.env["FINGUIN_API_PORT"] ?? 5187);
const db = openDb(dbPath);

const importBody = z.object({ fileName: z.string().min(1), text: z.string().max(20_000_000) });
const classifyBody = z.object({ classification: classificationSchema });
const accountBody = z.object({ homeShare: z.number().min(0).max(1) });
async function body<T>(req: Request, schema: z.ZodType<T>) {
  return schema.parse(await req.json());
}

Bun.serve({
  hostname: "127.0.0.1",
  port,
  routes: {
    "/api/snapshot": { GET: () => Response.json(snapshot(db)) },
    "/api/import": {
      POST: async (req) => {
        const { fileName, text } = await body(req, importBody);
        return Response.json(importParsed(db, parseWealthsimple(text), fileName));
      },
    },
    "/api/transactions/:id": {
      PATCH: async (req) => {
        const { classification } = await body(req, classifyBody);
        reclassify(db, transactionIdSchema.parse(req.params.id), classification);
        return new Response(null, { status: 204 });
      },
    },
    "/api/accounts/:id": {
      PATCH: async (req) => {
        const { homeShare } = await body(req, accountBody);
        setHomeShare(db, accountIdSchema.parse(req.params.id), homeShare);
        return new Response(null, { status: 204 });
      },
    },
    "/api/plan": {
      PUT: async (req) => {
        savePlan(db, await body(req, planSchema));
        return new Response(null, { status: 204 });
      },
    },
  },
  error(error) {
    const status = error instanceof z.ZodError || error instanceof ImportError ? 400 : 500;
    return Response.json({ error: error.message }, { status });
  },
});
console.log(`finguin api on http://127.0.0.1:${port} · db ${dbPath}`);
