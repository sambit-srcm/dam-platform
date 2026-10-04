import { useEffect, useState, type SubmitEvent } from 'react';
import { getErrorMessage } from '../../lib/http';
import { listTeams, type Team } from '../teams/api';
import {
  createShare,
  getSharing,
  grantTeam,
  revokeShare,
  revokeTeam,
  type AssetSharing,
} from './api';

type Props = { assetId: string };

export function SharePanel({ assetId }: Props) {
  const [teams, setTeams] = useState<Team[]>([]);
  const [sharing, setSharing] = useState<AssetSharing | null>(null);
  const [teamId, setTeamId] = useState('');
  const [canDownload, setCanDownload] = useState(false);
  const [expiresAt, setExpiresAt] = useState('');
  const [token, setToken] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function reload() {
    const [mine, current] = await Promise.all([
      listTeams(),
      getSharing(assetId),
    ]);
    setTeams(mine);
    setSharing(current);
    setTeamId((currentId) => currentId || mine[0]?.id || '');
  }

  useEffect(() => {
    let cancelled = false;
    Promise.all([listTeams(), getSharing(assetId)])
      .then(([mine, current]) => {
        if (cancelled) return;
        setTeams(mine);
        setSharing(current);
        setTeamId((currentId) => currentId || mine[0]?.id || '');
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(getErrorMessage(err));
      });
    return () => {
      cancelled = true;
    };
  }, [assetId]);

  async function onGrant() {
    if (!teamId) return;
    setError(null);
    try {
      await grantTeam(assetId, teamId);
      await reload();
    } catch (err) {
      setError(getErrorMessage(err));
    }
  }

  async function onCreate(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setToken(null);
    try {
      const created = await createShare(assetId, {
        canDownload,
        expiresAt: new Date(expiresAt).toISOString(),
      });
      setToken(created.token);
      await reload();
    } catch (err) {
      setError(getErrorMessage(err));
    }
  }

  const shareUrl = token ? `${window.location.origin}/share/${token}` : null;

  return (
    <section className="space-y-4 rounded-lg border border-gray-200 bg-white p-4">
      <h2 className="text-sm font-semibold">Share</h2>
      {error && (
        <p role="alert" className="text-sm text-red-600">
          {error}
        </p>
      )}

      <div className="flex flex-wrap items-end gap-2">
        <label className="text-sm text-gray-600">
          Team
          <select
            aria-label="Team to grant"
            value={teamId}
            onChange={(event) => setTeamId(event.target.value)}
            className="mt-1 block rounded border border-gray-300 bg-white px-2 py-1 text-sm"
          >
            {teams.length === 0 && <option value="">No teams yet</option>}
            {teams.map((team) => (
              <option key={team.id} value={team.id}>
                {team.name}
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          onClick={() => void onGrant()}
          disabled={!teamId}
          className="rounded bg-gray-900 px-3 py-1.5 text-sm text-white disabled:opacity-50"
        >
          Grant access
        </button>
      </div>

      {sharing && sharing.teams.length > 0 && (
        <ul className="space-y-1 text-sm">
          {sharing.teams.map((grant) => (
            <li
              key={grant.teamId}
              className="flex items-center justify-between"
            >
              <span>{grant.teamName}</span>
              <button
                type="button"
                className="text-gray-500 hover:text-gray-900"
                onClick={() =>
                  void revokeTeam(assetId, grant.teamId)
                    .then(reload)
                    .catch((err: unknown) => setError(getErrorMessage(err)))
                }
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}

      <form onSubmit={(event) => void onCreate(event)} className="space-y-2">
        <label className="block text-sm text-gray-600">
          Link expires
          <input
            type="datetime-local"
            required
            value={expiresAt}
            onChange={(event) => setExpiresAt(event.target.value)}
            className="mt-1 block rounded border border-gray-300 px-2 py-1 text-sm"
          />
        </label>
        <label className="flex items-center gap-2 text-sm text-gray-600">
          <input
            type="checkbox"
            checked={canDownload}
            onChange={(event) => setCanDownload(event.target.checked)}
          />
          Allow download
        </label>
        <button
          type="submit"
          className="rounded bg-gray-900 px-3 py-1.5 text-sm text-white"
        >
          Create link
        </button>
      </form>

      {shareUrl && (
        <p className="break-all text-sm">
          Copy this link now. It will not be shown again.
          <a href={shareUrl} className="mt-1 block text-blue-700 underline">
            {shareUrl}
          </a>
        </p>
      )}

      {sharing && sharing.links.length > 0 && (
        <ul className="space-y-1 text-sm text-gray-600">
          {sharing.links.map((link) => (
            <li
              key={link.id}
              className="flex items-center justify-between gap-2"
            >
              <span>
                {link.revokedAt
                  ? 'Revoked'
                  : `Expires ${new Date(link.expiresAt).toLocaleString()}`}
                {link.canDownload ? ' · download' : ' · preview only'}
              </span>
              {!link.revokedAt && (
                <button
                  type="button"
                  className="text-gray-500 hover:text-gray-900"
                  onClick={() =>
                    void revokeShare(assetId, link.id)
                      .then(reload)
                      .catch((err: unknown) => setError(getErrorMessage(err)))
                  }
                >
                  Revoke
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
