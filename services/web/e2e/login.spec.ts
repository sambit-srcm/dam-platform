import { expect, test } from '@playwright/test';

test('a failed sign-in is announced on the fields', async ({ page }) => {
  await page.goto('/login');
  await page.getByLabel('Email').fill('ada@example.com');
  await page.getByLabel('Password').fill('correct-horse');
  await page.getByRole('button', { name: 'Sign in' }).click();

  const alert = page.getByRole('alert');
  await expect(alert).toBeVisible();
  await expect(page.getByLabel('Email')).toHaveAttribute(
    'aria-invalid',
    'true',
  );
  await expect(page.getByLabel('Email')).toHaveAttribute(
    'aria-describedby',
    'auth-error',
  );
  await expect(page.getByLabel('Password')).toHaveAttribute(
    'aria-describedby',
    'auth-error',
  );
});
