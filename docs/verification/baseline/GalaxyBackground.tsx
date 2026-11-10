import { useEffect, useRef, useState } from 'react';

interface GalaxyBackgroundProps {
  className?: string;
  orbAnchorId?: string;
}

export function GalaxyBackground({ className = '', orbAnchorId = 'orbpos' }: GalaxyBackgroundProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [calm, setCalm] = useState(false);

  const fs = `
precision highp float;
uniform vec2 R; uniform float T; uniform vec3 O;
float h(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float n(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(h(i),h(i+vec2(1,0)),f.x),mix(h(i+vec2(0,1)),h(i+vec2(1,1)),f.x),f.y);}
float fbm(vec2 p){float v=0.,a=.5;mat2 m=mat2(1.6,1.2,-1.2,1.6);for(int i=0;i<5;i++){v+=a*n(p);p=m*p;a*=.5;}return v;}
void main(){
 vec2 fc=vec2(gl_FragCoord.x,R.y-gl_FragCoord.y);
 vec2 s=fc/R;vec2 p=fc/R.y*2.3;float t=T*.025;
 vec2 q=vec2(fbm(p+t),fbm(p+vec2(5.2,1.3)-t));
 vec2 r=vec2(fbm(p+3.*q+vec2(1.7,9.2)+t),fbm(p+3.*q+vec2(8.3,2.8)-t));
 float f=fbm(p+3.*r);
 vec3 c=vec3(.012,.008,.06);
 c=mix(c,vec3(.16,.07,.58),smoothstep(.25,.85,f));
 c=mix(c,vec3(.72,.14,.9),smoothstep(.5,1.,r.x)*.85);
 c=mix(c,vec3(.12,.42,1.),smoothstep(.45,1.,q.y)*.9);
 c+=vec3(0.,.55,.8)*pow(smoothstep(.55,.95,r.y),3.)*.7;
 c+=vec3(1.,.35,.7)*pow(smoothstep(.6,1.,f*r.x*1.8),3.)*.5;
 float m=.45+1.3*exp(-pow(length((s-vec2(.82,.12))*vec2(1.,.8)),2.)*3.2)+.9*exp(-pow(length(s-vec2(.04,.97)),2.)*4.5)+.5*exp(-pow(length(s-vec2(.45,.62)),2.)*6.)+.5*exp(-pow(length(s-vec2(.98,.7)),2.)*8.);
 c*=m*1.55;
 c*=1.-.55*smoothstep(.55,.8,fbm(p*1.4+9.));
 vec2 g=fc/(R.y/90.);float st=h(floor(g));vec2 fr=fract(g)-.5;
 c+=vec3(.9,.9,1.)*smoothstep(.16,0.,length(fr))*step(.965,st)*(.6+.4*sin(T*1.5+st*80.));
 vec2 o=O.xy;float rad=O.z;vec2 e=(fc-o)/rad;float d=length(e);
  vec2 drift=e+vec2(sin(T*.10)*.06,cos(T*.08)*.05);
  float wisps=fbm(drift*3.5+T*.025);
  float cloud=exp(-dot(drift*vec2(.88,1.08),drift*vec2(.88,1.08))*2.1);
  float grain=pow(fbm(drift*12.-T*.035),3.2);
  float dissolve=smoothstep(1.34,.36,d+wisps*.35);
  vec3 vapor=mix(vec3(.15,.58,1.),vec3(.86,.40,1.),wisps);
  c+=vapor*cloud*(.20+.47*grain)*dissolve;
  c+=vec3(.58,.9,1.)*pow(max(0.,1.-length(drift-vec2(-.18,-.22))*1.7),5.)*.70;
  c+=vec3(.92,.65,1.)*pow(max(0.,1.-length(drift-vec2(.27,.18))*1.9),6.)*.30;
  float mote=h(floor(fc/(R.y/180.)));
  c+=vapor*smoothstep(.985,.999,mote)*cloud*(.3+.5*sin(T+mote*50.));
 c=1.-exp(-c*1.35);c=pow(c,vec3(.9));
 gl_FragColor=vec4(c,1.);
}`;

  const vs = `attribute vec2 a;void main(){gl_Position=vec4(a,0.,1.);}`;

  useEffect(() => {
    const media = matchMedia('(prefers-reduced-motion: reduce)');
    setCalm(media.matches);
    const handler = () => setCalm(media.matches);
    media.addEventListener('change', handler);
    return () => media.removeEventListener('change', handler);
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const gl = canvas.getContext('webgl');
    if (!gl) return;

    const shader = (type: number, source: string): WebGLShader => {
      const s = gl.createShader(type)!;
      gl.shaderSource(s, source);
      gl.compileShader(s);
      return s;
    };

    const program = gl.createProgram();
    gl.attachShader(program, shader(gl.VERTEX_SHADER, vs));
    gl.attachShader(program, shader(gl.FRAGMENT_SHADER, fs));
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      console.error('WebGL link error', gl.getProgramInfoLog(program));
      return;
    }
    gl.useProgram(program);

    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const aLoc = gl.getAttribLocation(program, 'a');
    gl.enableVertexAttribArray(aLoc);
    gl.vertexAttribPointer(aLoc, 2, gl.FLOAT, false, 0, 0);

    const uR = gl.getUniformLocation(program, 'R');
    const uT = gl.getUniformLocation(program, 'T');
    const uO = gl.getUniformLocation(program, 'O');

    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    const resize = () => {
      if (!canvas) return;
      const w = Math.round(innerWidth * dpr);
      const h = Math.round(innerHeight * dpr);
      canvas.width = w;
      canvas.height = h;
      canvas.style.width = innerWidth + 'px';
      canvas.style.height = innerHeight + 'px';
      gl.viewport(0, 0, w, h);
    };

    const draw = (ms: number) => {
      if (!canvas) return;
      gl.uniform2f(uR, canvas.width, canvas.height);
      gl.uniform1f(uT, calm ? 4 : ms / 1000);

      let ox = 0, oy = 0, or = 0;
      const anchor = document.getElementById(orbAnchorId);
      if (anchor) {
        const r = anchor.getBoundingClientRect();
        ox = (r.left + r.width / 2) * dpr;
        oy = (r.top + r.height / 2) * dpr;
        or = (r.width * 0.36) * dpr;
      } else {
        ox = canvas.width * 0.82;
        oy = canvas.height * 0.12;
        or = canvas.width * 0.18;
      }
      gl.uniform3f(uO, ox, oy, or);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    };

    let raf: number;
    const loop = (ms: number) => {
      draw(ms);
      raf = requestAnimationFrame(loop);
    };

    resize();
    window.addEventListener('resize', resize);

    if (calm) {
      draw(0);
      window.addEventListener('scroll', () => draw(0));
    } else {
      raf = requestAnimationFrame(loop);
    }

    return () => {
      window.removeEventListener('resize', resize);
      window.removeEventListener('scroll', () => draw(0));
      cancelAnimationFrame(raf);
      gl.deleteProgram(program);
      gl.deleteBuffer(buf);
      gl.deleteShader(shader(gl.VERTEX_SHADER, vs));
      gl.deleteShader(shader(gl.FRAGMENT_SHADER, fs));
    };
  }, [calm, orbAnchorId, fs, vs]);

  return (
    <canvas
      ref={canvasRef}
      id="gl"
      aria-hidden="true"
      className={className}
      style={{
        position: 'fixed',
        inset: 0,
        width: '100%',
        height: '100%',
        zIndex: 0,
        pointerEvents: 'none',
        display: 'block',
      }}
    />
  );
}

