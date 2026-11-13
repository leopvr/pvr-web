/*
  PVR · escena de las páginas secundarias (Mezcla y mastering · Clases).
  Los fondos generados con herramientas/fondos.py (los mismos del collage del presskit) convertidos en partículas
  finas: cada punto toma el brillo de la imagen, tiene relieve, los bordes se desprenden como polvo y el cursor
  los deshace. Además, cadenas con espinas colgando como en el presskit.
  Cada figura se dibuja exactamente encima de su hueco en el HTML:
    <div class="art" data-art="fondo" data-src="img/fondo/fondo-05.jpg" data-gain="1"></div>
    <div class="art" data-art="cadena"></div>
*/
import * as THREE from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';

const V3 = THREE.Vector3, V2 = THREE.Vector2;
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
const touch = matchMedia('(hover: none)').matches;

const canvas = document.getElementById('art');
const renderer = new THREE.WebGLRenderer({canvas, antialias:true, alpha:true, powerPreference:'high-performance'});
renderer.setPixelRatio(Math.min(devicePixelRatio, touch ? 1.5 : 2));
renderer.setClearColor(0x000000, 0);
renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = .95;
renderer.setScissorTest(true);
const PR = renderer.getPixelRatio();

// ---------- estudio negro con tiras de luz suave: reflejos del cromo de las cadenas ----------
const env = (()=>{
  const s = new THREE.Scene(); s.background = new THREE.Color(0x000000);
  const strip = (w,h,x,y,z,ry=0,rx=0,k=1)=>{ const m = new THREE.Mesh(new THREE.PlaneGeometry(w,h), new THREE.MeshBasicMaterial({color:new THREE.Color(k,k,k), side:THREE.DoubleSide})); m.position.set(x,y,z); m.rotation.set(rx,ry,0); s.add(m); };
  strip(10, 1.2, 0, 7, 0, 0, Math.PI/2, 2.2);
  strip(.8, 9, -7, 0, 1, Math.PI/2, 0, 1.6);
  strip(.5, 9, 7, 1, -2, -Math.PI/2, 0, 1.1);
  strip(6, .35, 0, -1, -8, 0, 0, .9);
  return new THREE.PMREMGenerator(renderer).fromScene(s, .02).texture;
})();
const grime = (()=>{
  const S = 256, c = document.createElement('canvas'); c.width = c.height = S; const g = c.getContext('2d'), im = g.createImageData(S,S);
  for(let i=0;i<im.data.length;i+=4){ const v = 130 + Math.random()*60 + (Math.random()<.04 ? 50 : 0); im.data[i]=im.data[i+1]=im.data[i+2]=v; im.data[i+3]=255; }
  g.putImageData(im,0,0); const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(3,3); return t;
})();
const chainMat = new THREE.MeshPhysicalMaterial({color:0xa8a8a8, metalness:1, roughness:.2, roughnessMap:grime, bumpMap:grime, bumpScale:.6, envMap:env, envMapIntensity:1.7, clearcoat:.3, clearcoatRoughness:.25});

// ================= fondo generado → partículas =================
const texLoader = new THREE.TextureLoader();
const NOISE = `
float h21(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float vn(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(h21(i),h21(i+vec2(1,0)),f.x),mix(h21(i+vec2(0,1)),h21(i+vec2(1,1)),f.x),f.y);}
float lum(vec3 c){return dot(c,vec3(.299,.587,.114));}
`;
function fondo(el){
  const r = el.getBoundingClientRect();
  const N = Math.round(THREE.MathUtils.clamp(Math.min(r.width, r.height)/(touch ? 3 : 2.4), 110, touch ? 190 : 300));
  const uvs = new Float32Array(N*N*2), rnd = new Float32Array(N*N);
  for(let j=0,k=0;j<N;j++) for(let i=0;i<N;i++,k++){ uvs[k*2] = (i + Math.random())/N; uvs[k*2+1] = (j + Math.random())/N; rnd[k] = Math.random(); }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(N*N*3), 3));
  g.setAttribute('uvp', new THREE.BufferAttribute(uvs, 2)); g.setAttribute('rnd', new THREE.BufferAttribute(rnd, 1));
  const U = {map:{value:null}, time:{value:0}, mouse:{value:new V2(9,9)}, pr:{value:PR}, inv:{value:0}, size:{value:new V2(1,1)},
    gain:{value:+(el.dataset.gain || 1)}, lv:{value:new V2(0,1)}, seed:{value:Math.random()*10}, dens:{value:Math.min(1.6, 300/N)}};
  const pts = new THREE.Points(g, new THREE.ShaderMaterial({
    uniforms:U, transparent:true, depthWrite:false, blending:THREE.AdditiveBlending,
    vertexShader:NOISE+`
      attribute vec2 uvp; attribute float rnd;
      uniform sampler2D map; uniform float time,pr,inv,gain,seed,dens; uniform vec2 mouse,size,lv; varying float vA;
      void main(){
        float l=lum(textureLod(map,uvp,1.6).rgb); if(inv>.5) l=1.-l;     // un poco desenfocada: las líneas finas también dan puntos
        l=clamp((l-lv.x)/(lv.y-lv.x),0.,1.5);                              // nivelada: 0 = gris del fondo, 1 = lo más claro
        l=smoothstep(.05,.6,l);                                           // sin fondo: el gris de base no da puntos
        // borde orgánico: hacia afuera la imagen se suelta en polvo
        float e=smoothstep(.88,.4,length(uvp-.5)*2.);
        e*=smoothstep(.15,.65,vn(uvp*3.2+seed+time*.04)+.4*e);
        float det=1.-e;
        float life=fract(time*(.02+.05*rnd)+rnd*7.);
        vec3 p=vec3((uvp-.5)*2.*size, l*.28 + sin(time*.5+uvp.x*5.+seed)*.03);
        p.y+=det*life*.75*size.y; p.x+=det*(sin(life*5.+rnd*9.)*.1 + (rnd-.5)*.35*life);
        p.z+=det*(rnd-.5)*.8*life;
        p.y-=sin(time*.3+uvp.x*9.+seed)*.012*l;                       // estela muy leve, como en el collage
        vec2 d=p.xy-mouse; float f=smoothstep(.5,0.,length(d)); float a=rnd*6.2831+time*1.6;
        p.xy+=(vec2(cos(a),sin(a*1.31))*.05+normalize(d+1e-4)*.12)*f;
        p.z+=f*.25*(rnd-.5);
        vA=pow(l,1.15)*gain*(.45+.55*rnd)*mix(1.,(1.-life)*.9,det)*(.25+.75*e+det*.4)*(1.-f*.35);
        vA*=.8*dens;
        gl_PointSize=(1.+rnd*.9+f*2.2)*pr;
        gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.);
      }`,
    fragmentShader:`varying float vA; void main(){ float d=length(gl_PointCoord-.5); gl_FragColor=vec4(vec3(vA*smoothstep(.5,.12,d)),1.); }`
  }));
  pts.frustumCulled = false;
  // debajo, la imagen misma como en el collage del presskit: blanco y negro, barrida, con bordes rotos;
  // donde pasa el cursor se apaga y quedan solo las partículas
  const plane = new THREE.Mesh(new THREE.PlaneGeometry(2,2), new THREE.ShaderMaterial({
    uniforms:U, transparent:true, depthWrite:false, blending:THREE.AdditiveBlending,
    vertexShader:`varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }`,
    fragmentShader:NOISE+`
      uniform sampler2D map; uniform float time,inv,gain,seed; uniform vec2 mouse,size,lv; varying vec2 vUv;
      float px(vec2 uv, float lod){ float l=lum(textureLod(map,uv,lod).rgb); if(inv>.5) l=1.-l; return clamp((l-lv.x)/(lv.y-lv.x),0.,1.6); }
      void main(){
        vec2 uv=vUv; uv.x+=(vn(vec2(uv.y*3.+seed,time*.08))-.5)*.012;
        float sharp=px(uv,1.), soft=px(uv,3.2), halo=px(uv,5.5);
        float l=max(sharp*.45, soft*.85) + halo*.55;                      // difuminada, con un halo que respira
        float s=smoothstep(.06,.6,l)*min(l,1.3);                          // recorte: el fondo gris desaparece
        float e=smoothstep(.84,.32,length(vUv-.5)*2.);                    // sin rectángulo: se funde en redondo antes del borde
        e*=smoothstep(.2,.65,vn(vUv*2.6+seed+time*.04)+.45*e);
        vec2 pp=(vUv-.5)*2.*size; float f=smoothstep(.55,0.,length(pp-mouse));
        float g=fract(sin(dot(gl_FragCoord.xy+fract(time*7.)*91.7,vec2(12.9898,78.233)))*43758.5453);
        gl_FragColor=vec4(vec3(s*e*.5*gain*(1.-f*.6)*(.88+.24*g)),1.);
      }`
  }));
  plane.renderOrder = -1;
  const grp = new THREE.Group(); grp.add(plane); grp.add(pts); grp.visible = false; grp.userData.U = U;
  texLoader.load(el.dataset.src, tex=>{
    // se mide cada imagen: el gris del fondo (mediana) y lo más claro, para recortarla y nivelarla igual que las demás
    const S = 64, im = tex.image, cv = document.createElement('canvas'); cv.width = cv.height = S;
    const x = cv.getContext('2d'); x.drawImage(im,0,0,S,S); const d = x.getImageData(0,0,S,S).data, L = [];
    for(let k=0;k<d.length;k+=4) L.push((d[k]*.299+d[k+1]*.587+d[k+2]*.114)/255);
    const mean = L.reduce((a,b)=>a+b,0)/L.length, inv = mean > .5;
    const V = L.map(v=> inv ? 1-v : v).sort((a,b)=>a-b);
    U.inv.value = inv ? 1 : 0;                                           // los de fondo blanco se invierten
    const bg = V[Math.floor(V.length*.5)], hi = Math.max(bg + .08, V[Math.floor(V.length*.995)]);
    U.lv.value.set(bg + .015, hi);
    const a = im.width/im.height; U.size.value.set(a > 1 ? 1 : a, a > 1 ? 1/a : 1);
    plane.scale.set(U.size.value.x, U.size.value.y, 1);
    tex.minFilter = THREE.LinearMipmapLinearFilter; tex.needsUpdate = true;
    U.map.value = tex; grp.visible = true;
  });
  return grp;
}

// ================= eslabón con espinas (el mismo del presskit) =================
const UP = new V3(0,1,0);
class Stadium extends THREE.Curve{
  constructor(lc,wc){ super(); this.R = wc/2; this.s = lc-wc; this.P = 2*this.s + 2*Math.PI*this.R; }
  getPoint(t, out = new V3()){
    let d = t*this.P; const R = this.R, s = this.s;
    if(d < s) return out.set(R, -s/2+d, 0); d -= s;
    if(d < Math.PI*R){ const a = d/R; return out.set(R*Math.cos(a), s/2+R*Math.sin(a), 0); } d -= Math.PI*R;
    if(d < s) return out.set(-R, s/2-d, 0); d -= s;
    const a = Math.PI + d/R; return out.set(R*Math.cos(a), -s/2+R*Math.sin(a), 0);
  }
}
const LL = .5, LW = .3, LR = .046, PITCH = LL - 4*LR;
function cone(h, rad, bend, seg){
  const g = new THREE.ConeGeometry(rad, h, seg, 6); g.translate(0, h/2, 0);
  const p = g.attributes.position;
  for(let i=0;i<p.count;i++){ const y = p.getY(i)/h; p.setX(i, p.getX(i)*(1-y*.15) + bend*h*y*y); }
  g.computeVertexNormals(); return g;
}
const LINK = (()=>{
  const lc = LL-2*LR, wc = LW-2*LR, seg = touch ? 7 : 12;
  const parts = [new THREE.TubeGeometry(new Stadium(lc,wc), touch ? 40 : 80, LR, touch ? 8 : 14, true)];
  const put = (g, ang, side)=>{ g.rotateZ(-Math.PI/2 + ang); g.translate(wc/2 + LR*.15, 0, 0); if(side<0) g.rotateZ(Math.PI); parts.push(g); };
  [1,-1].forEach(s=>{ put(cone(.46, LR*1.4, .12*s, seg), 0, s); put(cone(.22, LR, .45, seg), .75, s); put(cone(.22, LR, -.45, seg), -.75, s); });
  [1,-1].forEach(s=>{ const g = cone(.13, LR*.75, .3*s, seg); g.rotateZ(s>0?0:Math.PI); g.translate(0, s*(lc/2+LR*.1), 0); g.rotateY(Math.PI/2); parts.push(g); });
  [1,-1].forEach(s=>{ const g = cone(.15, LR*.85, 0, seg); g.rotateX(s*Math.PI/2); g.translate(wc/2, 0, s*LR*.5); parts.push(g); const g2 = g.clone(); g2.rotateZ(Math.PI); parts.push(g2); });
  return mergeGeometries(parts);
})();

// cadena colgante: cuelga del borde de arriba del hueco y se hamaca sola; el cursor la empuja
function cadena(){
  const H = 9, n = Math.ceil(H/PITCH) + 3;
  const mesh = new THREE.InstancedMesh(LINK, chainMat, n); mesh.frustumCulled = false;
  const g = new THREE.Group(); g.add(mesh);
  const pts = Array.from({length:n+1}, ()=>new V3()), m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), q2 = new THREE.Quaternion(), tan = new V3(), mid = new V3(), S1 = new V3(1,1,1);
  const ph = Math.random()*6.28, twist = Array.from({length:n}, ()=> (Math.random()-.5)*.35);
  g.userData.H = H;
  g.userData.update = (t, push)=>{
    for(let i=0;i<=n;i++){
      const s = i/n, w = Math.pow(s, 1.35);
      pts[i].set((Math.sin(t*.55+ph)*.42 + Math.sin(t*1.3+ph*2+s*3)*.07 + push*.9)*w, H/2 - i*PITCH, Math.sin(t*.4+ph*1.7)*.3*w);
    }
    for(let i=0;i<n;i++){
      tan.subVectors(pts[i+1], pts[i]).normalize(); mid.addVectors(pts[i], pts[i+1]).multiplyScalar(.5);
      q.setFromUnitVectors(UP, tan.clone().negate()); q2.setFromAxisAngle(UP, (i%2)*Math.PI/2 + twist[i]); q.multiply(q2);
      m4.compose(mid, q, S1); mesh.setMatrixAt(i, m4);
    }
    mesh.instanceMatrix.needsUpdate = true;
  };
  return g;
}

// ================= huecos del HTML → escenas =================
const MAKERS = {fondo, cadena};
const cells = [];
const mouse = {x:-9999, y:-9999};
addEventListener('pointermove', e=>{ mouse.x = e.clientX; mouse.y = e.clientY; }, {passive:true});

document.querySelectorAll('.art[data-art]').forEach(el=>{
  const kind = el.dataset.art; if(!MAKERS[kind]) return;
  const scene = new THREE.Scene(), cam = new THREE.PerspectiveCamera(30, 1, .1, 60); cam.position.set(0,0,9);
  if(kind === 'cadena'){ const key = new THREE.PointLight(0xffffff, 18, 20, 2); key.position.set(2,3,4); scene.add(key); }
  // la figura se arma recién cuando está por aparecer (y de a una por cuadro): la entrada no se traba
  cells.push({el, scene, cam, obj:null, kind, push:0, tilt:new V2()});
});

function resize(){ renderer.setSize(innerWidth, innerHeight, false); }
addEventListener('resize', resize); resize();
const clock = new THREE.Clock(); let t = 0, run = true;
const startAt = performance.now() + (document.documentElement.classList.contains('dim-in') ? 700 : 0);
document.addEventListener('visibilitychange', ()=>{ run = !document.hidden; if(run){ clock.getDelta(); requestAnimationFrame(loop); } });
function vis(r){ return r.bottom > 0 && r.top < innerHeight && r.right > 0 && r.left < innerWidth && r.width > 2 && r.height > 2; }
function draw(r, scene, cam){
  const y = innerHeight - r.bottom;
  renderer.setViewport(r.left, y, r.width, r.height); renderer.setScissor(r.left, y, r.width, r.height);
  renderer.render(scene, cam);
}
const TAN = Math.tan(15*Math.PI/180);
function loop(){
  if(!run) return;
  const dt = Math.min(clock.getDelta(), .05); t += reduce ? dt*.2 : dt;
  renderer.setScissor(0,0,innerWidth,innerHeight); renderer.setViewport(0,0,innerWidth,innerHeight); renderer.clear();
  let built = false;
  for(const c of cells){
    const r = c.el.getBoundingClientRect();
    if(!c.obj){
      if(built || performance.now() < startAt || r.top > innerHeight*1.8 || r.bottom < -innerHeight*.8) continue;
      c.obj = MAKERS[c.kind](c.el); c.scene.add(c.obj); built = true; continue;
    }
    if(!vis(r)) continue;
    const asp = r.width/r.height; c.cam.aspect = asp;
    const hx = (mouse.x - (r.left+r.width/2))/r.width, hy = (mouse.y - (r.top+r.height/2))/r.height;
    if(c.kind === 'cadena'){
      const H = c.obj.userData.H; c.cam.position.z = H/(2*TAN);
      const inside = mouse.y > r.top && mouse.y < r.bottom ? Math.max(0, 1 - Math.abs(hx)*asp*1.6) : 0;
      c.push += ((inside ? -Math.sign(hx || 1)*inside : 0) - c.push)*.05;
      c.obj.userData.update(t, c.push);
    } else {
      const U = c.obj.userData.U, sz = U.size.value;
      c.cam.position.z = Math.max(sz.y*.92/TAN, sz.x*.92/(TAN*asp));     // grande: los bordes ya se funden solos
      const Hv = 2*TAN*c.cam.position.z;
      U.time.value = t; U.mouse.value.set(hx*Hv*asp, -hy*Hv);
      const near = Math.max(0, 1 - Math.hypot(hx, hy)*1.2);             // leve 3D: se inclina hacia el cursor
      c.tilt.x += ((touch ? 0 : hy*.35*near) - c.tilt.x)*.05; c.tilt.y += ((touch ? 0 : hx*.45*near) - c.tilt.y)*.05;
      c.obj.rotation.set(c.tilt.x + Math.sin(t*.21)*.05, c.tilt.y + Math.sin(t*.17)*.08, 0);
    }
    c.cam.updateProjectionMatrix();
    draw(r, c.scene, c.cam);
  }
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);

// ================= cursor y grano (como en el presskit) =================
const cur = document.getElementById('cur');
if(cur && !touch){
  const lab = cur.querySelector('span');
  addEventListener('pointermove', e=>{
    cur.style.transform = `translate(${e.clientX}px,${e.clientY}px)`;
    const h = e.target.closest && e.target.closest('a,button,label,[data-label]');
    cur.classList.toggle('on', !!h);
    lab.textContent = h && h.dataset.label ? h.dataset.label : '';
  }, {passive:true});
}
const grain = document.getElementById('grain');
if(grain){
  const S = 256, c = document.createElement('canvas'); c.width = c.height = S; const g = c.getContext('2d'), im = g.createImageData(S,S);
  for(let i=0;i<im.data.length;i+=4){ const v = Math.random()*255; im.data[i]=im.data[i+1]=im.data[i+2]=v; im.data[i+3]=255; }
  g.putImageData(im,0,0); grain.style.backgroundImage = `url(${c.toDataURL()})`;
  if(!reduce) setInterval(()=>{ grain.style.backgroundPosition = `${Math.random()*256|0}px ${Math.random()*256|0}px`; }, 90);
}
