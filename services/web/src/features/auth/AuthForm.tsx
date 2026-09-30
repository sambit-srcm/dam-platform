import { useState, type SubmitEvent } from 'react';
import { Link, useLocation, useNavigate } from 'react-router';
import { getErrorMessage } from '../../lib/http';
import { login, register } from './api';
import { useAuthStore } from './store';

type Props = { mode: 'login' | 'register' };

const COPY = {
  login: {
    title: 'Sign in',
    submit: 'Sign in',
    busy: 'Signing in…',
    switchText: 'No account yet?',
    switchLink: 'Create one',
    switchTo: '/register',
  },
  register: {
    title: 'Create account',
    submit: 'Create account',
    busy: 'Creating account…',
    switchText: 'Already have an account?',
    switchLink: 'Sign in',
    switchTo: '/login',
  },
} as const;

const inputClass =
  'mt-1 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm outline-none focus:border-gray-900';

export function AuthForm({ mode }: Props) {
  const copy = COPY[mode];
  const navigate = useNavigate();
  const location = useLocation();
  const setSession = useAuthStore((state) => state.setSession);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Send people back to the page that made them sign in
  const destination = (location.state as { from?: string } | null)?.from ?? '/';

  const submit = async (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const session = await (mode === 'login' ? login : register)({
        email,
        password,
      });
      setSession(session);
      navigate(destination, { replace: true });
    } catch (err) {
      setError(getErrorMessage(err));
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
      <form
        onSubmit={submit}
        className="w-full max-w-sm rounded-lg border border-gray-200 bg-white p-6 shadow-sm"
      >
        <h1 className="text-lg font-semibold">DAM platform</h1>
        <h2 className="mt-1 mb-5 text-sm text-gray-500">{copy.title}</h2>

        <label className="block text-sm font-medium">
          Email
          <input
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={inputClass}
          />
        </label>

        <label className="mt-4 block text-sm font-medium">
          Password
          <input
            type="password"
            required
            minLength={mode === 'register' ? 8 : undefined}
            autoComplete={
              mode === 'login' ? 'current-password' : 'new-password'
            }
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={inputClass}
          />
        </label>
        {mode === 'register' && (
          <p className="mt-1 text-xs text-gray-500">At least 8 characters</p>
        )}

        {error && (
          <p role="alert" className="mt-4 text-sm text-red-600">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={busy}
          className="mt-5 w-full rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-gray-700 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {busy ? copy.busy : copy.submit}
        </button>

        <p className="mt-4 text-center text-sm text-gray-500">
          {copy.switchText}{' '}
          <Link to={copy.switchTo} className="text-blue-600 hover:underline">
            {copy.switchLink}
          </Link>
        </p>
      </form>
    </div>
  );
}
