import { useEffect, useState } from 'react';
import { getErrorMessage } from '../lib/http';
import {
  addMember,
  createTeam,
  listAllTeams,
  listMembers,
  removeMember,
  type Team,
  type TeamMember,
} from '../features/teams/api';

export function AdminTeamsPage() {
  const [teams, setTeams] = useState<Team[]>([]);
  const [name, setName] = useState('');
  const [selected, setSelected] = useState<string | null>(null);
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);

  function loadTeams() {
    return listAllTeams().then((next) => {
      setTeams(next);
      setSelected((current) =>
        current && next.some((team) => team.id === current)
          ? current
          : (next[0]?.id ?? null),
      );
      return next;
    });
  }

  useEffect(() => {
    let cancelled = false;
    listAllTeams()
      .then((next) => {
        if (cancelled) return;
        setTeams(next);
        setSelected(next[0]?.id ?? null);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(getErrorMessage(err));
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!selected) return;
    let cancelled = false;
    listMembers(selected)
      .then((next) => {
        if (!cancelled) setMembers(next);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(getErrorMessage(err));
      });
    return () => {
      cancelled = true;
    };
  }, [selected]);

  const current = teams.find((team) => team.id === selected);

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-semibold">Teams</h2>
      {error && (
        <p role="alert" className="text-sm text-red-600">
          {error}
        </p>
      )}

      <form
        className="flex flex-wrap items-end gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          setError(null);
          void createTeam(name)
            .then(async (team) => {
              setName('');
              await loadTeams();
              setSelected(team.id);
            })
            .catch((err: unknown) => setError(getErrorMessage(err)));
        }}
      >
        <label className="text-sm text-gray-600">
          New team
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            required
            maxLength={80}
            className="mt-1 block rounded border border-gray-300 px-2 py-1 text-sm"
          />
        </label>
        <button
          type="submit"
          className="rounded bg-gray-900 px-3 py-1.5 text-sm text-white"
        >
          Create
        </button>
      </form>

      {teams.length === 0 ? (
        <p className="text-sm text-gray-600">No teams yet.</p>
      ) : (
        <div className="grid gap-6 sm:grid-cols-[12rem_1fr]">
          <ul className="space-y-1">
            {teams.map((team) => (
              <li key={team.id}>
                <button
                  type="button"
                  onClick={() => setSelected(team.id)}
                  className={`w-full rounded px-2 py-1 text-left text-sm ${
                    team.id === selected
                      ? 'bg-gray-900 text-white'
                      : 'hover:bg-gray-100'
                  }`}
                >
                  {team.name}
                </button>
              </li>
            ))}
          </ul>

          {current && (
            <div className="space-y-3">
              <ul className="space-y-1 text-sm">
                {members.length === 0 && (
                  <li className="text-gray-600">No members yet.</li>
                )}
                {members.map((member) => (
                  <li
                    key={member.userId}
                    className="flex items-center justify-between"
                  >
                    <span>{member.email}</span>
                    <button
                      type="button"
                      className="text-gray-500 hover:text-gray-900"
                      onClick={() =>
                        void removeMember(current.id, member.userId)
                          .then(() => listMembers(current.id).then(setMembers))
                          .catch((err: unknown) =>
                            setError(getErrorMessage(err)),
                          )
                      }
                    >
                      Remove
                    </button>
                  </li>
                ))}
              </ul>
              <form
                className="flex flex-wrap items-end gap-2"
                onSubmit={(event) => {
                  event.preventDefault();
                  setError(null);
                  void addMember(current.id, email)
                    .then(async () => {
                      setEmail('');
                      setMembers(await listMembers(current.id));
                    })
                    .catch((err: unknown) => setError(getErrorMessage(err)));
                }}
              >
                <label className="text-sm text-gray-600">
                  Add by email
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    className="mt-1 block rounded border border-gray-300 px-2 py-1 text-sm"
                  />
                </label>
                <button
                  type="submit"
                  className="rounded bg-gray-900 px-3 py-1.5 text-sm text-white"
                >
                  Add
                </button>
              </form>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
