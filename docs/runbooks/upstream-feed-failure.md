# Upstream feed failure

## Symptom

- The daily deploy workflow on GitHub Actions is red.
- The build succeeds but one of the loaders logs `✗ foo failed: HTTP 503`.
- A PR reviewer sees a schema validation error.
- An issue reports "France's gasoline price looks wrong".

## Diagnosis

1. Open the failing run in GitHub Actions.
2. Find the log block for the affected loader — each is prefixed (`[Fuel]`, `[FR]`, `[IT]`, etc.).
3. Look for one of three failure modes:

   **Hard 4xx/5xx from upstream**
   ```
   ✗ IT failed: HTTP 503 — MIMIT is unavailable right now
   ```
   The loader already fell back gracefully. No action if it clears within 48 h.

   **Schema drift** (the validator complains)
   ```
   ❌ prices.json does not match schemas/prices.schema.json
     /regions/12/pricesUSD/gasoline  must be number
   ```
   Upstream changed the shape. The loader needs updating.

   **Silent value drift** (numbers look wrong)
   Diff today's `prices.json` against yesterday's in git history.

## Fix

**Hard 4xx/5xx** — wait one day, 90 % of upstream outages clear on their own. If a URL has genuinely moved permanently, update the constant at the top of `scripts/generateData.js`.

**Schema drift** — download the new upstream response manually, inspect, update the parser, re-run `npm run generate-data` locally until `npm run validate` passes. Add a test fixture if the change was subtle.

**Value drift** — revert the pipeline commit that introduced the bad parsing, or pin the dataset to the last known good version.

## Prevent recurrence

If the same feed breaks twice in a quarter, add a contract test — a test that hits the upstream and asserts the bare-minimum shape we depend on. File it under `test/contracts/`.
