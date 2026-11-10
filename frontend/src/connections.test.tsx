import { describe, expect, it, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import { connectionNames, documentConnection } from './components/charts/documentConnections';
import { GlassGraph } from './components/charts/GlassGraph';
const edge = { source: 'a', target: 'b', weight: 2, similarity: 0, rel_type: 'shared_entities', evidence: 'Shared entities: Acme, Inc., Atlas', shared_entities: [{ entity_id: '1', name: 'Acme, Inc.' }, { entity_id: '2', name: 'Atlas' }] };
describe('Document connection evidence', () => {
  it('uses stored names without splitting punctuation or inventing similarity', () => {
    expect(connectionNames(edge)).toEqual(['Acme, Inc.', 'Atlas']);
    expect(documentConnection(edge).label).toBe('Acme, Inc. +1');
    expect(documentConnection(edge).similarity).toBe(0);
    expect(connectionNames({ ...edge, shared_entities: undefined })).toEqual(['Acme, Inc., Atlas']);
  });
  it('supports pointer and keyboard access to connection evidence', () => {
    vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} });
    const select = vi.fn();
    const { container } = render(<GlassGraph nodes={['a', 'b'].map(id => ({ id, label: id, type: 'document', detail: '2 passages' }))} edges={[documentConnection(edge)]} onEdgeSelect={select}/>);
    const link = container.querySelector('.graph-edge')!;
    expect(link.getAttribute('aria-label')).toContain('Acme, Inc. +1');
    fireEvent.click(link);
    fireEvent.keyDown(link, { key: 'Enter' });
    expect(select).toHaveBeenCalledTimes(2);
    expect(select).toHaveBeenLastCalledWith('a:b:shared_entities');
  });
});
