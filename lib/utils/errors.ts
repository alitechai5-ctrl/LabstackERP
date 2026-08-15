const FK_PATTERNS = [
  /foreign key constraint/i,
  /violates foreign key/i,
  /is still referenced by/i,
];

const NOT_NULL_PATTERNS = [
  /not-null constraint/i,
  /null value in column/i,
  /violates not-null/i,
];

const UNIQUE_PATTERNS = [
  /unique constraint/i,
  /duplicate key value/i,
  /already exists/i,
];

const COLUMN_PATTERNS = [
  /column .* does not exist/i,
  /could not find the column/i,
  /relation .* does not exist/i,
  /column ".*" of relation ".*" does not exist/i,
];

const RLS_PATTERNS = [
  /row-level security/i,
  /new row violates row-level security/i,
  /policy/i,
];

export function getFriendlyErrorMessage(error: unknown): string {
  if (!error) return 'Something went wrong. Please try again or contact support.';

  const msg =
    typeof error === 'string'
      ? error
      : (error as any)?.message ?? (error as any)?.error?.message ?? String(error);

  if (!msg) return 'Something went wrong. Please try again or contact support.';

  if (FK_PATTERNS.some((p) => p.test(msg))) {
    return 'This record is linked to other data and cannot be deleted or modified. Remove the linked records first.';
  }
  if (NOT_NULL_PATTERNS.some((p) => p.test(msg))) {
    return 'Please fill in all required fields before saving.';
  }
  if (UNIQUE_PATTERNS.some((p) => p.test(msg))) {
    return 'A record with this value already exists. Please use a different value.';
  }
  if (COLUMN_PATTERNS.some((p) => p.test(msg))) {
    return 'There is a configuration issue with this screen. Please contact support.';
  }
  if (RLS_PATTERNS.some((p) => p.test(msg))) {
    return 'You do not have permission to perform this action.';
  }
  if (/network|fetch|timeout|connection/i.test(msg)) {
    return 'Could not connect to the server. Please check your internet connection and try again.';
  }

  return 'Something went wrong. Please try again or contact support.';
}
