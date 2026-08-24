export type ClassNameValue = string | number | boolean | null | undefined;

/**
 * Joins conditional NativeWind class names into a static className string.
 */
export function cx(...values: ClassNameValue[]): string {
  let result = '';

  for (const value of values) {
    if (!value) continue;

    if (result) result += ' ';
    result += value;
  }

  return result;
}
