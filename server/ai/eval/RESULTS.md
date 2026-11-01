# AI prompt evaluation results

Run the prompts with `pnpm eval:prompts` (writes them to `.superpowers/eval-prompts/`) for a stand-in
model, or with `pnpm eval:ai` against the gateway (needs `AI_GATEWAY_API_KEY` and `AI_MODEL` in
`.env.local`). Pass/fail comes from the check functions in `checks.ts`.

## Results

| Case                  | Stage 1 asks as expected | Stages 2-5 | Input bytes (largest stage) | Output bytes (largest stage) |
| --------------------- | ------------------------ | ---------- | --------------------------- | ---------------------------- |
| frontend-vague        | pending                  | pending    | pending                     | pending                      |
| frontend-partial      | pending                  | pending    | pending                     | pending                      |
| frontend-complete     | pending                  | pending    | pending                     | pending                      |
| frontend-conflicting  | pending                  | pending    | pending                     | pending                      |
| backend-vague         | pending                  | pending    | pending                     | pending                      |
| backend-partial       | pending                  | pending    | pending                     | pending                      |
| backend-complete      | pending                  | pending    | pending                     | pending                      |
| backend-conflicting   | pending                  | pending    | pending                     | pending                      |
| fullstack-vague       | pending                  | pending    | pending                     | pending                      |
| fullstack-partial     | pending                  | pending    | pending                     | pending                      |
| fullstack-complete    | pending                  | pending    | pending                     | pending                      |
| fullstack-conflicting | pending                  | pending    | pending                     | pending                      |

## Measured limits

| Limit                                                    | Value          | Source                                                                                                                                                                 |
| -------------------------------------------------------- | -------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `AI_MAX_BODY_BYTES` (`server/routes/ai.ts`)              | 64 KB (65,536) | Largest stage input is 9,747 bytes (data-model, synthetic 40-component design with 32 endpoints); 4 x 9,747 = 38,988, rounded up to 64 KB. Pinned by `limits.test.ts`. |
| `maxDuration` (`vercel.json`)                            | unchanged      | pending: needs gateway latency (slowest stage x 3, rounded up to 10 s)                                                                                                 |
| `decisionConcurrency` (`src/hooks/useDesignPipeline.ts`) | `Infinity`     | unchanged: no gateway run has shown rate limiting yet                                                                                                                  |

Stage input sizes for the synthetic design: components 832 B, decisions up to 3,297 B, api 7,897 B,
data-model 9,747 B.
