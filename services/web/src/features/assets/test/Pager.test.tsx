import { isValidElement, type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { Pager } from '../Pager';

type Props = Parameters<typeof Pager>[0];

const render = (props: Partial<Props> = {}) =>
  renderToStaticMarkup(
    <Pager offset={0} limit={10} total={35} onChange={() => {}} {...props} />,
  );

// The page text without the HTML around it, e.g. "1–10 of 35"
const summary = (html: string) =>
  html.match(/<span>(.*?)<\/span>/)![1]!.replace(/<!-- -->/g, '');

// Finds a button in the un-rendered tree so a "click" can be simulated without a browser
function findButton(
  node: ReactNode,
  label: string,
): { disabled?: boolean; onClick: () => void } {
  if (!isValidElement(node)) throw new Error(`no ${label} button`);
  const props = node.props as {
    children?: ReactNode;
    disabled?: boolean;
    onClick?: () => void;
  };
  if (node.type === 'button' && props.children === label) {
    return { disabled: props.disabled, onClick: props.onClick! };
  }
  for (const child of [props.children].flat()) {
    try {
      return findButton(child, label);
    } catch {
      // keep looking in the next child
    }
  }
  throw new Error(`no ${label} button`);
}

describe('Pager text', () => {
  it('shows which items are on screen', () => {
    expect(summary(render())).toBe('1–10 of 35');
  });

  it('shows the right range on a later page', () => {
    expect(summary(render({ offset: 10 }))).toBe('11–20 of 35');
  });

  it('stops at the total on the last page', () => {
    expect(summary(render({ offset: 30 }))).toBe('31–35 of 35');
  });

  it('shows 0–0 when there is nothing to page through', () => {
    expect(summary(render({ total: 0 }))).toBe('0–0 of 0');
  });
});

describe('Pager buttons', () => {
  it('cannot go back from the first page', () => {
    expect(
      findButton(
        Pager({ offset: 0, limit: 10, total: 35, onChange: () => {} }),
        'Previous',
      ).disabled,
    ).toBe(true);
  });

  it('can go back from a later page', () => {
    expect(
      findButton(
        Pager({ offset: 10, limit: 10, total: 35, onChange: () => {} }),
        'Previous',
      ).disabled,
    ).toBe(false);
  });

  it('cannot go forward from the last page', () => {
    expect(
      findButton(
        Pager({ offset: 30, limit: 10, total: 35, onChange: () => {} }),
        'Next',
      ).disabled,
    ).toBe(true);
  });

  it('cannot go forward when everything fits on one page exactly', () => {
    expect(
      findButton(
        Pager({ offset: 0, limit: 10, total: 10, onChange: () => {} }),
        'Next',
      ).disabled,
    ).toBe(true);
  });

  it('asks for the next page when Next is clicked', () => {
    const onChange = vi.fn();
    findButton(
      Pager({ offset: 10, limit: 10, total: 35, onChange }),
      'Next',
    ).onClick();
    expect(onChange).toHaveBeenCalledWith(20);
  });

  it('asks for the page before when Previous is clicked', () => {
    const onChange = vi.fn();
    findButton(
      Pager({ offset: 20, limit: 10, total: 35, onChange }),
      'Previous',
    ).onClick();
    expect(onChange).toHaveBeenCalledWith(10);
  });

  it('never goes below the first page', () => {
    const onChange = vi.fn();
    findButton(
      Pager({ offset: 4, limit: 10, total: 35, onChange }),
      'Previous',
    ).onClick();
    expect(onChange).toHaveBeenCalledWith(0);
  });
});
