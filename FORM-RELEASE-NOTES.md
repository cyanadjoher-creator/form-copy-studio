# FORM Copy Studio — audit fixes and rollout

Base revision: 80e8fb5aee748bddbc2427dc8af5588cbf4ab1f6. This is a tested source-code candidate, not a deployment. No credentials or new production data exports are included.

| Finding | Fix |
|---|---|
| Regeneration overwrote approved copy and kept old source links. | Regeneration reopens approval, preserves the prior approval as a snapshot and saves separate current evidence. Stale edits are rejected. Photo changes invalidate the prior review. |
| The studio could find research but skip it in the draft or cite it for a different claim. | Generation matches one boutique-scoped item and carries through the candidate paragraph and both source roles. The reviewer accepts, omits or holds it. Web-only drafts need actual search-returned URLs for both claims and still require editorial review. |
| The tracker import assigned an entire batch to one boutique. | Imports preserve boutique by row, Tracker Temp ID, supplier ID and listing URL separately. The import dropdown is a fallback for items without a boutique. |
| Mixed photos and unreadable labels leaked into copy. | Unresolved mixed-set reports prevent draft replacement and approval. The team can correct the photos or confirm the set after checking it. Held fibre and lining aren’t inferred. |
| The model assembled the whole website block and copied bad rounded sizes. | The app assembles explicit copy fields and calculates quarter-inch sizing directly from original measurements, without doubling flat widths. Verified overall wear belongs in the first product sentence. Unconfirmed dates and internal status markers stay off the website. |
| Copy for Shopify combined unrelated fields. | Approved items have separate Vendor, Title, Season or era, Description and Care controls. No live Shopify sync is performed. |
| Archive reuse only recognized identical files. | Exact files still restore approved text and evidence verbatim. A stable same-boutique ID can also identify one approved record if the current photo set has been confirmed. Ambiguous matches are not reused. |

## Preview deployment

1. Start from the above SHA. From the original repo root run `git apply --check FORM-Copy-Studio-Fixes.patch`, then `git apply FORM-Copy-Studio-Fixes.patch`. The full corrected source ZIP is an alternative. Use a branch with a separate preview database.
2. Keep the team login and Claude key server-side. For live tracker lookup, enable the Google Sheets API for a team service account and share the tracker as **Viewer** with that account. Set `COPY_CONTEXT_SHEET_ID` and `COPY_CONTEXT_SERVICE_ACCOUNT_JSON` in Vercel. Do not commit the key. The route reads `'Copy Context'!A1:R` and caches up to 60 seconds. Without either setting, only a labelled bundled snapshot is used. A partial or failed configured connection is reported instead of silently using the snapshot.
3. Confirm the current FORM prompt on the Copy prompt page. The untouched original v2 migrates to a visible v3 on upgrade. A newer team-authored version stays active.
4. Correct OP-7's boutique to **Option** in preview and check every photo. Remove any wrong images. Use the original dimensions and verify the hem width before entering it. The successful preview should show **sheets · option|op-7**, both research sources, Collection comparison, and no exact-runway claim.
5. Repeat the D&G nine-photo and Balenciaga archive tests. Regenerate an approved test item and confirm the old approval is retained separately. Check the manual Shopify fields on a sample before sending anything live.

## Repeatable checks

- Run `npm ci`, `npm test`, `npm run typecheck` and `npm run build`.
- Start the built app on 127.0.0.1:43131 with an empty local PGlite database, `AI_PROVIDER=mock`, and no production credentials. Run `node tests/release-api.mjs`. It refuses remote database, provider and storage configurations.
- Local tests cover the application and a mocked Google request. They do not test Google authentication or model OCR against the deployed Vercel preview. Keep the three tracker holds and clear them only after the underlying facts have been checked.
