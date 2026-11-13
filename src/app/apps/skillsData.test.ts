import { describe, expect, it } from "vitest";
import { SKILLS, SKILLS_BY_NAME, skillLinks, skillMarkdown } from "./skillsData";

describe("SKILL.md agent skills", () => {
  it("gives every skill a unique name and a SKILL.md path", () => {
    expect(new Set(SKILLS.map(skill => skill.name)).size).toBe(SKILLS.length);
    for (const skill of SKILLS) expect(skill.path).toMatch(/^([a-z0-9-]+\/)+SKILL\.md$/);
  });
  it("only links to skills that exist", () => {
    for (const skill of SKILLS) for (const name of skillLinks(skill)) expect(SKILLS_BY_NAME.has(name), `${skill.name} → ${name}`).toBe(true);
  });
  it("nests some skills inside others", () => {
    expect(SKILLS.some(skill => skill.path.split("/").length > 2)).toBe(true);
  });
  it("writes Claude Code-style frontmatter", () => {
    const text = skillMarkdown(SKILLS_BY_NAME.get("frontend-ui")!);
    expect(text.startsWith("---\nname: frontend-ui\ndescription: ")).toBe(true);
    expect(text).toContain("allowed-tools: ");
  });
});
