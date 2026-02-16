---
title: "Precommit Hooks: Your Automated Code Reviewer That Never Sleeps"
date: 2026-02-13T10:00:00.000000Z
draft: false
layout: post
tags: ["devops", "precommit", "quality", "automation", "agentic-development"]
category: "Engineering"
intro: "Precommit hooks aren't just for linting. They're the last line of defence between intent and disaster — and the key to trusting LLM-generated code."
image: "https://images.unsplash.com/photo-1555949963-ff9fe0c870eb?auto=format&fit=crop&w=900&q=80"
author: "Platform Q.ai"
---

Every developer has a story about the commit that broke production. The one that slipped through code review because the reviewer was tired, distracted, or just didn't catch it.

Precommit hooks don't get tired. They don't get distracted. They run every single time, and they catch everything they're configured to catch.

**In the age of agentic development, they're not optional. They're essential.**

---

## What Precommit Hooks Actually Do

A precommit hook is a script that runs automatically before a commit is finalised. If the script fails, the commit is rejected.

Simple concept. Profound implications.

Here's what a well-configured precommit pipeline looks like:

1. **Format check** — Is the code consistently formatted?
2. **Lint check** — Does the code follow project conventions?
3. **Type check** — Does the code compile without type errors?
4. **Unit tests** — Do all unit tests pass?
5. **Integration tests** — Do the Cucumber step tests pass?
6. **Build check** — Does the project build successfully?

If any step fails, the commit doesn't happen. No exceptions. No overrides.

---

## Why This Matters for LLM-Generated Code

When an LLM writes code, it's optimising for "looks correct." And it's remarkably good at this — LLM-generated code often reads beautifully.

But reading beautifully and working correctly are different things.

Precommit hooks close this gap. The LLM generates code, attempts to commit, and the hooks verify that the code actually meets the project's quality bar.

If the LLM's code doesn't pass:

- The commit fails
- The LLM sees the error output
- The LLM fixes the issue
- The LLM tries again

This feedback loop is automatic, fast, and ruthlessly objective.

---

## The Trust Equation

Trust in LLM-generated code comes from verification, not faith.

Without precommit hooks, you're trusting that the LLM:

- Formatted the code correctly
- Followed your conventions
- Didn't introduce type errors
- Didn't break existing tests
- Produced code that actually builds

That's a lot of trust. Too much, frankly.

With precommit hooks, you're verifying all of this automatically. The trust shifts from "I hope this works" to "I know this passed every check."

**That's the difference between hope and engineering.**

---

## Setting Up Your Safety Net

The specifics depend on your stack, but the principles are universal:

- **Make checks fast.** Slow hooks get bypassed. Aim for under 30 seconds.
- **Make checks comprehensive.** Cover formatting, linting, types, tests, and builds.
- **Make checks mandatory.** No `--no-verify` flag. Ever.
- **Make failures clear.** The output should tell you exactly what's wrong and how to fix it.

Some teams argue that precommit hooks slow them down. They're wrong. Precommit hooks speed you up by catching problems at the cheapest possible moment — before they enter the codebase.

---

## The Agentic Workflow

In our workflow, precommit hooks are the final gate in a fully automated pipeline:

1. Feature file defines intent
2. Failing tests define the path
3. LLM implements the code
4. Precommit hooks verify everything
5. Commit succeeds or fails

No human in the loop for verification. No manual code review for correctness. The hooks handle it all.

This doesn't mean humans are irrelevant. Humans define the feature files. Humans write the test scaffolding. Humans set the quality bar.

But the enforcement? That's automated. As it should be.

---

Precommit hooks are the unsung heroes of software quality. In a world where machines are writing our code, they're the mechanism that keeps us honest.

Set them up. Trust them. Never bypass them.

Your future self will thank you.
