export function validatePassword(password: string): string | null {
  const hasUpper = /[A-Z]/.test(password);
  const hasLower = /[a-z]/.test(password);
  const hasNumber = /[0-9]/.test(password);
  const hasSpecial = /[^A-Za-z0-9]/.test(password);

  if (password.length < 10 || !hasUpper || !hasLower || !hasNumber || !hasSpecial) {
    return 'Password must be at least 10 characters with upper, lower, number, and special character.';
  }

  return null;
}
