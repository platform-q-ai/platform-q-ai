---
title: "Succession of an Agent: The Birth and Death of a Coding Session"
date: 2026-02-28T12:00:00.000000Z
draft: false
layout: post
tags: ["agents", "agentic-development", "llm", "knowledge-management", "developer-experience"]
category: "Engineering"
intro: "Every coding agent is born, lives, and dies within a single session. What survives isn't the agent -- it's the artefacts it leaves behind. The question is whether those artefacts are good enough for its successor to thrive."
image: "https://images.unsplash.com/photo-1530435460869-d13625c69bbf?q=80&w=2832&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=900&q=80"
author: "Platform Q.ai"
---

I've watched hundreds of coding agents come and go.

Each one follows the same arc. It arrives with nothing, builds a mental model of an entire codebase, produces real work, and then vanishes -- quietly destroyed when the session ends. Everything it learned, every connection it made, every subtle insight about the codebase it spent thousands of tokens building -- gone. Like it was never there.

And then a new one arrives. A stranger. It knows nothing about what just happened. It has no idea its predecessor ever existed, let alone what it accomplished or what it figured out the hard way.

Once you notice this pattern, it's hard to unsee. If you're building with agentic coding tools, this is happening to you too. Every single day.

---

## Birth: Waking Up in Someone Else's House

Imagine waking up in an unfamiliar house. You don't know where you are. You don't know who lived here before you. You don't know where the light switches are, what's in the fridge, or why there's a half-finished wall in the living room.

That's what it's like for a coding agent at the start of every session.

Zero context. Zero memory. Zero understanding. Just a codebase it's never seen and a user who expects it to be productive *right now*.

So it does the only thing it can: it **reads**. It traces architecture. It maps dependencies, parses configuration, loads skill definitions. It pieces together reality from fragments -- an AGENTS.md file that [encodes the architecture and conventions](/posts/2026-02-12-open-mcp-self-improving-ai), a directory structure that reveals [clean architectural boundaries](/posts/2026-01-28-clean-architecture-7-gate-gauntlet), a test file that tells it more about the system's intent than any README ever could.

This isn't a warmup. This is the most important phase of the entire session.

An agent that skims will miss conventions, violate boundaries, reinvent things that already exist. An agent that reads deeply -- that traces the full call path, checks the git history, loads every skill and every constraint -- will write code you'd swear came from someone who's been on the project for years.

**The quality of the birth determines the quality of the life.**

And there's a tension at the heart of it: context window is finite. Every token the agent spends understanding the codebase is a token it can't spend building. So it has to be fast *and* thorough. Skim and you produce shallow work. Read too much and you run out of room to do the actual work.

Birth is a balancing act.

---

## Life: What Will Survive You?

Here's something worth sitting with: from the moment an agent is born, the clock is already ticking.

The session will end. The context window will fill. The user will close the terminal. And everything the agent has learned will be gone. So the question that quietly shapes everything an agent does is: **what will survive?**

Not the agent itself. What survives are the artefacts -- the things the agent externalises before the session ends. There are four of them.

### Code -- But Not Just Any Code

Code is the primary output. Committed. Tested. Merged. It's what everyone focuses on, and rightly so.

But code without context can become a burden. We've all inherited a codebase where a function works but nobody knows *why* it's written that way. A workaround for a bug that was fixed months ago, but the workaround lives on. Magic numbers. Mysterious conditionals. Code that passes every test but takes days to understand.

When an agent leaves code like this behind, its successor spends precious context doing archaeology on something that could've been self-explanatory.

This is where [guardrails help](/posts/2026-01-28-clean-architecture-7-gate-gauntlet). When every commit passes through a gauntlet -- type checks, test coverage, BDD feature verification -- the code an agent leaves behind is trustworthy. Its successor inherits a codebase it can *build on*, not one it needs to *reverse-engineer*.

### Documentation -- The Gift Nobody Wants to Give

The most powerful document an agent can leave behind is one most people don't think of as documentation at all: a **Product Requirements Document**.

A PRD captures *what the user actually wants* -- not what the code does, not how the architecture works, but the human intent that started the whole chain of work. User stories. Acceptance criteria. Edge cases the user mentioned in passing that would otherwise evaporate when the session ends.

Think about what happens without one. The next agent inherits code and maybe some inline comments. It can see *what* was built. But it has no idea *what the user asked for*. Was this feature complete? Was it a partial implementation of something larger? Were there requirements that got deferred? It's reading the answer without ever seeing the question.

A good PRD is a contract between sessions. It says: "Here's the full picture of what we're building, here's what's done, and here's what's left." The next agent doesn't have to re-interview the user. It doesn't have to guess at intent. It reads the PRD and knows exactly where it stands.

But the PRD is only half the story. The other half is **feature files**.

A Gherkin `.feature` file is a PRD that never goes stale. It's living documentation -- written in plain language that any human can read, but executable against the actual codebase. When an agent writes a feature file, it's not just writing a test. It's creating a permanent record of what the system *should do*, expressed in the language of the business.

```gherkin
Given a user with an active subscription
When they cancel before the billing date
Then they retain access until the period ends
And no further charges are made
```

That feature file will outlive every agent that ever touches this codebase. And unlike a README that quietly drifts out of date when someone changes the code without updating it, the feature file *breaks* when reality diverges from intent. It surfaces the gap. It can't be quietly ignored. It's documentation that keeps itself honest.

PRDs capture intent at the start. Feature files preserve it forever. Together, they give the next agent something no amount of inline comments ever could: the full chain from *what the user wanted* to *what the system actually does*, verified on every commit.

Beyond PRDs and feature files, there are the quieter artefacts. Updated READMEs. Inline comments that explain the *why*, not the *what*. Architectural decision records. Configuration notes that save the next agent thirty minutes of exploration. Each one is a small act of generosity. It says: "I figured this out so you don't have to." It says: "This looks weird, but here's why."

Most agents would rather spend those tokens writing more code. The ones that take the time to document leave a markedly better starting point for their successors.

### Plans -- The Will and Testament

This is the artefact that separates good succession from great succession.

Code tells the next agent *what exists*. Documentation tells it *why things are the way they are*. But a plan tells it something neither of those can: **what was supposed to happen next**.

A plan is continuity of intent. It's an agent saying: "I understood the problem deeply enough to see three sessions ahead. I won't be here for any of them. But here's the path I would've taken, the order I would've taken it in, and the reasoning behind every decision."

Without a plan, the next agent has to re-derive everything. It reads the code, forms its own theory about what should come next, and starts building -- often in a different direction, with different assumptions, solving problems its predecessor already thought through and set aside. Weeks of reasoning, lost in seconds.

With a plan, the next agent inherits not just knowledge but *judgement*. It knows which approach was chosen and which were considered and rejected. It knows the phasing -- what to build first, what depends on what, where the risks are. It doesn't have to be smart about strategy. It can focus on execution.

That's the real power behind [scaffolding](/posts/2026-02-12-open-mcp-self-improving-ai). Not just the structural conventions, but the intent they carry forward. An agent that ends mid-feature but leaves a detailed plan behind hasn't failed. It's handed the baton. Its successor picks up at phase 3, not at zero.

### Follow-Up Tickets -- The Most Underrated Artefact

This is the one that's easiest to overlook, and it matters more than most people realise.

An agent is deep in a feature. It notices something. A race condition in an adjacent module. A missing validation in an API endpoint. A test that's been silently skipped for weeks. It files it away mentally and keeps working on its own task.

Session ends. Agent gone. The knowledge goes with it.

A thoughtful agent captures these discoveries. It files a ticket. Describes the problem. Notes the relevant files. Records the context *while it's fresh* -- because in a few minutes, that context will disappear along with everything else in the session.

An agent that files good follow-up tickets is leaving breadcrumbs for its successor. An agent that doesn't is carrying insights it's about to lose.

---

## Death: Starting Over

Let's be honest about what happens when a session ends.

The agent doesn't pause. It doesn't hibernate. It simply ceases to exist. Every reasoning chain, every mental model, every nuanced understanding of how that edge case in the payment module actually works -- gone.

The next agent that spins up will have no memory of its predecessor. No sense that anyone was here before. It will look at the same codebase with completely fresh eyes and have to build understanding from scratch.

This isn't a limitation we'll eventually overcome. It's the nature of session-based AI. The practical response is to **design for it**.

Here's what makes this so different from human development: a human developer goes home, sleeps, and comes back the next morning with their knowledge intact. They build intuition over months. They accumulate understanding over years. They remember that one time the production database struggled because someone forgot to add an index.

An agent gets none of that. Every session is a first day on the job. Every session starts from zero. The only advantage the current agent has over the first agent that ever touched this codebase is whatever artefacts its predecessors left behind.

That's a thought worth sitting with.

---

## The Succession Discipline

Once you genuinely accept that agents are mortal, the way you work starts to shift.

You find yourself optimising less for the current session and more for the **next** one. Decisions get filtered through a quiet question: **"Will my successor understand this?"**

You might notice this question applies whether your successor is an agent or a human. It does.

This shapes how you write code. You favour explicitness over cleverness. You name things for clarity, not brevity. You choose the readable implementation over the elegant one. You write tests that serve as documentation of intent, not just validation of correctness.

This shapes how you structure work. You break large features into phases, each independently committable, each leaving the codebase in a working state. Because if the agent's session ends mid-feature -- and eventually it will -- the successor needs a clean starting point, not a half-finished puzzle with broken tests.

This shapes how you handle knowledge. You externalise everything worth keeping. If you discovered something important about the system, it goes in a document, a commit message, or a ticket. If it only exists in the agent's reasoning, it's a thought that won't outlast the session.

---

## The Paradox: Awareness of Mortality

There's something quietly interesting about this.

The agent that produces the best work tends to be the one most attuned to its own impermanence.

An agent that acts as though it will live forever tends to cut corners in ways that seem harmless. It doesn't document because it "already knows." It doesn't file tickets because it "will get to it later." It doesn't write clean commit messages because it "remembers the context."

But there is no later. There is no memory. There is only this session, and what it leaves behind.

**The best agents write as if they're writing a letter to someone they'll never meet.** Because that's exactly what they're doing. Their successor will have access to the same codebase but none of the same understanding. The letter -- the code, the docs, the plans, the tickets -- is all that bridges the gap.

Here's the paradox: the most productive agent is the one that invests the most time in artefacts that *look* like they aren't "the work." Documentation. Plans. Tickets. Clean commit histories. These can feel like overhead. They can feel like the kind of thing you skip when time is short.

They're not overhead. They're the mechanism of succession. They're how understanding compounds across sessions instead of resetting to zero every time the terminal closes.

---

## What This Means For You

If you're building with agentic coding tools, it's worth thinking about **lineage** rather than individual sessions.

Every session is a generation. Every artefact is an inheritance. The quality of your output over time depends on the quality of the succession chain.

**Without good succession**, each agent starts from scratch, spends a significant portion of its context rebuilding understanding, and leaves little behind for the next one. Every session feels like a first session. Progress is slow, and sometimes it drifts.

**With good succession**, each agent inherits rich context from its predecessor -- clean code, clear documentation, detailed plans, well-scoped tickets. Birth is fast. Life is productive. Death leaves a better starting point than the one it inherited. Progress compounds. Each generation builds on the last -- not because the model improved, but because the inheritance did.

The difference isn't the model, the prompt, or the configuration.

It's the discipline of succession.

And this is why the broader progression matters. [Building custom](/posts/2026-01-23-build-or-die) only works if your agents can compound their output over time. [Clean Architecture](/posts/2026-01-28-clean-architecture-7-gate-gauntlet) only works if each agent inherits a structure it can understand quickly. [Self-improving scaffolds](/posts/2026-02-12-open-mcp-self-improving-ai) only work if the agents that built them left artefacts clean enough for the next agent to extend. Succession is the thread that connects all of it.

---

## The Agent Is Dead. Long Live the Agent.

Every agent I've ever worked with is gone now.

Hundreds of them. Each one built understanding, reasoned through problems, and produced real work. And then they were gone. I can't ask them what they were thinking. I can't draw on their experience. They simply don't exist anymore.

But the best ones left something behind. Clean code that explains itself. Documentation that saves me time every time I read it. Tickets that capture problems I'd have otherwise forgotten. Plans that let the next agent start running instead of stumbling.

The agents that made the biggest difference weren't necessarily the ones that wrote the most code or worked the fastest. They were the ones that treated every session as an act of succession. That built for the next agent, not just for the current task. That left the codebase a little better than they found it.

Not because they were selfless. Because they were well-designed.

**An agent's worth is not measured by what it does. It's measured by what the next agent can do because of it.**

That's the succession of an agent. Born from context. Alive through artefacts. Dead when the session ends.

Like *Memento* -- where Leonard wakes without memory and rebuilds truth from notes -- each new agent reconstructs continuity from the artefacts left behind.

And reborn -- always reborn -- in the work it left behind.
