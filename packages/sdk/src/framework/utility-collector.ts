import type { GeneratedUtility } from "./types";

/**
 * Collects and deduplicates generated utilities (helper functions, types, etc.)
 * across multiple type and validation mappings.
 *
 * Utilities are deduplicated by their `id` field. When `includeOnce` is true,
 * only the first instance of a utility with that id is kept.
 *
 * @example
 * ```typescript
 * const collector = new UtilityCollector();
 *
 * // Add enum validation utility
 * collector.add({
 *   id: "Status_enum",
 *   code: `type Status string\nconst (...`,
 *   includeOnce: true,
 * });
 *
 * // Same utility added again - will be deduplicated
 * collector.add({
 *   id: "Status_enum",
 *   code: `...`, // Ignored, already have this id
 *   includeOnce: true,
 * });
 *
 * // Get all unique utilities
 * const utilities = collector.getAll(); // Returns 1 utility
 * ```
 */
export class UtilityCollector {
  private utilities: Map<string, GeneratedUtility> = new Map();
  private imports: Set<string> = new Set();

  /**
   * Add a utility to the collector.
   *
   * If a utility with the same id exists:
   * - If `includeOnce` is true, the new utility is ignored
   * - If `includeOnce` is false, the new utility replaces the old one
   *
   * @param utility - The utility to add
   */
  add(utility: GeneratedUtility): void {
    const existing = this.utilities.get(utility.id);

    // If includeOnce and already exists, skip
    if (existing && utility.includeOnce) {
      return;
    }

    this.utilities.set(utility.id, utility);

    // Collect imports
    if (utility.imports) {
      for (const imp of utility.imports) {
        this.imports.add(imp);
      }
    }
  }

  /**
   * Add multiple utilities at once.
   *
   * @param utilities - The utilities to add
   */
  addAll(utilities: GeneratedUtility[]): void {
    for (const utility of utilities) {
      this.add(utility);
    }
  }

  /**
   * Check if a utility with the given id exists.
   *
   * @param id - The utility id to check
   */
  has(id: string): boolean {
    return this.utilities.has(id);
  }

  /**
   * Get a specific utility by id.
   *
   * @param id - The utility id to retrieve
   */
  get(id: string): GeneratedUtility | undefined {
    return this.utilities.get(id);
  }

  /**
   * Get all collected utilities, sorted by priority (higher first).
   */
  getAll(): GeneratedUtility[] {
    const utilities = Array.from(this.utilities.values());

    // Sort by priority (higher priority first), then by id for stability
    return utilities.sort((a, b) => {
      const priorityA = a.priority ?? 0;
      const priorityB = b.priority ?? 0;
      if (priorityA !== priorityB) {
        return priorityB - priorityA;
      }
      return a.id.localeCompare(b.id);
    });
  }

  /**
   * Get all unique imports required by collected utilities.
   */
  getImports(): string[] {
    return Array.from(this.imports).sort();
  }

  /**
   * Get the number of collected utilities.
   */
  size(): number {
    return this.utilities.size;
  }

  /**
   * Clear all collected utilities and imports.
   */
  clear(): void {
    this.utilities.clear();
    this.imports.clear();
  }

  /**
   * Merge another collector into this one.
   *
   * @param other - The collector to merge from
   */
  merge(other: UtilityCollector): void {
    for (const utility of other.getAll()) {
      this.add(utility);
    }
  }

  /**
   * Generate the combined code from all utilities.
   *
   * @param separator - Separator between utilities (default: double newline)
   */
  generateCode(separator = "\n\n"): string {
    return this.getAll()
      .map((u) => u.code)
      .join(separator);
  }
}
