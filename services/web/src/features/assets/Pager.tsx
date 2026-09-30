type Props = {
  offset: number;
  limit: number;
  total: number;
  onChange: (offset: number) => void;
};

export function Pager({ offset, limit, total, onChange }: Props) {
  const from = total === 0 ? 0 : offset + 1;
  const to = Math.min(offset + limit, total);

  return (
    <div className="flex items-center justify-between text-sm text-gray-600">
      <span>
        {from}–{to} of {total}
      </span>
      <div className="flex gap-2">
        <button
          type="button"
          disabled={offset === 0}
          onClick={() => onChange(Math.max(0, offset - limit))}
          className="rounded border border-gray-300 bg-white px-3 py-1 disabled:opacity-40"
        >
          Previous
        </button>
        <button
          type="button"
          disabled={offset + limit >= total}
          onClick={() => onChange(offset + limit)}
          className="rounded border border-gray-300 bg-white px-3 py-1 disabled:opacity-40"
        >
          Next
        </button>
      </div>
    </div>
  );
}
