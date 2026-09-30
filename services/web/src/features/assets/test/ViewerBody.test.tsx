import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { ViewerBody, type ViewState } from '../AssetViewer';

const show = (state: ViewState, poster?: string | null) =>
  renderToStaticMarkup(
    <ViewerBody state={state} filename="holiday" poster={poster} />,
  );

const source = (label: string) => ({
  label,
  width: null,
  height: null,
  url: `https://files.test/${label}.mp4`,
});

describe('asset viewer body', () => {
  it('says loading while the file is being fetched', () => {
    expect(show({ status: 'loading' })).toContain('Loading');
  });

  it('shows the error message when the file could not be loaded', () => {
    expect(show({ status: 'error', message: 'Not allowed' })).toContain(
      'Not allowed',
    );
  });

  it('shows an image at full size with its name as the description', () => {
    const html = show({
      status: 'ready',
      view: { kind: 'image', url: 'https://files.test/a.jpg' },
    });
    expect(html).toContain('src="https://files.test/a.jpg"');
    expect(html).toContain('alt="holiday"');
  });

  it('shows a document in a frame titled with its name', () => {
    const html = show({
      status: 'ready',
      view: { kind: 'document', url: 'https://files.test/a.pdf' },
    });
    expect(html).toContain('<iframe');
    expect(html).toContain('title="holiday"');
  });

  it('plays a video with its poster and no picker when there is one size', () => {
    const html = show(
      {
        status: 'ready',
        view: { kind: 'video', renditions: [source('720p')] },
      },
      'https://files.test/poster.webp',
    );
    expect(html).toContain('src="https://files.test/720p.mp4"');
    expect(html).toContain('poster="https://files.test/poster.webp"');
    expect(html).not.toContain('Quality');
  });

  it('offers a quality picker starting on the first size when there are several', () => {
    const html = show({
      status: 'ready',
      view: {
        kind: 'video',
        renditions: [source('480p'), source('1080p')],
      },
    });
    expect(html).toContain('Quality');
    expect(html).toContain('src="https://files.test/480p.mp4"');
    expect(html).toContain('>1080p</option>');
  });
});
