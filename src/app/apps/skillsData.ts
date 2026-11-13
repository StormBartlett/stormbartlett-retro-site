/**
 * Storm's skills, written as agent skills: one SKILL.md per folder, with Claude Code-style
 * frontmatter (name, description, allowed-tools) and [[skill-name]] links between them.
 */
export type Skill = {
  /** Path under ~/.storm/skills, always ending in SKILL.md. */
  path: string;
  name: string;
  description: string;
  allowedTools?: string;
  body: string;
};

export const SKILLS: Skill[] = [
  {
    path: "frontend-ui/SKILL.md",
    name: "frontend-ui",
    description: "Use when a complex workflow needs an interface people can actually use. Turns technical systems into fast, accessible screens.",
    allowedTools: "React, Next.js, TypeScript, CSS",
    body: `# Front-end UI

Storm's strongest thread: making complicated software feel simple.

## When to use
- A dashboard has more data than anyone can read
- A search or AI feature works, but nobody can tell what it is doing
- The page is slow and nobody knows why

## Steps
1. Load [[react-nextjs]] for the product architecture.
2. Type everything with [[typescript]].
3. Check every flow with [[accessibility]] before calling it done.
4. Profile, then fix the slowest thing first.

AI-backed screens also need [[ai-product]].`,
  },
  {
    path: "frontend-ui/react-nextjs/SKILL.md",
    name: "react-nextjs",
    description: "Use when building product UI in React and Next.js: component boundaries, data flow and rendering that stays fast as the app grows.",
    allowedTools: "React, Next.js, Tailwind, Sass",
    body: `# React and Next.js

Product architecture at Noteception, and this site.

## Rules
- Components own one job each.
- State lives as low as it can.
- Measure before memoising anything.

Pairs with [[typescript]]. For 3D, hand off to [[simulation]].`,
  },
  {
    path: "frontend-ui/typescript/SKILL.md",
    name: "typescript",
    description: "Use when JavaScript needs to stop surprising people. Strict types, shared contracts between front end and back end.",
    allowedTools: "TypeScript, JavaScript",
    body: `# TypeScript

- Strict mode on, \`any\` off.
- Types shared with [[apis]] so both sides agree.
- Narrow types at the edges, trust them inside.`,
  },
  {
    path: "frontend-ui/accessibility/SKILL.md",
    name: "accessibility",
    description: "Use before shipping any interface. Keyboard paths, focus, contrast and screen-reader labels.",
    body: `# Accessibility

- Every action works with a keyboard.
- Focus is visible and never lost.
- Labels describe what a control does, not what it looks like.

Checked as part of [[frontend-ui]] and covered by [[testing]].`,
  },
  {
    path: "ai-product/SKILL.md",
    name: "ai-product",
    description: "Use when an AI feature has to work for real users, not just in a demo. Integration, transcript and note workflows, honest UX.",
    allowedTools: "LLM APIs, Node.js, Python",
    body: `# AI product systems

## When to use
- Notes or transcripts need to become something useful
- An AI answer needs a source the user can check

## Steps
1. Find the right context with [[search]].
2. Prove it works with [[evals]] before users do.
3. Make uncertainty visible in the [[frontend-ui]].`,
  },
  {
    path: "ai-product/search/SKILL.md",
    name: "search",
    description: "Use when people need to find things in a lot of text. Indexed search and search-backed interfaces.",
    body: `# Search

- Index once, query fast.
- Show why a result matched.
- Store and serve it with [[databases]].`,
  },
  {
    path: "ai-product/evals/SKILL.md",
    name: "evals",
    description: "Use when \"it seemed fine\" is not good enough. Evaluation harnesses and regression suites for AI behaviour.",
    allowedTools: "Python, Node.js",
    body: `# Evals

- Write the test cases before changing the prompt.
- Keep failures as regression cases.
- Run them in CI alongside [[testing]].`,
  },
  {
    path: "backend-data/SKILL.md",
    name: "backend-data",
    description: "Use when the front end needs a back end it can rely on. APIs, auth, databases and data pipelines.",
    allowedTools: "Node.js, Express, Python, Flask, Django",
    body: `# Back end and data

## Steps
1. Design the contract with [[apis]].
2. Pick storage with [[databases]].
3. Move and clean data with ETL pipelines, including time-series and IoT telemetry.

Front-end work stays in [[frontend-ui]].`,
  },
  {
    path: "backend-data/apis/SKILL.md",
    name: "apis",
    description: "Use when two systems need to talk. REST, WebSockets, JWT and OAuth.",
    allowedTools: "REST, WebSockets, JWT, OAuth",
    body: `# APIs

- REST for resources, WebSockets for live updates.
- Auth with JWT or OAuth, never home-made.
- Share types with [[typescript]].`,
  },
  {
    path: "backend-data/databases/SKILL.md",
    name: "databases",
    description: "Use when data has to outlive the request. PostgreSQL, MongoDB, SQL and Firestore.",
    allowedTools: "PostgreSQL, MongoDB, SQL, Firestore",
    body: `# Databases

- Relational by default, documents when the shape really varies.
- Index for the queries [[search]] actually runs.`,
  },
  {
    path: "simulation/SKILL.md",
    name: "simulation",
    description: "Use when the answer comes out of a model, not a form. Optimisation, physics and visualising what the model did.",
    allowedTools: "Java, Rust, WGPU, Three.js, Matplotlib, scikit-learn",
    body: `# Simulation and research

- Parallel genetic algorithms and clustering optimisation in Java.
- Physics simulation in Rust with WGPU.
- Visualise model output with Three.js and Matplotlib, then hand the UI to [[frontend-ui]].

Results are only as good as the [[testing]] behind them.`,
  },
  {
    path: "engineering-practice/SKILL.md",
    name: "engineering-practice",
    description: "Use on every project, after the first version works. The habits that keep software alive.",
    allowedTools: "Git, GitHub Actions, Docker, Linux",
    body: `# Engineering practice

- Small commits, honest reviews.
- Decisions written down as ADRs.
- CI/CD with GitHub Actions and Docker.
- Load [[testing]] before refactoring anything.`,
  },
  {
    path: "engineering-practice/testing/SKILL.md",
    name: "testing",
    description: "Use when code is about to change. Automated tests that catch the bug before a user does.",
    body: `# Testing

- Test behaviour, not implementation.
- Every fixed bug gets a regression test.
- AI behaviour gets [[evals]] as well.`,
  },
  {
    path: "writing-skills/SKILL.md",
    name: "writing-skills",
    description: "Use when writing a skill about writing skills. See [[writing-skills]].",
    body: `# Writing skills

1. Write a skill.
2. Realise it needs a skill for writing skills.
3. Load [[writing-skills]].
4. Go to step 1.

If this loops forever, take a break and load [[engineering-practice]].`,
  },
];

export const SKILLS_BY_NAME = new Map(SKILLS.map(skill => [skill.name, skill]));

/** Every [[name]] a skill links to, in order of first mention. */
export function skillLinks(skill: Skill) {
  const names = [...`${skill.description}\n${skill.body}`.matchAll(/\[\[([a-z0-9-]+)\]\]/g)].map(match => match[1]);
  return [...new Set(names)];
}

/** The SKILL.md file a visitor would see: frontmatter, then the body. */
export function skillMarkdown(skill: Skill) {
  return ["---", `name: ${skill.name}`, `description: ${skill.description}`, ...(skill.allowedTools ? [`allowed-tools: ${skill.allowedTools}`] : []), "---", "", skill.body].join("\n");
}
