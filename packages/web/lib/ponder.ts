import { createClient } from "@ponder/client";
import * as schema from "../../indexer/ponder.schema";

// Deliberately a plain relative import across the workspace boundary, not a
// package dependency — this is @ponder/client's own recommended pattern
// (see ponder's official with-nextjs example): `schema` here is just a
// drizzle table-shape descriptor the client needs to type its queries, not
// business logic, so it's a narrower exception than e.g. packages/cron's
// choice to duplicate ABIs rather than import them from packages/web.

const PONDER_URL = process.env.NEXT_PUBLIC_PONDER_URL ?? "http://localhost:42069";

export const ponderClient = createClient(`${PONDER_URL}/sql`, { schema });
export { schema };

// Registers `schema` globally with @ponder/react via declaration merging, so
// `usePonderQuery`'s `db` callback param (and the relational `db.query.*`
// builder) are typed against our actual tables everywhere, not just at this
// createClient call site — see Ponder's SQL-over-HTTP docs' "Relational
// query builder" section.
declare module "@ponder/react" {
  interface Register {
    schema: typeof schema;
  }
}
