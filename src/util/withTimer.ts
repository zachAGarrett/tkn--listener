export function withTimer<T extends (...args: any[]) => any>(
  fn: T
): (...args: Parameters<T>) => { result: ReturnType<T>; duration: number } {
  return function (...args: Parameters<T>): {
    result: ReturnType<T>;
    duration: number;
  } {
    const start = performance.now();

    const result = fn(...args); // Execute the wrapped function

    const end = performance.now();
    const duration = end - start;

    return { result, duration }; // Return both result and duration
  };
}
