import { db } from "ponder:api";
import schema from "ponder:schema";
import { Hono } from "hono";
import { client, graphql } from "ponder";

const app = new Hono();

// packages/web queries this over SQL-over-HTTP via @ponder/client/@ponder/react
// (see lib/ponder.ts) — typed, no query language of its own to hand-write.
app.use("/sql/*", client({ db, schema }));

// Kept alongside /sql for ad-hoc exploration (GraphiQL) and debugging —
// packages/web doesn't use this route.
app.use("/", graphql({ db, schema }));

export default app;
