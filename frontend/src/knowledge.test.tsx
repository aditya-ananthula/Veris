import { act, fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GlassGraph, graphPositions } from './components/charts/GlassGraph';
import { MarkdownRenderer } from './components/MarkdownRenderer';
let resize: () => void;let width=900;
beforeEach(()=>{width=900;vi.spyOn(HTMLElement.prototype,'getBoundingClientRect').mockImplementation(()=>({width,height:500,top:0,left:0,bottom:500,right:width,x:0,y:0,toJSON:()=>({})}));vi.stubGlobal('ResizeObserver',class{constructor(fn:()=>void){resize=fn;}observe(){}disconnect(){}});});
describe('Graph interaction and integrity',()=>{
 const nodes=Array.from({length:500},(_,i)=>({id:String(i),label:'Source '+i.toString().padStart(3,'0'),type:'document',detail:'1 chunk'}));
 it('bounds large collections, supports keyboard selection, zoom and fit',()=>{
  const select=vi.fn(),{container}=render(<GlassGraph nodes={nodes} edges={[]} onSelect={select}/>);
  expect(container.querySelectorAll('.knowledge-node').length).toBeLessThanOrEqual(15);
 fireEvent.click(screen.getByRole('button',{name:'Circle'}));
 expect(screen.getByRole('button',{name:'Circle'}).getAttribute('aria-pressed')).toBe('true');
 fireEvent.keyDown(container.querySelector('.knowledge-node')!,{key:'Enter'});expect(select).toHaveBeenCalledWith('0');
  fireEvent.click(screen.getByLabelText('Next nodes'));expect(container.querySelector('.knowledge-node')?.getAttribute('aria-label')).not.toContain('Source 000');
  const transform=()=>container.querySelector('g[transform*="scale"]')?.getAttribute('transform');
  const original=transform();fireEvent.click(screen.getByLabelText('Zoom in'));expect(transform()).not.toBe(original);
  fireEvent.click(screen.getByText('Fit to View'));expect(transform()).toBe(original);
 });
 it('responds to resize with a finite fitted viewport',()=>{const {container}=render(<GlassGraph nodes={nodes} edges={[]}/>);width=320;act(()=>resize());expect(container.querySelector('svg')?.getAttribute('width')).toBe('320');expect(container.querySelectorAll('.knowledge-node').length).toBeLessThanOrEqual(6);expect(container.innerHTML).not.toContain('NaN');});
 it('filters before paging',()=>{const {rerender}=render(<GlassGraph nodes={nodes} edges={[]} query="Source 499"/>);expect(screen.getByRole('button',{name:'Source 499, 1 chunk'})).toBeDefined();rerender(<GlassGraph nodes={nodes} edges={[]} query="missing"/>);expect(screen.getByText(/No matches/)).toBeDefined();});
 it('preserves every edge and selection never repositions nodes',()=>{
  const three=nodes.slice(0,3),edges=[{id:'a',source:'0',target:'1',label:'uses',evidence:'Source evidence',directed:true},{id:'b',source:'1',target:'2',label:'mentioned_with',evidence:'Co-occurrence',directed:false},{id:'c',source:'2',target:'0',label:'supports',evidence:'Source evidence',directed:true}];
  const {container,rerender}=render(<GlassGraph nodes={three} edges={edges}/>);
  const before=[...container.querySelectorAll('.knowledge-node')].map(n=>n.getAttribute('transform'));
  expect(container.querySelectorAll('.graph-edge')).toHaveLength(3);expect(container.querySelectorAll('path[marker-end]')).toHaveLength(2);
  rerender(<GlassGraph nodes={three} edges={edges} selectedId="1"/>);
  expect([...container.querySelectorAll('.knowledge-node')].map(n=>n.getAttribute('transform'))).toEqual(before);
 });
 it('initializes disconnected nodes inside bounds without coincidences',()=>{const points=[...graphPositions(nodes.slice(0,8),[],900,540).values()];for(const p of points){expect(p.x).toBeGreaterThan(0);expect(p.x).toBeLessThan(900);expect(p.y).toBeGreaterThan(0);expect(p.y).toBeLessThan(540);}for(let i=0;i<points.length;i++)for(let j=i+1;j<points.length;j++)expect(Math.hypot(points[i].x-points[j].x,points[i].y-points[j].y)).toBeGreaterThan(70);});
});
describe('Markdown integrity',()=>{
 it('preserves literal symbols and blocks executable URLs',()=>{const {container}=render(<MarkdownRenderer text={'x < 5 & y > 2\n\n[bad](javascript:alert%281%29)'}/>);expect(container.textContent).toContain('x < 5 & y > 2');expect(container.querySelector('a')).toBeNull();});
 it('preserves unfinished fences and renders tables, math and nested lists',()=>{const {container,rerender}=render(<MarkdownRenderer text={'```ts\nconst x = 1;'}/>);expect(container.querySelector('code')?.textContent?.trimEnd()).toBe('const x = 1;');rerender(<MarkdownRenderer text={'| A | B |\n|---|---|\n| x | y |\n\n$x^2$\n\n- Parent\n  - Child'}/>);expect(container.querySelector('table')).not.toBeNull();expect(container.querySelector('.katex')).not.toBeNull();expect(container.querySelector('li ul li')).not.toBeNull();});
});
