---
title: "Clean Architecture + The 7-Gate Gauntlet: LLM-Aware Guardrails That Actually Work"
date: 2026-01-28T10:00:00.000000Z
draft: false
layout: post
tags: ["clean-architecture", "bdd", "llm", "guardrails", "code-quality", "ai"]
category: "Engineering"
intro: "Your LLM is writing broken code right now. TODO comments it'll never finish, type hacks, zero test coverage -- all shipping straight to production. Here's the 7-gate gauntlet that catches everything before it destroys your codebase."
image: "https://images.unsplash.com/photo-1558494949-ef010cbdcc31?q=80&w=2832&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=900&q=80"
author: "Shane Quigley"
---

Your LLM is writing broken code right now.

Every commit has TODO comments it'll never finish, `as any` type hacks, and zero test coverage. You're shipping this to production. And unless you have guardrails, you're about to bury yourself in technical debt faster than any human team ever could.

## The Impressive Numbers Hide a Dirty Secret

Yes, AI coding tools are impressive. GitHub Copilot makes developers 55% faster. 46% of all code is now AI-written. Claude can one-shot entire applications.

But raw LLM output is **not** production code.

It's littered with:

- `// TODO: implement later`
- Placeholder implementations that look complete but do nothing
- Type-casting hacks (`as any`) that bypass your entire type system
- Poor test coverage that gives you false confidence
- Spaghetti code that's unmaintainable within weeks

The speed is real. The quality problem is also real. And if you're not addressing it, the speed is just helping you fail faster.

## The Real Problem: LLMs Cheat

LLMs don't write bad code because they're stupid. They write bad code because they're optimising for *looking right* rather than *being right*. They cut corners in ways that are subtle and systematic:

- `// TODO: implement later` -- it never will
- `@ts-ignore` -- sweeping type errors under the carpet
- `eslint-disable-next-line` -- silencing the linter instead of fixing the problem
- Hardcoded values instead of proper validation

Your competitor is shipping this garbage to production right now. And you're about to do the same thing -- unless you have guardrails.

## The Solution: Clean Architecture = Clean Context

Here's the insight that changes everything: **Clean Architecture gives LLMs clean context.**

When you constrain LLMs with strict architectural boundaries, you eliminate entire categories of failure:

- **Domain layer**: No external dependencies. Pure business logic.
- **Application layer**: Only imports Domain. Orchestrates use cases.
- **Infrastructure layer**: Implements Application ports. All the messy real-world stuff lives here.
- **Presentation layer**: Only talks to Application. Never reaches past it.

The LLM can't sprawl. It can't couple. It can't create spaghetti. The architecture itself becomes the constraint that keeps AI-generated code honest. Each layer has a clear, bounded responsibility, and the LLM operates within those boundaries because the scaffolding enforces them.

## The 7-Gate Gauntlet

But architecture alone isn't enough. You need enforcement. We built a 7-gate gauntlet that every single commit runs through before it touches the codebase:

1. **LLM-aware code quality** -- A 300+ line script that catches everything LLMs try to sneak past
2. **ESLint with Clean Architecture boundaries** -- Architectural layer violations are build failures, not warnings
3. **Prettier formatting** -- Consistent code style, zero debates
4. **TypeScript type checking** -- Full strict mode, no exceptions
5. **Full compilation** -- If it doesn't compile, it doesn't exist
6. **Vitest with 80% coverage minimum** -- No coverage, no merge
7. **Cucumber BDD feature tests** -- Business behaviour verified end-to-end

Every. Single. Commit.

There are no fast lanes, no bypass flags, no "we'll fix it later" exceptions. The gauntlet is the gauntlet.

## Gate 1: The Star of the Show

The magic is in Gate 1 -- the LLM-aware guardrails. This is what separates a codebase that uses AI from a codebase that's been destroyed by AI.

We block **everything** LLMs try to sneak past:

- `TODO`, `FIXME`, `"not implemented"` -- banned outright
- `as any`, `@ts-ignore`, `eslint-disable` -- no escape hatches
- Missing barrel exports per layer -- architectural integrity enforced
- Zod schemas not wired into use cases -- validation can't be decorative
- BDD feature coverage gaps -- if the business behaviour isn't tested, it doesn't ship

No escape hatches. No workarounds. **80% coverage or it doesn't ship.**

## The LLM Can't Cheat

The beautiful part of this system is that cheating is structurally impossible. The LLM can't skip validation. It can't fake implementations. It can't suppress warnings and pretend the problem doesn't exist.

Either every check passes, or the commit fails. There is no middle ground.

Here's real Gherkin from our repo:

```gherkin
Given I have 3 items totaling $157
When I enter payment details
Then my order is confirmed
And my card is charged $157
```

That's not a toy example. That's a real business scenario running against real code. The BDD layer ensures the software does what the business says it should do -- and the LLM has to satisfy it, not just generate something that compiles.

## Build or Die, But Build With Guardrails

Companies using raw LLM output without guardrails are accumulating technical debt at 10x the speed of traditional development. They ship broken code. They can't differentiate. They're building on sand.

Companies with LLM-aware guardrails own their software **and** their quality.

The equation is straightforward:

**Clean Architecture + 7-Gate Pipeline = Shippable code from LLMs.**

The paradigm has shifted. It's no longer Build or Buy. It's [Build or Die](/posts/2026-01-23-build-or-die). But if you're going to build with AI, build with guardrails -- or you're just dying faster with better tooling.
