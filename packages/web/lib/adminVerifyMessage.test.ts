import { describe, expect, it } from "vitest";
import { verificationMessage } from "./adminVerifyMessage";

// This exact string is signed by the admin dashboard and independently
// reconstructed by app/api/admin/verify-market to recover the signer — if
// this format ever drifts between a future edit to one call site and not
// the other, every admin signature silently stops verifying. Pinning the
// literal output here catches that regardless of which side changes.
describe("verificationMessage", () => {
  it("produces the exact wire format both client and server rely on", () => {
    expect(verificationMessage("42", true, 1700000000000)).toBe(
      "HoodMarkets admin: set market #42 verified=true at 1700000000000",
    );
    expect(verificationMessage("7", false, 1)).toBe("HoodMarkets admin: set market #7 verified=false at 1");
  });
});
