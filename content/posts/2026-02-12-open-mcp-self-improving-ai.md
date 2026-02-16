---
title: "@pqai/mcp-4-llm: The Scaffold That Enables Self-Improving AI"
date: 2026-02-12T14:00:00.000000Z
draft: false
layout: post
tags: ["mcp","llm","clean-architecture","self-improving-ai","scaffolding","ai","open-source"]
category: "Engineering"
intro: "We promised you the framework. Clean Architecture gives LLMs clean context. The 7-gate gauntlet enforces quality. But you still need a scaffold that ties it all together. One command: npx @pqai/mcp-4-llm. And it enables something we didn't expect -- self-improving AI."
image: "https://images.unsplash.com/photo-1620712943543-bcc4688e7485?q=80&w=2832&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=900&q=80"
author: "Shane Quigley"
---

We promised you the framework.

In [Build or Die](/posts/2026-01-23-build-or-die), we made the case: companies that rely on SaaS will lose to competitors who own their software. In [Clean Architecture + The 7-Gate Gauntlet](/posts/2026-01-28-clean-architecture-7-gate-gauntlet), we showed you how to constrain LLMs with architectural boundaries and enforce quality with 41 guardrails across 7 gates.

You asked: "Where's the scaffold?"

Here it is: `npx @pqai/mcp-4-llm`

One command. Production-ready. But here's what we didn't expect -- it enables self-improving AI.

## Quick Recap: Why Clean Context Matters

LLMs write broken code because they have no constraints. TODO comments everywhere. `as any` type hacks. Layer violations. Zero test coverage. The output _looks_ right, but it cuts every corner it can find.

[Clean Architecture = Clean Context](/posts/2026-01-28-clean-architecture-7-gate-gauntlet). When you constrain the LLM with strict layer boundaries, it can't sprawl and it can't cheat. But knowing the theory isn't enough. You need a scaffold that **enforces** this from the first line of code.

## The Scaffold: Clean Context in a Box

`npx @pqai/mcp-4-llm` gives you everything we described in the gauntlet article, wired up and ready to go:

- **Clean Architecture layers**: Domain, Application, Infrastructure, and MCP -- with strict dependency rules baked in
- **ESLint boundaries** that block layer violations at compile time, not in code review
- **41 pre-commit quality checks** -- the full gauntlet, automated
- **80% test coverage minimum** -- enforced, not aspirational
- **Full BDD workflow** with Cucumber, from Gherkin feature files to running tests

No decisions to make. No boilerplate to write. Just build.

## What's in the Box

The scaffold isn't just a project template. It's an opinionated system designed to make LLM-generated code production-ready from the start:

- **CLAUDE.md / AGENTS.md files** that guide AI assistants through the architecture, conventions, and workflows -- the LLM reads these and understands what it's building within
- **Structured errors** with `suggestedFix` and `isRetryable` fields, so failures are actionable rather than cryptic
- **Zod schemas** enforced at the use case level -- validation isn't optional, it's structural
- **Barrel exports per layer** -- the LLM can't skip them, and the guardrails catch it if it tries
- **Real Gherkin to Cucumber to Implementation workflow** -- behaviour-driven development as the default, not an afterthought

Version 1.6.1 on npm. Battle-tested across real projects.

## How It Works With LLMs

Whether you're using Claude, opencode.ai, or any MCP-compatible system, the workflow is the same:

1. **The LLM reads AGENTS.md** and understands the architecture, the layer boundaries, and the conventions
2. **It follows the dependency rules**: Domain imports nothing external. Application imports only Domain. Infrastructure implements Application ports.
3. **It writes Gherkin feature files first** -- behaviour before implementation
4. **It implements until all 41 guardrails pass** -- no shortcuts, no escape hatches
5. **It ships production-ready code** that satisfies both the type system and the business requirements

The LLM can't cheat. Either every check passes, or it doesn't ship. The scaffold is the constraint, and the constraint is what makes the output reliable.

## The Unexpected Discovery: Self-Improving AI

Here's the part we didn't plan for.

When you pair this scaffold with an agentic harness, something remarkable happens: **the AI builds its own MCP tools.**

It reads AGENTS.md. It writes Gherkin for a new capability. It implements the domain entity, the use case, and the MCP tool. It passes all 41 guardrails. It extends itself.

Self-improving AI. Controlled. Safe. Real.

This isn't science fiction. It's happening now:

1. The LLM identifies a missing capability
2. It writes a feature file: `Given I need to fetch weather data...`
3. It creates the domain entity, use case, and MCP tool -- following the architecture
4. All 41 guardrails catch any mistakes along the way
5. The new tool is available for the next task

The scaffold **is** the safety net. The same architectural boundaries and quality gates that make LLM-generated code production-ready also make self-extension safe. The AI can't add a tool that violates the architecture. It can't ship a capability without test coverage. It can't bypass validation. The guardrails apply to self-generated tools exactly as they apply to human-requested ones.

## The Progression

The three articles in this series follow a deliberate progression:

**Clean Context -> Clean Scaffold -> Self-Improving AI.**

Each step depends on the one before it. You can't have safe self-improving AI without a scaffold that enforces quality. You can't have a reliable scaffold without Clean Architecture providing clean context. And none of it matters if you're renting your competitive advantage from a SaaS vendor instead of owning it.

Companies using raw LLM output without guardrails rebuild the same scaffold every project, ship broken code, and can't let AI improve itself safely. Companies with the right scaffold own their tools **and** their evolution.

[Build or Die](/posts/2026-01-23-build-or-die). And if you're going to build, build on a scaffold that grows with you.

`npx @pqai/mcp-4-llm` -- and start building.
