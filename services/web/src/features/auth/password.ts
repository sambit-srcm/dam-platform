export const MIN_PASSWORD_LENGTH = 8;
export const MAX_PASSWORD_LENGTH = 128;

export function passwordError(
  password: string,
  confirm: string,
): string | null {
  if (password.length < MIN_PASSWORD_LENGTH) {
    return 'Use at least 8 characters';
  }
  if (password.length > MAX_PASSWORD_LENGTH) {
    return 'Password is too long';
  }
  if (password !== confirm) {
    return 'Passwords do not match';
  }
  return null;
}
