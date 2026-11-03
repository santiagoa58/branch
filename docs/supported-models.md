# Vercel AI Gateway — Speed, Cost & Published Benchmark Scores

**Updated:** November 2, 2026  
**Models:** 90 budget-qualified models, plus frontier references  
**Score policy:** Published results only. No invented estimates.

## 1. Filters and Sorting

Models qualify when:

- Input price ≤ $2 per million tokens
- Output price ≤ $2 per million tokens
- P50 time to first token (TTFT) ≤ 4 seconds

**Sort order:** latency ascending → combined input/output price ascending → published overall benchmark descending for exact ties.

### Price Colors

| Color | Combined Price (1M Input + 1M Output) |
| ----- | ------------------------------------- |
| 🟢    | ≤ $0.50                               |
| 🟡    | > $0.50 to $1.50                      |
| 🟠    | > $1.50 to $3.00                      |
| 🔴    | > $3.00                               |

### Benchmark Columns

| Column  | Meaning                                   |
| ------- | ----------------------------------------- |
| Overall | LLMBenchmark.ai composite index, 0–100    |
| AA      | Artificial Analysis Intelligence Index v5 |
| Code    | LLMBenchmark Vibe Coding Index            |
| Agent   | LLMBenchmark Agentic Index                |
| Reason  | LLMBenchmark Reasoning Index              |
| Math    | LLMBenchmark Mathematics Index            |
| Know    | LLMBenchmark Knowledge Index              |
| LB2     | LiveBench 2.0 overall score               |

Each score column uses its own published methodology. All values are higher-is-better, but scores across different columns are **not directly interchangeable**.

The LLMBenchmark category indexes aggregate multiple published evaluations within each category. For example, the coding index combines coding-related benchmarks rather than representing a single coding test.

`—` indicates no matching published measurement verified for that model.

## 2. Complete Budget Model Comparison

**Pricing:** USD per million input/output tokens, retained from the preceding Vercel Gateway snapshot.

| #   | Model                                      | TTFT | Input | Output |  Overall |   AA | Code | Agent | Reason | Math | Know |  LB2 |
| --- | ------------------------------------------ | ---: | ----: | -----: | -------: | ---: | ---: | ----: | -----: | ---: | ---: | ---: |
| 1   | 🟠 `morph/morph-v3-fast`                   | 0.1s | $0.80 |  $1.20 |        — |    — |    — |     — |      — |    — |    — |    — |
| 2   | 🟢 `reflection/beam-free`                  | 0.2s | $0.00 |  $0.00 |        — |    — |    — |     — |      — |    — |    — |    — |
| 3   | 🟢 `zai/glm-5.3-flash`                     | 0.2s | $0.03 |  $0.09 | **61.9** | 27.8 | 57.7 |  48.3 |   72.8 | 76.6 | 67.6 | 62.1 |
| 4   | 🟢 `nvidia/nemotron-3.5-lightning`         | 0.2s | $0.04 |  $0.12 |        — |  5.5 | 22.6 |     — |      — |    — |    — | 28.7 |
| 5   | 🟢 `nvidia/nemotron-3-nano-30b-a3b`        | 0.2s | $0.05 |  $0.20 |        — |    — |    — |     — |      — |    — |    — |    — |
| 6   | 🟢 `nvidia/nemotron-nano-9b-v2`            | 0.2s | $0.06 |  $0.23 |        — |    — |    — |     — |      — |    — |    — |    — |
| 7   | 🟡 `liquid/lfm2.5-24b-a2b`                 | 0.2s | $0.05 |  $0.70 |        — |    — |    — |     — |      — |    — |    — |    — |
| 8   | 🟡 `nvidia/nemotron-nano-12b-v2-vl`        | 0.2s | $0.20 |  $0.60 |        — |    — |    — |     — |      — |    — |    — |    — |
| 9   | 🟡 `meta/llama-4-scout`                    | 0.2s | $0.17 |  $0.66 | **30.8** |    — |    — |     — |   21.5 | 21.1 |    — |    — |
| 10  | 🟡 `meta/llama-4-maverick`                 | 0.2s | $0.24 |  $0.97 |        — |    — |    — |     — |    4.2 |    — |    — |    — |
| 11  | 🟡 `reflection/beam`                       | 0.2s | $0.25 |  $1.00 |        — |    — |    — |     — |      — |    — |    — |    — |
| 12  | 🟡 `meta/llama-3.3-70b`                    | 0.2s | $0.72 |  $0.72 | **31.6** |    — |    — |     — |   26.3 | 18.3 |    — |    — |
| 13  | 🟡 `zai/glm-5.3`                           | 0.2s | $0.07 |  $1.40 | **66.9** | 31.7 | 68.5 |  63.8 |   75.7 | 80.5 | 56.2 |    — |
| 14  | 🟠 `zai/glm-5.2`                           | 0.2s | $0.19 |  $1.80 | **65.6** |    — | 61.1 |     — |   62.2 | 74.4 | 51.6 |    — |
| 15  | 🟠 `zai/glm-4.7`                           | 0.2s | $0.40 |  $1.75 | **62.3** |    — | 55.1 |     — |   61.2 | 79.1 | 46.0 |    — |
| 16  | 🟠 `morph/morph-v3-large`                  | 0.2s | $0.90 |  $1.90 |        — |    — |    — |     — |      — |    — |    — |    — |
| 17  | 🟢 `amazon/nova-micro`                     | 0.3s | $0.04 |  $0.14 |        — |    — |    — |     — |      — |    — |    — |    — |
| 18  | 🟢 `deepseek/deepseek-v4.1-flash-1017`     | 0.3s | $0.04 |  $0.19 | **68.2** |    — | 70.3 |  46.1 |   79.9 | 85.3 | 62.6 | 74.0 |
| 19  | 🟢 `alibaba/qwen3.8-27b`                   | 0.3s | $0.06 |  $0.32 | **55.4** | 20.1 | 74.1 |  35.9 |   55.7 |    — | 60.1 |    — |
| 20  | 🟡 `nvidia/nemotron-3.5-super-vl`          | 0.3s | $0.10 |  $0.50 | **25.6** | 13.6 | 19.0 |   9.8 |   56.2 |    — |    — | 51.5 |
| 21  | 🟡 `deepseek/deepseek-v3.2-thinking`       | 0.3s | $0.26 |  $0.38 |        — |    — |    — |     — |      — |    — |    — |    — |
| 22  | 🟡 `nvidia/nemotron-3-super-120b-a12b`     | 0.3s | $0.15 |  $0.65 |        — |    — |    — |     — |      — |    — |    — |    — |
| 23  | 🟡 `meta/llama-3.1-70b`                    | 0.3s | $0.72 |  $0.72 | **29.9** |    — |    — |     — |   25.3 | 16.4 |    — |    — |
| 24  | 🟠 `meta/muse-glimmer-30b`                 | 0.3s | $0.35 |  $1.50 |        — |    — |    — |     — |      — |    — |    — |    — |
| 25  | 🟢 `nvidia/nemotron-3.5-lightning-free`    | 0.4s | $0.00 |  $0.00 |        — |    — |    — |     — |      — |    — |    — |    — |
| 26  | 🟢 `meta/llama-3.1-8b`                     | 0.4s | $0.02 |  $0.05 | **20.9** |    — |    — |     — |   17.3 | 11.1 |    — |    — |
| 27  | 🟢 `mistral/ministral-3b`                  | 0.4s | $0.10 |  $0.10 |        — |    — |    — |     — |      — |    — |    — |    — |
| 28  | 🟢 `inclusionai/ling-3.0-flash-fin`        | 0.4s | $0.06 |  $0.18 |        — |    — |    — |     — |      — |    — |    — |    — |
| 29  | 🟢 `amazon/nova-lite`                      | 0.4s | $0.06 |  $0.24 |        — |    — |    — |     — |      — |    — |    — |    — |
| 30  | 🟢 `mistral/ministral-8b`                  | 0.4s | $0.15 |  $0.15 |        — |    — |    — |     — |      — |    — |    — |    — |
| 31  | 🟢 `zai/glm-4.7-flash`                     | 0.4s | $0.07 |  $0.40 | **50.0** |    — |    — |     — |   35.7 | 58.6 |    — |    — |
| 32  | 🟢 `google/gemini-2.5-flash-lite`          | 0.4s | $0.10 |  $0.40 |        — |    — |    — |     — |      — |    — |    — |    — |
| 33  | 🟡 `minimax/minimax-m2.1`                  | 0.4s | $0.30 |  $1.20 |        — |    — |    — |     — |      — |    — |    — |    — |
| 34  | 🟠 `deepseek/deepseek-v4-pro-0813`         | 0.4s | $0.66 |  $1.98 | **58.0** | 23.1 | 56.1 |  36.7 |   71.7 | 80.0 | 64.5 |    — |
| 35  | 🟢 `deepseek/deepseek-v4.1-flash`          | 0.5s | $0.04 |  $0.19 | **70.2** |    — | 56.6 |     — |   72.9 | 82.3 |    — |    — |
| 36  | 🟢 `deepseek/deepseek-v4-flash`            | 0.5s | $0.06 |  $0.18 |        — |    — |    — |     — |      — |    — |    — |    — |
| 37  | 🟢 `mistral/ministral-14b`                 | 0.5s | $0.20 |  $0.20 |        — |    — |    — |     — |      — |    — |    — |    — |
| 38  | 🟡 `google/gemma-4-26b-a4b-it`             | 0.5s | $0.13 |  $0.40 | **66.3** |    — |    — |     — |   50.4 | 80.9 |    — |    — |
| 39  | 🟡 `minimax/minimax-m3.1-flash`            | 0.5s | $0.10 |  $0.45 | **54.9** | 28.9 | 58.9 |  43.6 |   74.3 |    — |    — | 66.9 |
| 40  | 🟡 `mistral/mistral-small`                 | 0.5s | $0.15 |  $0.60 |        — |    — |    — |     — |      — |    — |    — |    — |
| 41  | 🟡 `mistral/codestral`                     | 0.5s | $0.30 |  $0.90 |        — |    — |    — |     — |      — |    — |    — |    — |
| 42  | 🟡 `alibaba/qwen3-next-80b-a3b-instruct`   | 0.5s | $0.15 |  $1.20 |        — |    — |    — |     — |      — |    — |    — |    — |
| 43  | 🟡 `minimax/minimax-m2.5`                  | 0.5s | $0.30 |  $1.20 | **38.7** |    — | 37.2 |     — |   19.5 |    — |    — |    — |
| 44  | 🟢 `mistral/mistral-nemo`                  | 0.6s | $0.03 |  $0.03 |        — |    — |    — |     — |      — |    — |    — |    — |
| 45  | 🟢 `deepseek/deepseek-v4-flash-0731`       | 0.6s | $0.04 |  $0.14 | **56.6** |    — | 51.8 |  40.2 |   70.2 | 76.0 | 50.7 |    — |
| 46  | 🟡 `google/gemma-4-31b-it`                 | 0.6s | $0.14 |  $0.40 | **45.4** |    — | 39.0 |   6.4 |   58.1 | 74.7 | 26.0 | 41.5 |
| 47  | 🟡 `minimax/minimax-m3`                    | 0.6s | $0.24 |  $0.96 | **47.2** | 18.7 | 33.6 |  19.0 |   73.3 | 71.2 |    — | 53.7 |
| 48  | 🟡 `zai/glm-4.5-air`                       | 0.6s | $0.20 |  $1.10 |        — |    — |    — |     — |      — |    — |    — |    — |
| 49  | 🟡 `particle/particle-1`                   | 0.7s | $0.13 |  $0.50 |        — |    — |    — |     — |      — |    — |    — |    — |
| 50  | 🟡 `minimax/minimax-m2.7`                  | 0.7s | $0.21 |  $0.84 |        — |    — | 36.2 |     — |      — |    — |    — |    — |
| 51  | 🟡 `alibaba/qwen3-vl-instruct`             | 0.7s | $0.20 |  $0.88 |        — |    — |    — |     — |      — |    — |    — |    — |
| 52  | 🟡 `xiaomi/mimo-v2.6-pro`                  | 0.7s | $0.39 |  $0.78 | **62.7** | 29.9 | 65.4 |  48.2 |   74.2 |    — |    — | 68.5 |
| 53  | 🟠 `zai/glm-5.3-flashx-legal`              | 0.7s | $0.37 |  $1.25 |        — |    — |    — |     — |      — |    — |    — |    — |
| 54  | 🟠 `google/gemini-3.1-flash-lite`          | 0.7s | $0.25 |  $1.50 |        — |    — |    — |     — |   53.2 | 53.9 |    — |    — |
| 55  | 🟡 `anthropic/claude-haiku-5.5`            | 0.8s | $0.10 |  $0.50 | **64.2** | 36.2 | 70.8 |  50.6 |   74.7 | 84.0 | 51.1 | 69.8 |
| 56  | 🟡 `minimax/minimax-m2`                    | 0.8s | $0.30 |  $1.20 |        — |    — |    — |     — |      — |    — |    — |    — |
| 57  | 🟠 `zai/glm-4.5v`                          | 0.8s | $0.60 |  $1.80 |        — |    — |    — |     — |      — |    — |    — |    — |
| 58  | 🟢 `zai/glm-4.7-flashx`                    | 0.9s | $0.06 |  $0.40 |        — |    — |    — |     — |      — |    — |    — |    — |
| 59  | 🟢 `alibaba/qwen3.5-flash`                 | 0.9s | $0.10 |  $0.40 | **50.1** |    — | 41.1 |     — |      — | 54.7 | 39.4 |    — |
| 60  | 🟠 `deepseek/deepseek-v4-pro`              | 0.9s | $0.66 |  $1.98 |        — |    — |    — |     — |      — |    — |    — |    — |
| 61  | 🟠 `spacexai/grok-build-0.1`               | 0.9s | $1.00 |  $2.00 |        — |    — |    — |     — |      — |    — |    — |    — |
| 62  | 🟢 `inclusionai/ling-3.0-flash-vl`         | 1.0s | $0.08 |  $0.22 |        — |    — |    — |     — |      — |    — |    — |    — |
| 63  | 🟢 `tencent/hy-mt2-pro`                    | 1.0s | $0.07 |  $0.30 |        — |    — |    — |     — |      — |    — |    — |    — |
| 64  | 🟠 `mistral/mistral-large-3`               | 1.0s | $0.50 |  $1.50 |        — |    — |    — |     — |      — |    — |    — |    — |
| 65  | 🟢 `inclusionai/ling-3.0-flash-sante`      | 1.1s | $0.08 |  $0.22 |        — |    — |    — |     — |      — |    — |    — |    — |
| 66  | 🟢 `tencent/hy-mt2-plus`                   | 1.1s | $0.07 |  $0.30 |        — |    — |    — |     — |      — |    — |    — |    — |
| 67  | 🟡 `deepseek/deepseek-v3.1`                | 1.1s | $0.25 |  $0.95 |        — |    — |    — |     — |      — |    — |    — |    — |
| 68  | 🟡 `openai/gpt-5.6-luna`                   | 1.1s | $0.20 |  $1.20 | **61.1** |    — | 55.3 |  35.2 |   70.4 | 87.5 | 55.5 |    — |
| 69  | 🟠 `bytedance/seed-1.6`                    | 1.1s | $0.25 |  $2.00 |        — |    — |    — |     — |      — |    — |    — |    — |
| 70  | 🟠 `bytedance/seed-1.8`                    | 1.1s | $0.25 |  $2.00 |        — |    — |    — |     — |      — |    — |    — |    — |
| 71  | 🟢 `inclusionai/ling-3.0-flash`            | 1.2s | $0.02 |  $0.06 |        — |    — | 29.6 |     — |      — |    — |    — |    — |
| 72  | 🟢 `tencent/hy-mt2-lite`                   | 1.2s | $0.04 |  $0.18 |        — |    — |    — |     — |      — |    — |    — |    — |
| 73  | 🟡 `inclusionai/ling-3.1-flash`            | 1.2s | $0.30 |  $0.90 |        — |    — |    — |     — |      — |    — |    — |    — |
| 74  | 🟡 `openai/gpt-6-luna`                     | 1.3s | $0.10 |  $0.50 | **56.5** | 27.8 | 57.4 |  36.0 |   71.9 | 84.8 | 46.5 | 64.6 |
| 75  | 🟡 `tencent/hy3`                           | 1.3s | $0.13 |  $0.53 |        — |    — |    — |     — |      — |    — |    — |    — |
| 76  | 🟡 `openai/gpt-6-luna-fast`                | 1.3s | $0.20 |  $1.00 |        — |    — |    — |     — |      — |    — |    — |    — |
| 77  | 🟢 `alibaba/qwen3.7-flash`                 | 1.4s | $0.03 |  $0.13 |        — |    — |    — |     — |      — |    — |    — |    — |
| 78  | 🟢 `xiaomi/mimo-v2.6-flash`                | 1.5s | $0.14 |  $0.28 | **55.9** | 26.7 | 54.8 |     — |      — |    — |    — |    — |
| 79  | 🟡 `deepseek/deepseek-v4-flash-vision-exp` | 1.5s | $0.22 |  $0.65 |        — |    — |    — |     — |      — |    — |    — |    — |
| 80  | 🟡 `mixedbread/toast-1`                    | 1.5s | $0.30 |  $0.72 |        — |    — |    — |     — |      — |    — |    — |    — |
| 81  | 🟡 `deepseek/deepseek-v3.2`                | 1.7s | $0.26 |  $0.38 | **40.0** |    — | 30.0 |     — |   22.7 |    — |    — |    — |
| 82  | 🟢 `meta/muse-spark-1.2-contributor`       | 2.1s | $0.10 |  $0.20 |        — |    — |    — |     — |      — |    — |    — |    — |
| 83  | 🟢 `meta/muse-spark-1.3-contributor`       | 2.4s | $0.10 |  $0.20 |        — |    — |    — |     — |      — |    — |    — |    — |
| 84  | 🟡 `alibaba/qwen3.8-omni-flash`            | 2.7s | $0.15 |  $0.47 |        — |    — |    — |     — |      — |    — |    — |    — |
| 85  | 🟢 `stealth/glyph-cluster`                 | 2.8s | $0.00 |  $0.00 |        — |    — |    — |     — |      — |    — |    — |    — |
| 86  | 🟡 `alibaba/qwen3.8-flash`                 | 3.0s | $0.15 |  $0.47 |        — |    — |    — |     — |      — |    — |    — |    — |
| 87  | 🟠 `alibaba/qwen3.7-plus`                  | 3.0s | $0.40 |  $1.60 | **58.5** |    — | 33.2 |     — |   69.4 | 66.7 |    — |    — |
| 88  | 🟡 `stepfun/step-3.7-flash`                | 3.1s | $0.20 |  $1.15 |        — |    — |    — |     — |      — |    — |    — |    — |
| 89  | 🟠 `zai/glm-5.3-flashx`                    | 3.8s | $0.37 |  $1.25 |        — |    — |    — |     — |      — |    — |    — |    — |
| 90  | 🟢 `inclusionai/ling-3.1-flash-1019`       | 3.9s | $0.00 |  $0.00 |        — |    — |    — |     — |      — |    — |    — |    — |

**Note:** Models with explicit version suffixes are kept separate from newer or unversioned aliases. A score for one release is not automatically assigned to another.

## 3. Frontier Model Comparison

These models exceed the original budget constraints but provide benchmarks for comparing quality.

They use the **same benchmark columns** as the budget table.

| Frontier Model    |  Overall |   AA | Code | Agent | Reason | Math | Know |  LB2 |
| ----------------- | -------: | ---: | ---: | ----: | -----: | ---: | ---: | ---: |
| Claude Opus 5.5   | **86.9** | 58.4 | 88.9 |  82.0 |   90.6 | 93.7 | 85.0 | 85.1 |
| GPT-6 Astra       | **83.9** | 56.9 | 85.1 |  81.0 |   89.7 | 93.1 | 87.3 | 85.6 |
| Gemini 4 Argon    | **82.6** | 50.4 | 81.0 |  72.4 |   90.7 | 92.3 | 86.7 | 79.3 |
| GPT-6.1 Sol       | **82.0** | 54.5 | 82.3 |  76.6 |   88.6 | 93.7 | 85.5 | 84.1 |
| Claude Sonnet 5.5 | **81.7** | 54.2 | 87.3 |  78.2 |   87.3 | 92.3 | 67.1 | 80.0 |

**Interpretation:** Frontier models tend to show stronger published performance across coding, reasoning, and agentic tasks. However, some inexpensive models achieve competitive results on individual evaluations, so the overall index alone does not determine the best model for a particular application.

## 4. Additional Published Task-Level Benchmarks

The main comparison uses aggregate categories. Some models without aggregate scores still have independently documented or manufacturer-published results on specific tests.

The following results are included separately rather than being converted into invented overall scores.

| Model / Evaluated Checkpoint                     | GPQA Diamond | MMLU-Pro | SWE-bench Verified | Other Published Results           |
| ------------------------------------------------ | -----------: | -------: | -----------------: | --------------------------------- |
| Nemotron 3.5 Lightning BF16                      |       75.44% |   81.94% |             51.56% | IFBench 71.88%                    |
| Nemotron 3 Nano                                  |       74.05% |   78.46% |             34.08% | —                                 |
| Nemotron 3 Super                                 |       78.60% |   83.89% |             63.08% | —                                 |
| Gemma 4 26B A4B                                  |       79.61% |   85.20% |             57.40% | —                                 |
| Ministral 3 14B (published reasoning evaluation) |        71.2% |        — |                  — | AIME25 85.0%; LiveCodeBench 64.6% |
| Ministral 3 8B (published reasoning evaluation)  |        66.8% |        — |                  — | AIME25 78.7%; LiveCodeBench 61.6% |
| Ministral 3 3B (published reasoning evaluation)  |        53.4% |        — |                  — | AIME25 72.1%; LiveCodeBench 54.8% |

These are **published evaluation results, not normalized indexes**. Model variants, prompt settings, agent scaffolds, test harnesses, and quantization settings can affect performance. For example, the Ministral reasoning evaluations are not automatically equivalent to the default instruct models served by Vercel.

Sources:

- [NVIDIA Nemotron 3.5 Lightning Model Card](https://huggingface.co/nvidia/NVIDIA-Nemotron-3.5-Lightning-30B-A3B-BF16)
- [NVIDIA Nemotron Evaluation Documentation](https://docs.nvidia.com/nemotron/nightly/nemotron/lightning35/evaluate.html)
- [Ministral 3 14B Evaluation Tables](https://docs.api.nvidia.com/nim/reference/mistralai-ministral-14b-instruct-2512)

## 5. Strongest Published Overall Scores Within Budget

Sorted by overall benchmark result rather than latency.

| Rank | Model                    |  Overall | TTFT | Input / Output |
| ---- | ------------------------ | -------: | ---: | -------------- |
| 1    | DeepSeek V4.1 Flash      | **70.2** | 0.5s | $0.04 / $0.19  |
| 2    | DeepSeek V4.1 Flash 1017 | **68.2** | 0.3s | $0.04 / $0.19  |
| 3    | GLM 5.3                  | **66.9** | 0.2s | $0.07 / $1.40  |
| 4    | Gemma 4 26B A4B          | **66.3** | 0.5s | $0.13 / $0.40  |
| 5    | GLM 5.2                  | **65.6** | 0.2s | $0.19 / $1.80  |
| 6    | Claude Haiku 5.5         | **64.2** | 0.8s | $0.10 / $0.50  |
| 7    | MiMo V2.6 Pro            | **62.7** | 0.7s | $0.39 / $0.78  |
| 8    | GLM 4.7                  | **62.3** | 0.2s | $0.40 / $1.75  |
| 9    | GLM 5.3 Flash            | **61.9** | 0.2s | $0.03 / $0.09  |
| 10   | GPT-5.6 Luna             | **61.1** | 1.1s | $0.20 / $1.20  |
| 11   | Qwen3.7 Plus             | **58.5** | 3.0s | $0.40 / $1.60  |
| 12   | DeepSeek V4 Pro 0813     | **58.0** | 0.4s | $0.66 / $1.98  |
| 13   | DeepSeek V4 Flash 0731   | **56.6** | 0.6s | $0.04 / $0.14  |
| 14   | GPT-6 Luna               | **56.5** | 1.3s | $0.10 / $0.50  |
| 15   | MiMo V2.6 Flash          | **55.9** | 1.5s | $0.14 / $0.28  |
| 16   | Qwen3.8 27B              | **55.4** | 0.3s | $0.06 / $0.32  |
| 17   | MiniMax M3.1 Flash       | **54.9** | 0.5s | $0.10 / $0.45  |

This ranking only includes models with published aggregate results. Missing models are not assumed weaker.

## 6. How to Interpret the Data

### Overall scores

The LLMBenchmark Overall Index is a composite of available published benchmark categories, with a reported uncertainty margin. Different models may have different evaluation coverage.

For that reason, a 70.2 and a 68.2 should not automatically be interpreted as a statistically significant difference.

### Individual categories

Use category results when your workload is known:

- **Coding:** Code generation, debugging, repository-level software tasks
- **Agentic:** Multi-step tool-based work and autonomous task execution
- **Reasoning:** Complex reasoning and problem solving
- **Math:** Mathematical problem solving
- **Knowledge:** Factual questions and knowledge-intensive tasks
- **AA:** Artificial Analysis's more challenging intelligence evaluation suite
- **LiveBench 2:** Longer, practical tasks including coding, research, design, and browser use

### Avoiding false comparisons

Do not compare an Artificial Analysis index score directly with a LiveBench score, an MMLU percentage, or a SWE-bench resolution rate. The scales and evaluation procedures are different.

Likewise, a model's benchmark result may have been obtained using higher reasoning effort than its normal API configuration, which can increase actual response times.

### Specialized models

General intelligence benchmarks may be unsuitable for code-editing, translation, vision, and other task-specific models. Where possible, evaluate these using benchmarks designed for their particular task rather than forcing a general intelligence ranking.

### Pricing and latency

Prices and TTFT values are a snapshot. They were not measured under the same configuration as the benchmark scores.

Vercel's gateway can route requests across providers, and price or latency may change with provider selection, caching, context length, promotions, or availability.

A TTFT of 0.2 seconds does not mean a full response finishes in 0.2 seconds.

## 7. Sources and Methodology

### Vercel AI Gateway

- [Vercel AI Gateway Model Catalog](https://vercel.com/ai-gateway/models)
- [Vercel Live Model API](https://ai-gateway.vercel.sh/v1/models)
- [Vercel AI Gateway Documentation](https://vercel.com/docs/ai-gateway)

### Aggregated Benchmark Scores

- [LLMBenchmark Overall Leaderboard](https://llmbenchmark.ai/leaderboard)
- [LLMBenchmark Leaderboard, Models 76–130](https://llmbenchmark.ai/leaderboard/2)
- [LLMBenchmark Methodology](https://llmbenchmark.ai/methodology)
- [LLMBenchmark Benchmark Catalog](https://llmbenchmark.ai/benchmarks)

### Independent Benchmarks

- [Artificial Analysis](https://artificialanalysis.ai/models/)
- [LiveBench 2.0](https://livebench.ai/)
- [Hugging Face Open LLM Leaderboard](https://huggingface.co/spaces/open-llm-leaderboard/open_llm_leaderboard)
- [LMArena](https://lmarena.ai/leaderboard)

### Model-Specific Reports

- [NVIDIA Nemotron 3.5 Lightning](https://huggingface.co/nvidia/NVIDIA-Nemotron-3.5-Lightning-30B-A3B-BF16)
- [NVIDIA Nemotron Technical Evaluations](https://docs.nvidia.com/nemotron/nightly/nemotron/lightning35/evaluate.html)
- [Ministral Evaluation Tables](https://docs.api.nvidia.com/nim/reference/mistralai-ministral-14b-instruct-2512)

**Attribution:** The category indexes are published by LLMBenchmark.ai using its documented aggregation methodology. Artificial Analysis and LiveBench results retain their own reported scales. Manufacturer-published task results are identified separately and should not be mistaken for independent evaluations.

**Coverage statement:** This document consolidates selected published overall, category, and task-level measurements from multiple sources. It is not an exhaustive transcription of every benchmark ever conducted for all 90 models. No missing score has been replaced with an estimate.
