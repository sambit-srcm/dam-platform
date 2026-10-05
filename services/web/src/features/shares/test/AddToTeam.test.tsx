import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { AddToTeam } from '../AddToTeam';

describe('AddToTeam', () => {
  it('shows nothing when the person is not on a team', () => {
    expect(
      renderToStaticMarkup(
        <AddToTeam assetId="a1" filename="a.jpg" teams={[]} />,
      ),
    ).toBe('');
  });

  it('offers the teams the person belongs to', () => {
    const html = renderToStaticMarkup(
      <AddToTeam
        assetId="a1"
        filename="beach.jpg"
        teams={[{ id: 't1', name: 'Editors' }]}
      />,
    );
    expect(html).toContain('Editors');
    expect(html).toContain('Add to team');
    expect(html).toContain('Team for beach.jpg');
  });
});
