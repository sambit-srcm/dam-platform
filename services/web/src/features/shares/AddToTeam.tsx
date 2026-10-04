import { useState } from 'react';
import { getErrorMessage } from '../../lib/http';
import type { Team } from '../teams/api';
import { grantTeam } from './api';

type Props = {
  assetId: string;
  filename: string;
  teams: Team[];
};

export function AddToTeam({ assetId, filename, teams }: Props) {
  const [teamId, setTeamId] = useState(teams[0]?.id ?? '');
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const selected = teams.find((team) => team.id === teamId) ?? teams[0];

  async function add() {
    if (!selected) return;
    setError(null);
    setMessage(null);
    try {
      await grantTeam(assetId, selected.id);
      setMessage(`Added to ${selected.name}`);
    } catch (err) {
      setError(getErrorMessage(err));
    }
  }

  if (teams.length === 0) return null;

  return (
    <div className="space-y-1">
      <div className="flex items-center gap-1">
        <select
          aria-label={`Team for ${filename}`}
          value={selected?.id ?? ''}
          onChange={(event) => {
            setTeamId(event.target.value);
            setMessage(null);
          }}
          className="min-w-0 flex-1 rounded border border-gray-300 bg-white px-1 py-1 text-xs"
        >
          {teams.map((team) => (
            <option key={team.id} value={team.id}>
              {team.name}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={() => void add()}
          className="shrink-0 rounded bg-gray-900 px-2 py-1 text-xs text-white"
        >
          Add to team
        </button>
      </div>
      {message && <p className="text-xs text-gray-600">{message}</p>}
      {error && (
        <p role="alert" className="text-xs text-red-600">
          {error}
        </p>
      )}
    </div>
  );
}
