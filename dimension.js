/*
  PVR · Dimensiones — paso entre páginas.
  Al salir: la página se desvanece en partículas y humo (tres variantes: Ceniza, Niebla, Grano; ver VELO).
  Al entrar: el humo se abre y las partículas se dispersan dejando ver la página nueva.
  También dibuja el fondo "ambiente" (humo con profundidad, partículas finas, grano) de las páginas secundarias.
  WebGL 1 sin librerías. Si no hay WebGL o se pide menos movimiento, hace un fundido simple.

  Uso:
    <a href="mastering.html" data-dim>…</a>        → cualquier link con data-dim cruza de dimensión
    PVRDim.init({ entry:'always' | 'flag', ready: Promise })
    PVRDim.ambient(canvas, { variant: 0 | 1, over })  → 0 = estudio (ondas), 1 = clases (órbitas); over: humo transparente por encima de otra capa
*/
(function(){
  'use strict';
  var KEY = 'pvr-dim';
  var reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  var touch = matchMedia('(hover: none)').matches;
  var DPR = Math.min(devicePixelRatio || 1, touch ? 1.25 : 1.5);
  var VDPR = Math.min(DPR, 1, 1920/Math.max(innerWidth, 1));   // el velo se calcula a menos resolución: las grietas son pesadas
  var root = document.documentElement;

  var NOISE = [
    'float h21(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}',
    'float vn(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(h21(i),h21(i+vec2(1,0)),f.x),mix(h21(i+vec2(0,1)),h21(i+vec2(1,1)),f.x),f.y);}',
    'float fbm(vec2 p){float a=.5,s=0.;for(int i=0;i<5;i++){s+=a*vn(p);p=p*2.03+vec2(3.1,1.7);a*=.5;}return s;}'
  ].join('\n');

  function compile(gl, vs, fs){
    function sh(type, src){ var s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s);
      if(!gl.getShaderParameter(s, gl.COMPILE_STATUS)){ console.warn(gl.getShaderInfoLog(s)); return null; } return s; }
    var p = gl.createProgram(), a = sh(gl.VERTEX_SHADER, vs), b = sh(gl.FRAGMENT_SHADER, fs);
    if(!a || !b) return null;
    gl.attachShader(p, a); gl.attachShader(p, b); gl.linkProgram(p);
    if(!gl.getProgramParameter(p, gl.LINK_STATUS)){ console.warn(gl.getProgramInfoLog(p)); return null; }
    var u = {}, n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
    for(var i=0;i<n;i++){ var nm = gl.getActiveUniform(p, i).name; u[nm] = gl.getUniformLocation(p, nm); }
    return {p:p, u:u};
  }
  function getGL(c, opts){
    try{ return c.getContext('webgl', opts) || c.getContext('experimental-webgl', opts); }catch(e){ return null; }
  }
  function quadBuf(gl){ var b = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, b); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1, 1,-1, -1,1, 1,1]), gl.STATIC_DRAW); return b; }
  function seedBuf(gl, n){
    var a = new Float32Array(n*3);
    for(var i=0;i<a.length;i++) a[i] = Math.random();
    var b = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, b); gl.bufferData(gl.ARRAY_BUFFER, a, gl.STATIC_DRAW); return b;
  }
  function ease(x){ return x<.5 ? 4*x*x*x : 1 - Math.pow(-2*x+2, 3)/2; }

  // ============================== VELO (transición): la página se desvanece en partículas y humo ==============================
  // Tres variantes (MODE), todas sutiles:
  //   0 · Ceniza  — la página se deshace desde el clic en polvo fino que sube, y el humo ocupa su lugar
  //   1 · Niebla  — un humo lento sube desde abajo y se la traga; quedan motas flotando
  //   2 · Grano   — la imagen se desgrana en puntitos (como grano de película) que se dispersan de costado
  var VEIL_VS = 'attribute vec2 p; void main(){ gl_Position = vec4(p,0.,1.); }';
  // P: 0 = nada cubierto · 1 = todo cubierto. INV = 1 al entrar: el orden se invierte (se libera primero lo último)
  var VEIL_FS = [
    'precision highp float;',
    'uniform vec2 R; uniform vec2 C; uniform float T; uniform float P; uniform float INV; uniform float MODE; uniform float PX;',
    NOISE,
    'void main(){',
    '  vec2 uv = gl_FragCoord.xy/R; float asp = R.x/R.y;',
    '  vec2 q = uv*vec2(asp,1.), c = C*vec2(asp,1.);',
    '  float d = length(q - c);',
    // el humo siempre sube despacio
    '  vec2 sq = q*1.7 + vec2(0., -T*.16);',
    '  float n = fbm(sq + fbm(sq*1.6 + T*.05)*1.2);',
    '  float f, W, MX;',
    '  if(MODE < .5){ f = clamp(d*.55, 0., 1.)*.65 + fbm(q*3.2 + T*.06)*.55; W = .1; MX = 1.2; }',
    '  else if(MODE < 1.5){ f = uv.y*.75 + n*.55; W = .22; MX = 1.3; }',
    '  else { vec2 cell = floor(gl_FragCoord.xy/(3.*PX)); f = mix(h21(cell), fbm(q*3.5), .55) + clamp(d*.55,0.,1.)*.35; W = .025; MX = 1.25; }',
    '  if(INV > .5) f = MX - f;',
    '  float thr = P*(MX + 2.*W) - W;',
    '  float cover = smoothstep(f - W, f + W, thr);',
    '  float front = cover*(1. - cover)*4.;',
    // humo: gris muy oscuro con volumen; en el frente se ve más claro, como polvo en suspensión
    '  float sm = fbm(sq*1.3 + vec2(n*1.4, 0.));',
    '  vec3 col = vec3(.006) + vec3(.17,.17,.165)*pow(sm, 2.3)*1.5;',
    '  col += front*vec3(.5,.5,.48)*(MODE > 1.5 ? .25 : .55)*pow(fbm(q*9. + T*.3), 1.5);',
    '  float gr = fract(sin(dot(gl_FragCoord.xy + fract(T*7.)*91.7, vec2(12.9898,78.233)))*43758.5453) - .5;',
    '  col += gr*.045;',
    // el borde no es una línea: es un velo que se espesa
    '  float a = clamp(cover + front*.25, 0., 1.);',
    '  gl_FragColor = vec4(col*a, a);',
    '}'
  ].join('\n');

  // partículas: se sueltan cuando pasa el frente y se van (suben, flotan o se dispersan según la variante)
  var PART_VS = [
    'attribute vec3 s;',
    'uniform vec2 R; uniform vec2 C; uniform float T; uniform float K; uniform float INV; uniform float DPR; uniform float MODE;',
    'varying float vA; varying float vM;',
    'void main(){',
    '  float asp = R.x/R.y;',
    '  vec2 p0 = s.xy; float d = length((p0 - C)*vec2(asp,1.));',
    '  float f, MX;',
    '  if(MODE < .5){ f = clamp(d*.55, 0., 1.)*.65 + s.z*.5; MX = 1.2; }',
    '  else if(MODE < 1.5){ f = p0.y*.75 + s.z*.5; MX = 1.3; }',
    '  else { f = s.z*.6 + clamp(d*.55,0.,1.)*.35; MX = 1.25; }',
    '  if(INV > .5) f = MX - f;',
    '  float k = clamp((K*(MX + .2) - f)/.8, 0., 1.);',
    '  vec2 p = p0; float al = 1., sz = 1.;',
    '  if(MODE < .5){ p += vec2(sin(T*1.7 + s.x*30.)*.012 + (s.y-.5)*.05*k, (.12 + .22*s.y)*k); sz = 1. + 1.8*s.z*s.z; }',
    '  else if(MODE < 1.5){ p += vec2(sin(T*.8 + s.x*20.)*.02*k, .1*k); al = .55; sz = .9 + 1.6*s.z*s.z; }',
    '  else { p += vec2((s.y-.5)*.16*k, (s.x-.5)*.03*k); al = .8; sz = 1.4 + 1.2*s.z; }',
    '  gl_Position = vec4(p*2.-1., 0., 1.);',
    '  vA = sin(k*3.14159)*(.3 + .6*s.z)*al;',
    '  vM = MODE;',
    '  gl_PointSize = sz*DPR;',
    '}'
  ].join('\n');
  var SHARD_FS = [
    'precision mediump float; varying float vA; varying float vM;',
    'void main(){ vec2 c = gl_PointCoord - .5; float a = vM > 1.5 ? step(max(abs(c.x),abs(c.y)), .42) : smoothstep(.5, .1, length(c));',
    '  a *= vA; gl_FragColor = vec4(vec3(.92,.92,.9)*a, a); }'
  ].join('\n');
  var PART_FS = [
    'precision mediump float; varying float vA;',
    'void main(){ vec2 c = gl_PointCoord - .5; float d = length(c); float a = smoothstep(.5, .1, d)*vA; gl_FragColor = vec4(vec3(.95,.95,.92)*a, a); }'
  ].join('\n');

  // variante elegida: se guarda en el navegador (selector de prueba, solo en local). Por defecto: Ceniza
  var TR_NAMES = ['Ceniza', 'Niebla', 'Grano'];
  var TR = 0;
  try{ var tq = new URLSearchParams(location.search).get('tr'); if(tq !== null) localStorage.setItem('pvr-tr', tq); TR = +(localStorage.getItem('pvr-tr') || 0) || 0; }catch(e){}
  if(!(TR >= 0 && TR <= 2)) TR = 0;

  var veil = null;
  function makeVeil(){
    if(veil) return veil;
    var c = document.createElement('canvas');
    c.className = 'dim-veil'; c.setAttribute('aria-hidden', 'true');
    c.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;z-index:120;pointer-events:none;display:block';
    document.body.appendChild(c);
    var gl = getGL(c, {premultipliedAlpha:true, alpha:true, antialias:false});
    var v = {c:c, gl:gl, ok:false};
    if(gl){
      v.q = compile(gl, VEIL_VS, VEIL_FS);
      v.pt = compile(gl, PART_VS, SHARD_FS);
      if(v.q && v.pt){
        v.qb = quadBuf(gl); v.n = touch ? 700 : 1600; v.sb = seedBuf(gl, v.n); v.ok = true;
      }
    }
    if(!v.ok){ c.style.background = '#000'; c.style.opacity = '0'; c.style.transition = 'opacity .6s'; }
    v.size = function(){ var w = Math.round(innerWidth*VDPR), h = Math.round(innerHeight*VDPR); if(c.width !== w || c.height !== h){ c.width = w; c.height = h; } };
    v.draw = function(t, P, K, inv, cx, cy){
      if(!v.ok){ c.style.opacity = String(P); return; }
      v.size(); gl.viewport(0, 0, c.width, c.height);
      gl.clearColor(0,0,0,0); gl.clear(gl.COLOR_BUFFER_BIT);
      gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
      gl.useProgram(v.q.p);
      gl.uniform2f(v.q.u.R, c.width, c.height); gl.uniform2f(v.q.u.C, cx, cy);
      gl.uniform1f(v.q.u.T, t); gl.uniform1f(v.q.u.P, P); gl.uniform1f(v.q.u.INV, inv); gl.uniform1f(v.q.u.MODE, TR); gl.uniform1f(v.q.u.PX, VDPR);
      gl.bindBuffer(gl.ARRAY_BUFFER, v.qb); var lp = gl.getAttribLocation(v.q.p, 'p');
      gl.enableVertexAttribArray(lp); gl.vertexAttribPointer(lp, 2, gl.FLOAT, false, 0, 0);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4); gl.disableVertexAttribArray(lp);
      if(K > 0 && K < 1){
        gl.blendFunc(gl.ONE, gl.ONE);
        gl.useProgram(v.pt.p);
        gl.uniform2f(v.pt.u.R, c.width, c.height); gl.uniform2f(v.pt.u.C, cx, cy);
        gl.uniform1f(v.pt.u.T, t); gl.uniform1f(v.pt.u.K, K); gl.uniform1f(v.pt.u.INV, inv); gl.uniform1f(v.pt.u.DPR, DPR); gl.uniform1f(v.pt.u.MODE, TR);
        gl.bindBuffer(gl.ARRAY_BUFFER, v.sb); var ls = gl.getAttribLocation(v.pt.p, 's');
        gl.enableVertexAttribArray(ls); gl.vertexAttribPointer(ls, 3, gl.FLOAT, false, 0, 0);
        gl.drawArrays(gl.POINTS, 0, v.n); gl.disableVertexAttribArray(ls);
      }
    };
    veil = v; return v;
  }
  function dropVeil(){
    if(!veil) return;
    var ext = veil.gl && veil.gl.getExtension('WEBGL_lose_context'); if(ext) ext.loseContext();
    veil.c.remove(); veil = null;
  }

  var busy = false;
  // reloj de pared: la página nueva sigue el humo exactamente donde lo dejó la anterior (mismo dibujo, mismo momento)
  function clk(){ return (Date.now() % 1000000)/1000; }
  // salir: cubre desde (cx,cy) y navega
  function leave(href, cx, cy){
    if(busy) return; busy = true;
    try{ sessionStorage.setItem(KEY, JSON.stringify({t:Date.now(), x:cx, y:cy})); }catch(e){}
    if(reduce){
      var f = makeVeil(); f.c.style.pointerEvents = 'auto';
      if(f.ok){ var t0r = performance.now(); (function fr(now){ var p = Math.min(1,(now-t0r)/320); f.draw(clk(), .2+p*.8, 0, 0, .5, .5); if(p<1) requestAnimationFrame(fr); else location.href = href; })(t0r); }
      else { requestAnimationFrame(function(){ f.c.style.opacity = '1'; }); setTimeout(function(){ location.href = href; }, 340); }
      return;
    }
    var v = makeVeil(); v.c.style.pointerEvents = 'auto';
    root.classList.add('dim-out');
    var D = TR === 1 ? 1500 : 1300, t0 = performance.now();
    // al terminar se navega, pero el humo sigue moviéndose hasta que la página nueva lo reemplaza: no hay corte
    var went = false, gone = false;
    addEventListener('pagehide', function(){ gone = true; }, {once:true});
    (function frame(now){
      var k = Math.min(1, (now - t0)/D);
      v.draw(clk(), ease(k), k, 0, cx, cy);
      if(k >= 1 && !went){ went = true; location.href = href; }
      if(!gone) requestAnimationFrame(frame);
    })(t0);
  }

  // entrar: la página arranca cubierta y el humo se abre desde el punto
  function arrive(ready, cx, cy, o_wait){
    o_wait = o_wait || 3200;
    var v = makeVeil();
    root.classList.add('dim-in');
    v.draw(clk(), 1, 0, 1, cx, cy);   // primer cuadro ya con el humo: sale en el primer pintado de la página
    var t0 = performance.now(), go = 0, started = false;
    function loop(now){
      if(!started){ v.draw(clk(), 1, 0, 1, cx, cy); requestAnimationFrame(loop); return; }
      var D = reduce ? 420 : (TR === 1 ? 1600 : 1400), k = Math.min(1, (now - go)/D);
      if(k > .12) root.classList.remove('dim-in');
      v.draw(clk(), 1 - ease(k), reduce ? 0 : k, 1, cx, cy);
      if(k < 1) requestAnimationFrame(loop); else { dropVeil(); busy = false; }
    }
    requestAnimationFrame(loop);
    var fired = false;
    function start(){ if(fired) return; fired = true; go = performance.now() + 60; started = true; }
    Promise.resolve(ready).then(start, start);
    setTimeout(start, o_wait);   // nunca se queda trabado
  }

  function onClick(e){
    var a = e.target.closest && e.target.closest('a[data-dim]');
    if(!a || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    if(a.target && a.target !== '_self') return;
    var url = new URL(a.href, location.href);
    if(url.origin !== location.origin) return;
    if(url.pathname === location.pathname && url.hash){ return; }   // ancla dentro de la misma página: scroll normal
    e.preventDefault();
    var sheet = document.getElementById('sheet'); if(sheet && !sheet.hidden){ sheet.hidden = true; }
    var x = e.clientX || innerWidth/2, y = e.clientY || innerHeight/2;
    if(!e.clientX && !e.clientY){ var r = a.getBoundingClientRect(); x = r.left + r.width/2; y = r.top + r.height/2; }
    leave(url.href, x/innerWidth, 1 - y/innerHeight);
  }

  // selector de prueba de transiciones: solo aparece viendo la web en local
  function picker(){
    if(!/^(localhost|127\.0\.0\.1)$/.test(location.hostname)) return;
    var box = document.createElement('div');
    box.setAttribute('role', 'group'); box.setAttribute('aria-label', 'Probar transición');
    box.style.cssText = 'position:fixed;left:12px;bottom:12px;z-index:110;display:flex;gap:6px;align-items:center;padding:6px 8px;background:rgba(0,0,0,.75);border:1px solid rgba(239,238,234,.2);font:11px/1 "JetBrains Mono",monospace;letter-spacing:.12em;text-transform:uppercase;color:#8d8c88';
    box.appendChild(document.createTextNode('Transición'));
    TR_NAMES.forEach(function(name, i){
      var b = document.createElement('button'); b.type = 'button'; b.textContent = (i+1) + ' ' + name;
      b.style.cssText = 'font:inherit;letter-spacing:inherit;text-transform:inherit;padding:6px 8px;border:1px solid ' + (i === TR ? '#efeeea' : 'rgba(239,238,234,.2)') + ';background:' + (i === TR ? '#efeeea' : 'none') + ';color:' + (i === TR ? '#000' : '#efeeea') + ';cursor:pointer';
      b.addEventListener('click', function(e){
        try{ localStorage.setItem('pvr-tr', String(i)); }catch(_){}
        TR = i; leave(location.href.split('#')[0], e.clientX/innerWidth, 1 - e.clientY/innerHeight);
      });
      box.appendChild(b);
    });
    document.body.appendChild(box);
  }

  function init(o){
    o = o || {};
    document.addEventListener('click', onClick);
    picker();
    // al volver con el botón atrás (bfcache) la página tiene que aparecer limpia
    addEventListener('pageshow', function(e){ if(e.persisted){ dropVeil(); busy = false; root.classList.remove('dim-out','dim-in'); } });
    var flag = null;
    try{ flag = JSON.parse(sessionStorage.getItem(KEY) || 'null'); sessionStorage.removeItem(KEY); }catch(e){}
    var fresh = flag && (Date.now() - flag.t) < 9000;
    if(fresh) root.classList.add('dim-arrived');
    if(fresh || o.entry === 'always'){
      var cx = .5, cy = .5;
      // la portada espera a su escena 3D; las secundarias solo a la tipografía (máximo 1,4 s)
      arrive(o.ready || (document.fonts ? document.fonts.ready : null), cx, cy, o.ready ? 3200 : 900);
    }
  }

  // ============================== AMBIENTE (fondo de páginas secundarias) ==============================
  var AMB_FS = [
    'precision highp float;',
    'uniform vec2 R; uniform float T; uniform float S; uniform vec2 M; uniform float V; uniform float OV;',
    NOISE,
    'void main(){',
    '  vec2 uv = gl_FragCoord.xy/R; float asp = R.x/R.y; vec2 p = (uv-.5)*vec2(asp,1.);',
    '  vec3 col = vec3(.0); float fa = 0.;',
    // capas de niebla a distintas profundidades: cada una se mueve distinto con el scroll
    '  for(int i=0;i<4;i++){',
    '    float z = float(i);',
    '    float sc = 1.1 + z*.75;',
    '    vec2 q = p*sc + vec2(T*(.012+z*.006), -S*(.15+z*.22) + T*.008*z);',
    '    q += (M - .5)*vec2(asp,1.)*(.03 + z*.025);',
    '    float n = fbm(q + fbm(q*1.7 + T*.03)*1.3);',
    '    float dens = smoothstep(OV > .5 ? .34 : .42, 1.0, n);',
    '    col += vec3(.1,.1,.098)*dens*(1. - z*.18);',
    '    fa += dens*(1. - z*.18);',
    '  }',
    // dimensión: 0 = estudio (ondas horizontales, como un espectro hecho de humo) · 1 = clases (órbitas)
    '  float w = 0.;',
    '  if(V < .5){',
    '    for(int i=0;i<7;i++){',
    '      float k = float(i);',
    '      float y = (k - 3.)*.13 + S*.08;',
    '      float amp = .02 + .03*fbm(vec2(p.x*1.5 + T*.2, k*3.1));',
    '      float wave = y + sin(p.x*(6. + k*1.7) + T*(.6 + k*.12))*amp + (fbm(vec2(p.x*4. - T*.3, k))-.5)*.05;',
    '      w += exp(-pow((p.y - wave)*R.y*.55, 2.))*(.08 + .05*fbm(vec2(p.x*3. + T, k)));',
    '    }',
    '  } else {',
    '    vec2 c = p - vec2(.18*asp, .05 - S*.1);',
    '    float r = length(c*vec2(1., 2.4)); float a = atan(c.y, c.x);',
    '    for(int i=0;i<6;i++){',
    '      float k = float(i); float rr = .12 + k*.11;',
    '      float dash = smoothstep(.3,.7, fbm(vec2(a*3. + T*(.1 + k*.03)*(mod(k,2.)*2.-1.), k*4.)));',
    '      w += exp(-pow((r - rr)*R.y*.5, 2.))*(.05 + .1*dash);',
    '    }',
    '  }',
    '  col += w*vec3(.92,.92,.9)*smoothstep(1.2,.1,length(p));',
    // halo del cursor: abre la niebla
    '  float mh = smoothstep(.35, 0., length((uv - M)*vec2(asp,1.)));',
    '  col *= 1. - mh*.35; fa *= 1. - mh*.45;',
    // viñeta y grano fino
    '  float vig = smoothstep(1.25, .25, length(p*vec2(.8,1.)));',
    '  col *= vig;',
    '  float g = fract(sin(dot(gl_FragCoord.xy + fract(T*9.)*113.1, vec2(12.9898,78.233)))*43758.5453) - .5;',
    '  col += g*.045;',
    '  if(OV > .5){ float a = clamp(fa*.8 + w*.9 + (1. - vig)*.9, 0., .95); gl_FragColor = vec4(max(col, 0.), a); }',
    '  else gl_FragColor = vec4(max(col, 0.), 1.);',
    '}'
  ].join('\n');
  var AMB_PART_VS = [
    'attribute vec3 s;',
    'uniform vec2 R; uniform float T; uniform float S; uniform float DPR;',
    'varying float vA;',
    'void main(){',
    '  float z = s.z;',
    '  float x = fract(s.x + T*.004*(1.+z) + sin(T*.2 + s.y*20.)*.002);',
    '  float y = fract(s.y + T*.006*(.4+z) + S*(.12 + z*.5));',
    '  gl_Position = vec4(x*2.-1., y*2.-1., 0., 1.);',
    '  vA = (.08 + .5*z*z)*(.6 + .4*sin(T*1.7 + s.x*60.));',
    '  gl_PointSize = (.7 + 2.2*z*z)*DPR;',
    '}'
  ].join('\n');

  function ambient(c, o){
    o = o || {};
    var gl = o.over ? getGL(c, {alpha:true, antialias:false, premultipliedAlpha:true}) : getGL(c, {alpha:false, antialias:false, premultipliedAlpha:false});
    if(!gl){ c.style.background = '#000'; return; }
    var q = compile(gl, VEIL_VS, AMB_FS), pt = compile(gl, AMB_PART_VS, PART_FS);
    if(!q || !pt){ c.style.background = '#000'; return; }
    var qb = quadBuf(gl), n = touch ? 500 : 1400, sb = seedBuf(gl, n);
    var scale = touch ? .75 : 1;   // el humo es suave: se puede dibujar a menos resolución
    var mx = .5, my = .5, tx = .5, ty = .5, sc = 0, run = true;
    addEventListener('pointermove', function(e){ tx = e.clientX/innerWidth; ty = 1 - e.clientY/innerHeight; }, {passive:true});
    document.addEventListener('visibilitychange', function(){ run = !document.hidden; if(run) requestAnimationFrame(frame); });
    function size(){ var w = Math.round(innerWidth*DPR*scale), h = Math.round(innerHeight*DPR*scale); if(c.width !== w || c.height !== h){ c.width = w; c.height = h; } }
    var t = 0, last = performance.now();
    function frame(now){
      if(!run) return;
      var dt = Math.min(.05, (now - last)/1000); last = now; t += reduce ? dt*.2 : dt;
      mx += (tx - mx)*.05; my += (ty - my)*.05;
      var s = scrollY/Math.max(1, innerHeight); sc += (s - sc)*.08;
      size(); gl.viewport(0, 0, c.width, c.height);
      gl.disable(gl.BLEND);
      if(o.over){ gl.clearColor(0,0,0,0); gl.clear(gl.COLOR_BUFFER_BIT); }
      gl.useProgram(q.p);
      gl.uniform2f(q.u.R, c.width, c.height); gl.uniform1f(q.u.T, t); gl.uniform1f(q.u.S, sc);
      gl.uniform2f(q.u.M, mx, my); gl.uniform1f(q.u.V, o.variant || 0); gl.uniform1f(q.u.OV, o.over ? 1 : 0);
      gl.bindBuffer(gl.ARRAY_BUFFER, qb); var lp = gl.getAttribLocation(q.p, 'p');
      gl.enableVertexAttribArray(lp); gl.vertexAttribPointer(lp, 2, gl.FLOAT, false, 0, 0);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4); gl.disableVertexAttribArray(lp);
      gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE);
      gl.useProgram(pt.p);
      gl.uniform2f(pt.u.R, c.width, c.height); gl.uniform1f(pt.u.T, t); gl.uniform1f(pt.u.S, sc); gl.uniform1f(pt.u.DPR, DPR*scale);
      gl.bindBuffer(gl.ARRAY_BUFFER, sb); var ls = gl.getAttribLocation(pt.p, 's');
      gl.enableVertexAttribArray(ls); gl.vertexAttribPointer(ls, 3, gl.FLOAT, false, 0, 0);
      gl.drawArrays(gl.POINTS, 0, n); gl.disableVertexAttribArray(ls);
      requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
  }

  // _frame: dibuja un cuadro fijo del velo (solo para revisar el efecto); _clear lo saca
  window.PVRDim = {init:init, ambient:ambient, leave:leave,
    _frame:function(P, K, inv, cx, cy){ var v = makeVeil(); v.draw(clk(), P, K, inv ? 1 : 0, cx == null ? .5 : cx, cy == null ? .5 : cy); },
    _clear:function(){ dropVeil(); }};
})();
