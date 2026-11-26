---
title: "Inkling 2 Mini on one RTX 5090: the recipe"
date: 2026-11-26T18:00:00.000000Z
draft: false
layout: post
tags: ["inkling", "vllm", "rtx-5090", "inference", "fp8"]
category: "Inference"
intro: "A set of vLLM patches that optimises Inkling 2 Mini on one RTX 5090 for long-running agentic tasks and coding: a 5.69 ms decode step, 344k tokens of context, and four coding agents at about 165 tok/s each with 90k tokens of context."
image_alt: "Bar chart of four concurrent agent streams on one RTX 5090: total throughput 746 tok/s at about 10k tokens of context per stream, 563 at 90k and 162 at 150k."
image: "/images/inkling-recipe.svg"
author: "Platform Q.ai"
---

[Inkling 2 Mini](https://huggingface.co/thinkingmachines/Inkling-2-Mini) is a 26B looped mixture-of-experts model from Thinking Machines Lab. It activates only a few billion parameters per token, and it fits on a single 32 GB consumer GPU. We wanted to know how good a coding-agent server one RTX 5090 can be, without giving up what [vLLM](https://github.com/vllm-project/vllm) already does well: concurrent requests, prefix caching, chunked prefill, speculative decoding and an OpenAI-compatible API.

The result is a set of vLLM patches, open source under Apache-2.0: **[github.com/platform-q-ai/inkling-mini-5090](https://github.com/platform-q-ai/inkling-mini-5090)**.

## Results

Measured on one RTX 5090 with 4 concurrent sequences, FP8 KV cache, and the model's DSpark drafter proposing 7 tokens.

<div class="table-wrap"><table><thead><tr><th>measure</th><th>our figures</th></tr></thead><tbody><tr><td>decode step</td><td>5.69 ms</td></tr><tr><td>single stream, tok/s (code / JSON / prose)</td><td>324 / 331 / 253</td></tr><tr><td>prefill tok/s at 60k / 150k tokens</td><td>11.0k / 7.25k</td></tr><tr><td>KV cache pool</td><td>380k tokens</td></tr><tr><td>max context</td><td>344k tokens</td></tr></tbody></table></div>

### Four coding agents at once

What matters for agents is several long conversations at the same time, not dozens of short chats. We sent four requests at once. Each held a different slice of a real Rust codebase plus a coding task, with no prefix shared between them. "Warm" repeats them with each prompt already cached, as in a running agent session.

<div class="table-wrap"><table><thead><tr><th>context per stream</th><th>total tok/s</th><th>per stream</th><th>time to first token</th></tr></thead><tbody><tr><td>~10k</td><td>746 (about 920 while all four decode)</td><td>186–282</td><td>1.1 s</td></tr><tr><td>~90k</td><td>563 (about 670 while all four decode)</td><td>147–196</td><td>2.7 s</td></tr><tr><td>~150k</td><td>162</td><td>71–305</td><td>2–83 s</td></tr></tbody></table></div>

At about 150k each, four contexts need about 600k tokens of KV cache, and the card holds 380k. vLLM runs about two at a time and evicts the others' cached prompts. At that length, two agents is the practical limit for one card.

At four streams the card draws about 430 W and runs at about 65 °C.

### Accuracy

With FP8, the model's next token matches the full-precision reference 95.7% of the time, over about 11,000 positions including a 57,556-token real-code prompt. The reference matches itself 96.4% of the time from run to run; that's the noise floor from sampling and kernel order.

The decode changes on their own don't change accuracy: 96.5%. The small drop comes from running prefill in FP8. If you'd rather keep prefill in BF16, one switch (`E22_DENSE_FP8=1`) does that. It measures 96.1% and leaves about 115k fewer tokens of KV pool.

## What changed

- **FP8 dense layers and LM head.** The dense projections and the head are stored in FP8 (per-channel weight scales, per-token activation scales), and their BF16 copies are freed. That memory goes to the KV cache, which is where the extra context comes from. The vLLM image has no sm_120 FP8 CUTLASS kernel, so prefill runs on a Triton W8A8 GEMM.
- **Decode kernels.** Programmatic dependent launch chained across kernels, so each kernel loads its weights while the previous one finishes; one launch for several projections; split-K where a small GEMM left the GPU idle; better MoE tiles; and split-KV local attention with an exact combine.
- **Speculative decoding:** adaptive verification, so only drafts likely to be accepted are verified, and a 16k-token draft vocabulary.
- **Reasoning effort profiles.** A request's `reasoning_effort` (`low`, `medium` or `high`) sets Inkling's thinking effort (0.2, 0.7 or 0.99). It also sets a thinking budget sized to the request's output room: <code>low</code> keeps a soft nudge, <code>medium</code> nudges from a third of the room and stops at two thirds, and <code>high</code> doesn't nudge and stops at 80%.

Every change has an environment switch that restores stock behaviour, so you can check any one of them yourself.

## Run it

```bash
git clone https://github.com/platform-q-ai/inkling-mini-5090
cd inkling-mini-5090
build/build.sh
build/serve.sh /path/to/Inkling-2-Mini 8100
```

Then point any OpenAI-compatible client at `http://localhost:8100/v1`, model `inkling-2-mini`.

## Credits

This builds on [vLLM](https://github.com/vllm-project/vllm) and on Inkling 2 Mini by Thinking Machines Lab. Several kernel ideas come from **Ingine** by satellitedown ([inkling-2-mini-abliterated-ingine](https://github.com/satellitedown/inkling-2-mini-abliterated-ingine)). Profiling its decode step next to ours showed us where vLLM's time was going. The thinking budget follows [gr8](https://github.com/kindlingai/gr8)'s think-end boost. And the whole effort was inspired by the work Ash and Mia of TensorFold have shared and talked about.

How we got here, including what didn't work, is in [What we learned making vLLM faster on Inkling 2 Mini](2026-11-26-what-we-learned-making-vllm-faster.html).
