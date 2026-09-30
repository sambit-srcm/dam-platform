import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { TagList } from '../TagList';

const items = (html: string) =>
  [...html.matchAll(/<li[^>]*>([^<]*)<\/li>/g)].map((m) => m[1]);

describe('TagList', () => {
  it('shows nothing at all when there are no tags', () => {
    expect(renderToStaticMarkup(<TagList tags={[]} />)).toBe('');
  });

  it('shows every tag when no limit is given', () => {
    const html = renderToStaticMarkup(<TagList tags={['a', 'b', 'c', 'd']} />);
    expect(items(html)).toEqual(['a', 'b', 'c', 'd']);
  });

  it('keeps the tags in the order they were given', () => {
    const html = renderToStaticMarkup(<TagList tags={['zebra', 'apple']} />);
    expect(items(html)).toEqual(['zebra', 'apple']);
  });

  it('shows only the first few tags when a limit is given', () => {
    const html = renderToStaticMarkup(
      <TagList tags={['a', 'b', 'c', 'd']} max={2} />,
    );
    expect(items(html)).toEqual(['a', 'b']);
  });

  it('shows all tags when the limit is bigger than the list', () => {
    const html = renderToStaticMarkup(<TagList tags={['a', 'b']} max={10} />);
    expect(items(html)).toEqual(['a', 'b']);
  });
});
