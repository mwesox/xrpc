/**
 * Converts a string to PascalCase
 * @param str - The string to convert (e.g., "hello-world" or "hello_world")
 * @returns The PascalCase version (e.g., "HelloWorld")
 */
export function toPascalCase(str: string): string {
  return str
    .split(/[-_]/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join('');
}

/**
 * Converts a string to camelCase
 * @param str - The string to convert
 * @returns The camelCase version (e.g., "helloWorld")
 */
export function toCamelCase(str: string): string {
  const pascal = toPascalCase(str);
  return pascal.charAt(0).toLowerCase() + pascal.slice(1);
}

/**
 * Converts a string to snake_case
 * @param str - The string to convert
 * @returns The snake_case version (e.g., "hello_world")
 */
export function toSnakeCase(str: string): string {
  return str.replace(/([A-Z])/g, '_$1').toLowerCase();
}
