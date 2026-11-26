---
title: "What we learned making vLLM faster on Inkling 2 Mini"
date: 2026-11-26T17:00:00.000000Z
draft: false
layout: post
tags: ["inkling", "vllm", "rtx-5090", "profiling", "kernels"]
category: "Research"
intro: "Optimising Inkling 2 Mini on one RTX 5090 for long-running agentic tasks and coding: what the profiles showed, the changes that paid off, the ones that didn't, and how we kept accuracy honest."
image_alt: "Bar chart of single-stream decode throughput on one RTX 5090: 340 tok/s on code, 330 on JSON and 253 on prose."
image_height: 720
image: "/images/inkling-lessons.svg"
author: "Platform Q.ai"
---

We set out to optimise vLLM's serving of Inkling 2 Mini on a single RTX 5090 for long-running agentic tasks and coding. The rule was to keep everything vLLM gives an agent server for free: batching, paged KV cache, prefix caching and speculative decoding. These are the lessons that held up, with the numbers behind them. The finished recipe is in [Inkling 2 Mini on one RTX 5090: the recipe](2026-11-26-inkling-2-mini-rtx-5090-recipe.html).

## 1. Profile first: it wasn't launch overhead

The obvious suspect for a model that runs its middle layers three times per token is kernel-launch overhead. A decode step is about a thousand kernels. But vLLM already captures the step in CUDA graphs. Gaps between kernels were about 1% of the step, and the host was idle less than 1% of the time.

Most of the big kernels were already near the card's memory bandwidth:

- **MoE experts:** 1.4–1.6 TB/s;
- **dense projections:** 76–87% of the 1.79 TB/s peak;
- **LM head:** 94%.

So no single kernel rewrite was going to give a big win.

## 2. Study a fast engine, kernel by kernel

[Ingine](https://github.com/satellitedown/inkling-2-mini-abliterated-ingine), a hand-written CUDA engine for this model, showed us where to look. We profiled it and our build with Nsight Systems on the same card and charged each moment of GPU time to the kernel that was running.

The gap wasn't kernel speed; it was **overlap**. Ingine starts loading the next kernel's weights before the previous kernel has finished, using programmatic dependent launch (PDL). In vLLM, a single cuBLAS call in the middle of the loop's gate chain broke that overlap, so the projection after it started cold.

Replacing that chain with kernels that keep PDL working, and loading weights before each wait, was the biggest exact win. Exact means the same arithmetic, just better scheduled.

## 3. One small GEMM can waste 5% of the step

The profile showed one real kernel defect. At verify widths, a small `down` projection inside the loop controller ran as a 6-block kernel without split-K, on a card with 170 SMs. It took 24 µs each time and ran 24 times a step: 5% of the step. Splitting it across the GPU fixed it.

## 4. Speculative decoding is where the rows come from

With 7 draft tokens, each step verifies several rows per stream. More rows touch more distinct experts, and reading those experts is most of why a speculative step costs about 1.9× a plain one.

Adaptive verification, which verifies only the drafts likely to be accepted, cut the rows without changing the output distribution. A 16k-token draft vocabulary made the drafter's head cheaper. Both are exact.

## 5. Check "not bit-identical" before you worry

Our split-KV local attention changes the order of a floating-point sum, so its outputs aren't bit-identical to the unsplit kernel's. We checked whether that cost precision by comparing both against a 64-bit reference over 64 cases.

The worst-case error was the same, 3.7 × 10⁻³, for both. The mean error was slightly *lower* with the split, 5.9–6.0 × 10⁻⁵ against 6.1–6.3 × 10⁻⁵. Different isn't worse; measure it.

## 6. FP8 is a memory decision as much as a speed one

Moving the dense layers and head to FP8 took the step from 6.36 ms to 5.69 ms. But how you do it matters more for context than for speed:

<div class="table-wrap"><table><thead><tr><th>FP8 variant</th><th>KV pool</th><th>matches reference</th></tr></thead><tbody><tr><td>BF16 copies kept for prefill</td><td>241k tokens</td><td>96.1%</td></tr><tr><td>BF16 freed, FP8 weights and activations in prefill</td><td><strong>380k tokens</strong></td><td>95.7%</td></tr></tbody></table></div>

Keeping the BF16 copies keeps prefill exact, but costs about 115k tokens of KV cache. Freeing them needed our own Triton W8A8 GEMM and activation-quantisation kernels, because the stock vLLM image ships neither for sm_120.

## 7. A "prefill regression" that wasn't

For a while, every new build looked 35% slower at prefill. It turned out every fresh server compiled its Triton kernels from scratch: the same server measured 6,633 tok/s cold and 10,635 warm. Passing a persistent Triton cache and running one warm-up pass made the numbers honest. Every result we publish is warm.

## 8. Bigger prefill chunks are faster, until they don't fit

Prefill chunks of 2,048 tokens instead of 1,024 lifted prefill from 11.0k to 13.9k tok/s at 60k tokens. But they cost 79k tokens of KV pool and a little accuracy. Chunks of 4,096 and up didn't start at all, because the memory peak grows about 3 GB per extra 1,024 tokens. We kept 1,024.

## 9. Measure accuracy with a noise floor

Every change went through the same gate: about 11,000 teacher-forced positions, including a 57,556-token real-code prompt, scored against the full-precision reference. The reference matches itself 96.4% of the time, and the run-to-run noise is about half a point.

A change counted as accuracy-neutral only if it stayed inside that band. That's how we know the decode work doesn't change accuracy: 96.5%. It's also how we know FP8 prefill isn't quite free: 95.7%, just below that band, which we chose for the extra context.

## 10. For agents, KV memory is the limit

Four streams at 10k tokens of context each decode at about 920 tok/s in total. At 90k each they still reach about 670.

Benchmarks with dozens of short chats measure batching. Agent work is a few long conversations, and there every token of KV cache counts. That's why we spent the FP8 savings on context rather than more batch slots.

## Thanks

vLLM made all of this possible. Ingine's design showed us where to look. gr8's think-end boost shaped our thinking budget. And Ash and Mia of TensorFold, through the work they've shared and talked about, inspired us to try.
