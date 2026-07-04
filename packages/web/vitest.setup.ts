import "@testing-library/jest-dom/vitest";
import { afterEach } from "vitest";
import { cleanup } from "@testing-library/react";

// Explicit rather than relying on RTL's auto-cleanup (which only
// self-registers when it detects `afterEach` as a global, and this project
// doesn't turn on vitest's `globals` option). Without an unmount between
// tests, React 19's scheduler can still have pending work queued against a
// component from a previous test when the next test's jsdom environment
// tears down, surfacing as an "unhandled" `window is not defined` error.
afterEach(() => {
  cleanup();
});
