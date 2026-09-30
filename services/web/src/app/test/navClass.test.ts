import { describe, expect, it } from 'vitest';
import { navClass } from '../navClass';

describe('navigation link style', () => {
  it('makes the current page link dark', () => {
    expect(navClass({ isActive: true })).toContain('text-gray-900');
    expect(navClass({ isActive: true })).not.toContain('text-gray-500');
  });

  it('makes other links grey until hovered', () => {
    const style = navClass({ isActive: false });
    expect(style).toContain('text-gray-500');
    expect(style).toContain('hover:text-gray-900');
  });
});
