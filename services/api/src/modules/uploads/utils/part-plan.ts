import { config } from '../../../config.ts';
import { ValidationError } from '../../../shared/errors/AppError.ts';

const MIB = 1024 * 1024;
// S3 rule: every part except the last one must be at least 5 MiB
const MIN_PART_SIZE = 5 * MIB;
// S3 rule: one upload cannot be split into more than 10,000 parts
const MAX_PARTS = 10_000;

export type PartPlan = {
  partSize: number;
  partCount: number;
};

// Works out how the file should be cut up, from the size the caller declared.
// Both sides use this plan, so the server knows exactly what each part must weigh.
export function planParts(declaredSize: number): PartPlan {
  if (!Number.isInteger(declaredSize) || declaredSize <= 0) {
    throw new ValidationError(
      'File size must be a positive whole number of bytes',
    );
  }

  const maxBytes = config.MAX_UPLOAD_MB * MIB;
  if (declaredSize > maxBytes) {
    throw new ValidationError(
      `Files larger than ${config.MAX_UPLOAD_MB} MB are not accepted`,
    );
  }

  // Small enough to go up in one piece, where the 5 MiB floor does not apply
  if (declaredSize <= MIN_PART_SIZE) {
    return { partSize: declaredSize, partCount: 1 };
  }

  // Grow the part size until the file fits inside the part ceiling,
  // rounded up to a whole number of MiB so the numbers stay readable
  const needed = Math.ceil(declaredSize / MAX_PARTS);
  const partSize = Math.max(MIN_PART_SIZE, Math.ceil(needed / MIB) * MIB);

  return { partSize, partCount: Math.ceil(declaredSize / partSize) };
}
