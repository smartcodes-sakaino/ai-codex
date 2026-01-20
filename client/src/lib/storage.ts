import type { Chapter, Problem, Block, Settings, ChapterWithCount, ProblemWithBlocks, InsertChapter, InsertProblem, InsertBlock } from "@shared/schema";

const STORAGE_KEYS = {
  chapters: "learning_app_chapters",
  problems: "learning_app_problems",
  blocks: "learning_app_blocks",
  settings: "learning_app_settings",
} as const;

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substring(2);
}

function getFromStorage<T>(key: string, defaultValue: T): T {
  try {
    const item = localStorage.getItem(key);
    return item ? JSON.parse(item) : defaultValue;
  } catch {
    return defaultValue;
  }
}

function saveToStorage<T>(key: string, value: T): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (error) {
    console.error("Failed to save to localStorage:", error);
  }
}

export const storage = {
  getChapters(): Chapter[] {
    return getFromStorage<Chapter[]>(STORAGE_KEYS.chapters, []);
  },

  getChaptersWithCount(): ChapterWithCount[] {
    const chapters = this.getChapters();
    const problems = this.getProblems();
    return chapters.map((chapter) => ({
      ...chapter,
      problemCount: problems.filter((p) => p.chapterId === chapter.id).length,
    }));
  },

  getChapter(id: string): Chapter | undefined {
    return this.getChapters().find((c) => c.id === id);
  },

  createChapter(data: InsertChapter): Chapter {
    const chapters = this.getChapters();
    const chapter: Chapter = {
      ...data,
      id: generateId(),
      createdAt: new Date().toISOString(),
    };
    chapters.push(chapter);
    saveToStorage(STORAGE_KEYS.chapters, chapters);
    return chapter;
  },

  updateChapter(id: string, data: Partial<InsertChapter>): Chapter | undefined {
    const chapters = this.getChapters();
    const index = chapters.findIndex((c) => c.id === id);
    if (index === -1) return undefined;
    chapters[index] = { ...chapters[index], ...data };
    saveToStorage(STORAGE_KEYS.chapters, chapters);
    return chapters[index];
  },

  deleteChapter(id: string): void {
    const problemIds = this.getProblems()
      .filter((p) => p.chapterId === id)
      .map((p) => p.id);
    
    const blocks = this.getBlocks().filter((b) => !problemIds.includes(b.problemId));
    saveToStorage(STORAGE_KEYS.blocks, blocks);
    
    const problems = this.getProblems().filter((p) => p.chapterId !== id);
    saveToStorage(STORAGE_KEYS.problems, problems);
    
    const chapters = this.getChapters().filter((c) => c.id !== id);
    saveToStorage(STORAGE_KEYS.chapters, chapters);
  },

  reorderChapters(chapters: Chapter[]): void {
    saveToStorage(STORAGE_KEYS.chapters, chapters);
  },

  getProblems(): Problem[] {
    return getFromStorage<Problem[]>(STORAGE_KEYS.problems, []);
  },

  getProblemsByChapter(chapterId: string): Problem[] {
    return this.getProblems()
      .filter((p) => p.chapterId === chapterId)
      .sort((a, b) => a.order - b.order);
  },

  getProblem(id: string): Problem | undefined {
    return this.getProblems().find((p) => p.id === id);
  },

  getProblemWithBlocks(id: string): ProblemWithBlocks | undefined {
    const problem = this.getProblem(id);
    if (!problem) return undefined;
    const blocks = this.getBlocksByProblem(id);
    const hasExplanation = blocks.some((b) => b.type === "text");
    return { ...problem, blocks, hasExplanation };
  },

  createProblem(data: InsertProblem): Problem {
    const problems = this.getProblems();
    const problem: Problem = {
      ...data,
      id: generateId(),
      createdAt: new Date().toISOString(),
    };
    problems.push(problem);
    saveToStorage(STORAGE_KEYS.problems, problems);
    return problem;
  },

  updateProblem(id: string, data: Partial<InsertProblem>): Problem | undefined {
    const problems = this.getProblems();
    const index = problems.findIndex((p) => p.id === id);
    if (index === -1) return undefined;
    problems[index] = { ...problems[index], ...data };
    saveToStorage(STORAGE_KEYS.problems, problems);
    return problems[index];
  },

  deleteProblem(id: string): void {
    const problems = this.getProblems().filter((p) => p.id !== id);
    saveToStorage(STORAGE_KEYS.problems, problems);
    const blocks = this.getBlocks().filter((b) => b.problemId !== id);
    saveToStorage(STORAGE_KEYS.blocks, blocks);
  },

  reorderProblems(problems: Problem[]): void {
    const allProblems = this.getProblems();
    const updatedProblems = allProblems.map((p) => {
      const updated = problems.find((up) => up.id === p.id);
      return updated ? { ...p, order: updated.order } : p;
    });
    saveToStorage(STORAGE_KEYS.problems, updatedProblems);
  },

  getBlocks(): Block[] {
    return getFromStorage<Block[]>(STORAGE_KEYS.blocks, []);
  },

  getBlocksByProblem(problemId: string): Block[] {
    return this.getBlocks()
      .filter((b) => b.problemId === problemId)
      .sort((a, b) => a.order - b.order);
  },

  getBlock(id: string): Block | undefined {
    return this.getBlocks().find((b) => b.id === id);
  },

  createBlock(data: InsertBlock): Block {
    const blocks = this.getBlocks();
    const block: Block = {
      ...data,
      id: generateId(),
    };
    blocks.push(block);
    saveToStorage(STORAGE_KEYS.blocks, blocks);
    return block;
  },

  updateBlock(id: string, data: Partial<InsertBlock>): Block | undefined {
    const blocks = this.getBlocks();
    const index = blocks.findIndex((b) => b.id === id);
    if (index === -1) return undefined;
    blocks[index] = { ...blocks[index], ...data };
    saveToStorage(STORAGE_KEYS.blocks, blocks);
    return blocks[index];
  },

  deleteBlock(id: string): void {
    const blocks = this.getBlocks().filter((b) => b.id !== id);
    saveToStorage(STORAGE_KEYS.blocks, blocks);
  },

  reorderBlocks(blocks: Block[]): void {
    const allBlocks = this.getBlocks();
    const updatedBlocks = allBlocks.map((b) => {
      const updated = blocks.find((ub) => ub.id === b.id);
      return updated ? { ...b, order: updated.order } : b;
    });
    saveToStorage(STORAGE_KEYS.blocks, updatedBlocks);
  },

  getSettings(): Settings {
    return getFromStorage<Settings>(STORAGE_KEYS.settings, {});
  },

  saveSettings(settings: Settings): void {
    saveToStorage(STORAGE_KEYS.settings, settings);
  },
};
