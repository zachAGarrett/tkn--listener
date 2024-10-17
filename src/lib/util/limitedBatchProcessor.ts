export async function limitedBatchProcessor<T>(
  promises: Promise<T>[],
  concurrencyLimit: number,
  boundaryCallback?: () => Promise<void>
): Promise<T[]> {
  const results: T[] = [];

  for (let i = 0; i < promises.length; i += concurrencyLimit) {
    // Create a batch of promises
    const batch = promises.slice(i, i + concurrencyLimit);

    // Execute promises in this batch concurrently
    const batchResults = await Promise.all(batch);

    // Store the results of this batch
    results.push(...batchResults);

    // Await the boundary callback if provided, before starting the next batch
    // Only call the boundary callback if there are more promises left to process
    if (boundaryCallback) {
      await boundaryCallback();
    }
  }

  return results;
}
