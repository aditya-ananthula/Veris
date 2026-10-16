import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MessageBubble } from './components/MessageBubble';

describe('MessageBubble', () => {
  beforeEach(() => {
    vi.stubGlobal('navigator', { clipboard: { writeText: vi.fn() } });
  });

  it('renders user message', () => {
    render(<MessageBubble msg={{ id: '1', role: 'user', text: 'hello' }} />);
    expect(screen.getByText('hello')).toBeDefined();
  });

  it('renders assistant answer with evidence count', () => {
    render(
      <MessageBubble
        msg={{
          id: '2',
          role: 'assistant',
          text: 'The doc says X.',
          sources: ['passage one', 'passage two'],
          validation: 'VERDICT: SUPPORTED\nREASONING: ok',
        }}
      />,
    );
    expect(screen.getByText('Cited evidence')).toBeDefined();
    expect(screen.getAllByText('2').length).toBeGreaterThan(0);
    expect(screen.getByText(/The doc says/)).toBeDefined();
  });

  it('flags unsupported validation', () => {
    render(
      <MessageBubble
        msg={{
          id: '3',
          role: 'assistant',
          text: 'Maybe X.',
          sources: [],
          validation: 'VERDICT: UNSUPPORTED\nREASONING: not in context',
        }}
      />,
    );
    expect(screen.getAllByText(/VERDICT: UNSUPPORTED/).length).toBeGreaterThan(0);
    expect(screen.getByText('Validation detail')).toBeDefined();
  });
});
