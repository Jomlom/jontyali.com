(function() {

const canvas = document.getElementById('hero-canvas')
if (!canvas) return

const heroEl2=document.querySelector(".hero"); canvas.width=heroEl2.offsetWidth
canvas.height=heroEl2.offsetHeight

const gl = canvas.getContext('webgl2', { alpha: true, premultipliedAlpha: false })
if (!gl || !gl.getExtension('EXT_color_buffer_float')) return
gl.getExtension('OES_texture_float_linear')

window.addEventListener("resize", () => {
  const heroEl2=document.querySelector(".hero"); canvas.width=heroEl2.offsetWidth
  canvas.height=heroEl2.offsetHeight
  resizeTargets()
})

const W = () => canvas.width
const H = () => canvas.height

function mkShader(type, src) {
  const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s)
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) { console.error(gl.getShaderInfoLog(s)); return null }
  return s
}
function mkProg(vs, fs) {
  const p = gl.createProgram()
  gl.attachShader(p, mkShader(gl.VERTEX_SHADER, vs))
  gl.attachShader(p, mkShader(gl.FRAGMENT_SHADER, fs))
  gl.linkProgram(p); return p
}
function mkF32(w, h, data) {
  const t = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, t)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA32F, w, h, 0, gl.RGBA, gl.FLOAT, data||null)
  return t
}
function mkRGBA(w, h) {
  const t = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, t)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA16F, w, h, 0, gl.RGBA, gl.FLOAT, null)
  return t
}
function mkFBO(tex) {
  const fb = gl.createFramebuffer(); gl.bindFramebuffer(gl.FRAMEBUFFER, fb)
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0)
  gl.bindFramebuffer(gl.FRAMEBUFFER, null); return fb
}
function randn(m, s) { return m + s * Math.sqrt(-2*Math.log(Math.random()+1e-10)) * Math.cos(2*Math.PI*Math.random()) }
function hsl(h, s, l) {
  s/=100; l/=100
  const k=n=>(n+h/30)%12, a=s*Math.min(l,1-l)
  const f=n=>l-a*Math.max(-1,Math.min(k(n)-3,Math.min(9-k(n),1)))
  return [f(0),f(8),f(4)]
}
function persp(fov,asp,n,f){ const t=1/Math.tan(fov/2),nf=1/(n-f); return new Float32Array([t/asp,0,0,0,0,t,0,0,0,0,(f+n)*nf,-1,0,0,2*f*n*nf,0]) }
function mul(a,b){ const o=new Float32Array(16); for(let r=0;r<4;r++)for(let c=0;c<4;c++){let s=0;for(let k=0;k<4;k++)s+=a[r+k*4]*b[k+c*4];o[r+c*4]=s} return o }
function mRX(a){ const c=Math.cos(a),s=Math.sin(a); return new Float32Array([1,0,0,0,0,c,s,0,0,-s,c,0,0,0,0,1]) }
function mRY(a){ const c=Math.cos(a),s=Math.sin(a); return new Float32Array([c,0,-s,0,0,1,0,0,s,0,c,0,0,0,0,1]) }
function mT(x,y,z){ return new Float32Array([1,0,0,0,0,1,0,0,0,0,1,0,x,y,z,1]) }
function st(p,n,u,tex){ gl.activeTexture(gl.TEXTURE0+u); gl.bindTexture(gl.TEXTURE_2D,tex); const l=gl.getUniformLocation(p,n); if(l!==null)gl.uniform1i(l,u) }
function u1f(p,n,v){const l=gl.getUniformLocation(p,n);if(l!==null)gl.uniform1f(l,v)}
function u1i(p,n,v){const l=gl.getUniformLocation(p,n);if(l!==null)gl.uniform1i(l,v)}
function u2f(p,n,x,y){const l=gl.getUniformLocation(p,n);if(l!==null)gl.uniform2f(l,x,y)}
function uM4(p,n,m){const l=gl.getUniformLocation(p,n);if(l!==null)gl.uniformMatrix4fv(l,false,m)}

const QUAD_VS=`#version 300 es\nin vec2 a_pos;out vec2 v_uv;\nvoid main(){v_uv=a_pos*.5+.5;gl_Position=vec4(a_pos,0,1);}`
const FORCE_FS=`#version 300 es
precision highp float;precision highp sampler2D;
in vec2 v_uv;uniform sampler2D u_pos,u_vel;uniform float u_dt,u_soft2,u_G;uniform int u_tw,u_th;out vec4 o;
void main(){
  vec2 bh=(vec2(0)+.5)/vec2(float(u_tw),float(u_th));
  if(abs(v_uv.x-bh.x)<.5/float(u_tw)&&abs(v_uv.y-bh.y)<.5/float(u_th)){o=vec4(0);return;}
  vec3 pos=texture(u_pos,v_uv).xyz,vel=texture(u_vel,v_uv).xyz,acc=vec3(0);
  for(int y=0;y<u_th;y++)for(int x=0;x<u_tw;x++){
    vec2 uv=(vec2(float(x),float(y))+.5)/vec2(float(u_tw),float(u_th));
    vec4 op=texture(u_pos,uv);vec3 d=op.xyz-pos;float d2=dot(d,d)+u_soft2;
    acc+=u_G*op.w*inversesqrt(d2*d2*d2)*d;
  }
  o=vec4(vel+acc*u_dt,0);
}`
const INTEG_FS=`#version 300 es
precision highp float;precision highp sampler2D;
in vec2 v_uv;uniform sampler2D u_pos,u_vel;uniform float u_dt;uniform int u_tw,u_th;out vec4 o;
void main(){
  vec2 bh=(vec2(0)+.5)/vec2(float(u_tw),float(u_th));
  if(abs(v_uv.x-bh.x)<.5/float(u_tw)&&abs(v_uv.y-bh.y)<.5/float(u_th)){vec4 b=texture(u_pos,v_uv);o=vec4(0,0,0,b.w);return;}
  vec4 pos=texture(u_pos,v_uv);o=vec4(pos.xyz+texture(u_vel,v_uv).xyz*u_dt,pos.w);
}`
const PART_VS=`#version 300 es
precision highp float;precision highp sampler2D;
uniform sampler2D u_pos,u_col;uniform mat4 u_mvp;uniform int u_tw,u_th;uniform float u_pxScale;
out vec3 v_col;out float v_size,v_fade;
void main(){
  int id=gl_VertexID,px=id-(id/u_tw)*u_tw,py=id/u_tw;
  vec2 uv=(vec2(float(px),float(py))+.5)/vec2(float(u_tw),float(u_th));
  vec4 world=texture(u_pos,uv),meta=texture(u_col,uv),clip=u_mvp*vec4(world.xyz,1);
  gl_Position=clip;
  float depth=clamp(1.5/(.5+clip.w*.18),.2,1.5),sz=meta.r;
  float raw=sz*depth*u_pxScale,minPx=2.2*max(u_pxScale,1.);
  gl_PointSize=clamp(raw,minPx,6.*u_pxScale);
  v_fade=min(1.,pow(raw/minPx,1.5));
  v_col=meta.gba;v_size=sz;
}`
const PART_FS=`#version 300 es
precision highp float;in vec3 v_col;in float v_size,v_fade;out vec4 o;
void main(){
  vec2 d=gl_PointCoord-.5;float r=dot(d,d)*4.;if(r>1.)discard;
  float a=(1.-r)*(1.-r)*v_fade;o=vec4(v_col*a*mix(.6,1.2,clamp(v_size/3.5,0.,1.)),a*.7);
}`
const TRAIL_SEG=5
const TRAIL_VS=`#version 300 es
precision highp float;precision highp sampler2D;
uniform sampler2D u_pos,u_vel,u_col;uniform mat4 u_mvp;uniform int u_tw,u_th;
uniform float u_pxScale,u_dt;uniform vec2 u_res;
out vec3 v_col;out float v_a;
const int SEG=${TRAIL_SEG};
vec3 spin(vec3 p,vec3 n,float a){return p*cos(a)+cross(n,p)*sin(a)+n*dot(n,p)*(1.-cos(a));}
void main(){
  int per=6*SEG,id=gl_VertexID/per,rem=gl_VertexID-id*per,seg=rem/6,k=rem-seg*6,px=id-(id/u_tw)*u_tw,py=id/u_tw;
  vec2 uv=(vec2(float(px),float(py))+.5)/vec2(float(u_tw),float(u_th));
  vec4 world=texture(u_pos,uv),meta=texture(u_col,uv);
  vec3 p=world.xyz,v=texture(u_vel,uv).xyz;
  vec3 L=cross(p,v);float r2=dot(p,p),ll=length(L);
  vec3 axis=ll>1e-9?L/ll:vec3(0.,1.,0.);
  float w=r2>1e-4?ll/r2*u_dt:0.;
  vec4 head=u_mvp*vec4(p,1),ahead=u_mvp*vec4(p+v*u_dt,1);
  vec2 hs=head.xy/head.w*.5*u_res,as2=ahead.xy/ahead.w*.5*u_res;
  float dl=length(hs-as2);
  float s=clamp(length(v)*u_dt/.0021,0.,1.3),lenPx=40.*u_pxScale*s*s*s;
  float frames=min(lenPx/max(dl,1e-3),600.);
  bool atTail=(k==2||k==3||k==5);
  int e0=seg+(atTail?1:0);
  float t0=float(seg)/float(SEG),t1=float(seg+1)/float(SEG),te=float(e0)/float(SEG);
  vec4 c0=u_mvp*vec4(spin(p,axis,-w*frames*t0),1),c1=u_mvp*vec4(spin(p,axis,-w*frames*t1),1);
  vec4 ce=atTail?c1:c0;
  vec2 dir=c1.xy/c1.w*.5*u_res-c0.xy/c0.w*.5*u_res;
  float dn=length(dir);dir=dn>1e-5?dir/dn:vec2(0.);
  float side=(k==0||k==2||k==3)?1.:-1.;
  vec4 pos=ce;pos.xy+=vec2(-dir.y,dir.x)*side*.5*max(u_pxScale,1.)/(.5*u_res)*ce.w;
  gl_Position=pos;
  v_col=meta.gba;
  float depth=clamp(1.5/(.5+head.w*.18),.2,1.5),minPx=2.2*max(u_pxScale,1.);
  float starB=mix(.6,1.2,clamp(meta.r/3.5,0.,1.))*min(1.,pow(meta.r*depth*u_pxScale/minPx,1.5));
  v_a=(1.-te)*starB*mix(.2,.55,min(s,1.));
}`
const TRAIL_FS=`#version 300 es
precision highp float;in vec3 v_col;in float v_a;out vec4 o;
void main(){o=vec4(v_col*v_a,v_a*.7);}`
const BLUR_FS=`#version 300 es
precision highp float;in vec2 v_uv;uniform sampler2D u_tex;uniform vec2 u_dir;out vec4 o;
void main(){
  float w[7];w[0]=.0625;w[1]=.125;w[2]=.25;w[3]=.375;w[4]=.25;w[5]=.125;w[6]=.0625;
  vec4 c=vec4(0);for(int i=0;i<7;i++)c+=texture(u_tex,v_uv+u_dir*float(i-3))*w[i];o=c;
}`
const COMP_FS=`#version 300 es
precision highp float;in vec2 v_uv;
uniform sampler2D u_sharp,u_bloom;uniform float u_alpha;out vec4 o;
void main(){
  vec3 s=texture(u_sharp,v_uv).rgb,b=texture(u_bloom,v_uv).rgb;
  vec3 col=s+b*.78;
  col=col/(col+.44);col=pow(col,vec3(.90));
  float lum=dot(col,vec3(.299,.587,.114));
  // empty space transparent so bg-stars show through
  col=mix(vec3(lum),col,1.08);
  col=col*mix(vec3(1.0),vec3(0.612,0.439,1.0),0.13);
  float a=clamp(dot(col,vec3(.299,.587,.114))*12.,0.,1.)*u_alpha;
  o=vec4(col,a);
}`

const forceProg=mkProg(QUAD_VS,FORCE_FS), integProg=mkProg(QUAD_VS,INTEG_FS)
const partProg=mkProg(PART_VS,PART_FS), blurProg=mkProg(QUAD_VS,BLUR_FS)
const compProg=mkProg(QUAD_VS,COMP_FS), trailProg=mkProg(TRAIL_VS,TRAIL_FS)

const quadVAO=gl.createVertexArray(); gl.bindVertexArray(quadVAO)
const qBuf=gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER,qBuf)
gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,1,1]),gl.STATIC_DRAW)
const qLocs=[forceProg,integProg,blurProg,compProg].map(p=>gl.getAttribLocation(p,'a_pos'))
gl.bindVertexArray(null)
function dq(pi){
  gl.bindVertexArray(quadVAO);gl.bindBuffer(gl.ARRAY_BUFFER,qBuf)
  const l=qLocs[pi];if(l>=0){gl.enableVertexAttribArray(l);gl.vertexAttribPointer(l,2,gl.FLOAT,false,0,0)}
  gl.drawArrays(gl.TRIANGLE_STRIP,0,4);gl.bindVertexArray(null)
}

let sharpTex,sharpFBO,blurTexA,blurTexB,blurFBOA,blurFBOB,BW,BH
function resizeTargets(){
  const w=W(),h=H()
  if(sharpTex){
    gl.deleteTexture(sharpTex);gl.deleteFramebuffer(sharpFBO)
    gl.deleteTexture(blurTexA);gl.deleteFramebuffer(blurFBOA)
    gl.deleteTexture(blurTexB);gl.deleteFramebuffer(blurFBOB)
  }
  BW=Math.floor(w/2);BH=Math.floor(h/2)
  sharpTex=mkRGBA(w,h);sharpFBO=mkFBO(sharpTex)
  blurTexA=mkRGBA(BW,BH);blurFBOA=mkFBO(blurTexA)
  blurTexB=mkRGBA(BW,BH);blurFBOB=mkFBO(blurTexB)
}
resizeTargets()

// pick body count based on device
// mobile 2048, mid-range 4096, strong gpu 8192
function pickTier() {
  // touch-primary device = mobile
  if (window.matchMedia('(pointer: coarse)').matches) return { N:2048, TW:64,  TH:32  }
  // check gpu renderer string for known weak gpus
  const dbg = gl.getExtension('WEBGL_debug_renderer_info')
  if (dbg) {
    const r = (gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) || '').toLowerCase()
    if (/mali|adreno|powervr|apple a[0-9]|intel hd|intel uhd 6[0-9][0-9]|llvmpipe|swiftshader/.test(r)) return { N:2048, TW:64,  TH:32  }
    if (/intel/.test(r) && !/iris|arc/.test(r)) return { N:4096, TW:128, TH:32  }
    if (/nvidia|radeon|geforce|rx |rtx |gtx |amd/.test(r)) return { N:8192, TW:128, TH:64  }
  }
  return { N:4096, TW:128, TH:32 } // safe default for unknown desktop
}
const { N, TW, TH } = pickTier()
const DT=0.0008,SOFT2=0.001,G=1.0,DTMULT=0.20,HUE=258
let posTex=[mkF32(TW,TH,null),mkF32(TW,TH,null)]
let velTex=[mkF32(TW,TH,null),mkF32(TW,TH,null)]
let posFBO=[mkFBO(posTex[0]),mkFBO(posTex[1])]
let velFBO=[mkFBO(velTex[0]),mkFBO(velTex[1])]
let colTex=null,ping=0

function makeGalaxy(){
  const pos=new Float32Array(N*4),vel=new Float32Array(N*4),col=new Float32Array(N*4)
  const BH=40,SM=0.0008,DM=(N-1)*SM,RS=0.9
  pos[3]=BH;col[0]=5.5;col[1]=1;col[2]=.98;col[3]=1
  const nA=2+Math.floor(Math.random()*2),tw=1.6+Math.random()*1.4
  const aA=Array.from({length:nA},(_,i)=>i*(Math.PI*2/nA)+randn(0,0.18))
  const aW=Array.from({length:nA},()=>.18+Math.random()*.20)
  const nc=30+Math.floor(Math.random()*40),csMin=.04+Math.random()*.06,csRng=.08+Math.random()*.16,onA=.60+Math.random()*.18
  const clumps=[]
  for(let c=0;c<nc;c++){
    const armIdx=c%nA
    let cr,ct
    if(Math.random()<onA){const u=Math.random();cr=Math.max(.3,-RS*Math.log(1-u*.94));cr=Math.min(cr,4.5);ct=aA[armIdx]-tw*Math.log(cr*2.5+1)+randn(0,aW[armIdx]*.5)}
    else{const u=Math.random();cr=Math.max(.08,-RS*Math.log(1-u*.96));cr=Math.min(cr,4.5);ct=Math.random()*Math.PI*2}
    clumps.push({r:cr,t:ct,size:csMin+Math.random()*csRng})
  }
  const cb=.72+Math.random()*.10,SL=20*Math.PI/180,cs=Math.cos(SL),ss=Math.sin(SL)
  const [hr,hg,hb]=hsl(HUE,100,52),[lr,lg,lb]=hsl(HUE,85,72)
  const [a1r,a1g,a1b]=hsl((HUE+120)%360,95,60),[a2r,a2g,a2b]=hsl((HUE+210)%360,90,55),[a3r,a3g,a3b]=hsl((HUE+60)%360,85,65)
  for(let i=1;i<N;i++){
    let rC,th,cd=0
    if(Math.random()<cb){const cl=clumps[Math.floor(Math.random()*clumps.length)];const cx=cl.r*Math.cos(cl.t)+randn(0,cl.size),cz=cl.r*Math.sin(cl.t)+randn(0,cl.size);rC=Math.sqrt(cx*cx+cz*cz);th=Math.atan2(cz,cx);cd=Math.max(0,1-cl.size/.25)}
    else{const u=Math.random();rC=Math.min(-RS*Math.log(1-u*.96),4.5);th=Math.random()*Math.PI*2}
    const CR=.18;if(rC<CR){const acc=(rC/CR)*(rC/CR);if(Math.random()>acc){const u=Math.random();rC=CR+(-RS*Math.log(1-u*.96))*.3;rC=Math.min(rC,4.5);th=Math.random()*Math.PI*2;cd=0}}
    rC=Math.max(.06,rC)
    const isH=Math.random()<.06,dt2=isH?rC*.45:rC*.09+.04
    const px0=rC*Math.cos(th),pz0=rC*Math.sin(th),py0=rC<.4?randn(0,rC*.04):randn(0,dt2)
    const px=px0,py=py0*cs-pz0*ss,pz=py0*ss+pz0*cs
    pos[i*4]=px;pos[i*4+1]=py;pos[i*4+2]=pz;pos[i*4+3]=SM
    const r3=Math.sqrt(px*px+py*py+pz*pz),xR=r3/RS,mD=DM*(1-Math.exp(-xR)*(1+xR)),mE=BH+mD
    const d2=r3*r3+SOFT2,vC=Math.sqrt(G*mE*r3*r3/(d2*Math.sqrt(d2))),sig=vC*.012
    const vx0=-Math.sin(th)*vC+randn(0,sig),vy0=randn(0,sig*.5),vz0=Math.cos(th)*vC+randn(0,sig)
    vel[i*4]=vx0;vel[i*4+1]=vy0*cs-vz0*ss;vel[i*4+2]=vy0*ss+vz0*cs
    const lSz=randn(1,.5),rSz=Math.max(.4,Math.min(5,Math.exp(lSz)*.52))
    col[i*4]=rSz
    const radT=Math.min(rC/2.5,1),sc=()=>(Math.random()-.5)*.10,sp=Math.random()
    let cr2,cg2,cb2
    if(isH){cr2=hr*.55+.15+sc();cg2=hg*.45+.10+sc();cb2=hb*.40+.08+sc()}
    else if(rC<.5){cr2=hr*.85+.10+sc();cg2=hg*.85+.08+sc();cb2=hb*.85+.10+sc()}
    else{
      const fd=1-radT*.15
      cr2=hr*fd+(lr-hr*fd)*cd+sc();cg2=hg*fd+(lg-hg*fd)*cd+sc();cb2=hb*fd+(lb-hb*fd)*cd+sc()
      if(sp<.033){cr2=a2r+sc();cg2=a2g+sc();cb2=a2b+sc()}
      else if(sp<.043){cr2=a3r+sc();cg2=a3g+sc();cb2=a3b+sc()}
      else if(sp<.073){cr2=.92+sc();cg2=.12+sc()*.5;cb2=.10+sc()*.5}
      else if(sp<.089){const w=.85+Math.random()*.15;cr2=w+sc();cg2=w+sc();cb2=w+sc()}
    }
    // blend toward pink then white at centre
    const coreT=Math.max(0,1-rC/0.2)
    // pink midpoint: more red, a bit less blue
    const pinkR=Math.min(1,cr2*2.4+0.3),pinkG=cg2*0.3,pinkB=cb2*0.85
    cr2=cr2+(pinkR+(1-pinkR)*coreT-cr2)*coreT
    cg2=cg2+(pinkG+(1-pinkG)*coreT-cg2)*coreT
    cb2=cb2+(pinkB+(1-pinkB)*coreT-cb2)*coreT
    // bigger particles at centre for bloom
    const coreBoom=1+coreT*3.5
    const bs=(0.82+rSz*.14)*coreBoom;col[i*4]=rSz*coreBoom;col[i*4+1]=Math.max(0,cr2)*bs;col[i*4+2]=Math.max(0,cg2)*bs;col[i*4+3]=Math.max(0,cb2)*bs
  }
  return {pos,vel,col}
}

function loadGalaxy(g){
  gl.bindTexture(gl.TEXTURE_2D,posTex[0]);gl.texSubImage2D(gl.TEXTURE_2D,0,0,0,TW,TH,gl.RGBA,gl.FLOAT,g.pos)
  gl.bindTexture(gl.TEXTURE_2D,velTex[0]);gl.texSubImage2D(gl.TEXTURE_2D,0,0,0,TW,TH,gl.RGBA,gl.FLOAT,g.vel)
  if(colTex){gl.bindTexture(gl.TEXTURE_2D,colTex);gl.texSubImage2D(gl.TEXTURE_2D,0,0,0,TW,TH,gl.RGBA,gl.FLOAT,g.col)}
  else colTex=mkF32(TW,TH,g.col)
  ping=0
}
loadGalaxy(makeGalaxy())

// camera state exposed globally for bg-stars.js
let rotX=0.5,rotY=-1.75,rotVel=0.005
const ROT_SPEED=0.00006
window._heroSim = { get rotX(){return rotX}, get rotY(){return rotY}, get fadeAlpha(){return fadeAlpha} }

const PAUSE_KEY='sim-paused'

const heroEl=document.querySelector('.hero')
let drag=false,lx=0,ly=0
function inHero(cy){const r=heroEl.getBoundingClientRect();return cy>=r.top&&cy<=r.bottom}
window.addEventListener('mousedown',e=>{if(paused||!inHero(e.clientY)||e.target.closest('input,textarea,select,button,a,summary,label'))return;drag=true;lx=e.clientX;ly=e.clientY;e.preventDefault()})
window.addEventListener('mouseup',()=>drag=false)
window.addEventListener('mousemove',e=>{if(!drag||paused)return;rotY+=(e.clientX-lx)*.005;lx=e.clientX;rotX+=(e.clientY-ly)*.005;ly=e.clientY})

let fadeAlpha=1,fadingOut=false,pendingReset=false,paused=localStorage.getItem(PAUSE_KEY)==='true'
window.addEventListener('heroResetRequest',()=>{fadingOut=true;pendingReset=false})

let frame=0
function tick(){
  frame++
  const w=W(),h=H()

  const tvel=drag?0:ROT_SPEED;rotVel+=(tvel-rotVel)*.04;rotY+=rotVel

  if(fadingOut){fadeAlpha=Math.max(0,fadeAlpha-.055);if(fadeAlpha===0&&!pendingReset){loadGalaxy(makeGalaxy());window.dispatchEvent(new Event('heroReset'));pendingReset=true;fadingOut=false}}
  else if(pendingReset){fadeAlpha=Math.min(1,fadeAlpha+.055);if(fadeAlpha>=1)pendingReset=false}

  const pong=1-ping,dt=DT*DTMULT

  gl.bindFramebuffer(gl.FRAMEBUFFER,velFBO[pong]);gl.viewport(0,0,TW,TH);gl.useProgram(forceProg)
  st(forceProg,'u_pos',0,posTex[ping]);st(forceProg,'u_vel',1,velTex[ping])
  u1f(forceProg,'u_dt',dt);u1f(forceProg,'u_soft2',SOFT2);u1f(forceProg,'u_G',G);u1i(forceProg,'u_tw',TW);u1i(forceProg,'u_th',TH);dq(0)
  gl.bindFramebuffer(gl.FRAMEBUFFER,posFBO[pong]);gl.viewport(0,0,TW,TH);gl.useProgram(integProg)
  st(integProg,'u_pos',0,posTex[ping]);st(integProg,'u_vel',1,velTex[pong])
  u1f(integProg,'u_dt',dt);u1i(integProg,'u_tw',TW);u1i(integProg,'u_th',TH);dq(1)
  ping=pong

  const fov=Math.PI/3.2,asp=w/h
  // narrow screen (asp < 1) magnifies galaxy
  const px=Math.min(w,h)/1080 * Math.max(1, 1/asp)

  gl.bindFramebuffer(gl.FRAMEBUFFER,sharpFBO);gl.viewport(0,0,w,h)
  gl.clearColor(0,0,0,0);gl.clear(gl.COLOR_BUFFER_BIT)
  gl.enable(gl.BLEND);gl.blendFunc(gl.ONE,gl.ONE);gl.useProgram(partProg)
  st(partProg,'u_pos',0,posTex[ping]);st(partProg,'u_col',1,colTex)
  u1i(partProg,'u_tw',TW);u1i(partProg,'u_th',TH);u1f(partProg,'u_pxScale',px)
  const mobile = window.matchMedia('(max-width: 900px)').matches
  const proj=persp(fov,asp,.01,300),view=mul(mT(0,mobile?1.1:0,mobile?-4.5:-4),mul(mRX(rotX),mRY(rotY)))
  const mvp=mul(proj,view)
  uM4(partProg,'u_mvp',mvp);gl.drawArrays(gl.POINTS,0,N)

  // short streaks behind each body
  gl.useProgram(trailProg)
  st(trailProg,'u_pos',0,posTex[ping]);st(trailProg,'u_vel',1,velTex[ping]);st(trailProg,'u_col',2,colTex)
  uM4(trailProg,'u_mvp',mvp);u1i(trailProg,'u_tw',TW);u1i(trailProg,'u_th',TH)
  u1f(trailProg,'u_pxScale',px);u1f(trailProg,'u_dt',dt);u2f(trailProg,'u_res',w,h)
  gl.drawArrays(gl.TRIANGLES,0,N*6*TRAIL_SEG);gl.disable(gl.BLEND)

  const B1=2.2,B2=4.4;gl.useProgram(blurProg)
  gl.bindFramebuffer(gl.FRAMEBUFFER,blurFBOA);gl.viewport(0,0,BW,BH);st(blurProg,'u_tex',0,sharpTex);u2f(blurProg,'u_dir',(B1*px)/w,0);dq(2)
  gl.bindFramebuffer(gl.FRAMEBUFFER,blurFBOB);st(blurProg,'u_tex',0,blurTexA);u2f(blurProg,'u_dir',0,(B1*px)/h);dq(2)
  gl.bindFramebuffer(gl.FRAMEBUFFER,blurFBOA);st(blurProg,'u_tex',0,blurTexB);u2f(blurProg,'u_dir',(B2*px)/w,0);dq(2)
  gl.bindFramebuffer(gl.FRAMEBUFFER,blurFBOB);st(blurProg,'u_tex',0,blurTexA);u2f(blurProg,'u_dir',0,(B2*px)/h);dq(2)

  gl.bindFramebuffer(gl.FRAMEBUFFER,null);gl.viewport(0,0,w,h)
  gl.clearColor(0,0,0,0);gl.clear(gl.COLOR_BUFFER_BIT)
  gl.enable(gl.BLEND);gl.blendFunc(gl.ONE,gl.ONE_MINUS_SRC_ALPHA)
  gl.useProgram(compProg)
  st(compProg,'u_sharp',0,sharpTex);st(compProg,'u_bloom',1,blurTexB)
  u1f(compProg,'u_alpha',fadeAlpha);dq(3)
  gl.disable(gl.BLEND)

  if(!paused)requestAnimationFrame(tick)
}

window.addEventListener('simPauseToggle',e=>{
  paused=e.detail.paused
  if(!paused)tick()
})

tick()

})()