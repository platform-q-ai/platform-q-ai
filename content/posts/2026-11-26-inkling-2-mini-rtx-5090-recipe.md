---
title: "Inkling 2 Mini on one RTX 5090: the recipe"
date: 2026-11-26T18:00:00.000000Z
draft: false
layout: post
tags: ["inkling", "vllm", "rtx-5090", "inference", "fp8"]
category: "Inference"
intro: "A set of vLLM patches that optimises Inkling 2 Mini on one RTX 5090 for long-running agentic tasks and coding: a 5.69 ms decode step, 344k tokens of context, and four coding agents at about 670 tok/s in total with 90k tokens of context each."
image_alt: "Bar chart of four concurrent agent streams on one RTX 5090: total throughput with all four decoding is about 920 tok/s at about 10k tokens of context per stream and about 670 at 90k."
image_height: 610
image: "/images/inkling-recipe.svg"
author: "Platform Q.ai"
---

[Inkling 2 Mini](https://huggingface.co/thinkingmachines/Inkling-2-Mini) is a 26B looped mixture-of-experts model from Thinking Machines Lab. It activates only a few billion parameters per token, and it fits on a single 32 GB consumer GPU. We wanted to know how good a coding-agent server one RTX 5090 can be, without giving up what [vLLM](https://github.com/vllm-project/vllm) already does well: concurrent requests, prefix caching, chunked prefill, speculative decoding and an OpenAI-compatible API.

The result is a set of vLLM patches, open source under Apache-2.0: **[github.com/platform-q-ai/inkling-mini-5090](https://github.com/platform-q-ai/inkling-mini-5090)**.

## Results

Measured on one RTX 5090 with 4 concurrent sequences, FP8 KV cache, and the model's DSpark drafter proposing 7 tokens. All speed figures are at temperature 1.0, Inkling's default sampling, not greedy decoding.

<div class="table-wrap"><table><thead><tr><th>measure</th><th>our figures</th></tr></thead><tbody><tr><td>decode step</td><td>5.69 ms</td></tr><tr><td>single stream, tok/s (code / JSON / prose)</td><td>340 / 330 / 253</td></tr><tr><td>prefill</td><td>~11k tok/s</td></tr><tr><td>KV cache pool</td><td>380k tokens</td></tr><tr><td>max context</td><td>344k tokens</td></tr></tbody></table></div>

### Four coding agents at once

What matters for agents is several long conversations at the same time, not dozens of short chats. We sent four requests at once. Each held a different slice of a real Rust codebase plus a coding task, with no prefix shared between them. "Warm" repeats them with each prompt already cached, as in a running agent session.

<div class="table-wrap"><table><thead><tr><th>context per stream</th><th>total tok/s with all 4 decoding</th><th>per stream</th><th>time to first token</th></tr></thead><tbody><tr><td>~10k</td><td>~920</td><td>186–282</td><td>1.1 s</td></tr><tr><td>~90k</td><td>~670</td><td>147–196</td><td>2.7 s</td></tr></tbody></table></div>

At four streams the card draws about 430 W and runs at about 65 °C.

### Accuracy

With FP8, the model's next token matches the full-precision reference 95.7% of the time, over about 11,000 positions including a 57,556-token real-code prompt. The reference matches itself 96.4% of the time from run to run; that's the noise floor from sampling and kernel order. These agreement figures are greedy, teacher-forced comparisons against the reference.

The decode changes on their own don't change accuracy: 96.5%. The small drop comes from running prefill in FP8. If you'd rather keep prefill in BF16, one switch (`E22_DENSE_FP8=1`) does that. It measures 96.1% and leaves about 115k fewer tokens of KV pool.

## What changed

- **FP8 dense layers and LM head.** The dense projections and the head are stored in FP8 (per-channel weight scales, per-token activation scales), and their BF16 copies are freed. That memory goes to the KV cache, which is where the extra context comes from. The vLLM image has no sm_120 FP8 CUTLASS kernel, so prefill runs on a Triton W8A8 GEMM.
- **Decode kernels.** Programmatic dependent launch chained across kernels, so each kernel loads its weights while the previous one finishes; one launch for several projections; split-K where a small GEMM left the GPU idle; better MoE tiles; and split-KV local attention with an exact combine.
- **Speculative decoding:** adaptive verification, so only drafts likely to be accepted are verified, and a 16k-token draft vocabulary.
- **Reasoning effort profiles.** A request's `reasoning_effort` (`low`, `medium` or `high`) sets Inkling's thinking effort (0.2, 0.7 or 0.99). It also sets a thinking budget sized to the request's output room: <code>low</code> keeps a soft nudge, <code>medium</code> nudges from a third of the room and stops at two thirds, and <code>high</code> doesn't nudge and stops at 80%.

Every change has an environment switch that restores stock behaviour, so you can check any one of them yourself.

### Precision

The DSpark drafter has 3 layers and proposes 7 tokens.

<div class="table-wrap table-text"><table><thead><tr><th>part of the model</th><th>precision</th></tr></thead><tbody><tr><td>Routed MoE experts</td><td>NVFP4, as shipped in the checkpoint; layers 20–23 in MXFP8</td></tr><tr><td>Attention projections, all 24 layers (fused qkv and output)</td><td>FP8 E4M3 weights with per-row scales; activations FP8 per-token in prefill (W8A8), BF16 in decode</td></tr><tr><td>LM head, shared with the drafter</td><td>FP8 E4M3</td></tr><tr><td>DSpark drafter attention (qkv, context kv, output) and MLP (gate-up, down)</td><td>FP8 E4M3</td></tr><tr><td>DSpark drafter 16,384-token draft head and Markov head</td><td>BF16</td></tr><tr><td>Embeddings, router, loop gates, norms, short convolutions</td><td>BF16</td></tr><tr><td>KV cache</td><td>FP8</td></tr></tbody></table></div>

## Thinking budget: ThinkNudge

Inkling thinks before it answers, and on hard coding steps it can keep thinking for 16,000 tokens or more, sometimes drafting a whole implementation in its reasoning and running out of room before it answers. For an agent that's wasted time. ThinkNudge is a vLLM logits processor, included in the repo, that keeps thinking in proportion without cutting it off mid-thought.

- **Soft budget (the nudge).** Once a response has used `start` thinking tokens, the logit of Inkling's end-of-thinking token gets a boost of `base + per1k × (tokens past start) / 1000`, capped at `max`. The boost applies only at natural pauses, after a newline or a sentence end, so the model wraps up at the end of a thought rather than mid-sentence.
- **Hard cap.** At `cap` thinking tokens the processor forces the close sequence and stops the model opening another thinking block in that response. It forces only the close, so the model still chooses whether to answer or call a tool.
- **Counting.** Thinking is counted over the whole response, across every thinking block, so a model can't escape the budget by closing and reopening a block. Speculative drafts are tracked too: the state follows exactly the tokens vLLM accepts.
- **Fast.** The state lives on the GPU and two small Triton kernels update it each step with no host sync.

<div class="table-wrap"><table><thead><tr><th>server default</th><th>value</th></tr></thead><tbody><tr><td>nudge starts after</td><td>5,000 thinking tokens</td></tr><tr><td>boost: base / per 1k tokens / max</td><td>6 / 2 / 18 logits</td></tr><tr><td>boost applies at</td><td>pauses (newline or sentence end)</td></tr><tr><td>hard cap</td><td>12,000 thinking tokens</td></tr></tbody></table></div>

Inkling's end-of-thinking token sits about 15 to 30 logits below the top choice at a pause (median 23), so a boost that starts from zero does nothing for thousands of tokens. That's why the nudge starts with a step (`base`) and goes up to 18.

Any request can set its own budget through `vllm_xargs` (`think_nudge`, `think_end_boost`, `think_cap`), or use the effort profiles: `low` uses the server defaults above, `medium` nudges from a third of the request's output room and stops at two thirds, and `high` doesn't nudge and stops at 80%.

The soft budget follows the think-end boost in [gr8](https://github.com/kindlingai/gr8), with two changes for Inkling: the boost starts with a step and is gated to pauses, and it tracks the thinking blocks the model opens itself. gr8 applies its boost only when the prompt leaves a thinking block open, which an Inkling prompt never does.

## Run it

```bash
git clone https://github.com/platform-q-ai/inkling-mini-5090
cd inkling-mini-5090
build/build.sh
build/serve.sh /path/to/Inkling-2-Mini 8100
```

Then point any OpenAI-compatible client at `http://localhost:8100/v1`, model `inkling-2-mini`.

## Credits

- **[vLLM](https://github.com/vllm-project/vllm)** (Apache-2.0). Everything here is a set of patches to vLLM and its Inkling 2 support: the batching, paged KV cache, chunked prefill, prefix caching, speculative decoding and the OpenAI-compatible server are all vLLM's.
- **[Thinking Machines Lab](https://huggingface.co/thinkingmachines/Inkling-2-Mini)**, for Inkling 2 Mini and its DSpark drafter (Apache-2.0).
- **Ingine** by satellitedown ([inkling-2-mini-abliterated-ingine](https://github.com/satellitedown/inkling-2-mini-abliterated-ingine), Apache-2.0), a hand-written CUDA engine for Inkling 2 Mini on one RTX 5090. Profiling its decode step next to ours showed where our time was going, and several of our kernels follow its ideas: loading weights before the programmatic-dependent-launch wait, one launch for several projections, a single-kernel loop message-gate chain, the conv/mix layout, prefetching the expert down-projection, a confidence threshold for how many drafts to verify, and FP8 dense weights with per-row scales. No Ingine code is copied; each file in the repo says which idea it follows.
- **[gr8](https://github.com/kindlingai/gr8)**, whose think-end boost and thinking budget ThinkNudge's soft budget follows.
- **Ash and Mia of TensorFold**: this work was inspired by what they have shared and talked about.
- **[Triton](https://github.com/triton-lang/triton)**, which the FP8 prefill, ThinkNudge and several decode kernels are written in, and **NVIDIA Nsight Systems**, used for the profiles.

How we got here, including what didn't work, is in [What we learned making vLLM faster on Inkling 2 Mini](2026-11-26-what-we-learned-making-vllm-faster.html).
