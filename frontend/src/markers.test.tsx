import { describe, it, expect } from 'vitest';
import { MarkdownRenderer } from './components/MarkdownRenderer';
import { render } from '@testing-library/react';

describe('MarkdownRenderer', () => {
  it('renders bold and code without raw markdown symbols', () => {
    const { container } = render(<MarkdownRenderer text="This is **bold** and `code` here." />);
    const html = container.innerHTML;
    expect(html).not.toContain('**');
    expect(html).not.toContain('`');
    expect(html).toContain('<strong>');
    expect(html).toContain('<code>');
  });

  it('renders a fenced code block', () => {
    const { container } = render(<MarkdownRenderer text={"```ts\nconst x = 1;\n```"} />);
    expect(container.querySelector('pre')).toBeTruthy();
    expect(container.querySelector('code')?.textContent).toContain('const x = 1;');
  });

  it('renders a link as an anchor', () => {
    const { container } = render(<MarkdownRenderer text="see [doc](file.txt)" />);
    const link = container.querySelector('a');
    expect(link).toBeTruthy();
    expect(link?.getAttribute('href')).toBe('file.txt');
  });
});
