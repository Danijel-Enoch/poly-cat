import { db } from "ponder:api";
import schema from "ponder:schema";
import { Hono } from "hono";
import { client, graphql } from "ponder";

const app = new Hono();

// packages/web queries this route (plain GraphQL over HTTP, hand-rolled
// `fetch` calls — see lib/indexerApi.ts) for everything: the home page grid,
// admin's live markets table and full history, and the portfolio page's
// "needs redeeming" list.
app.use("/", graphql({ db, schema }));

// Kept available for ad-hoc debugging/exploration (a direct SQL client, a
// future non-GraphQL consumer) even though packages/web doesn't use it.
app.use("/sql/*", client({ db, schema }));

export default app;
