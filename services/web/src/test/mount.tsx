import { act, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';

export async function flush() {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
}

export async function waitFor(check: () => void, timeoutMs = 1000) {
  const started = Date.now();
  let last: unknown;
  while (Date.now() - started < timeoutMs) {
    await flush();
    try {
      check();
      return;
    } catch (error) {
      last = error;
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
  }
  throw last;
}

export async function mount(ui: ReactNode) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  await act(async () => {
    root.render(ui);
  });
  await flush();
  return {
    container,
    async rerender(next: ReactNode) {
      await act(async () => {
        root.render(next);
      });
      await flush();
    },
    unmount() {
      act(() => {
        root.unmount();
      });
      container.remove();
    },
  };
}

export async function click(el: Element) {
  await act(async () => {
    (el as HTMLElement).click();
  });
  await flush();
}

export async function change(
  el: HTMLInputElement | HTMLSelectElement,
  value: string | boolean,
) {
  await act(async () => {
    if (el instanceof HTMLInputElement && el.type === 'checkbox') {
      const setter = Object.getOwnPropertyDescriptor(
        HTMLInputElement.prototype,
        'checked',
      )?.set;
      setter?.call(el, Boolean(value));
    } else if (el instanceof HTMLSelectElement) {
      const setter = Object.getOwnPropertyDescriptor(
        HTMLSelectElement.prototype,
        'value',
      )?.set;
      setter?.call(el, String(value));
    } else {
      const setter = Object.getOwnPropertyDescriptor(
        HTMLInputElement.prototype,
        'value',
      )?.set;
      setter?.call(el, String(value));
    }
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
  });
  await flush();
}

export async function submit(form: HTMLFormElement) {
  await act(async () => {
    form.requestSubmit();
  });
  await flush();
}
