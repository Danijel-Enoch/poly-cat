import { describe, expect, it } from "vitest";
import { encodeMetadataURI, parseMetadataURI } from "./category";

describe("category encode/parse roundtrip", () => {
  it("round-trips category + title with no image", () => {
    const uri = encodeMetadataURI("Crypto", "Will BTC hit $100k?");
    expect(uri).toBe("[Crypto]Will BTC hit $100k?");
    expect(parseMetadataURI(uri)).toEqual({
      category: "Crypto",
      image: null,
      title: "Will BTC hit $100k?",
    });
  });

  it("round-trips category + image CID + title", () => {
    const uri = encodeMetadataURI("Politics", "Will it happen?", "QmTestCid123");
    expect(parseMetadataURI(uri)).toEqual({
      category: "Politics",
      image: "QmTestCid123",
      title: "Will it happen?",
    });
  });

  it("parses a pre-category legacy market (no tags at all) as a bare title", () => {
    expect(parseMetadataURI("Will it rain tomorrow?")).toEqual({
      category: null,
      image: null,
      title: "Will it rain tomorrow?",
    });
  });

  it("treats an unrecognized bracket tag as part of the title, not a category", () => {
    const result = parseMetadataURI("[NotACategory]Some question");
    expect(result.category).toBeNull();
    expect(result.title).toBe("[NotACategory]Some question");
  });

  it("never confuses the image tag for the title when image is present but category isn't", () => {
    // Not producible via encodeMetadataURI (category is required), but parse
    // must still handle it gracefully since it's just string matching.
    const result = parseMetadataURI("[img:QmAbc]Bare question, no category tag");
    expect(result).toEqual({
      category: null,
      image: "QmAbc",
      title: "Bare question, no category tag",
    });
  });
});
