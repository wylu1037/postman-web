import { describe, expect, it } from 'vitest';
import RootLayout from '@/app/layout';

describe('RootLayout', () => {
  it('suppresses root html hydration noise from browser-injected attributes', () => {
    const element = RootLayout({ children: 'content' });

    expect(element.props.suppressHydrationWarning).toBe(true);
  });
});
