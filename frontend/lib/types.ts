// Types shared across the frontend — must match the Python generator's Pydantic schema exactly

export interface Command {
  command: string;
  description: string;
  scenario: string;
  language: string;
  tags: string[];
  is_curated: boolean;
  man_page: string;
}

export interface CheatSheet {
  title: string;
  slug: string;
  description: string;
  category: string;
  audience: "engineer" | "non-engineer";
  commands?: Command[];
}

export interface ToolMeta {
  name: string;
  slug: string;
  audience: "engineer" | "non-engineer";
  description?: string;
  category?: string;
}

export const CATEGORIES = [
  "Languages",
  "Frameworks",
  "Databases",
  "DevOps",
  "CLI Tools",
  "Cloud",
  "Editors",
  "Design",
  "Productivity",
  "Networking",
  "Security",
  "AI Chatbot",
  "Coding Assistant",
  "Image Generation",
  "AI Search",
  "AI Tools",
  "Other",
] as const;

export type Category = (typeof CATEGORIES)[number];

// ---------------------------------------------------------------------------
// How-To types
// ---------------------------------------------------------------------------

export interface HowToStep {
  title: string;
  explanation: string;
  code?: string;
  language?: string;
}

export interface HowTo {
  slug: string;
  question: string;
  description: string;
  topic: string;
  difficulty: "beginner" | "intermediate" | "advanced";
  tags: string[];
  steps: HowToStep[];
  full_example?: {
    code: string;
    language: string;
  };
  related_slugs?: string[];
}

export interface HowToMeta {
  slug: string;
  question: string;
  description: string;
  topic: string;
  difficulty: "beginner" | "intermediate" | "advanced";
  tags: string[];
}
