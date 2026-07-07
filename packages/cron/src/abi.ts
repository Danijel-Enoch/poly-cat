// Hand-picked subset of MarketFactory's ABI — only the functions this cron
// script actually calls. The full ABI (for trading/redeeming/etc.) lives in
// packages/web/lib/abis/MarketFactoryAbi.ts; duplicating just this slice here
// keeps the cron package free of any dependency on the Next.js app.
export const MarketFactoryAbi = [
  {
    type: "function",
    name: "createMarket",
    stateMutability: "nonpayable",
    inputs: [
      { name: "assetId", type: "uint256" },
      { name: "startTime", type: "uint64" },
      { name: "closeTime", type: "uint64" },
      { name: "startPriceWad", type: "uint256" },
    ],
    outputs: [{ name: "marketId", type: "uint256" }],
  },
  {
    type: "function",
    name: "settleMarket",
    stateMutability: "nonpayable",
    inputs: [
      { name: "marketId", type: "uint256" },
      { name: "closePriceWad", type: "uint256" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "getMarket",
    stateMutability: "view",
    inputs: [{ name: "marketId", type: "uint256" }],
    outputs: [
      {
        name: "",
        type: "tuple",
        components: [
          { name: "assetId", type: "uint256" },
          { name: "startTime", type: "uint64" },
          { name: "closeTime", type: "uint64" },
          { name: "startPriceWad", type: "uint256" },
          { name: "closePriceWad", type: "uint256" },
          { name: "reserve", type: "uint256" },
          { name: "upSupply", type: "uint256" },
          { name: "downSupply", type: "uint256" },
          { name: "genesisSupply", type: "uint256" },
          { name: "collectedFees", type: "uint256" },
          { name: "state", type: "uint8" },
          { name: "outcome", type: "bool" },
        ],
      },
    ],
  },
  {
    type: "function",
    name: "getAsset",
    stateMutability: "view",
    inputs: [{ name: "assetId", type: "uint256" }],
    outputs: [
      {
        name: "",
        type: "tuple",
        components: [
          { name: "symbol", type: "string" },
          { name: "source", type: "uint8" },
          { name: "sourceId", type: "string" },
        ],
      },
    ],
  },
  {
    type: "function",
    name: "nextAssetId",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "currentMarketId",
    stateMutability: "view",
    inputs: [{ name: "", type: "uint256" }],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "owner",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "address" }],
  },
] as const;

export const MarketState = { Trading: 0, Finalized: 1, Cancelled: 2 } as const;
