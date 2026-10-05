import { isValidElement, type ReactElement, type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { ErrorBoundary } from '../ErrorBoundary';

function findButton(node: ReactNode): ReactElement | undefined {
  if (!isValidElement(node)) return undefined;
  if (node.type === 'button') return node;
  const children = (node.props as { children?: ReactNode }).children;
  for (const child of Array.isArray(children) ? children : [children]) {
    const found = findButton(child);
    if (found) return found;
  }
  return undefined;
}

describe('ErrorBoundary', () => {
  it('shows the page when nothing has failed', () => {
    const boundary = new ErrorBoundary({ children: <p>Gallery</p> });
    expect(renderToStaticMarkup(boundary.render())).toContain('Gallery');
  });

  it('offers a reload after a render error', () => {
    const reload = vi.fn();
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: { reload },
    });

    expect(ErrorBoundary.getDerivedStateFromError()).toEqual({ failed: true });

    const boundary = new ErrorBoundary({ children: null });
    boundary.state = { failed: true };
    const view = boundary.render();
    expect(renderToStaticMarkup(view)).toContain('Something went wrong');

    const button = findButton(view);
    (button?.props as { onClick: () => void }).onClick();
    expect(reload).toHaveBeenCalledOnce();
  });
});
