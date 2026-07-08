// Event-only subset of MarketFactory's ABI — Ponder only ever calls
// `eth_getLogs`/decodes events against this, never a read/write function, so
// there's no reason to carry the rest. The full ABI (for trading/redeeming/
// etc.) lives in packages/web/lib/abis/MarketFactoryAbi.ts; packages/cron
// keeps its own hand-picked function-only slice the same way — duplicating
// keeps every package free of a dependency on another package's ABI copy.
export const MarketFactoryAbi = [
  {
    type: "event",
    name: "AssetRegistered",
    inputs: [
      { name: "assetId", type: "uint256", indexed: true, internalType: "uint256" },
      { name: "symbol", type: "string", indexed: false, internalType: "string" },
      { name: "source", type: "uint8", indexed: false, internalType: "enum MarketFactory.PriceSource" },
      { name: "sourceId", type: "string", indexed: false, internalType: "string" },
    ],
    anonymous: false,
  },
  {
    type: "event",
    name: "MarketCreated",
    inputs: [
      { name: "marketId", type: "uint256", indexed: true, internalType: "uint256" },
      { name: "assetId", type: "uint256", indexed: true, internalType: "uint256" },
      { name: "startTime", type: "uint64", indexed: false, internalType: "uint64" },
      { name: "closeTime", type: "uint64", indexed: false, internalType: "uint64" },
      { name: "startPriceWad", type: "uint256", indexed: false, internalType: "uint256" },
      { name: "initialLiquidity", type: "uint256", indexed: false, internalType: "uint256" },
    ],
    anonymous: false,
  },
  {
    type: "event",
    name: "SharesBought",
    inputs: [
      { name: "marketId", type: "uint256", indexed: true, internalType: "uint256" },
      { name: "buyer", type: "address", indexed: true, internalType: "address" },
      { name: "isUp", type: "bool", indexed: false, internalType: "bool" },
      { name: "collateralIn", type: "uint256", indexed: false, internalType: "uint256" },
      { name: "sharesOut", type: "uint256", indexed: false, internalType: "uint256" },
      { name: "feePaid", type: "uint256", indexed: false, internalType: "uint256" },
      { name: "newUpSupply", type: "uint256", indexed: false, internalType: "uint256" },
      { name: "newDownSupply", type: "uint256", indexed: false, internalType: "uint256" },
    ],
    anonymous: false,
  },
  {
    type: "event",
    name: "SharesSold",
    inputs: [
      { name: "marketId", type: "uint256", indexed: true, internalType: "uint256" },
      { name: "seller", type: "address", indexed: true, internalType: "address" },
      { name: "isUp", type: "bool", indexed: false, internalType: "bool" },
      { name: "sharesIn", type: "uint256", indexed: false, internalType: "uint256" },
      { name: "collateralOut", type: "uint256", indexed: false, internalType: "uint256" },
      { name: "feePaid", type: "uint256", indexed: false, internalType: "uint256" },
      { name: "newUpSupply", type: "uint256", indexed: false, internalType: "uint256" },
      { name: "newDownSupply", type: "uint256", indexed: false, internalType: "uint256" },
    ],
    anonymous: false,
  },
  {
    type: "event",
    name: "Redeemed",
    inputs: [
      { name: "marketId", type: "uint256", indexed: true, internalType: "uint256" },
      { name: "redeemer", type: "address", indexed: true, internalType: "address" },
      { name: "payout", type: "uint256", indexed: false, internalType: "uint256" },
      { name: "outcome", type: "bool", indexed: false, internalType: "bool" },
    ],
    anonymous: false,
  },
  {
    type: "event",
    name: "RefundClaimed",
    inputs: [
      { name: "marketId", type: "uint256", indexed: true, internalType: "uint256" },
      { name: "claimant", type: "address", indexed: true, internalType: "address" },
      { name: "payout", type: "uint256", indexed: false, internalType: "uint256" },
    ],
    anonymous: false,
  },
  {
    type: "event",
    name: "MarketSettled",
    inputs: [
      { name: "marketId", type: "uint256", indexed: true, internalType: "uint256" },
      { name: "closePriceWad", type: "uint256", indexed: false, internalType: "uint256" },
      { name: "outcome", type: "bool", indexed: false, internalType: "bool" },
    ],
    anonymous: false,
  },
  {
    type: "event",
    name: "MarketPushed",
    inputs: [
      { name: "marketId", type: "uint256", indexed: true, internalType: "uint256" },
      { name: "closePriceWad", type: "uint256", indexed: false, internalType: "uint256" },
    ],
    anonymous: false,
  },
  {
    type: "event",
    name: "CloseTimeExtended",
    inputs: [
      { name: "marketId", type: "uint256", indexed: true, internalType: "uint256" },
      { name: "newCloseTime", type: "uint64", indexed: false, internalType: "uint64" },
    ],
    anonymous: false,
  },
  {
    type: "event",
    name: "MarketCancelled",
    inputs: [{ name: "marketId", type: "uint256", indexed: true, internalType: "uint256" }],
    anonymous: false,
  },
  {
    type: "event",
    name: "FeesWithdrawn",
    inputs: [
      { name: "marketId", type: "uint256", indexed: true, internalType: "uint256" },
      { name: "to", type: "address", indexed: true, internalType: "address" },
      { name: "amount", type: "uint256", indexed: false, internalType: "uint256" },
    ],
    anonymous: false,
  },
] as const;
