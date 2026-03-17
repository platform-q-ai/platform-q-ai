/**
 * Platform Q.ai Development Workflow Extension — Enforces a structured
 * development workflow as an interactive todo checklist in Pi.
 *
 * Supports TWO workflow types, selected at cycle start:
 *   - "content" — for blog posts (research, draft, build, review, publish)
 *   - "dev"     — for design/code changes (scout, implement, build, review, publish)
 *
 * CONTENT workflow (14 steps, 5 phases):
 *
 *  RESEARCH (steps 1-2):
 *   1. Scout topic & gather research
 *   2. Write content brief
 *
 *  DRAFT (steps 3-5):
 *   3. Write first draft
 *   4. Content review (sub-agent)
 *   5. Revise draft
 *
 *  BUILD (steps 6-8):
 *   6. Build the site
 *   7. Preview & visual check
 *   8. Fix any layout/styling issues
 *
 *  REVIEW (steps 9-11):
 *   9.  Dispatch parallel reviewers (SEO, editorial, technical)
 *  10. Apply review feedback
 *  11. Final build & verify
 *
 *  PUBLISH (steps 12-14):
 *  12. Commit
 *  13. Push & create PR
 *  14. Merge and deploy
 *
 * DEV workflow (12 steps, 4 phases):
 *
 *  SCOUT (steps 1-2):
 *   1. Scout codebase & write plan
 *   2. Validate plan
 *
 *  IMPLEMENT (steps 3-5):
 *   3. Implement changes
 *   4. Build & verify (`mix alkali.build`)
 *   5. Fix any build/layout/styling issues
 *
 *  REVIEW (steps 6-8):
 *   6. Dispatch parallel reviewers
 *   7. Apply review feedback
 *   8. Final build & verify
 *
 *  PUBLISH (steps 9-12):
 *   9.  Commit
 *  10. Push & create PR
 *  11. Address PR feedback (if any)
 *  12. Merge and deploy
 *
 * Features:
 * - `/workflow` command opens an interactive checklist UI
 * - `workflow` tool lets the LLM check/uncheck/reset/query steps + set workflow type
 * - Tracks active work item (post slug or branch name) and shows it in widget
 * - Widget above editor shows current progress at a glance
 * - Guards block git commit, git push, gh pr create, gh pr merge unless prerequisite steps are done
 * - Injects workflow awareness into the system prompt
 * - Completion nudge prompts for next work when all steps are done
 * - State persists across session restarts via tool result details
 */

import { StringEnum } from "@mariozechner/pi-ai";
import type { ExtensionAPI, ExtensionContext, Theme } from "@mariozechner/pi-coding-agent";
import { isToolCallEventType } from "@mariozechner/pi-coding-agent";
import { matchesKey, Text, truncateToWidth } from "@mariozechner/pi-tui";
import { Type } from "@sinclair/typebox";

// ─── Workflow definition ───────────────────────────────────────────────

type WorkflowType = "content" | "dev";

type ContentPhase = "research" | "draft" | "build" | "review" | "publish";
type DevPhase = "scout" | "implement" | "build" | "review" | "publish";
type Phase = ContentPhase | DevPhase;

interface WorkflowStep {
	id: number;
	label: string;
	phase: Phase;
	done: boolean;
}

interface ActiveItem {
	slug: string;
	title: string;
}

// ─── Content workflow template ────────────────────────────────────────

const CONTENT_TEMPLATE: Omit<WorkflowStep, "done">[] = [
	{
		id: 1,
		label: "Scout topic — spawn a scout sub-agent to research the topic, gather references, identify the target audience, find compelling angles, and map related Platform Q content for internal linking.",
		phase: "research",
	},
	{
		id: 2,
		label: "Write content brief — define: title, subtitle, intro hook, key sections, target keywords, category, tags, estimated word count, and the core argument or thesis.",
		phase: "research",
	},
	{
		id: 3,
		label: "Write first draft — create the markdown file in `content/posts/` with proper frontmatter (title, date, layout: post, tags, category, intro, image, author). Write the full article following the content brief.",
		phase: "draft",
	},
	{
		id: 4,
		label: "Content review — spawn a content-reviewer sub-agent to analyze the draft for: argument strength, flow, readability, voice consistency with existing Platform Q posts, factual accuracy, and engagement.",
		phase: "draft",
	},
	{
		id: 5,
		label: "Revise draft — apply content review feedback. Tighten prose, strengthen the argument, improve transitions, add concrete examples or data points.",
		phase: "draft",
	},
	{
		id: 6,
		label: "Build the site — run `mix alkali.build` to generate the static site. Verify it completes without errors.",
		phase: "build",
	},
	{
		id: 7,
		label: "Preview & visual check — verify: post appears in the home grid, hero image displays correctly, code blocks render properly, no broken links.",
		phase: "build",
	},
	{
		id: 8,
		label: "Fix any layout/styling issues — if the preview revealed problems with the HEEx layouts, CSS, or frontmatter, fix them now and rebuild.",
		phase: "build",
	},
	{
		id: 9,
		label: "Dispatch parallel reviewers — spawn seo-reviewer, editorial-reviewer, and technical-reviewer sub-agents simultaneously.",
		phase: "review",
	},
	{
		id: 10,
		label: "Apply review feedback — address SEO issues (meta, keywords, headings), editorial concerns (grammar, style, voice), and technical accuracy. Rebuild after changes.",
		phase: "review",
	},
	{
		id: 11,
		label: "Final build & verify — run `mix alkali.build` one last time. Confirm no errors, post renders correctly, and all review feedback has been addressed.",
		phase: "review",
	},
	{
		id: 12,
		label: 'Commit — `git add -A && git commit -m "post: <slug-title>"`. Use a clear commit message.',
		phase: "publish",
	},
	{
		id: 13,
		label: 'Push & create PR — `git push origin HEAD` then `gh pr create --title "post: <title>" --body "<summary>"`. Record PR number.',
		phase: "publish",
	},
	{
		id: 14,
		label: "Merge and deploy — `gh pr merge --squash --delete-branch` then `git checkout master && git pull origin master`. Confirm clean working tree.",
		phase: "publish",
	},
];

// ─── Dev workflow template ────────────────────────────────────────────

const DEV_TEMPLATE: Omit<WorkflowStep, "done">[] = [
	{
		id: 1,
		label: "Scout codebase & write plan — map relevant files (layouts, CSS, config, static assets). Write a plan listing: what changes, which files are affected, acceptance criteria, and potential risks.",
		phase: "scout",
	},
	{
		id: 2,
		label: "Validate plan — re-read every file path, class name, and selector mentioned in the plan. Confirm they exist. Fix inaccuracies. Do NOT write implementation code yet.",
		phase: "scout",
	},
	{
		id: 3,
		label: "Implement changes — make the planned changes to layouts, CSS, templates, config, or content files. Work iteratively.",
		phase: "implement",
	},
	{
		id: 4,
		label: "Build & verify — run `mix alkali.build`. Verify it completes without errors. Check that all pages generate correctly in `_site/`.",
		phase: "implement",
	},
	{
		id: 5,
		label: "Fix any build/layout/styling issues — if the build revealed problems, fix them and rebuild with `mix alkali.build`.",
		phase: "implement",
	},
	{
		id: 6,
		label: 'Commit & push — `git add -A && git commit` then `git push origin HEAD`. Create PR: `gh pr create --title "<type>: <title>" --body "<summary>"`. Record PR number.',
		phase: "build",
	},
	{
		id: 7,
		label: "Dispatch parallel reviewers — spawn architecture-reviewer, security-reviewer, and performance-reviewer sub-agents simultaneously to post inline comments on the PR.",
		phase: "review",
	},
	{
		id: 8,
		label: "Fix review concerns — read all reviewer comments. Fix valid concerns, rebuild with `mix alkali.build`, commit and push fixes.",
		phase: "review",
	},
	{
		id: 9,
		label: "Reply to reviewers and resolve — reply explaining changes or rationale, then resolve each review thread.",
		phase: "review",
	},
	{
		id: 10,
		label: "Final build & verify — run `mix alkali.build` one last time. Confirm no errors and everything renders correctly.",
		phase: "review",
	},
	{
		id: 11,
		label: "Merge — `gh pr merge --squash --delete-branch`.",
		phase: "publish",
	},
	{
		id: 12,
		label: "Clean up — `git checkout master && git pull origin master`. Confirm clean working tree.",
		phase: "publish",
	},
];

function getTemplate(type: WorkflowType): Omit<WorkflowStep, "done">[] {
	return type === "content" ? CONTENT_TEMPLATE : DEV_TEMPLATE;
}

function freshSteps(type: WorkflowType): WorkflowStep[] {
	return getTemplate(type).map((s) => ({ ...s, done: false }));
}

// ─── Tool details shape (for state persistence) ───────────────────────

interface WorkflowDetails {
	action: "status" | "check" | "uncheck" | "reset" | "skip" | "set_item" | "clear_item" | "set_type";
	workflowType: WorkflowType;
	steps: WorkflowStep[];
	activeItem?: ActiveItem;
	error?: string;
}

// ─── Phase colors ─────────────────────────────────────────────────────

function phaseColor(phase: string, theme: Theme): (t: string) => string {
	switch (phase) {
		case "research":
		case "scout":
			return (t) => theme.fg("warning", t);
		case "draft":
		case "implement":
			return (t) => theme.fg("accent", t);
		case "build":
			return (t) => theme.fg("success", t);
		case "review":
			return (t) => theme.fg("muted", t);
		case "publish":
			return (t) => theme.fg("error", t);
		default:
			return (t) => t;
	}
}

function phaseLabel(phase: string): string {
	switch (phase) {
		case "research":
			return "RESEARCH";
		case "scout":
			return "SCOUT";
		case "draft":
			return "DRAFT";
		case "implement":
			return "IMPLEMENT";
		case "build":
			return "BUILD";
		case "review":
			return "REVIEW";
		case "publish":
			return "PUBLISH";
		default:
			return phase;
	}
}

// ─── Guards definition ────────────────────────────────────────────────

interface Guard {
	pattern: RegExp;
	/** Returns the step number that must be completed before this command. */
	beforeStep: (type: WorkflowType) => number;
	message: (type: WorkflowType) => string;
}

const GUARDS: Guard[] = [
	{
		pattern: /\bgit\s+commit\b/,
		beforeStep: (type) => (type === "content" ? 12 : 6),
		message: (type) => {
			const stepCount = type === "content" ? 11 : 5;
			return `BLOCKED: Steps 1-${stepCount} must be checked before committing. This ensures the build passes and issues are fixed. Run workflow(action='status') to see what's missing.`;
		},
	},
	{
		pattern: /\bgit\s+push\b/,
		beforeStep: (type) => (type === "content" ? 13 : 6),
		message: (type) => {
			const stepCount = type === "content" ? 12 : 5;
			return `BLOCKED: Steps 1-${stepCount} must be checked before pushing. Run workflow(action='status') to see what's missing.`;
		},
	},
	{
		pattern: /\bgh\s+pr\s+create\b/,
		beforeStep: (type) => (type === "content" ? 13 : 6),
		message: (type) => {
			const stepCount = type === "content" ? 12 : 5;
			return `BLOCKED: Steps 1-${stepCount} must be checked before creating a PR. Run workflow(action='status') to see what's missing.`;
		},
	},
	{
		pattern: /\bgh\s+pr\s+merge\b/,
		beforeStep: (type) => (type === "content" ? 14 : 11),
		message: (type) => {
			const stepCount = type === "content" ? 13 : 10;
			return `BLOCKED: All steps 1-${stepCount} must be checked before merging. This includes dispatching reviewers, fixing concerns, and the final build. Run workflow(action='status') to see what's missing.`;
		},
	},
];

// ─── Interactive checklist component ──────────────────────────────────

class WorkflowChecklist {
	private steps: WorkflowStep[];
	private workflowType: WorkflowType;
	private activeItem: ActiveItem | undefined;
	private theme: Theme;
	private onClose: (steps: WorkflowStep[]) => void;
	private selected: number = 0;
	private cachedWidth?: number;
	private cachedLines?: string[];

	constructor(
		steps: WorkflowStep[],
		workflowType: WorkflowType,
		activeItem: ActiveItem | undefined,
		theme: Theme,
		onClose: (steps: WorkflowStep[]) => void,
	) {
		this.steps = steps.map((s) => ({ ...s }));
		this.workflowType = workflowType;
		this.activeItem = activeItem;
		this.theme = theme;
		this.onClose = onClose;
	}

	handleInput(data: string): void {
		if (matchesKey(data, "escape") || matchesKey(data, "ctrl+c")) {
			this.onClose(this.steps);
			return;
		}
		if (matchesKey(data, "up") || data === "k") {
			this.selected = Math.max(0, this.selected - 1);
			this.invalidate();
			return;
		}
		if (matchesKey(data, "down") || data === "j") {
			this.selected = Math.min(this.steps.length - 1, this.selected + 1);
			this.invalidate();
			return;
		}
		if (matchesKey(data, "return") || data === " " || data === "x") {
			this.steps[this.selected].done = !this.steps[this.selected].done;
			this.invalidate();
			return;
		}
		if (data === "r" || data === "R") {
			this.steps.forEach((s) => (s.done = false));
			this.invalidate();
			return;
		}
	}

	render(width: number): string[] {
		if (this.cachedLines && this.cachedWidth === width) {
			return this.cachedLines;
		}

		const th = this.theme;
		const lines: string[] = [];

		lines.push("");
		const typeLabel = this.workflowType === "content" ? "Content" : "Dev";
		const title = th.fg("accent", th.bold(` Platform Q ${typeLabel} Workflow `));
		const bar =
			th.fg("borderMuted", "─".repeat(3)) +
			title +
			th.fg("borderMuted", "─".repeat(Math.max(0, width - 35)));
		lines.push(truncateToWidth(bar, width));

		const phaseSummary =
			this.workflowType === "content"
				? "Research → Draft → Build → Review → Publish"
				: "Scout → Implement → Build → Review → Publish";
		lines.push(truncateToWidth(`  ${th.fg("dim", phaseSummary)}`, width));

		if (this.activeItem) {
			lines.push(
				truncateToWidth(
					`  ${th.fg("accent", th.bold(this.activeItem.slug))} ${th.fg("muted", this.activeItem.title)}`,
					width,
				),
			);
		}
		lines.push("");

		const done = this.steps.filter((s) => s.done).length;
		const total = this.steps.length;
		const pct = Math.round((done / total) * 100);
		const barLen = Math.min(30, width - 20);
		const filled = Math.round((done / total) * barLen);
		const progressBar =
			th.fg("success", "█".repeat(filled)) + th.fg("dim", "░".repeat(barLen - filled));
		lines.push(
			truncateToWidth(`  ${progressBar} ${th.fg("muted", `${done}/${total} (${pct}%)`)}`, width),
		);
		lines.push("");

		let lastPhase = "";
		for (let i = 0; i < this.steps.length; i++) {
			const step = this.steps[i];

			if (step.phase !== lastPhase) {
				lastPhase = step.phase;
				const colorFn = phaseColor(step.phase, th);
				lines.push(truncateToWidth(`  ${colorFn(th.bold(phaseLabel(step.phase)))}`, width));
			}

			const isSel = i === this.selected;
			const check = step.done ? th.fg("success", "✓") : th.fg("dim", "○");
			const num = th.fg("accent", `${step.id.toString().padStart(2)}.`);
			const maxLabelLen = Math.max(20, width - 16);
			const labelText =
				step.label.length > maxLabelLen
					? step.label.slice(0, maxLabelLen - 1) + "…"
					: step.label;
			const text = step.done ? th.fg("dim", labelText) : th.fg("text", labelText);
			const pointer = isSel ? th.fg("accent", "▸ ") : "  ";

			lines.push(truncateToWidth(`  ${pointer}${check} ${num} ${text}`, width));
		}

		lines.push("");
		lines.push(
			truncateToWidth(
				`  ${th.fg("dim", "↑↓ navigate  ·  Enter/Space toggle  ·  R reset  ·  Esc close")}`,
				width,
			),
		);
		lines.push("");

		this.cachedWidth = width;
		this.cachedLines = lines;
		return lines;
	}

	invalidate(): void {
		this.cachedWidth = undefined;
		this.cachedLines = undefined;
	}
}

// ─── Extension entry point ────────────────────────────────────────────

export default function (pi: ExtensionAPI) {
	let workflowType: WorkflowType = "dev";
	let steps: WorkflowStep[] = freshSteps(workflowType);
	let activeItem: ActiveItem | undefined = undefined;
	let autoComplete = false;
	let completionNudgeEnabled = true;
	let completionNudgeFired = false;

	// ── State reconstruction ──────────────────────────────────────────

	const reconstructState = (ctx: ExtensionContext) => {
		workflowType = "dev";
		steps = freshSteps(workflowType);
		activeItem = undefined;

		const entries = ctx.sessionManager.getBranch();
		let lastToolResultIdx = -1;
		let lastAppendIdx = -1;

		for (let i = 0; i < entries.length; i++) {
			const entry = entries[i];
			if (entry.type === "message") {
				const msg = entry.message;
				if (msg.role === "toolResult" && msg.toolName === "workflow") {
					const details = msg.details as WorkflowDetails | undefined;
					if (details?.steps) {
						workflowType = details.workflowType || "dev";
						steps = details.steps.map((s) => ({ ...s }));
						activeItem = details.activeItem;
						lastToolResultIdx = i;
					}
				}
			}
			if (entry.type === "custom" && entry.customType === "workflow-state") {
				lastAppendIdx = i;
			}
		}

		if (lastAppendIdx > lastToolResultIdx) {
			const entry = entries[lastAppendIdx];
			if (entry.type === "custom" && entry.data?.steps) {
				workflowType = (entry.data.workflowType as WorkflowType) || "dev";
				steps = (entry.data.steps as WorkflowStep[]).map((s) => ({ ...s }));
				activeItem = entry.data.activeItem as ActiveItem | undefined;
			}
		}

		completionNudgeFired = steps.every((s) => s.done);
		updateWidget(ctx);
	};

	pi.on("session_start", async (_event, ctx) => reconstructState(ctx));
	pi.on("session_switch", async (_event, ctx) => reconstructState(ctx));
	pi.on("session_fork", async (_event, ctx) => reconstructState(ctx));
	pi.on("session_tree", async (_event, ctx) => reconstructState(ctx));

	// ── Widget: always-visible progress ───────────────────────────────

	const updateWidget = (ctx: ExtensionContext) => {
		const done = steps.filter((s) => s.done).length;
		const total = steps.length;

		if (done === 0 && !activeItem) {
			ctx.ui.setWidget("workflow", undefined);
			return;
		}

		const pct = Math.round((done / total) * 100);
		const current = steps.find((s) => !s.done);
		const currentInfo = current
			? `→ Step ${current.id}: ${current.label.slice(0, 60)}${current.label.length > 60 ? "…" : ""} [${phaseLabel(current.phase)}]`
			: "✓ Workflow complete!";

		ctx.ui.setWidget("workflow", (_tui, theme) => {
			const barLen = 15;
			const filled = Math.round((done / total) * barLen);
			const bar =
				theme.fg("success", "█".repeat(filled)) +
				theme.fg("dim", "░".repeat(barLen - filled));

			const typeLabel = workflowType === "content" ? "Content" : "Dev";
			const itemPart = activeItem
				? theme.fg("accent", theme.bold(` ${activeItem.slug}`)) +
				  theme.fg("dim", ` ${activeItem.title.slice(0, 40)}${activeItem.title.length > 40 ? "…" : ""} `)
				: " ";

			const line =
				theme.fg("accent", theme.bold(typeLabel)) +
				itemPart +
				bar +
				theme.fg("muted", ` ${done}/${total} (${pct}%) `) +
				theme.fg("dim", currentInfo);

			return new Text(line, 0, 0);
		});
	};

	// ── Guards: block commands if prerequisite steps incomplete ────────

	pi.on("tool_call", async (event, ctx) => {
		if (!isToolCallEventType("bash", event)) return;

		const cmd = event.input.command?.trim() ?? "";

		for (const guard of GUARDS) {
			if (!guard.pattern.test(cmd)) continue;

			const beforeStep = guard.beforeStep(workflowType);
			const prerequisiteSteps = steps.filter((s) => s.id < beforeStep);
			const incomplete = prerequisiteSteps.filter((s) => !s.done);

			if (incomplete.length === 0) continue;

			const missing = incomplete.map((s) => `  ○ Step ${s.id}: ${s.label.slice(0, 80)}`).join("\n");
			const message = guard.message(workflowType);

			if (!ctx.hasUI) {
				return {
					block: true,
					reason: `${message}\n\nMissing steps:\n${missing}`,
				};
			}

			const ok = await ctx.ui.confirm(
				"⚠️ Workflow Guard",
				`${message}\n\nMissing steps:\n${missing}\n\nProceed anyway?`,
			);
			if (!ok) {
				return { block: true, reason: "Blocked by workflow extension — prerequisite steps incomplete" };
			}
		}
	});

	// ── System prompt injection ───────────────────────────────────────

	pi.on("before_agent_start", async (event, _ctx) => {
		const done = steps.filter((s) => s.done).length;
		const total = steps.length;
		const current = steps.find((s) => !s.done);

		const typeLabel = workflowType === "content" ? "Content" : "Dev";
		let injection = `\n\n## Active ${typeLabel} Workflow (Platform Q.ai)\n`;
		injection += `Progress: ${done}/${total} steps complete.\n`;
		if (activeItem) {
			injection += `Active item: ${activeItem.slug} — ${activeItem.title}\n`;
		} else {
			injection += `Active item: (not set) — call workflow(action="set_item", itemSlug="...", itemTitle="...")\n`;
		}

		if (current) {
			injection += `CURRENT STEP → ${current.id}. ${current.label} [${phaseLabel(current.phase)}]\n`;

			if (workflowType === "content") {
				injection += `\nYou MUST follow the content workflow: Research → Draft → Build → Review → Publish.\n`;
			} else {
				injection += `\nYou MUST follow the dev workflow: Scout → Implement → Build → Review → Publish.\n`;
			}
			injection += `Use the \`workflow\` tool to check off steps as you complete them.\n`;
			injection += `Do NOT skip ahead — complete steps in order.\n`;

			// ── Content workflow step instructions ──
			if (workflowType === "content") {
				if (current.id === 1) {
					injection += `\n### Step 1: Scout Topic\n`;
					injection += `Spawn a scout sub-agent to research the topic.\n`;
					injection += `Gather: key data points, compelling quotes, competitor content gaps, related Platform Q posts for cross-linking.\n`;
				}
				if (current.id === 2) {
					injection += `\n### Step 2: Content Brief\n`;
					injection += `Define: title, subtitle, intro hook, key sections, target keywords, category, core thesis.\n`;
					injection += `Include internal links to existing Platform Q posts.\n`;
				}
				if (current.id === 3) {
					injection += `\n### Step 3: Write First Draft\n`;
					injection += `Create the markdown file in \`content/posts/\` with frontmatter:\n`;
					injection += `---\ntitle: "..."\ndate: YYYY-MM-DDTHH:MM:SS.000000Z\nlayout: post\ntags: [...]\ncategory: "..."\nintro: "..."\nimage: "..."\nauthor: "..."\n---\n`;
					injection += `Match Platform Q's voice: direct, opinionated, data-driven, no fluff.\n`;
				}
				if (current.id === 4) {
					injection += `\n### Step 4: Content Review\n`;
					injection += `Spawn a content-reviewer sub-agent to analyze the draft.\n`;
				}
				if (current.id === 5) {
					injection += `\n### Step 5: Revise Draft\n`;
					injection += `Apply content review feedback. Tighten prose, strengthen arguments.\n`;
				}
				if (current.id === 6) {
					injection += `\n### Step 6: Build the Site\n`;
					injection += `Run: \`mix alkali.build\`\n`;
					injection += `Verify it completes without errors.\n`;
				}
				if (current.id === 7) {
					injection += `\n### Step 7: Preview & Visual Check\n`;
					injection += `Check the generated HTML in \`_site/\`. Verify post appears correctly.\n`;
				}
				if (current.id === 8) {
					injection += `\n### Step 8: Fix Layout/Styling Issues\n`;
					injection += `Fix any problems and rebuild with \`mix alkali.build\`.\n`;
				}
				if (current.id === 9) {
					injection += `\n### Step 9: Dispatch Parallel Reviewers\n`;
					injection += `Use the subagent tool in parallel mode:\n`;
					injection += `subagent(tasks=[\n`;
					injection += `  {agent: "seo-reviewer", task: "Review the post at content/posts/..."},\n`;
					injection += `  {agent: "editorial-reviewer", task: "Review the post at content/posts/..."},\n`;
					injection += `  {agent: "technical-reviewer", task: "Review the post at content/posts/..."}\n`;
					injection += `])\n`;
				}
				if (current.id === 10) {
					injection += `\n### Step 10: Apply Review Feedback\n`;
					injection += `Address each reviewer's concerns. Rebuild with \`mix alkali.build\`.\n`;
				}
				if (current.id === 11) {
					injection += `\n### Step 11: Final Build & Verify\n`;
					injection += `Run: \`mix alkali.build\`. Confirm no errors.\n`;
				}
				if (current.id === 12) {
					injection += `\n### Step 12: Commit\n`;
					injection += `\`git add -A && git commit -m "post: <slug-title>"\`\n`;
				}
				if (current.id === 13) {
					injection += `\n### Step 13: Push & Create PR\n`;
					injection += `\`git push origin HEAD\` then \`gh pr create --title "post: <title>" --body "<summary>"\`\n`;
				}
				if (current.id === 14) {
					injection += `\n### Step 14: Merge and Deploy\n`;
					injection += `\`gh pr merge --squash --delete-branch\` then \`git checkout master && git pull origin master\`\n`;
				}
			}

			// ── Dev workflow step instructions ──
			if (workflowType === "dev") {
				if (current.id === 1) {
					injection += `\n### Step 1: Scout & Plan\n`;
					injection += `Spawn a scout sub-agent or manually map the relevant files.\n`;
					injection += `Write a plan: what changes, which files, acceptance criteria, risks.\n`;
				}
				if (current.id === 2) {
					injection += `\n### Step 2: Validate Plan\n`;
					injection += `Re-read every file path, class name, and selector mentioned in the plan.\n`;
					injection += `Confirm they exist. Fix inaccuracies. Do NOT write implementation code yet.\n`;
				}
				if (current.id === 3) {
					injection += `\n### Step 3: Implement\n`;
					injection += `Make the planned changes. Work iteratively.\n`;
					injection += `For CSS/layout changes, modify files in \`layouts/\`, \`static/css/\`, \`layouts/partials/\`.\n`;
					injection += `For content changes, modify files in \`content/\`.\n`;
				}
				if (current.id === 4) {
					injection += `\n### Step 4: Build & Verify\n`;
					injection += `Run: \`mix alkali.build\`\n`;
					injection += `Verify it completes without errors. Check output in \`_site/\`.\n`;
				}
				if (current.id === 5) {
					injection += `\n### Step 5: Fix Issues\n`;
					injection += `If the build revealed problems, fix them and rebuild.\n`;
				}
				if (current.id === 6) {
					injection += `\n### Step 6: Commit & Push & Create PR\n`;
					injection += `\`git add -A && git commit -m "<type>: <description>"\`\n`;
					injection += `Use conventional commits: feat, fix, style, refactor, docs, chore.\n`;
					injection += `\`git push -u origin HEAD\`\n`;
					injection += `\`gh pr create --title "<type>: <title>" --body "<summary>"\`\n`;
					injection += `Record the PR number — reviewers need it to post inline comments.\n`;
				}
				if (current.id === 7) {
					injection += `\n### Step 7: Dispatch Reviewers\n`;
					injection += `Use the subagent tool in parallel mode with all three reviewer agents:\n`;
					injection += `subagent(tasks=[\n`;
					injection += `  {agent: "architecture-reviewer", task: "Review PR #N in platform-q-ai for ..."},\n`;
					injection += `  {agent: "security-reviewer", task: "Review PR #N in platform-q-ai for ..."},\n`;
					injection += `  {agent: "performance-reviewer", task: "Review PR #N in platform-q-ai for ..."}\n`;
					injection += `])\n\n`;
					injection += `Include the PR number in each task. Reviewers post inline GitHub comments.\n`;
				}
				if (current.id === 8) {
					injection += `\n### Step 8: Fix Review Concerns\n`;
					injection += `Read all reviewer comments. Fix valid concerns.\n`;
					injection += `Rebuild with \`mix alkali.build\`, commit and push fixes.\n`;
				}
				if (current.id === 9) {
					injection += `\n### Step 9: Reply & Resolve\n`;
					injection += `Reply to each reviewer thread explaining changes or rationale.\n`;
					injection += `Resolve threads via GraphQL.\n`;
				}
				if (current.id === 10) {
					injection += `\n### Step 10: Final Build & Verify\n`;
					injection += `Run: \`mix alkali.build\`. Confirm no errors and everything renders correctly.\n`;
				}
				if (current.id === 11) {
					injection += `\n### Step 11: Merge\n`;
					injection += `\`gh pr merge --squash --delete-branch\`\n`;
				}
				if (current.id === 12) {
					injection += `\n### Step 12: Clean Up\n`;
					injection += `\`git checkout master && git pull origin master\`\n`;
					injection += `Confirm clean working tree.\n`;
				}
			}
		} else {
			injection += `All steps complete! You may start a new workflow cycle with \`workflow reset\`.\n`;
		}

		return { systemPrompt: event.systemPrompt + injection };
	});

	// ── Tool: LLM-callable workflow management ────────────────────────

	const WorkflowParams = Type.Object({
		action: StringEnum(["status", "check", "uncheck", "reset", "skip", "set_item", "clear_item", "set_type"] as const),
		step: Type.Optional(Type.Number({ description: "Step number" })),
		itemSlug: Type.Optional(Type.String({ description: "Work item slug (required for set_item), e.g. 'feature/redesign' or '2026-03-17-my-post'" })),
		itemTitle: Type.Optional(Type.String({ description: "Work item title (required for set_item)" })),
		workflowType: Type.Optional(StringEnum(["content", "dev"] as const, { description: "Workflow type (required for set_type): 'content' for blog posts, 'dev' for code/design changes" })),
	});

	pi.registerTool({
		name: "workflow",
		label: "Workflow",
		description: [
			"Manage the Platform Q.ai development workflow checklist.",
			"Actions:",
			"  status     — Show all steps and current progress",
			"  check      — Mark a step as done (requires step number)",
			"  uncheck    — Unmark a step (requires step number)",
			"  reset      — Reset all steps for a new cycle",
			"  skip       — Mark a step as done even if previous steps are incomplete (requires step number)",
			"  set_item   — Record the work item for this cycle (requires itemSlug + itemTitle)",
			"  clear_item — Clear the active work item",
			"  set_type   — Switch workflow type: 'content' or 'dev' (resets steps)",
			"",
			"Workflow types:",
			"  content — For blog posts: Research → Draft → Build → Review → Publish (14 steps)",
			"  dev     — For code/design: Scout → Implement → Build → Review → Publish (12 steps)",
			"",
			"Steps should be completed in order.",
		].join("\n"),
		parameters: WorkflowParams,

		async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
			const makeDetails = (action: WorkflowDetails["action"], error?: string): WorkflowDetails => ({
				action,
				workflowType,
				steps: steps.map((s) => ({ ...s })),
				activeItem: activeItem ? { ...activeItem } : undefined,
				error,
			});

			const formatStatus = (): string => {
				const done = steps.filter((s) => s.done).length;
				const total = steps.length;
				const typeLabel = workflowType === "content" ? "Content" : "Dev";
				let text = `Workflow (${typeLabel}): ${done}/${total} complete\n`;
				if (activeItem) text += `Active item: ${activeItem.slug} — ${activeItem.title}\n`;
				text += "\n";
				let lastPhase = "";
				for (const s of steps) {
					if (s.phase !== lastPhase) {
						lastPhase = s.phase;
						text += `\n[${phaseLabel(s.phase)}]\n`;
					}
					text += `  [${s.done ? "x" : " "}] ${s.id}. ${s.label.slice(0, 100)}${s.label.length > 100 ? "…" : ""}\n`;
				}
				const current = steps.find((s) => !s.done);
				if (current) {
					text += `\n→ Next: Step ${current.id} — ${current.label.slice(0, 80)}`;
				} else {
					text += `\n✓ All steps complete!`;
				}
				return text;
			};

			switch (params.action) {
				case "status": {
					updateWidget(ctx);
					return {
						content: [{ type: "text", text: formatStatus() }],
						details: makeDetails("status"),
					};
				}

				case "set_type": {
					if (!params.workflowType) {
						return {
							content: [{ type: "text", text: "Error: workflowType is required for set_type. Use 'content' or 'dev'." }],
							details: makeDetails("set_type", "workflowType required"),
						};
					}
					workflowType = params.workflowType;
					steps = freshSteps(workflowType);
					completionNudgeFired = false;
					pi.appendEntry("workflow-state", {
						workflowType,
						steps: steps.map((s) => ({ ...s })),
						activeItem: activeItem ? { ...activeItem } : undefined,
					});
					updateWidget(ctx);
					const typeLabel = workflowType === "content" ? "Content" : "Dev";
					return {
						content: [{ type: "text", text: `🔄 Workflow type set to ${typeLabel} (${steps.length} steps). Steps reset.` }],
						details: makeDetails("set_type"),
					};
				}

				case "set_item": {
					if (!params.itemSlug || !params.itemTitle) {
						return {
							content: [{ type: "text", text: "Error: itemSlug and itemTitle are required for set_item" }],
							details: makeDetails("set_item", "itemSlug and itemTitle required"),
						};
					}
					activeItem = { slug: params.itemSlug, title: params.itemTitle };
					pi.appendEntry("workflow-state", {
						workflowType,
						steps: steps.map((s) => ({ ...s })),
						activeItem: { ...activeItem },
					});
					updateWidget(ctx);
					return {
						content: [{ type: "text", text: `📝 Active item set: ${activeItem.slug} — ${activeItem.title}` }],
						details: makeDetails("set_item"),
					};
				}

				case "clear_item": {
					activeItem = undefined;
					pi.appendEntry("workflow-state", {
						workflowType,
						steps: steps.map((s) => ({ ...s })),
						activeItem: undefined,
					});
					updateWidget(ctx);
					return {
						content: [{ type: "text", text: "Active item cleared" }],
						details: makeDetails("clear_item"),
					};
				}

				case "check": {
					if (params.step === undefined) {
						return {
							content: [{ type: "text", text: "Error: step number required" }],
							details: makeDetails("check", "step number required"),
						};
					}
					const step = steps.find((s) => s.id === params.step);
					if (!step) {
						return {
							content: [{ type: "text", text: `Error: no step #${params.step}` }],
							details: makeDetails("check", `no step #${params.step}`),
						};
					}
					const prev = steps.filter((s) => s.id < step.id && !s.done);
					let warning = "";
					if (prev.length > 0) {
						warning = `\n⚠️ Warning: ${prev.length} earlier step(s) still incomplete`;
					}
					step.done = true;
					updateWidget(ctx);
					return {
						content: [{ type: "text", text: `✓ Step ${step.id} checked: ${step.label.slice(0, 80)}${warning}` }],
						details: makeDetails("check"),
					};
				}

				case "uncheck": {
					if (params.step === undefined) {
						return {
							content: [{ type: "text", text: "Error: step number required" }],
							details: makeDetails("uncheck", "step number required"),
						};
					}
					const step = steps.find((s) => s.id === params.step);
					if (!step) {
						return {
							content: [{ type: "text", text: `Error: no step #${params.step}` }],
							details: makeDetails("uncheck", `no step #${params.step}`),
						};
					}
					step.done = false;
					updateWidget(ctx);
					return {
						content: [{ type: "text", text: `○ Step ${step.id} unchecked: ${step.label.slice(0, 80)}` }],
						details: makeDetails("uncheck"),
					};
				}

				case "skip": {
					if (params.step === undefined) {
						return {
							content: [{ type: "text", text: "Error: step number required" }],
							details: makeDetails("skip", "step number required"),
						};
					}
					const step = steps.find((s) => s.id === params.step);
					if (!step) {
						return {
							content: [{ type: "text", text: `Error: no step #${params.step}` }],
							details: makeDetails("skip", `no step #${params.step}`),
						};
					}
					step.done = true;
					updateWidget(ctx);
					return {
						content: [{ type: "text", text: `⏭ Step ${step.id} skipped: ${step.label.slice(0, 80)}` }],
						details: makeDetails("skip"),
					};
				}

				case "reset": {
					steps = freshSteps(workflowType);
					completionNudgeFired = false;
					updateWidget(ctx);
					const itemPart = activeItem
						? ` (still tracking ${activeItem.slug} — call set_item once you have the next one)`
						: "";
					return {
						content: [
							{
								type: "text",
								text: `Workflow reset — all ${steps.length} steps cleared for new cycle${itemPart}`,
							},
						],
						details: makeDetails("reset"),
					};
				}

				default:
					return {
						content: [{ type: "text", text: `Unknown action: ${params.action}` }],
						details: makeDetails("status", `unknown action: ${params.action}`),
					};
			}
		},

		renderCall(args, theme) {
			let text = theme.fg("toolTitle", theme.bold("workflow ")) + theme.fg("muted", args.action);
			if (args.step !== undefined) text += ` ${theme.fg("accent", `#${args.step}`)}`;
			if (args.itemSlug) text += ` ${theme.fg("accent", args.itemSlug)}`;
			if (args.itemTitle) text += ` ${theme.fg("dim", args.itemTitle)}`;
			if (args.workflowType) text += ` ${theme.fg("accent", args.workflowType)}`;
			return new Text(text, 0, 0);
		},

		renderResult(result, { expanded }, theme) {
			const details = result.details as WorkflowDetails | undefined;
			if (!details) {
				const text = result.content[0];
				return new Text(text?.type === "text" ? text.text : "", 0, 0);
			}

			if (details.error) {
				return new Text(theme.fg("error", `Error: ${details.error}`), 0, 0);
			}

			const done = details.steps.filter((s) => s.done).length;
			const total = details.steps.length;
			const pct = Math.round((done / total) * 100);

			switch (details.action) {
				case "set_item": {
					const msg = result.content[0];
					return new Text(
						theme.fg("accent", "📝 ") + theme.fg("muted", msg?.type === "text" ? msg.text : ""),
						0,
						0,
					);
				}
				case "clear_item":
					return new Text(theme.fg("dim", "Item cleared"), 0, 0);
				case "set_type": {
					const msg = result.content[0];
					return new Text(
						theme.fg("accent", "🔄 ") + theme.fg("muted", msg?.type === "text" ? msg.text : ""),
						0,
						0,
					);
				}
				case "status": {
					const typeLabel = details.workflowType === "content" ? "Content" : "Dev";
					let text = theme.fg("muted", `${typeLabel} ${done}/${total} (${pct}%)`);
					if (details.activeItem) {
						text += theme.fg("accent", ` ${details.activeItem.slug}`);
					}
					const current = details.steps.find((s) => !s.done);
					if (current) {
						const colorFn = phaseColor(current.phase, theme);
						text += ` → ${colorFn(phaseLabel(current.phase))} Step ${current.id}`;
					} else {
						text += " " + theme.fg("success", "✓ Complete!");
					}
					if (expanded) {
						let lastPhase = "";
						for (const s of details.steps) {
							if (s.phase !== lastPhase) {
								lastPhase = s.phase;
								const colorFn = phaseColor(s.phase, theme);
								text += `\n  ${colorFn(theme.bold(phaseLabel(s.phase)))}`;
							}
							const check = s.done ? theme.fg("success", "✓") : theme.fg("dim", "○");
							const label = s.done ? theme.fg("dim", s.label.slice(0, 80)) : theme.fg("text", s.label.slice(0, 80));
							text += `\n  ${check} ${theme.fg("accent", `${s.id}.`)} ${label}`;
						}
					}
					return new Text(text, 0, 0);
				}

				case "check":
				case "skip": {
					const msg = result.content[0];
					return new Text(
						theme.fg("success", "✓ ") + theme.fg("muted", msg?.type === "text" ? msg.text : ""),
						0,
						0,
					);
				}

				case "uncheck": {
					const msg = result.content[0];
					return new Text(
						theme.fg("warning", "○ ") + theme.fg("muted", msg?.type === "text" ? msg.text : ""),
						0,
						0,
					);
				}

				case "reset":
					return new Text(theme.fg("warning", "↺ ") + theme.fg("muted", "Workflow reset"), 0, 0);
			}
		},
	});

	// ── Command: /workflow — interactive checklist ─────────────────────

	pi.registerCommand("workflow", {
		description: "Open the Platform Q workflow checklist",
		handler: async (_args, ctx) => {
			if (!ctx.hasUI) {
				const done = steps.filter((s) => s.done).length;
				const itemPart = activeItem ? ` | ${activeItem.slug}` : "";
				ctx.ui.notify(`Workflow: ${done}/${steps.length} steps complete${itemPart}`, "info");
				return;
			}

			const updatedSteps = await ctx.ui.custom<WorkflowStep[]>((_tui, theme, _kb, done) => {
				return new WorkflowChecklist(steps, workflowType, activeItem, theme, (result) => done(result));
			});

			if (updatedSteps) {
				steps = updatedSteps;
				pi.appendEntry("workflow-state", {
					workflowType,
					steps: steps.map((s) => ({ ...s })),
					activeItem: activeItem ? { ...activeItem } : undefined,
				});
				updateWidget(ctx);
			}
		},
	});

	// ── Shortcut: Ctrl+Shift+W to quickly open workflow ──────────────

	pi.registerShortcut("ctrl+shift+w", {
		description: "Open Platform Q workflow checklist",
		handler: async (ctx) => {
			if (!ctx.hasUI) return;

			const updatedSteps = await ctx.ui.custom<WorkflowStep[]>((_tui, theme, _kb, done) => {
				return new WorkflowChecklist(steps, workflowType, activeItem, theme, (result) => done(result));
			});

			if (updatedSteps) {
				steps = updatedSteps;
				pi.appendEntry("workflow-state", {
					workflowType,
					steps: steps.map((s) => ({ ...s })),
					activeItem: activeItem ? { ...activeItem } : undefined,
				});
				updateWidget(ctx);
			}
		},
	});

	// ── Auto-complete + completion nudge ─────────────────────────────

	pi.on("agent_end", async (event, ctx) => {
		const lastMsg = event.messages[event.messages.length - 1];
		const wasAborted =
			event.messages.length === 0 || (lastMsg as any)?.stopReason === "aborted";
		if (wasAborted) return;

		if (ctx.hasPendingMessages()) return;

		const allDone = steps.every((s) => s.done);

		if (autoComplete && !allDone) {
			const done = steps.filter((s) => s.done).length;
			const total = steps.length;

			if (done === 0) return;

			const current = steps.find((s) => !s.done);
			if (!current) return;

			const msg =
				`Workflow incomplete (${done}/${total}). ` +
				`Continue with the next incomplete step. ` +
				`Use the workflow tool to check off steps as you complete them. ` +
				`Respond with just the word DONE (no other text) when all ${total} steps are checked off.`;

			pi.sendUserMessage(msg, { deliverAs: "followUp" });
			return;
		}

		if (autoComplete && allDone) {
			autoComplete = false;
			ctx.ui.notify("Workflow auto-continue OFF — all steps complete", "success");
		}

		if (allDone && !completionNudgeFired && completionNudgeEnabled) {
			completionNudgeFired = true;
			const itemLine = activeItem
				? `You have completed all ${steps.length} workflow steps for "${activeItem.title}". `
				: `You have completed all ${steps.length} workflow steps. `;

			pi.sendUserMessage(
				itemLine +
					"Now do the following in order:\n" +
					"1. Confirm the work was published/merged successfully\n" +
					'2. Suggest what to work on next\n' +
					'3. Record it: call the workflow tool with action="set_item", itemSlug="...", itemTitle="..."\n' +
					'4. Reset the checklist: call the workflow tool with action="reset"\n' +
					"5. Begin Step 1 immediately for the new work item",
				{ deliverAs: "followUp" },
			);
		}

		if (!allDone) {
			completionNudgeFired = false;
		}
	});

	// ── Command: /workflow-auto — toggle auto-complete ────────────────

	pi.registerCommand("workflow-auto", {
		description: "Toggle auto-continue: nudge agent to keep going until all workflow steps are done",
		handler: async (_args, ctx) => {
			autoComplete = !autoComplete;
			ctx.ui.notify(
				autoComplete
					? "Workflow auto-continue ON — agent will be nudged to complete all steps"
					: "Workflow auto-continue OFF",
				"info",
			);
		},
	});

	// ── Shortcut: Ctrl+Shift+A to toggle auto-complete ───────────────

	pi.registerShortcut("ctrl+shift+a", {
		description: "Toggle workflow auto-continue",
		handler: async (ctx) => {
			autoComplete = !autoComplete;
			ctx.ui.notify(
				autoComplete
					? "Workflow auto-continue ON — agent will be nudged to complete all steps"
					: "Workflow auto-continue OFF",
				"info",
			);
		},
	});

	// ── Command: /workflow-nudge — toggle completion nudge ───────────

	pi.registerCommand("workflow-nudge", {
		description: "Toggle completion nudge: prompt agent to suggest next work when all steps are done",
		handler: async (_args, ctx) => {
			completionNudgeEnabled = !completionNudgeEnabled;
			ctx.ui.notify(
				completionNudgeEnabled
					? "Workflow completion nudge ON — agent will suggest next work on cycle complete"
					: "Workflow completion nudge OFF — agent will stop after final step",
				"info",
			);
		},
	});

	// ── Shortcut: Ctrl+Shift+N to toggle completion nudge ───────────

	pi.registerShortcut("ctrl+shift+n", {
		description: "Toggle workflow completion nudge",
		handler: async (ctx) => {
			completionNudgeEnabled = !completionNudgeEnabled;
			ctx.ui.notify(
				completionNudgeEnabled
					? "Workflow completion nudge ON"
					: "Workflow completion nudge OFF",
				"info",
			);
		},
	});
}
