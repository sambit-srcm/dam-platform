export function TagList({ tags, max }: { tags: string[]; max?: number }) {
  if (tags.length === 0) return null;

  return (
    <ul className="flex flex-wrap gap-1">
      {tags.slice(0, max).map((tag) => (
        <li
          key={tag}
          className="rounded bg-gray-100 px-1.5 py-0.5 text-xs text-gray-600"
        >
          {tag}
        </li>
      ))}
    </ul>
  );
}
