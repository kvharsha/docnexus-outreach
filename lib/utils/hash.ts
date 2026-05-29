// Tiny deterministic string hash (FNV-1a, 32-bit). We only need stable pseudo-randomness for mock
// dashboard metrics — same input always yields the same number, so server and client agree and the
// figures don't jump on reload. Not for anything security-sensitive.
export function hashString(input: string): number {
  let hash = 2166136261; // FNV offset basis
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    // Math.imul keeps the multiply in 32-bit range; the FNV prime is 16777619.
    hash = Math.imul(hash, 16777619);
  }
  // >>> 0 coerces the result to an unsigned 32-bit integer.
  return hash >>> 0;
}

// Map a seed string to an integer in [min, max] inclusive — deterministic for a given seed.
export function hashToRange(seed: string, min: number, max: number): number {
  const span = max - min + 1;
  return min + (hashString(seed) % span);
}
