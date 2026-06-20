import ultracite from "ultracite/prettier";

/**
 * Prettier handles Markdown only (Biome formats TS/JS/JSON). We extend
 * Ultracite's shared config but keep `proseWrap: "preserve"` so existing
 * hand-wrapped prose in the docs isn't reflowed.
 *
 * @type {import('prettier').Config}
 */
const config = {
  ...ultracite,
  proseWrap: "preserve",
};

export default config;
