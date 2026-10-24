/** Report the actual server runtime; managed function patches are provider-controlled. */
export function register(): void {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    console.info(JSON.stringify({
      event: "node_runtime",
      node: process.version,
      brotli: process.versions.brotli,
      undici: process.versions.undici,
    }));
  }
}
