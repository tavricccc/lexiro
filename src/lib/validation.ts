export function containsHan(value: string): boolean {
  return /[\u3400-\u9FFF]/u.test(value);
}
