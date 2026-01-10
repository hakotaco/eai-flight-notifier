/**
 * Calculates the delay in minutes between schedule and actual time.
 * Returns 0 if actual is null or if flight is early.
 */
export function calculateDelayMinutes(
  schedule: Date,
  actual: Date | null
): number {
  if (!actual) return 0;

  const diffMs = actual.getTime() - schedule.getTime();
  const diffMins = Math.floor(diffMs / 60000);

  // We treat early arrivals (negative diff) as 0 delay
  return Math.max(0, diffMins);
}

/**
 * Determines if the delay state has changed.
 * Returns true if the minute value is different.
 * This covers:
 * 1. 0 -> 20 (New Delay)
 * 2. 20 -> 45 (Worse Delay)
 * 3. 45 -> 15 (Improved but still delayed)
 * 4. 15 -> 0 (Recovery / Back on time)
 */
export function hasDelayChanged(oldDelay: number, newDelay: number): boolean {
  return oldDelay !== newDelay;
}
