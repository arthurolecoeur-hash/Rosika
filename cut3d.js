import * as T from "./vendor/three.module.min.js";
import {EffectComposer} from "./vendor/jsm/postprocessing/EffectComposer.js";
import {RenderPass} from "./vendor/jsm/postprocessing/RenderPass.js";
import {UnrealBloomPass} from "./vendor/jsm/postprocessing/UnrealBloomPass.js";
import {OutputPass} from "./vendor/jsm/postprocessing/OutputPass.js";
import {RoomEnvironment} from "./vendor/jsm/environments/RoomEnvironment.js";
import {RoundedBoxGeometry} from "./vendor/jsm/geometries/RoundedBoxGeometry.js";

const E=(a,b,t)=>Math.max(0,Math.min(1,(t-a)/(b-a)));
const eo=x=>1-Math.pow(1-x,3);
const eio=x=>x<.5?4*x*x*x:1-Math.pow(-2*x+2,3)/2;
const rnd=(a,b)=>a+Math.random()*(b-a);
const CS=.82;

function cnv(w,h,f){const c=document.createElement("canvas");c.width=w;c.height=h;f(c.getContext("2d"),w,h);const t=new T.CanvasTexture(c);t.colorSpace=T.SRGBColorSpace;return t}
function cnvL(w,h,f){const t=cnv(w,h,f);t.colorSpace=T.NoColorSpace;return t}
let DOT=null;
const dot=()=>DOT||(DOT=cnv(64,64,(g)=>{const r=g.createRadialGradient(32,32,0,32,32,32);r.addColorStop(0,"#fff");r.addColorStop(.22,"rgba(255,255,255,.85)");r.addColorStop(.5,"rgba(255,255,255,.25)");r.addColorStop(1,"rgba(255,255,255,0)");g.fillStyle=r;g.fillRect(0,0,64,64)}));
const add=(m,o={})=>Object.assign(m,{transparent:true,depthWrite:false,blending:T.AdditiveBlending},o);

let ENV=null,ENVREN=null;
function env(ren){if(ENV&&ENVREN===ren)return ENV;const pm=new T.PMREMGenerator(ren);ENV=pm.fromScene(new RoomEnvironment(ren),.04).texture;pm.dispose();ENVREN=ren;return ENV}
let CUR_ENV=null;
const std=(col,rough=.6,metal=0,o={})=>new T.MeshStandardMaterial(Object.assign({color:col,roughness:rough,metalness:metal},o));
const metal=(col,rough=.3,ei=1,o={})=>new T.MeshStandardMaterial(Object.assign({color:col,roughness:rough,metalness:1,envMap:CUR_ENV,envMapIntensity:ei},o));
const phys=(col,o={})=>new T.MeshPhysicalMaterial(Object.assign({color:col,envMap:CUR_ENV},o));
const emis=(col,i=2,o={})=>new T.MeshStandardMaterial(Object.assign({color:"#000000",emissive:col,emissiveIntensity:i,roughness:1},o));
const shadowy=(m,cast=true,recv=true)=>{m.traverse(x=>{if(x.isMesh){x.castShadow=cast;x.receiveShadow=recv}});return m};

function sky(top,bot,r=90){const g=new T.SphereGeometry(r,32,16),c=[],a=new T.Color(top),b=new T.Color(bot),p=g.attributes.position;
  for(let i=0;i<p.count;i++){const k=(p.getY(i)/r+1)/2,m=b.clone().lerp(a,Math.pow(k,1.3));c.push(m.r,m.g,m.b)}
  g.setAttribute("color",new T.Float32BufferAttribute(c,3));return new T.Mesh(g,new T.MeshBasicMaterial({vertexColors:true,side:T.BackSide,fog:false,depthWrite:false}))}
function glow(col,s,op=1){const m=new T.Sprite(add(new T.SpriteMaterial({map:dot(),color:col,opacity:op})));m.scale.set(s,s,1);return m}

class Parts{
  constructor(n,o){this.n=n;this.o=o;const g=new T.BufferGeometry();this.p=new Float32Array(n*3);this.v=new Float32Array(n*3);this.c=new Float32Array(n*3);this.life=new Float32Array(n);
    const cols=(o.cols||[o.col||"#fff"]).map(x=>new T.Color(x));
    for(let i=0;i<n;i++){const k=cols[i%cols.length];this.c.set([k.r,k.g,k.b],i*3);o.init(this.p,this.v,i,this.life)}
    g.setAttribute("position",new T.BufferAttribute(this.p,3));g.setAttribute("color",new T.BufferAttribute(this.c,3));
    this.mat=add(new T.PointsMaterial({size:o.size||.12,map:dot(),vertexColors:true,sizeAttenuation:true,opacity:o.op??1}));
    this.obj=new T.Points(g,this.mat);this.obj.frustumCulled=false}
  update(dt,t){const{p,v,n,o}=this;for(let i=0;i<n;i++){if(o.step)o.step(p,v,i,dt,t,this.life);else{p[i*3]+=v[i*3]*dt;p[i*3+1]+=v[i*3+1]*dt;p[i*3+2]+=v[i*3+2]*dt}}this.obj.geometry.attributes.position.needsUpdate=true}}
function burstParts(n,cols,center,speed=6,grav=-2,size=.14){return new Parts(n,{cols,size,init:(p,v,i,l)=>{p.set([center.x,center.y,center.z],i*3);const a=Math.random()*Math.PI*2,b=Math.acos(rnd(-1,1)),s=rnd(.3,1)*speed;v.set([Math.sin(b)*Math.cos(a)*s,Math.cos(b)*s,Math.sin(b)*Math.sin(a)*s],i*3);l[i]=1},
  step:(p,v,i,dt)=>{p[i*3]+=v[i*3]*dt;p[i*3+1]+=v[i*3+1]*dt;p[i*3+2]+=v[i*3+2]*dt;v[i*3]*=.985;v[i*3+1]=v[i*3+1]*.985+grav*dt;v[i*3+2]*=.985}})}
function field(n,box,cols,size,vel){return new Parts(n,{cols,size,init:(p,v,i)=>{p.set([rnd(-box[0],box[0]),rnd(box[1],box[2]),rnd(box[3],box[4])],i*3);v.set(vel(),i*3)},
  step:(p,v,i,dt)=>{p[i*3]+=v[i*3]*dt;p[i*3+1]+=v[i*3+1]*dt;p[i*3+2]+=v[i*3+2]*dt;
    if(p[i*3+1]>box[2])p[i*3+1]=box[1];if(p[i*3+1]<box[1])p[i*3+1]=box[2];if(p[i*3]>box[0])p[i*3]=-box[0];if(p[i*3]<-box[0])p[i*3]=box[0];if(p[i*3+2]>box[4])p[i*3+2]=box[3];if(p[i*3+2]<box[3])p[i*3+2]=box[4]}})}

function cardTex(o){const W=600,H=840;return cnv(W,H,(g)=>{
  let fr;try{fr=g.createConicGradient(0,W/2,H/2)}catch(_){fr=null}
  if(fr){[[0,"#fff6cc"],[.2,o.col],[.4,"#ffd34d"],[.6,o.col2],[.8,"#ffffff"],[1,"#fff6cc"]].forEach(([k,c])=>fr.addColorStop(k,c))}else{fr=g.createLinearGradient(0,0,W,H);fr.addColorStop(0,"#fff6cc");fr.addColorStop(.5,o.col);fr.addColorStop(1,"#ffd34d")}
  g.fillStyle=fr;g.fillRect(0,0,W,H);
  g.fillStyle="#0a0a0b";g.beginPath();g.roundRect(14,14,W-28,H-28,30);g.fill();
  const ig=g.createLinearGradient(0,0,0,H);ig.addColorStop(0,o.col);ig.addColorStop(1,"#0a0a0b");g.fillStyle=ig;g.beginPath();g.roundRect(28,96,W-56,H-246,20);g.fill();
  g.fillStyle="rgba(255,255,255,.85)";g.font="900 150px Sora, sans-serif";g.textAlign="center";g.textBaseline="middle";if(!o.img)g.fillText((o.name||"?").slice(0,2).toUpperCase(),W/2,H/2-40);
  g.fillStyle="#fff";g.font="800 46px Sora, sans-serif";g.textAlign="left";g.textBaseline="alphabetic";
  let nm=o.name||"";while(g.measureText(nm).width>W-170&&nm.length>3)nm=nm.slice(0,-2);if(nm!==o.name)nm+="…";g.fillText(nm,44,72);
  g.fillStyle="#ffd34d";g.beginPath();g.arc(W-70,56,28,0,7);g.fill();g.fillStyle="#1a1200";g.font="900 30px Sora, sans-serif";g.textAlign="center";g.fillText("D",W-70,67);
  g.textAlign="left";g.fillStyle="rgba(255,255,255,.7)";g.font="600 30px 'Plus Jakarta Sans', sans-serif";g.fillText(o.uni||"",44,H-104);
  g.fillStyle="#ffd34d";g.font="800 34px 'Plus Jakarta Sans', sans-serif";g.fillText("DIVIN",44,H-56);
  g.textAlign="right";g.fillStyle="rgba(255,255,255,.55)";g.font="800 30px Sora, sans-serif";g.fillText("ROSIKA",W-44,H-56)})}
function backTex(){return cnv(600,840,(g,W,H)=>{const b=g.createLinearGradient(0,0,W,H);b.addColorStop(0,"#3a0c12");b.addColorStop(1,"#070506");g.fillStyle="#d4af37";g.fillRect(0,0,W,H);
  g.fillStyle=b;g.beginPath();g.roundRect(12,12,W-24,H-24,30);g.fill();g.strokeStyle="rgba(255,211,77,.35)";g.lineWidth=3;
  for(let r=60;r<520;r+=46){g.beginPath();g.arc(W/2,H/2,r,0,7);g.stroke()}
  g.save();g.translate(W/2,H/2);g.rotate(Math.PI/4);g.strokeStyle="rgba(255,211,77,.55)";g.lineWidth=5;g.strokeRect(-120,-120,240,240);g.restore();
  g.fillStyle="#ffd34d";g.font="900 84px Sora, sans-serif";g.textAlign="center";g.textBaseline="middle";g.fillText("ROSIKA",W/2,H/2)})}
function roundRect(w,h,r){const s=new T.Shape(),x=-w/2,y=-h/2;s.moveTo(x+r,y);s.lineTo(x+w-r,y);s.quadraticCurveTo(x+w,y,x+w,y+r);s.lineTo(x+w,y+h-r);s.quadraticCurveTo(x+w,y+h,x+w-r,y+h);s.lineTo(x+r,y+h);s.quadraticCurveTo(x,y+h,x,y+h-r);s.lineTo(x,y+r);s.quadraticCurveTo(x,y,x+r,y);return s}
function shapeUV(g,w,h){const p=g.attributes.position,uv=g.attributes.uv;for(let i=0;i<p.count;i++)uv.setXY(i,(p.getX(i)+w/2)/w,(p.getY(i)+h/2)/h);uv.needsUpdate=true;return g}
const HOLO_V=`varying vec2 vUv;varying vec3 vN;varying vec3 vV;void main(){vUv=uv;vec4 mv=modelViewMatrix*vec4(position,1.);vV=mv.xyz;vN=normalize(normalMatrix*normal);gl_Position=projectionMatrix*mv;}`;
const HOLO_F=`uniform float uT;uniform float uOp;uniform float uBand;varying vec2 vUv;varying vec3 vN;varying vec3 vV;
vec3 hsv(float h){vec3 k=abs(fract(h+vec3(0.,.6667,.3333))*6.-3.)-1.;return clamp(k,0.,1.);}
void main(){vec3 V=normalize(-vV);float f=1.-abs(dot(vN,V));float ang=dot(vN.xy,vec2(.7,.3));
 float h=fract(vUv.x*.55+vUv.y*.35+ang*1.6+uT*.05+f*.6);vec3 c=hsv(h);
 float e=smoothstep(.36,.5,max(abs(vUv.x-.5)*1.02,abs(vUv.y-.5)*.98));
 float bpos=fract(uT*.22)*2.2-.6;float b=smoothstep(.09,0.,abs((vUv.x+vUv.y*.6)-bpos));
 float a=uOp*(.03+.3*e+.08*f)+uBand*b*.4;gl_FragColor=vec4(c*(.75+b*.8)+vec3(b*.6),a);}`;
function makeCard(o,ren){const W=2.5,H=3.5,D=.05,R=.17,grp=new T.Group();
  const front=cardTex(o),back=backTex();const an=Math.min(8,ren.capabilities.getMaxAnisotropy());front.anisotropy=back.anisotropy=an;
  const body=new T.Mesh(new T.ExtrudeGeometry(roundRect(W,H,R),{depth:D,bevelEnabled:true,bevelThickness:.02,bevelSize:.02,bevelSegments:3,curveSegments:10}),metal("#e2b84a",.3,.9,{emissive:"#3a2a05",emissiveIntensity:.15}));
  body.geometry.translate(0,0,-D/2);body.castShadow=true;grp.add(body);
  const fg=shapeUV(new T.ShapeGeometry(roundRect(W-.03,H-.03,R-.01),10),W-.03,H-.03);
  const fm=new T.Mesh(fg,new T.MeshBasicMaterial({map:front,envMap:CUR_ENV,reflectivity:.06,combine:T.MixOperation,color:"#f2f2f2"}));fm.position.z=D/2+.021;grp.add(fm);
  const bm=new T.Mesh(fg.clone(),new T.MeshBasicMaterial({map:back,envMap:CUR_ENV,reflectivity:.1,combine:T.MixOperation,color:"#e8e8e8"}));bm.rotation.y=Math.PI;bm.position.z=-(D/2+.021);grp.add(bm);
  const holo=new T.ShaderMaterial({vertexShader:HOLO_V,fragmentShader:HOLO_F,uniforms:{uT:{value:0},uOp:{value:.2},uBand:{value:0}},transparent:true,depthWrite:false,blending:T.AdditiveBlending});
  const hm=new T.Mesh(fg.clone(),holo);hm.position.z=D/2+.024;grp.add(hm);
  if(o.img){const im=new Image();im.onload=()=>{const c=front.image,g=c.getContext("2d"),x=28,y=96,w=c.width-56,h=c.height-246,s=Math.max(w/im.width,h/im.height),dw=im.width*s,dh=im.height*s;
      g.save();g.beginPath();g.roundRect(x,y,w,h,20);g.clip();g.drawImage(im,x+(w-dw)/2,y+(h-dh)*.15,dw,dh);
      const sh=g.createLinearGradient(0,y+h*.65,0,y+h);sh.addColorStop(0,"rgba(0,0,0,0)");sh.addColorStop(1,"rgba(0,0,0,.55)");g.fillStyle=sh;g.fillRect(x,y,w,h);g.restore();front.needsUpdate=true};im.src=o.img}
  const halo=glow(o.col,9,0);halo.position.z=-.35;grp.add(halo);
  const dummy={material:{opacity:0}};
  grp.userData={halo,holo,sheen:dummy,st:{offset:{x:0}}};return grp}

function streaks(n,col,len){const g=new T.BufferGeometry(),a=new Float32Array(n*6),d=[];for(let i=0;i<n;i++){const r=rnd(1.5,14),th=Math.random()*Math.PI*2;d.push([Math.cos(th)*r,Math.sin(th)*r,rnd(-120,0)])}
  g.setAttribute("position",new T.BufferAttribute(a,3));const L=new T.LineSegments(g,add(new T.LineBasicMaterial({color:col,opacity:.9})));L.frustumCulled=false;
  L.userData.step=(dt,sp)=>{for(let i=0;i<n;i++){const q=d[i];q[2]+=sp*dt;if(q[2]>10){q[2]=rnd(-120,-60)}const l=Math.min(30,len+sp*.08);a.set([q[0],q[1],q[2],q[0],q[1],q[2]-l],i*6)}g.attributes.position.needsUpdate=true};return L}

function city(n,R0,R1,win,base=-3,zc=-6){const grp=new T.Group(),wt=cnv(64,128,(g,w,h)=>{g.fillStyle="#05060a";g.fillRect(0,0,w,h);for(let y=4;y<h;y+=10)for(let x=4;x<w;x+=10)if(Math.random()<.35){g.fillStyle=win;g.globalAlpha=rnd(.4,1);g.fillRect(x,y,5,6)}});
  wt.wrapS=wt.wrapT=T.RepeatWrapping;
  for(let i=0;i<n;i++){const a=Math.PI+Math.random()*Math.PI,r=rnd(R0,R1),w=rnd(1.2,3),h=rnd(3,14),m=new T.Mesh(new T.BoxGeometry(w,h,w),new T.MeshStandardMaterial({color:"#0b0c14",emissive:"#ffffff",emissiveMap:wt,emissiveIntensity:.9,roughness:.9}));
    m.position.set(Math.cos(a)*r*1.3,base+h/2,Math.sin(a)*r+zc);grp.add(m)}return grp}

function saber(col,len){const g=new T.Group(),blade=new T.Group();
  const core=new T.Mesh(new T.CylinderGeometry(.035,.035,len,10),new T.MeshBasicMaterial({color:"#ffffff"}));core.position.y=len/2;
  const gl=new T.Mesh(new T.CylinderGeometry(.13,.13,len,16),add(new T.MeshBasicMaterial({color:col,opacity:.55})));gl.position.y=len/2;
  const gl2=new T.Mesh(new T.CylinderGeometry(.3,.3,len,16),add(new T.MeshBasicMaterial({color:col,opacity:.18})));gl2.position.y=len/2;
  blade.add(core,gl,gl2);g.add(blade);const hilt=new T.Mesh(new T.CylinderGeometry(.06,.06,.6,12),new T.MeshStandardMaterial({color:"#888",metalness:.9,roughness:.3}));hilt.position.y=-.3;g.add(hilt);
  g.userData.blade=blade;return g}
function bolt(from,to,seg,jit){const pts=[];for(let i=0;i<=seg;i++){const k=i/seg,p=from.clone().lerp(to,k);if(i&&i<seg){p.x+=(i%2?1:-1)*jit*rnd(.5,1);p.y+=rnd(-jit,jit)*.4;p.z+=rnd(-jit,jit)*.3}pts.push(p)}return new T.CatmullRomCurve3(pts,false,"catmullrom",0)}
function boltMesh(from,to,col,r=.05,seg=8,jit=.4){const c=bolt(from,to,seg,jit),g=new T.Group();g.add(new T.Mesh(new T.TubeGeometry(c,seg*6,r,5,false),add(new T.MeshBasicMaterial({color:"#ffffff"}))));g.add(new T.Mesh(new T.TubeGeometry(c,seg*6,r*3.5,5,false),add(new T.MeshBasicMaterial({color:col,opacity:.4}))));return g}
const texSmoke=(tint="255,255,255")=>cnv(128,128,(g)=>{for(let i=0;i<10;i++){const x=rnd(36,92),y=rnd(36,92),r=rnd(22,40),q=g.createRadialGradient(x,y,0,x,y,r);q.addColorStop(0,`rgba(${tint},.5)`);q.addColorStop(1,`rgba(${tint},0)`);g.fillStyle=q;g.fillRect(0,0,128,128)}});
class Smoke{constructor(s,n,tex,col,emit,o={}){this.ps=[];this.o=o;this.emit=emit;const L=o.life||2;
    for(let i=0;i<n;i++){const m=new T.Sprite(new T.SpriteMaterial({map:tex,color:col,transparent:true,opacity:0,depthWrite:false,blending:o.additive?T.AdditiveBlending:T.NormalBlending}));m.userData={life:-i/n*L,max:L*rnd(.8,1.2)};s.add(m);this.ps.push(m)}}
  update(dt,on=true){for(const m of this.ps){const u=m.userData;u.life+=dt;if(u.life>=u.max||(!u.v&&u.life>=0)){if(!on){m.material.opacity=0;continue}u.life=0;const e=this.emit();m.position.copy(e.p);u.v=e.v;u.s0=e.s||1}
    if(u.life<0){m.material.opacity=0;continue}const k=u.life/u.max;m.position.addScaledVector(u.v,dt);const sc=u.s0*(1+k*(this.o.grow??2));m.scale.set(sc,sc,1);m.material.opacity=(this.o.op??.5)*Math.sin(k*Math.PI)}}}
function rainFx(n,box,col="#9fb3d9",op=.35,speed=22,slant=4){const g=new T.BufferGeometry(),a=new Float32Array(n*6),P=[];for(let i=0;i<n;i++)P.push([rnd(-box[0],box[0]),rnd(box[1],box[2]),rnd(box[3],box[4])]);
  g.setAttribute("position",new T.BufferAttribute(a,3));const L=new T.LineSegments(g,add(new T.LineBasicMaterial({color:col,opacity:op})));L.frustumCulled=false;
  return{obj:L,update(dt,push){for(let i=0;i<n;i++){const q=P[i];q[1]-=dt*speed;q[0]-=dt*slant;
      if(push){const dx=q[0]-push.x,dz=q[2]-push.z,d=Math.hypot(dx,dz)+.01;q[0]+=dx/d*push.s*dt;q[2]+=dz/d*push.s*dt}
      if(q[1]<box[1]){q[1]=box[2];q[0]=rnd(-box[0],box[0]);q[2]=rnd(box[3],box[4])}a.set([q[0],q[1],q[2],q[0]+slant*.03,q[1]+.6,q[2]],i*6)}g.attributes.position.needsUpdate=true}}}
function frameFx(card){const W=2.5,H=3.5,g=new T.Group(),gt=cnv(8,64,(c,w,h)=>{const q=c.createLinearGradient(0,0,0,h);q.addColorStop(0,"rgba(255,255,255,0)");q.addColorStop(.5,"rgba(255,255,255,1)");q.addColorStop(1,"rgba(255,255,255,0)");c.fillStyle=q;c.fillRect(0,0,w,h)});
  const mk=(w,x,y,rot)=>{const m=new T.Mesh(new T.PlaneGeometry(w,.55),add(new T.MeshBasicMaterial({map:gt,opacity:0,side:T.DoubleSide})));m.position.set(x,y,.06);m.rotation.z=rot;g.add(m)};
  mk(W+.35,0,H/2,0);mk(H+.35,W/2,0,Math.PI/2);mk(W+.35,0,-H/2,0);mk(H+.35,-W/2,0,Math.PI/2);card.add(g);
  return{set(a,col){g.children.forEach((m,i)=>{m.material.opacity=a;if(col)m.material.color.set(Array.isArray(col)?col[i%col.length]:col)})},prog(k,a,col){g.children.forEach((m,i)=>{const kk=Math.max(0,Math.min(1,k*4-i));m.scale.x=Math.max(.001,kk);m.material.opacity=a*(kk>0?1:0);if(col)m.material.color.set(col)})}}}
function edgeArcs(card,n=7){const W=2.5,H=3.5,ls=[];for(let i=0;i<n;i++){const g=new T.BufferGeometry(),a=new Float32Array(30);g.setAttribute("position",new T.BufferAttribute(a,3));const l=new T.Line(g,add(new T.LineBasicMaterial({opacity:0})));l.position.z=.08;l.frustumCulled=false;card.add(l);ls.push({l,a,g})}
  const per=u=>{u=((u%1)+1)%1;const d=u*2*(W+H);if(d<W)return[-W/2+d,H/2];if(d<W+H)return[W/2,H/2-(d-W)];if(d<2*W+H)return[W/2-(d-W-H),-H/2];return[-W/2,-H/2+(d-2*W-H)]};
  let acc=1;return{update(dt,a,cols){acc+=dt;if(acc<.05&&a>0)return;acc=0;ls.forEach((o,i)=>{const u0=Math.random(),len=rnd(.03,.09);for(let k=0;k<10;k++){const[x,y]=per(u0+len*k/9);o.a.set([x+rnd(-.14,.14),y+rnd(-.14,.14),0],k*3)}o.g.attributes.position.needsUpdate=true;o.l.material.opacity=a*rnd(.5,1);o.l.material.color.set(cols[i%cols.length])})}}}
function lensSplats(cam,n,col){const tx=cnv(64,64,(g)=>{g.fillStyle="#fff";g.beginPath();for(let i=0;i<14;i++){const a=i/14*Math.PI*2,r=rnd(14,27);g.lineTo(32+Math.cos(a)*r,32+Math.sin(a)*r)}g.fill();for(let i=0;i<7;i++){g.beginPath();g.arc(rnd(4,60),rnd(4,60),rnd(2,6),0,7);g.fill()}});
  const ss=[];for(let i=0;i<n;i++){const m=new T.Sprite(new T.SpriteMaterial({map:tx,color:col,transparent:true,opacity:0,depthTest:false,depthWrite:false}));m.position.set(rnd(-.75,.75),rnd(-.42,.42),-1.2);const sc=rnd(.1,.3);m.scale.set(sc,sc,1);m.renderOrder=998;cam.add(m);ss.push(m)}
  return{hit(){ss.forEach(m=>m.material.opacity=rnd(.75,.95))},update(dt){ss.forEach(m=>{if(m.material.opacity>0){m.position.y-=dt*.02;m.material.opacity=Math.max(0,m.material.opacity-dt*.3)}})}}}
const comicTex=txt=>cnv(512,384,(g,w,h)=>{g.translate(w/2,h/2);g.beginPath();for(let i=0;i<24;i++){const a=i/24*Math.PI*2,r=i%2?150:228;g.lineTo(Math.cos(a)*r*1.08,Math.sin(a)*r*.78)}g.closePath();g.fillStyle="#ffd21f";g.fill();g.lineWidth=10;g.strokeStyle="#111";g.stroke();
  g.fillStyle="rgba(232,35,58,.85)";for(let y=-110;y<120;y+=16)for(let x=-170;x<180;x+=16){if(Math.hypot(x/1.35,y)<105){g.beginPath();g.arc(x+((y+110)/16%2)*8,y,3,0,7);g.fill()}}
  g.rotate(-.12);g.font="900 104px Sora, sans-serif";g.textAlign="center";g.textBaseline="middle";g.lineJoin="round";g.lineWidth=18;g.strokeStyle="#111";g.strokeText(txt,0,6);g.fillStyle="#e8233a";g.fillText(txt,0,6);g.lineWidth=3;g.strokeStyle="#fff";g.strokeText(txt,0,6)});
const noteTex=(ch,col)=>cnv(64,64,(g)=>{g.fillStyle=col;g.font="900 52px serif";g.textAlign="center";g.textBaseline="middle";g.shadowColor=col;g.shadowBlur=10;g.fillText(ch,32,34)});
function stagPts(n){const c=document.createElement("canvas");c.width=200;c.height=160;const g=c.getContext("2d");g.strokeStyle=g.fillStyle="#fff";g.lineCap=g.lineJoin="round";
  g.beginPath();g.ellipse(95,92,42,19,-.05,0,7);g.fill();g.lineWidth=13;g.beginPath();g.moveTo(126,84);g.quadraticCurveTo(139,62,146,46);g.stroke();
  g.beginPath();g.ellipse(152,42,14,8,.45,0,7);g.fill();g.lineWidth=6;g.beginPath();g.moveTo(162,47);g.lineTo(175,52);g.stroke();g.lineWidth=4;
  [[147,36,-1],[156,34,1]].forEach(([x,y,s])=>{g.beginPath();g.moveTo(x,y);g.lineTo(x-6*s,y-22);g.lineTo(x-2*s,y-40);g.moveTo(x-5*s,y-17);g.lineTo(x-17*s,y-25);g.moveTo(x-4*s,y-30);g.lineTo(x+8*s,y-38);g.moveTo(x-4*s,y-30);g.lineTo(x-15*s,y-45);g.stroke()});
  g.lineWidth=7;[[68,100,56,142],[82,104,88,144],[112,102,120,142],[124,98,140,136]].forEach(([a,b,x,y])=>{g.beginPath();g.moveTo(a,b);g.lineTo(x,y);g.stroke()});g.lineWidth=5;g.beginPath();g.moveTo(55,86);g.lineTo(43,79);g.stroke();
  const d=g.getImageData(0,0,200,160).data,pts=[];let k=0;while(pts.length<n*3&&k++<n*80){const x=Math.random()*200|0,y=Math.random()*160|0;if(d[(y*200+x)*4+3]>128)pts.push((x-100)/45,-(y-92)/45,rnd(-.12,.12))}return new Float32Array(pts)}
const brickTex=(c1,c2,mortar,rep=1)=>{const t=cnv(256,256,(g,w,h)=>{g.fillStyle=mortar;g.fillRect(0,0,w,h);for(let y=0;y<h;y+=32)for(let x=-((y/32)%2)*32;x<w;x+=64){g.fillStyle=Math.random()<.5?c1:c2;g.globalAlpha=rnd(.75,1);g.fillRect(x+3,y+3,58,26)}g.globalAlpha=1});t.wrapS=t.wrapT=T.RepeatWrapping;t.repeat.set(rep,rep);return t};
const gridTex=(bg,line,step=32,rep=1)=>{const t=cnv(256,256,(g,w,h)=>{g.fillStyle=bg;g.fillRect(0,0,w,h);g.strokeStyle=line;g.lineWidth=2;for(let i=0;i<=w;i+=step){g.beginPath();g.moveTo(i,0);g.lineTo(i,h);g.stroke();g.beginPath();g.moveTo(0,i);g.lineTo(w,i);g.stroke()}});t.wrapS=t.wrapT=T.RepeatWrapping;t.repeat.set(rep,rep);return t};
const uiTex=(col)=>cnv(256,160,(g,w,h)=>{g.strokeStyle=col;g.fillStyle=col;g.lineWidth=2;g.globalAlpha=.9;g.strokeRect(4,4,w-8,h-8);for(let i=0;i<6;i++){g.globalAlpha=rnd(.3,.9);g.fillRect(14,18+i*20,rnd(40,180),6)}g.globalAlpha=.8;g.beginPath();g.arc(w-50,h/2,30,0,7);g.stroke();g.beginPath();g.moveTo(w-50,h/2);g.lineTo(w-28,h/2-18);g.stroke();
  g.beginPath();for(let x=0;x<w;x+=8)g.lineTo(x,h-22+Math.sin(x*.12)*8*Math.random());g.stroke()});
const runeTex=()=>{const t=cnv(128,512,(g,w,h)=>{g.fillStyle="#24242a";g.fillRect(0,0,w,h);g.strokeStyle="rgba(255,200,90,.9)";g.lineWidth=3;for(let y=30;y<h-20;y+=44){const x=w/2;g.beginPath();for(let k=0;k<4;k++){g.moveTo(x+rnd(-26,26),y+rnd(-14,14));g.lineTo(x+rnd(-26,26),y+rnd(-14,14))}g.stroke()}});return t};
const woodTex=(c1="#6b4426",c2="#4a2c16")=>cnv(128,256,(g,w,h)=>{g.fillStyle=c1;g.fillRect(0,0,w,h);g.strokeStyle=c2;for(let x=0;x<w;x+=rnd(4,9)){g.globalAlpha=rnd(.3,.8);g.lineWidth=rnd(1,3);g.beginPath();g.moveTo(x,0);for(let y=0;y<h;y+=16)g.lineTo(x+Math.sin(y*.05+x)*2,y);g.stroke()}g.globalAlpha=1;g.strokeStyle="#2a1608";g.lineWidth=3;[w*.33,w*.66].forEach(x=>{g.beginPath();g.moveTo(x,0);g.lineTo(x,h);g.stroke()})});
function cloth(w,h,col,sx=18,sy=18,mo={}){const g=new T.PlaneGeometry(w,h,sx,sy),m=new T.Mesh(g,new T.MeshStandardMaterial(Object.assign({color:col,side:T.DoubleSide,roughness:.85},mo))),b=g.attributes.position.array.slice();
  m.userData.wave=(t,amp,fq,pin)=>{const p=g.attributes.position.array;for(let i=0;i<p.length;i+=3){const x=b[i],y=b[i+1],k=pin==="top"?(h/2-y)/h:pin==="left"?(x+w/2)/w:pin==="right"?(w/2-x)/w:1;p[i+2]=b[i+2]+(Math.sin(x*fq+t*3)*amp+Math.sin(y*fq*.8+t*2.2)*amp*.6)*k}g.attributes.position.needsUpdate=true;g.computeVertexNormals()};return m}
const at=(c,t,f)=>c.at(t,f);
const toCam=(cam,p,l)=>{cam.position.copy(p);cam.lookAt(l)};
const V=(x,y,z)=>new T.Vector3(x,y,z);
const L3=(a,b,k)=>a.clone().lerp(b,k);



const H=(col,k)=>new T.Color(col).multiplyScalar(k);
const hb=(col,k,o={})=>new T.MeshBasicMaterial(Object.assign({color:H(col,k)},o));
const rbox=(w,h,d,r,mat,seg=2)=>new T.Mesh(new RoundedBoxGeometry(w,h,d,seg,r),mat);
const lathe=(pts,mat,seg=32)=>new T.Mesh(new T.LatheGeometry(pts.map(([x,y])=>new T.Vector2(x,y)),seg),mat);
const hdrP=(P,k)=>{P.mat.color.setScalar(k);return P};
const noiseTex=(w,h,base,dots,rep=1,a=.25)=>{const t=cnv(w,h,(g)=>{g.fillStyle=base;g.fillRect(0,0,w,h);for(let i=0;i<w*h/40;i++){g.fillStyle=dots[i%dots.length];g.globalAlpha=Math.random()*a;g.fillRect(Math.random()*w,Math.random()*h,rnd(1,4),rnd(1,4))}g.globalAlpha=1});t.wrapS=t.wrapT=T.RepeatWrapping;t.repeat.set(rep,rep);return t};
const winTex=(warm=["#ffd27a","#ffc46a","#ffe2a8"],litP=.3,cols=4,rows=8)=>{const t=cnv(128,256,(g,w,h)=>{g.fillStyle="#06070b";g.fillRect(0,0,w,h);const cw=w/cols,ch=h/rows;
  for(let y=0;y<rows;y++)for(let x=0;x<cols;x++){const lit=Math.random()<litP;const gr=g.createLinearGradient(0,y*ch,0,y*ch+ch);if(lit){const c0=warm[Math.random()*warm.length|0];gr.addColorStop(0,c0);gr.addColorStop(1,"#5a3a18")}else{gr.addColorStop(0,"#141824");gr.addColorStop(1,"#0a0c12")}
    g.fillStyle=gr;g.globalAlpha=lit?rnd(.6,1):1;g.fillRect(x*cw+5,y*ch+6,cw-10,ch-12);g.globalAlpha=1;g.fillStyle="#06070b";g.fillRect(x*cw+cw/2-1,y*ch+6,2,ch-12)}});t.wrapS=t.wrapT=T.RepeatWrapping;return t};
function skyscraper(w,h,d,win,o={}){const g=new T.Group(),tex=win.clone();tex.needsUpdate=true;tex.repeat.set(Math.max(1,Math.round(w/3)),Math.max(1,Math.round(h/5)));
  const m=new T.Mesh(new T.BoxGeometry(w,h,d),new T.MeshStandardMaterial({color:o.col||"#0d0f16",roughness:.75,metalness:.2,emissive:"#ffffff",emissiveMap:tex,emissiveIntensity:o.ei??.75}));m.position.y=h/2;g.add(m);
  const cap=new T.Mesh(new T.BoxGeometry(w+.2,.25,d+.2),std("#1a1c24",.7,.3));cap.position.y=h+.12;g.add(cap);
  if(o.tier){const t2=new T.Mesh(new T.BoxGeometry(w*.65,h*.25,d*.65),m.material);t2.position.y=h+h*.125+.25;g.add(t2);if(o.spire){const sp=new T.Mesh(new T.CylinderGeometry(.02,.12,h*.3,6),std("#555",.4,.8));sp.position.y=h*1.25+.25+h*.15;g.add(sp);const lt=glow("#ff3030",.6,1);lt.position.y=h*1.25+.25+h*.3;g.add(lt)}}
  return g}
function neon(text,col,w=2.6,hgt=.7){const g=new T.Group(),board=rbox(w,hgt,.14,.04,std("#0b0b10",.45,.6));g.add(board);
  const tx=cnv(1024,256,(c,W,Hh)=>{c.font="900 150px Sora, Arial, sans-serif";c.textAlign="center";c.textBaseline="middle";c.lineJoin="round";c.lineWidth=14;c.strokeStyle="#fff";c.strokeText(text,W/2,Hh/2+6)});
  const tm=new T.MeshBasicMaterial({map:tx,color:H(col,2),transparent:true,depthWrite:false});const p=new T.Mesh(new T.PlaneGeometry(w*.9,hgt*.8),tm);p.position.z=.08;g.add(p);
  const hw=w*.47,hh=hgt*.45,fr=new T.Line(new T.BufferGeometry().setFromPoints([V(-hw,-hh,0),V(hw,-hh,0),V(hw,hh,0),V(-hw,hh,0),V(-hw,-hh,0)]),new T.LineBasicMaterial({color:H(col,1.6)}));fr.position.z=.08;g.add(fr);
  const pl=new T.PointLight(col,10,10);pl.position.z=1.2;g.add(pl);g.userData={tm,pl,col:new T.Color(col)};return g}
function waterTower(){const g=new T.Group(),wood=new T.MeshStandardMaterial({map:woodTex("#5a3a22","#3a2414"),roughness:.85});
  const tank=new T.Mesh(new T.CylinderGeometry(1.1,1.15,2,24),wood);tank.position.y=3.2;g.add(tank);const roof=new T.Mesh(new T.ConeGeometry(1.25,.9,24),std("#2a2a30",.6,.5));roof.position.y=4.65;g.add(roof);
  for(let i=0;i<3;i++){const b=new T.Mesh(new T.TorusGeometry(1.15,.035,6,32),std("#333",.4,.9));b.rotation.x=Math.PI/2;b.position.y=2.4+i*.8;g.add(b)}
  for(let i=0;i<4;i++){const a=i*Math.PI/2+Math.PI/4,l=new T.Mesh(new T.CylinderGeometry(.06,.06,2.4,6),std("#2a2a2e",.5,.8));l.position.set(Math.cos(a)*.85,1.1,Math.sin(a)*.85);g.add(l)}
  const pf=new T.Mesh(new T.CylinderGeometry(1.25,1.25,.08,24),std("#222",.6,.6));pf.position.y=2.2;g.add(pf);return g}
function acUnit(){const g=new T.Group(),b=rbox(1.3,.8,1,.06,std("#9aa0a8",.45,.6));b.position.y=.4;g.add(b);const fan=new T.Mesh(new T.CircleGeometry(.36,24),new T.MeshStandardMaterial({map:cnv(64,64,(c)=>{c.fillStyle="#222";c.fillRect(0,0,64,64);c.strokeStyle="#777";for(let r=6;r<32;r+=5){c.beginPath();c.arc(32,32,r,0,7);c.stroke()}c.beginPath();c.moveTo(0,32);c.lineTo(64,32);c.moveTo(32,0);c.lineTo(32,64);c.stroke()}),roughness:.6,metalness:.5}));fan.rotation.x=-Math.PI/2;fan.position.set(.2,.81,0);g.add(fan);return g}
function lattice(h,w=.5){const g=new T.Group(),m=std("#6a6a72",.45,.85),pts=[[0,0],[w,0],[w/2,w*.86]].map(([x,z])=>[x-w/2,z-w*.3]);
  pts.forEach(([x,z])=>{const l=new T.Mesh(new T.CylinderGeometry(.025,.035,h,5),m);l.position.set(x,h/2,z);g.add(l)});
  for(let y=.4;y<h;y+=.45)for(let i=0;i<3;i++){const a=pts[i],b=pts[(i+1)%3],l=new T.Mesh(new T.CylinderGeometry(.012,.012,Math.hypot(a[0]-b[0],a[1]-b[1])*1.25,4),m);l.position.set((a[0]+b[0])/2,y,(a[1]+b[1])/2);l.lookAt(b[0],y+.25,b[1]);l.rotateX(Math.PI/2);g.add(l)}return g}
const barkTex=(c1="#2a2016",c2="#18120c")=>{const t=cnv(128,256,(g,w,h)=>{g.fillStyle=c1;g.fillRect(0,0,w,h);for(let i=0;i<70;i++){g.strokeStyle=Math.random()<.5?c2:"rgba(255,255,255,.05)";g.lineWidth=rnd(1,4);g.beginPath();let x=rnd(0,w);g.moveTo(x,0);for(let y=0;y<h;y+=12){x+=rnd(-3,3);g.lineTo(x,y)}g.stroke()}});t.wrapS=t.wrapT=T.RepeatWrapping;t.repeat.set(2,3);return t};
function gnarlTree(h,r,mat,leaf){const g=new T.Group(),pts=[];let x=0,z=0;for(let i=0;i<=6;i++){pts.push(new T.Vector3(x,i/6*h,z));x+=rnd(-.5,.5)*r*1.6;z+=rnd(-.5,.5)*r*1.6}
  const c=new T.CatmullRomCurve3(pts),tg=new T.TubeGeometry(c,40,r,9,false),p=tg.attributes.position;for(let i=0;i<p.count;i++){const y=p.getY(i),k=1-y/h*.7;const cx=c.getPointAt(Math.max(0,Math.min(1,y/h)));p.setX(i,cx.x+(p.getX(i)-cx.x)*k);p.setZ(i,cx.z+(p.getZ(i)-cx.z)*k)}tg.computeVertexNormals();g.add(new T.Mesh(tg,mat));
  for(let k=0;k<5;k++){const a=k/5*Math.PI*2+rnd(-.3,.3),rc=new T.CatmullRomCurve3([V(0,rnd(.4,1.2),0),V(Math.cos(a)*r*1.6,.3,Math.sin(a)*r*1.6),V(Math.cos(a)*r*3.2,-.1,Math.sin(a)*r*3.2)]);g.add(new T.Mesh(new T.TubeGeometry(rc,10,r*.35,6,false),mat))}
  for(let k=0;k<4;k++){const t0=rnd(.45,.9),p0=c.getPointAt(t0),a=rnd(0,6.28),l=rnd(1.2,2.6)*r*3,bc=new T.CatmullRomCurve3([p0,p0.clone().add(V(Math.cos(a)*l*.5,l*.4,Math.sin(a)*l*.5)),p0.clone().add(V(Math.cos(a)*l,l*.5+rnd(-.5,.5),Math.sin(a)*l))]);g.add(new T.Mesh(new T.TubeGeometry(bc,10,r*.28,6,false),mat));
    if(leaf){const lf=new T.Mesh(new T.IcosahedronGeometry(rnd(.9,1.6)*r*3,1),leaf);lf.position.copy(bc.getPointAt(1));lf.scale.y=.7;g.add(lf)}}
  return g}
function velvet(w,h,col,folds=10){const g=new T.PlaneGeometry(w,h,folds*8,6),p=g.attributes.position;for(let i=0;i<p.count;i++){const x=p.getX(i);p.setZ(i,Math.sin(x/w*Math.PI*2*folds)*.18+Math.sin(x/w*Math.PI*2*folds*2.3)*.04)}g.computeVertexNormals();
  return new T.Mesh(g,new T.MeshPhysicalMaterial({color:col,roughness:.65,sheen:1,sheenColor:new T.Color(col).lerp(new T.Color("#ffffff"),.35),sheenRoughness:.4,side:T.DoubleSide}))}

const K={};
K.spider=c=>{const{s,cam,card,rest}=c;c.dur=5;s.add(sky("#080b22","#1d0a1c"));s.fog=new T.FogExp2("#0c0814",.03);
  const fl=new T.Mesh(new T.PlaneGeometry(40,40),new T.MeshStandardMaterial({color:"#0b0b10",roughness:.15,metalness:.75}));fl.rotation.x=-Math.PI/2;fl.position.y=-1.6;s.add(fl);
  const wall=new T.Mesh(new T.PlaneGeometry(34,16),new T.MeshStandardMaterial({map:brickTex("#2a1414","#1c0e0e","#0a0606",6),roughness:.9}));wall.position.set(0,5,-10);s.add(wall);
  const neons=[];[["#ff2a6d",-5,3.4],["#22d3ee",0.6,4.6],["#ff9f1a",5.6,3]].forEach(([cl,x,y])=>{const sg=new T.Mesh(new T.BoxGeometry(2.6,.55,.12),new T.MeshBasicMaterial({color:cl}));sg.position.set(x,y,-9.8);s.add(sg);const gl=glow(cl,5,.55);sg.add(gl);
    const pl=new T.PointLight(cl,16,14);pl.position.set(x,y-1,-7.5);s.add(pl);const pd=new T.Mesh(new T.CircleGeometry(rnd(.9,1.5),28),add(new T.MeshBasicMaterial({color:cl,opacity:.22})));pd.rotation.x=-Math.PI/2;pd.position.set(x*.55,-1.58,rnd(-4,.5));s.add(pd);neons.push({sg,gl,pl,pd,ph:rnd(0,9)})});
  const sm=texSmoke("190,195,215"),vents=[[-3.6,-2.4],[4,-3.4]];vents.forEach(([x,z])=>{const v=new T.Mesh(new T.CylinderGeometry(.38,.38,.9,18),new T.MeshStandardMaterial({color:"#2a2a30",metalness:.6,roughness:.5}));v.position.set(x,-1.15,z);s.add(v)});
  const smoke=new Smoke(s,14,sm,"#b9bfd6",()=>{const v=vents[Math.random()*2|0];return{p:V(v[0],-.6,v[1]),v:V(rnd(-.1,.1),rnd(.5,.9),0),s:.9}},{life:2.6,op:.32,grow:2.2});
  const antTop=V(2.8,3.6,-3);const ant=new T.Mesh(new T.CylinderGeometry(.04,.07,5.2,8),new T.MeshStandardMaterial({color:"#77777f",metalness:.8,roughness:.4}));ant.position.set(2.8,1,-3);s.add(ant);const tip=glow("#ff2a2a",.7,1);tip.position.copy(antTop);s.add(tip);
  const wpts=[],N=16,R=11;for(let i=0;i<N;i++){const a=i/N*Math.PI*2;wpts.push(0,0,0,Math.cos(a)*R,Math.sin(a)*R,0)}for(let r=1;r<=9;r++){const rr=r*R/9.4;for(let i=0;i<N;i++){const a=i/N*Math.PI*2,b=(i+1)/N*Math.PI*2,m=(a+b)/2;wpts.push(Math.cos(a)*rr,Math.sin(a)*rr,0,Math.cos(m)*rr*.92,Math.sin(m)*rr*.92,0,Math.cos(m)*rr*.92,Math.sin(m)*rr*.92,0,Math.cos(b)*rr,Math.sin(b)*rr,0)}}
  const wg=new T.BufferGeometry();wg.setAttribute("position",new T.Float32BufferAttribute(wpts,3));const web=new T.LineSegments(wg,add(new T.LineBasicMaterial({color:"#cfe0ff",opacity:.5})));web.position.set(0,4,-9.5);s.add(web);const wgl=glow("#7ab8ff",14,.25);wgl.position.copy(web.position);s.add(wgl);
  const rain=rainFx(900,[16,-1.6,12,-12,9]);s.add(rain.obj);
  const line=new T.Line(new T.BufferGeometry().setFromPoints([V(0,0,0),V(0,0,0)]),new T.LineBasicMaterial({color:"#ffffff"}));line.frustumCulled=false;s.add(line);
  const fr=frameFx(card),arcs=edgeArcs(card);let splash=null;
  s.add(new T.AmbientLight("#5060a0",.55));const kl=new T.PointLight("#ffffff",10,10);kl.position.set(0,3,4);s.add(kl);
  at(c,.05,()=>c.sfx("rain"));at(c,1.3,()=>c.sfx("web"));at(c,2.88,()=>{c.shake(.3);c.sfx("thump");splash=burstParts(90,["#9fb3d9","#ffffff"],V(0,-1.5,0),4,-6,.1);s.add(splash.obj)});
  at(c,3.05,()=>{c.flash(.85);c.sfx("shutter")});at(c,3.22,()=>c.flash(.7));at(c,3.1,()=>c.reveal());at(c,3.35,()=>c.sfx("crackle"));
  const p0=V(-8,7,-6),p1=V(antTop.x-2.4,antTop.y-1.6,antTop.z),q=V(),look=V();
  return (t,dt)=>{rain.update(dt);smoke.update(dt);neons.forEach(n=>{const f=Math.sin(t*23+n.ph)>-.85&&Math.sin(t*7.3+n.ph*2)>-.95?1:.15;n.gl.material.opacity=.55*f;n.pl.intensity=16*f;n.pd.material.opacity=.22*f});
    if(splash){splash.update(dt,t);splash.mat.opacity=Math.max(0,1-(t-2.88)/1.2)}
    card.visible=t>.95;
    if(t<1.6){const k=eio(E(.95,1.6,t));q.lerpVectors(p0,p1,k);card.position.copy(q);card.rotation.set(k*Math.PI*4,0,(1-k)*.8)}
    else if(t<2.45){const k=E(1.6,2.45,t),a=Math.PI+k*Math.PI*1.5,r=2.4;card.position.set(antTop.x+Math.cos(a)*r,antTop.y-1.6-Math.sin(k*Math.PI)*.8,antTop.z+Math.sin(a)*r);card.rotation.set(0,-a+Math.PI/2,Math.sin(k*Math.PI)*.4)}
    else{const k=eio(E(2.45,2.88,t)),from=V(antTop.x+Math.cos(Math.PI*2.5)*2.4,antTop.y-1.6,antTop.z+Math.sin(Math.PI*2.5)*2.4);card.position.lerpVectors(from,rest,k);const cr=1-E(2.9,3.4,t);card.rotation.set(-.45*cr*(t>2.88?1:k),(1-k)*1.2,0);card.position.y-=.35*cr*(t>2.88?1:0)}
    line.visible=t>1.3&&t<2.45;if(line.visible){const a=line.geometry.attributes.position.array;a.set([card.position.x,card.position.y+1.2,card.position.z,antTop.x,antTop.y,antTop.z]);line.geometry.attributes.position.needsUpdate=true}
    wg.setDrawRange(0,Math.floor(wg.attributes.position.count*eo(E(.1,2.6,t))));web.rotation.z=t*.04;
    const fa=E(3.3,3.5,t)*(.55+.45*Math.sin(t*14));fr.set(fa*.9,Math.sin(t*9)>0?"#ff2a3a":"#2f6bff");arcs.update(dt,E(3.3,3.5,t),["#ff2a3a","#6fa8ff","#ffffff"]);
    if(t<1){toCam(cam,L3(V(-3,-.9,13),V(-1.5,0,11),eio(E(0,1,t))),V(0,2.4,-4))}
    else if(t<2.5){const k=E(1,2.5,t);look.copy(card.position);toCam(cam,L3(V(-1.5,0,11),V(.6,.8,10),k),L3(V(0,2.4,-4),look,eio(Math.min(1,k*2))))}
    else{const k=eio(E(2.5,3.1,t));toCam(cam,L3(V(.6,.8,10),V(0,1.15,7.4-(t-3)*.12),k),L3(card.position,rest,k))}}};

K.iron=c=>{const{s,cam,card,rest}=c;c.dur=5;s.background=new T.Color("#03070d");s.fog=new T.FogExp2("#04101a",.035);
  const fl=new T.Mesh(new T.PlaneGeometry(50,50),new T.MeshStandardMaterial({map:gridTex("#0b1218","#1d3a48",32,12),roughness:.35,metalness:.8}));fl.rotation.x=-Math.PI/2;fl.position.y=-1.6;s.add(fl);
  const holo=[];for(let i=0;i<10;i++){const m=new T.Mesh(new T.PlaneGeometry(rnd(1.6,2.8),rnd(1,1.7)),add(new T.MeshBasicMaterial({map:uiTex(i%3?"#6ff7ff":"#ffd34d"),opacity:.55,side:T.DoubleSide})));const a=rnd(-1.2,1.2);m.position.set(Math.sin(a)*rnd(5,9),rnd(0,4),-Math.cos(a)*rnd(4,9)-1);m.lookAt(0,1,4);m.userData.ph=rnd(0,9);s.add(m);holo.push(m)}
  const pods=[];for(let i=0;i<7;i++){const g=new T.Mesh(new T.CylinderGeometry(.9,.9,3.6,24,1,true),add(new T.MeshBasicMaterial({color:"#3ad8ff",opacity:.08,side:T.DoubleSide})));g.position.set(-9+i*3,.2,-12);s.add(g);const b=glow("#3ad8ff",2.2,.35);b.position.set(-9+i*3,-1.4,-12);s.add(b);pods.push(g)}
  const arms=[];[[-6,-7],[6.5,-8]].forEach(([x,z],i)=>{const base=new T.Group(),mm=new T.MeshStandardMaterial({color:"#555c66",metalness:.85,roughness:.35});const b=new T.Mesh(new T.CylinderGeometry(.5,.6,.5,16),mm);base.add(b);
    const s1=new T.Group();s1.position.y=.3;base.add(s1);const a1=new T.Mesh(new T.BoxGeometry(.3,2.4,.3),mm);a1.position.y=1.2;s1.add(a1);const s2=new T.Group();s2.position.y=2.4;s1.add(s2);const a2=new T.Mesh(new T.BoxGeometry(.24,1.8,.24),mm);a2.position.y=.9;s2.add(a2);
    const tipP=new T.Object3D();tipP.position.y=1.85;s2.add(tipP);base.position.set(x,-1.6,z);s.add(base);arms.push({s1,s2,tipP,ph:i*2})});
  const sparks=[];let nsp=.3;
  s.add(new T.AmbientLight("#3ad8ff",.5));const kl=new T.PointLight("#9fe8ff",25,20);kl.position.set(0,4,4);s.add(kl);
  const plates=[],W=2.5,H=3.5;for(let i=0;i<26;i++){const u=i/26,d=u*2*(W+H);let x,y;if(d<W){x=-W/2+d;y=H/2}else if(d<W+H){x=W/2;y=H/2-(d-W)}else if(d<2*W+H){x=W/2-(d-W-H);y=-H/2}else{x=-W/2;y=-H/2+(d-2*W-H)}
    const m=new T.Mesh(new T.BoxGeometry(.36,.36,.1),new T.MeshStandardMaterial({color:i%3?"#b3121f":"#d4af37",metalness:.9,roughness:.25,emissive:i%3?"#3a0508":"#3a2a05"}));m.userData.to=V(x,y,.05);m.userData.from=V(rnd(-8,8),rnd(-4,6),rnd(2,6));m.visible=false;card.add(m);plates.push(m)}
  const reactor=glow("#e8fdff",.1,1);reactor.position.set(0,.1,.2);card.add(reactor);const rp1=glow("#cff6ff",.1,1),rp2=glow("#cff6ff",.1,1);rp1.position.set(-.8,-1,.2);rp2.position.set(.8,-1,.2);card.add(rp1,rp2);
  const boomR=new T.Mesh(new T.RingGeometry(.8,1,64),add(new T.MeshBasicMaterial({color:"#cff6ff",opacity:0,side:T.DoubleSide})));s.add(boomR);const trail=new Parts(160,{cols:["#cff6ff","#6ff7ff"],size:.12,init:(p,v,i,l)=>{p.set([0,-50,0],i*3);l[i]=0},step:(p,v,i,dt,t,l)=>{l[i]-=dt;if(l[i]<=0&&t>1&&t<2.25){l[i]=rnd(.2,.6);p.set([card.position.x+rnd(-.3,.3),card.position.y+rnd(-.3,.3),card.position.z-1],i*3)}}});s.add(trail.obj);
  let deb=null;
  at(c,1.05,()=>c.sfx("fly"));at(c,1.5,()=>{c.sfx("boom");c.shake(.08)});at(c,2.2,()=>{c.shake(.45);c.sfx("thump");c.sfx("boom");deb=burstParts(140,["#8a8f99","#ffd34d","#ffffff"],V(0,-1.4,-.5),8,-9,.13);s.add(deb.obj)});
  at(c,2.35,()=>c.sfx("transform"));at(c,3.2,()=>c.sfx("charge"));at(c,3.85,()=>{c.flash(1);c.sfx("hit");c.shake(.15)});at(c,3.85,()=>c.reveal());
  return (t,dt)=>{holo.forEach(m=>{m.material.opacity=.45+.15*Math.sin(t*7+m.userData.ph)+(Math.random()<.02?-.3:0);m.position.y+=Math.sin(t+m.userData.ph)*dt*.1});
    arms.forEach(a=>{a.s1.rotation.z=Math.sin(t*.9+a.ph)*.5;a.s2.rotation.z=-.8+Math.sin(t*1.3+a.ph)*.6;a.s1.rotation.y=t*.3});
    if(t>nsp){nsp=t+rnd(.35,.7);const a=arms[Math.random()*2|0],p=new T.Vector3();a.tipP.getWorldPosition(p);const b=burstParts(40,["#ffb347","#ffffff","#ff7a1a"],p,3,-7,.07);s.add(b.obj);sparks.push({b,t0:t})}
    sparks.forEach(x=>{x.b.update(dt,t);x.b.mat.opacity=Math.max(0,1-(t-x.t0)/.9)});trail.update(dt,t);
    card.visible=t>1;if(t<2.2){const k=E(1,2.2,t),e=k*k;card.position.set(Math.sin(k*3)*1.5*(1-k),rest.y+3.5*(1-e)-.2,-60+59.5*e);card.rotation.set(-.6*(1-k),Math.sin(t*6)*.2*(1-k),Math.sin(k*9)*.3*(1-k))}
    else{const cr=1-eo(E(2.2,2.8,t));card.position.set(0,rest.y-.55*cr,rest.z);card.rotation.set(-.5*cr,0,0)}
    const bk=E(1.5,2.1,t);boomR.position.set(card.position.x,card.position.y,-30);boomR.lookAt(cam.position);boomR.scale.setScalar(1+bk*16);boomR.material.opacity=bk>0?(1-bk)*.8:0;
    if(deb){deb.update(dt,t);deb.mat.opacity=Math.max(0,1-(t-2.2)/1.6)}
    plates.forEach((m,i)=>{const k=eio(E(2.35+i*.025,2.75+i*.025,t));m.visible=k>0;m.position.lerpVectors(m.userData.from,m.userData.to,k);m.rotation.set((1-k)*6,(1-k)*4,0)});
    const ch=E(3.2,3.85,t),dn=1-E(3.9,4.6,t);reactor.scale.setScalar((.4+ch*5)*dn+.6);reactor.material.opacity=Math.min(1,ch*1.5);[rp1,rp2].forEach(r=>{r.scale.setScalar((.2+ch*2.6)*dn+.3);r.material.opacity=ch});
    if(t<1){toCam(cam,L3(V(-6,1.4,6),V(-2.5,1,9),eio(t)),V(0,1,-4))}
    else if(t<2.2){const k=eio(E(1,2.2,t));toCam(cam,L3(V(-2.5,1,9),V(1.2,.4,8.5),k),L3(V(0,1,-4),V(0,.6,-.5),k))}
    else{const k=eio(E(2.3,3.6,t));toCam(cam,L3(V(1.2,.4,8.5),V(0,1.1,7.2-ch*.5),k),rest)}}};

K.bat=c=>{const{s,cam,card,rest}=c;c.dur=5.2;s.add(sky("#0c1018","#030405"));s.fog=new T.FogExp2("#141c18",.06);
  const bt=brickTex("#2a1c18","#1c120f","#0a0706",3);[[-3.6,1],[3.6,-1]].forEach(([x,sd])=>{const w=new T.Mesh(new T.PlaneGeometry(26,12),new T.MeshStandardMaterial({map:bt,roughness:.85}));w.position.set(x,4,-6);w.rotation.y=sd*Math.PI/2;s.add(w)});
  const gl=new T.Mesh(new T.PlaneGeometry(16,8),new T.MeshStandardMaterial({map:brickTex("#26201c","#1a1512","#080606",3),roughness:.9}));gl.position.set(0,7,-19);s.add(gl);
  const fl=new T.Mesh(new T.PlaneGeometry(10,40),new T.MeshStandardMaterial({color:"#0b0c0e",roughness:.2,metalness:.6}));fl.rotation.x=-Math.PI/2;fl.position.set(0,-1.6,-6);s.add(fl);
  const disc=glow("#fff3c4",7,0);disc.material.fog=false;disc.position.set(0,8,-18.8);s.add(disc);const beam=new T.Mesh(new T.CylinderGeometry(2.4,.25,22,32,1,true),add(new T.MeshBasicMaterial({color:"#fff3c4",opacity:0,side:T.DoubleSide,fog:false})));beam.position.set(0,-1,-14);beam.rotation.x=-.55;s.add(beam);
  const ct=texSmoke("70,80,90");const clouds=[];for(let i=0;i<14;i++){const m=new T.Sprite(new T.SpriteMaterial({map:ct,transparent:true,opacity:.7,depthWrite:false}));const sc=rnd(8,14);m.scale.set(sc,sc*.6,1);m.position.set(rnd(-14,14),rnd(9,14),rnd(-24,-16));s.add(m);clouds.push(m)}
  const fog=new Smoke(s,18,texSmoke("150,175,160"),"#8fa596",()=>({p:V(rnd(-4,4),rnd(-1.4,0),rnd(-10,2)),v:V(rnd(.1,.4),rnd(0,.08),0),s:rnd(3,5)}),{life:4,op:.22,grow:.6});
  const rain=rainFx(700,[8,-1.6,12,-16,8],"#9fb3c9",.3,24,3);s.add(rain.obj);
  const bt2=cnv(128,64,(g)=>{g.fillStyle="#000";g.beginPath();g.moveTo(64,40);g.quadraticCurveTo(44,10,6,18);g.quadraticCurveTo(26,28,20,44);g.quadraticCurveTo(40,34,64,52);g.quadraticCurveTo(88,34,108,44);g.quadraticCurveTo(102,28,122,18);g.quadraticCurveTo(84,10,64,40);g.fill()});
  const bats=[];for(let i=0;i<60;i++){const m=new T.Mesh(new T.PlaneGeometry(.8,.4),new T.MeshBasicMaterial({map:bt2,transparent:true,alphaTest:.3,side:T.DoubleSide,fog:false}));m.userData={s:V(rnd(-4,4),rnd(-1,3),rnd(-24,-14)),e:V(rnd(-9,9),rnd(-3,6),rnd(9,14)),d:rnd(0,.5),ph:rnd(0,6)};m.visible=false;s.add(m);bats.push(m)}
  const cape=[-1,1].map(sd=>{const m=cloth(3.8,4.4,"#10131c",14,14,{roughness:.35,metalness:.6,emissive:"#0a1020"});m.position.set(sd*.2,0,-.2);m.geometry.translate(sd*1.7,0,0);card.add(m);return m});
  const rang=new T.Mesh(new T.ExtrudeGeometry((()=>{const sh=new T.Shape();sh.moveTo(-.6,0);sh.quadraticCurveTo(0,.38,.6,0);sh.quadraticCurveTo(0,.16,-.6,0);return sh})(),{depth:.04,bevelEnabled:false}),new T.MeshStandardMaterial({color:"#1a1c22",metalness:.9,roughness:.3}));rang.geometry.center();rang.visible=false;s.add(rang);
  const rl=new T.PointLight("#d8e4ff",0,10);rl.position.set(2,3,1);s.add(rl);const rim=new T.PointLight("#7a9aff",0,12);rim.position.set(0,2.4,-3);s.add(rim);const cgl=glow("#5a7aff",7,0);cgl.position.set(0,0,-.6);card.add(cgl);const amb=new T.AmbientLight("#8fa6ff",.18);s.add(amb);let sp=null;
  at(c,.1,()=>c.sfx("rain"));at(c,.55,()=>{c.flash(.55,"#cfe0ff");c.sfx("thunder")});at(c,1,()=>c.sfx("flutter"));at(c,1.4,()=>c.sfx("flutter"));at(c,2.6,()=>c.sfx("whoosh"));
  at(c,3.35,()=>{c.sfx("whoosh");c.shake(.12)});at(c,4,()=>{c.sfx("clank");c.shake(.18);sp=burstParts(60,["#ffd34d","#ffffff"],card.position.clone().add(V(1,1.4,0)),4,-6,.08);s.add(sp.obj)});at(c,4,()=>c.reveal());at(c,4.3,()=>{c.flash(.4,"#cfe0ff");c.sfx("thunder")});
  return (t,dt)=>{rain.update(dt);fog.update(dt);clouds.forEach((m,i)=>{m.position.x+=Math.sin(i)*dt*.6});const ls=E(.4,1.2,t);disc.material.opacity=.75*ls;beam.material.opacity=.07*ls;
    amb.intensity=.18+((t>.55&&t<.65)||(t>4.3&&t<4.38)?1.2:0);
    bats.forEach(b=>{const k=E(1+b.userData.d,2.1+b.userData.d,t);b.visible=k>0&&k<1;if(b.visible){b.position.lerpVectors(b.userData.s,b.userData.e,k);b.scale.y=.5+.5*Math.abs(Math.sin(t*16+b.userData.ph));b.lookAt(cam.position)}});
    card.visible=t>1.7;const em=eo(E(1.8,3.2,t));card.position.set(0,rest.y,-6+5.5*em);card.rotation.set(0,(1-em)*.3,0);rl.intensity=em*30;rim.intensity=E(2.4,3.1,t)*40;cgl.material.opacity=E(2.4,3.1,t)*.35;
    cape.forEach((m,i)=>{const o=eo(E(2.4,3.1,t));m.scale.set(.15+o*1.1,1,1);m.rotation.y=(i?-1:1)*(1-o)*1.2;m.userData.wave(t,.12+o*.18,1.6,i?"left":"right");m.visible=t>1.7});
    rang.visible=t>3.15&&t<4.02;if(rang.visible){const k=E(3.15,4.02,t);const p=k<.55?L3(V(.3,1,0),V(cam.position.x+.6,cam.position.y-.15,cam.position.z-1.4),eo(k/.55)):L3(V(cam.position.x+.6,cam.position.y-.15,cam.position.z-1.4),card.position.clone().add(V(1.02,1.42,.1)),eio((k-.55)/.45));rang.position.copy(p);rang.rotation.set(1.3,t*28,0)}
    if(sp){sp.update(dt,t);sp.mat.opacity=Math.max(0,1-(t-4)/1)}
    if(t<1.8)toCam(cam,L3(V(.4,.2,12),V(.2,.6,9.5),eio(E(0,1.8,t))),V(0,2.2,-10));else toCam(cam,L3(V(.2,.6,9.5),V(0,1.1,7.6),eio(E(1.8,3.3,t))),L3(V(0,2.2,-10),rest,eio(E(1.8,3,t))))}};

K.sup=c=>{const{s,cam,card,rest}=c;c.dur=5;s.add(sky("#02040e","#2a5fd0",95));
  const earth=new T.Mesh(new T.SphereGeometry(80,96,48),new T.MeshStandardMaterial({color:"#1d5fd0",roughness:.9,emissive:"#0a2a6a",emissiveIntensity:.5}));earth.position.set(0,-86,-30);s.add(earth);
  const atm=new T.Mesh(new T.SphereGeometry(81.5,96,48),add(new T.MeshBasicMaterial({color:"#7fc4ff",opacity:.25,side:T.BackSide})));atm.position.copy(earth.position);s.add(atm);
  const sun=glow("#fff1c4",26,1);sun.position.set(-10,3,-60);s.add(sun);const sun2=glow("#ffb347",60,.45);sun2.position.copy(sun.position);s.add(sun2);
  const ry=rays("#ffe7a8",18);ry.position.copy(sun.position);ry.scale.setScalar(3);s.add(ry);
  const ct=texSmoke("255,220,170");const clouds=[];for(let i=0;i<26;i++){const m=new T.Sprite(new T.SpriteMaterial({map:ct,transparent:true,opacity:.85,depthWrite:false,color:i%2?"#ffd9a0":"#ffffff"}));const sc=rnd(7,14);m.scale.set(sc,sc*.45,1);m.position.set(rnd(-20,20),rnd(-6,-3),rnd(-40,4));s.add(m);clouds.push(m)}
  const dust=field(200,[20,-6,14,-30,6],["#fff1c4","#ffffff"],.08,()=>[rnd(-.2,.2),rnd(-.1,.1),rnd(-.2,.2)]);s.add(dust.obj);
  const cape=cloth(3.1,3.3,"#c8102e",12,16,{roughness:.6});cape.position.set(0,-.3,-.25);card.add(cape);
  const beams=[0,1].map(()=>{const m=new T.Mesh(new T.CylinderGeometry(.05,.05,1,10),add(new T.MeshBasicMaterial({color:"#ff2a1a"})));const g=new T.Mesh(new T.CylinderGeometry(.16,.16,1,10),add(new T.MeshBasicMaterial({color:"#ff4a2a",opacity:.4})));m.add(g);m.visible=false;s.add(m);return m});
  const fr=frameFx(card);let mol=null;
  s.add(new T.AmbientLight("#ffe7c8",.9));const dl=new T.DirectionalLight("#ffd9a0",2.2);dl.position.set(-6,4,6);s.add(dl);const rl=new T.PointLight("#ff3a1a",0,8);s.add(rl);
  at(c,.05,()=>c.sfx("rumble"));at(c,1.2,()=>c.sfx("fly"));at(c,2.6,()=>c.sfx("rumble"));at(c,3.05,()=>{c.sfx("sizzle");c.sfx("laser")});at(c,3,()=>c.reveal());at(c,3.9,()=>{mol=burstParts(80,["#ffb347","#ff5a1a","#fff1c4"],card.position.clone(),3,-3,.1);s.add(mol.obj)});
  const eye=V(),tgt=V(),tmp=V();
  return (t,dt)=>{dust.update(dt,t);clouds.forEach(m=>{m.position.x+=dt*.4});ry.rotation.z=t*.05;ry.lookAt(cam.position);
    card.visible=t>1.1;const d=eo(E(1.1,3,t));card.position.set(Math.sin(t*.8)*.15*(1-d),rest.y+9*(1-d)+Math.sin(t*1.4)*.06,rest.z);card.rotation.set(-.25*(1-d),Math.sin(t*.6)*.12,0);
    cape.userData.wave(t*1.4,.22,1.5,"top");cape.rotation.x=-.25-.2*Math.sin(t*1.1);
    const bk=E(3.05,3.95,t);beams.forEach((b,i)=>{b.visible=bk>0&&bk<1;if(!b.visible)return;card.localToWorld(eye.set(i?.28:-.28,.95,.3));const W2=1.25,H2=1.75,u=(bk*1+i*.5)%1,dd=u*2*(W2*2+H2*2);let x,y;
      if(dd<W2*2){x=-W2+dd;y=H2}else if(dd<W2*2+H2*2){x=W2;y=H2-(dd-W2*2)}else if(dd<W2*4+H2*2){x=W2-(dd-W2*2-H2*2);y=-H2}else{x=-W2;y=-H2+(dd-W2*4-H2*2)}card.localToWorld(tgt.set(x,y,.1));
      tmp.copy(cam.position).sub(card.position).setLength(2.2);eye.add(tmp.multiplyScalar(.5));const len=eye.distanceTo(tgt);b.position.copy(eye).lerp(tgt,.5);b.scale.y=len;b.lookAt(tgt);b.rotateX(Math.PI/2);rl.position.copy(tgt);rl.intensity=30});
    if(bk>=1)rl.intensity=0;fr.prog(E(3.05,3.95,t),bk>0?(1-E(4.2,5,t)*.6):0,"#ffb347");if(mol){mol.update(dt,t);mol.mat.opacity=Math.max(0,1-(t-3.9)/1.2)}
    if(t<1.2)toCam(cam,L3(V(2,-4,10),V(1,-1.5,9),eio(E(0,1.2,t))),V(-4,1,-40));else toCam(cam,L3(V(1,-1.5,9),V(0,.9,7.6),eio(E(1.2,3,t))),L3(V(-4,1,-40),rest,eio(E(1.2,2.6,t))))}};

K.vader=c=>{const{s,cam,card,rest}=c;c.dur=5.2;s.background=new T.Color("#020101");s.fog=new T.FogExp2("#0a0203",.05);
  const gm=new T.MeshStandardMaterial({map:gridTex("#141416","#2a2a30",16,8),roughness:.4,metalness:.85});const cat=new T.Mesh(new T.BoxGeometry(4,.25,40),gm);cat.position.set(0,-1.75,-12);s.add(cat);
  const rail=new T.MeshStandardMaterial({color:"#2c2c33",metalness:.9,roughness:.3});[-2,2].forEach(x=>{const r=new T.Mesh(new T.BoxGeometry(.08,.08,40),rail);r.position.set(x,-.7,-12);s.add(r);for(let z=8;z>-32;z-=3){const p=new T.Mesh(new T.BoxGeometry(.06,1.1,.06),rail);p.position.set(x,-1.2,z);s.add(p)}});
  const vents=[];for(let i=0;i<10;i++){const v=new T.Mesh(new T.BoxGeometry(1.4,.05,.18),new T.MeshBasicMaterial({color:"#ff2a10"}));v.position.set(i%2?-4.5:4.5,-3.6,-i*3.2);s.add(v);vents.push(v)}
  const steam=new Smoke(s,22,texSmoke("255,90,60"),"#ff4a2a",()=>{const v=vents[Math.random()*vents.length|0];return{p:V(v.position.x,v.position.y,v.position.z),v:V(rnd(-.1,.1),rnd(.8,1.4),0),s:1.2}},{life:2.4,op:.28,grow:2.4,additive:true});
  const mon=[];for(let i=0;i<6;i++){const p=new T.Mesh(new T.PlaneGeometry(1.6,1),new T.MeshStandardMaterial({color:"#0d0d10",metalness:.6,roughness:.5}));p.position.set(i<3?-3.6:3.6,0,-4-(i%3)*3.4);p.rotation.y=i<3?Math.PI/2:-Math.PI/2;s.add(p);
    for(let j=0;j<6;j++){const d=glow(Math.random()<.7?"#ff2a2a":"#ffb347",.18,1);d.position.set(rnd(-.6,.6),rnd(-.35,.35),.02);p.add(d);mon.push({d,ph:rnd(0,9),sp:rnd(2,9)})}}
  const door=[-1,1].map(sd=>{const d=new T.Mesh(new T.BoxGeometry(3.4,7,.4),new T.MeshStandardMaterial({color:"#1c1c22",metalness:.85,roughness:.4}));d.position.set(sd*1.7,1.8,-30);s.add(d);return d});
  const sb=saber("#ff1a2c",3.4);sb.position.set(1.7,-.3,.4);sb.rotation.z=-.15;card.add(sb);const lt=new T.PointLight("#ff1a2c",0,14);lt.position.set(1.4,1,2);card.add(lt);
  const amb=new T.AmbientLight("#401015",0);s.add(amb);const arcs=[];let nArc=0;const smk=new Smoke(s,20,texSmoke("120,10,20"),"#7a0a14",()=>{const a=rnd(0,6.28);return{p:card.position.clone().add(V(Math.cos(a)*1.8,rnd(-1.4,1.4),Math.sin(a)*.6)),v:V(-Math.sin(a)*.8,rnd(.1,.4),Math.cos(a)*.3),s:1.4}},{life:1.6,op:.4,grow:1.4});
  at(c,.15,()=>c.sfx("breath"));at(c,1.25,()=>{c.sfx("ignite");c.flash(.25,"#ff3a3a")});at(c,1.9,()=>{c.sfx("thump");c.shake(.16)});at(c,2.55,()=>{c.sfx("thump");c.shake(.2)});at(c,3.05,()=>{c.sfx("crackle");c.sfx("rumble")});at(c,3.05,()=>c.reveal());at(c,3.7,()=>c.sfx("crackle"));
  return (t,dt)=>{const on=E(1.25,1.6,t);sb.userData.blade.scale.y=Math.max(.001,eo(on));sb.visible=t>1.2;lt.intensity=on*55*(.85+Math.random()*.15);amb.intensity=on*.7;
    mon.forEach(m=>m.d.material.opacity=Math.sin(t*m.sp+m.ph)>0?1:.15);vents.forEach(v=>v.material.color.setRGB(1,.16+.1*Math.sin(t*3),.06));steam.update(dt,t>.2);
    card.visible=t>1.2;const st=Math.min(1,E(1.6,1.9,t)*.5+E(2.25,2.55,t)*.5),bob=Math.sin(Math.min(1,st)*Math.PI*2)*.05;card.position.set(0,rest.y+bob,-4.2+3.7*eo(st));card.rotation.set(0,0,0);
    const fc=E(3.05,3.3,t);smk.update(dt,t>3.05);if(t>3.05&&t>nArc){nArc=t+.08;arcs.forEach(a=>{s.remove(a);a.traverse(x=>{x.geometry&&x.geometry.dispose()})});arcs.length=0;for(let i=0;i<3;i++){const a0=rnd(0,6.28),a1=a0+rnd(.6,1.4),r=1.9;const m=boltMesh(card.position.clone().add(V(Math.cos(a0)*r,rnd(-1.4,1.6),Math.sin(a0)*.6)),card.position.clone().add(V(Math.cos(a1)*r,rnd(-1.4,1.6),Math.sin(a1)*.6)),"#ff1a2c",.025,6,.3);m.children.forEach(x=>x.material.opacity*=fc*(1-E(4.6,5.2,t)));s.add(m);arcs.push(m)}}
    if(t<1.25)toCam(cam,V(0,.9,8.4),V(0,.6,-4));else toCam(cam,L3(V(0,.9,8.4),V(-.6,1,7.4),eio(E(1.3,3.4,t))),L3(V(0,.6,-4),rest,eio(E(1.3,2.8,t))))}};

K.luke=c=>{const{s,cam,card,rest}=c;c.dur=5;s.add(sky("#0a2a26","#03100e"));s.fog=new T.FogExp2("#0e2a26",.07);
  const tm=new T.MeshStandardMaterial({color:"#1c2418",roughness:1});for(let i=0;i<22;i++){let a=rnd(0,6.28),r=rnd(6,16);for(let q=0;q<20;q++){const x=Math.cos(a)*r,z=Math.sin(a)*r-5;if(!(Math.abs(x)<4.5&&z>-6))break;a=rnd(0,6.28);r=rnd(6,16)}const h=rnd(8,14),tr=new T.Mesh(new T.CylinderGeometry(rnd(.3,.6),rnd(.8,1.4),h,9),tm);tr.position.set(Math.cos(a)*r,-1.6+h/2,Math.sin(a)*r-5);tr.rotation.z=rnd(-.15,.15);s.add(tr);
    for(let k=0;k<3;k++){const rt=new T.Mesh(new T.CylinderGeometry(.08,.25,rnd(2,4),6),tm);rt.position.set(tr.position.x+rnd(-1,1),-1.3,tr.position.z+rnd(-1,1));rt.rotation.set(rnd(-1.2,1.2),0,rnd(-1.2,1.2));s.add(rt)}}
  const gr=new T.Mesh(new T.CircleGeometry(30,48),new T.MeshStandardMaterial({color:"#0c1a12",roughness:1}));gr.rotation.x=-Math.PI/2;gr.position.y=-1.6;s.add(gr);
  const gods=[];for(let i=0;i<6;i++){const m=new T.Mesh(new T.CylinderGeometry(.4,2.2,18,24,1,true),add(new T.MeshBasicMaterial({color:i%2?"#5fd4ff":"#5fffb0",opacity:.07,side:T.DoubleSide})));m.position.set(rnd(-7,7),6,rnd(-12,-2));m.rotation.z=rnd(-.3,.3);s.add(m);gods.push(m)}
  const dust=field(300,[12,-1.5,7,-14,6],["#bfffe0","#a8e6ff","#ffffff"],.07,()=>[rnd(-.08,.08),rnd(.05,.25),rnd(-.08,.08)]);s.add(dust.obj);
  const sb=saber("#3cff6a",3.2);sb.position.set(1.5,-1.2,.5);card.add(sb);const lt=new T.PointLight("#3cff6a",0,12);lt.position.set(1.4,.5,1.5);card.add(lt);
  const tex=cnv(256,32,(g,w,h)=>{const q=g.createLinearGradient(0,0,w,0);q.addColorStop(0,"rgba(255,255,255,0)");q.addColorStop(.6,"rgba(200,255,210,.7)");q.addColorStop(1,"rgba(255,255,255,1)");g.fillStyle=q;g.fillRect(0,0,w,h)});
  const trails=[[ -.3,2.3,0],[2.6,4.9,1]].map(([a0,a1,i])=>{const m=new T.Mesh(new T.RingGeometry(2.55,2.95,64,1,a0,a1-a0),add(new T.MeshBasicMaterial({color:"#5aff8a",opacity:0,side:T.DoubleSide})));m.position.set(0,.2,.4);m.rotation.x=i?.5:-.4;card.add(m);return m});
  const ab=new Parts(260,{cols:["#5aff8a","#d8ffe0","#ffffff"],size:.08,init:(p,v,i,l)=>{const a=rnd(-.3,4.9),r=rnd(2.1,3.3);v.set([Math.cos(a)*r,Math.sin(a)*r+.2,rnd(-.2,.2)],i*3);p.set([0,-99,0],i*3);l[i]=rnd(0,.4)},step:(p,v,i,dt,t,l)=>{const k=eio(E(3.4+l[i],4.2+l[i],t));if(k<=0||k>=1){p.set([0,-99,0],i*3);return}const w=V(v[i*3],v[i*3+1],v[i*3+2]);card.localToWorld(w);p.set([w.x+(card.position.x-w.x)*k,w.y+(card.position.y-w.y)*k,w.z+(card.position.z-w.z)*k],i*3)}});s.add(ab.obj);
  s.add(new T.AmbientLight("#7fd0c0",.45));
  at(c,1.25,()=>c.sfx("ignite"));at(c,1.65,()=>c.sfx("swing"));at(c,2.1,()=>c.sfx("swing"));at(c,3.4,()=>c.sfx("magic"));at(c,3.5,()=>c.reveal());
  return (t,dt)=>{dust.update(dt,t);gods.forEach((m,i)=>m.material.opacity=.06+.03*Math.sin(t*1.5+i));ab.update(dt,t);ab.mat.opacity=1-E(4.3,4.7,t);
    card.visible=t>.9;const ap=eo(E(.9,1.4,t));card.position.set(0,rest.y-.4*(1-ap),rest.z-1.5*(1-ap));
    const ig=eo(E(1.25,1.5,t));sb.userData.blade.scale.y=Math.max(.001,ig);sb.visible=t>1.2;lt.intensity=ig*30*(1-E(4,4.6,t)*.5);
    const s1=E(1.6,1.95,t),s2=E(2.05,2.45,t);sb.rotation.z=t<2?-.2+eio(s1)*-2.4:t<2.5?-2.6+eio(s2)*2.9:.3-E(2.6,3,t)*.9;sb.position.set(1.5-E(2.6,3,t)*.5,-1.2+E(2.6,3,t)*.6,.5);
    trails[0].material.opacity=s1>0?(1-E(3.3,4.1,t))*.75:0;trails[1].material.opacity=s2>0?(1-E(3.3,4.1,t))*.75:0;trails[0].scale.setScalar(1-E(3.3,4.1,t)*.8);trails[1].scale.setScalar(1-E(3.3,4.1,t)*.8);
    card.rotation.y=Math.sin(t*.7)*.08;
    toCam(cam,L3(V(-2.5,.3,12),V(.2,1.1,7.6),eio(E(0,3,t))),L3(V(0,1.6,-6),rest,eio(E(.4,2.6,t))))}};

K.gandalf=c=>{const{s,cam,card,rest}=c;c.dur=5.2;s.background=new T.Color("#030305");s.fog=new T.FogExp2("#07070a",.045);
  const rt=runeTex(),pm=new T.MeshStandardMaterial({color:"#3a3a42",roughness:.95,emissive:"#ffb347",emissiveMap:rt,emissiveIntensity:.18});
  for(let z=0;z<7;z++)for(const x of[-5,5]){const p=new T.Mesh(new T.BoxGeometry(1.8,22,1.8),pm);p.position.set(x+rnd(-.4,.4),8,-z*5-2);s.add(p)}
  const fl=new T.Mesh(new T.PlaneGeometry(40,60),new T.MeshStandardMaterial({color:"#121216",roughness:.9}));fl.rotation.x=-Math.PI/2;fl.position.set(0,-1.6,-14);s.add(fl);
  const dust=field(320,[10,-1.5,8,-34,6],["#ffe0a0","#ffffff"],.06,()=>[rnd(-.05,.05),rnd(-.02,.06),rnd(-.05,.05)]);s.add(dust.obj);
  const tr=new Parts(240,{cols:["#ffcc66","#ffe9b0"],size:.09,init:(p,v,i)=>{v.set([rnd(0,6.28),rnd(1.5,4),rnd(-30,-2)],i*3)},step:(p,v,i,dt,t)=>{const a=v[i*3]+t*.6;p.set([Math.cos(a)*v[i*3+1],2+Math.sin(a*1.3)*1.5,v[i*3+2]+Math.sin(t+i)*.3],i*3)}});s.add(tr.obj);
  const staff=new T.Group(),st=new T.Mesh(new T.CylinderGeometry(.05,.07,3.8,8),new T.MeshStandardMaterial({color:"#5a3a22",roughness:.8}));st.position.y=1.9;staff.add(st);const sg=glow("#ffffff",.9,1);sg.position.y=3.9;staff.add(sg);staff.position.set(1.55,-1.6,.3);card.add(staff);
  const wave=new T.Mesh(new T.RingGeometry(.9,1.25,96),add(new T.MeshBasicMaterial({color:"#ffffff",opacity:0,side:T.DoubleSide})));wave.rotation.x=-Math.PI/2;s.add(wave);const sph=glow("#ffffff",1,0);s.add(sph);
  const amb=new T.AmbientLight("#8090b0",.18);s.add(amb);const sl=new T.PointLight("#fff3d0",8,10);s.add(sl);const fw=[];let nfw=2.7;
  at(c,.2,()=>c.sfx("rumble"));at(c,1.6,()=>c.sfx("magic"));at(c,2.3,()=>{c.sfx("boom");c.shake(.4);c.flash(.9)});at(c,2.4,()=>c.reveal());
  return (t,dt)=>{dust.update(dt,t);tr.update(dt,t);card.visible=t>.9;const ap=eo(E(.9,1.5,t)),lift=eo(E(1.6,2.15,t))*(1-eio(E(2.15,2.3,t)));
    card.position.set(0,rest.y+lift*.7,rest.z);card.rotation.set(0,0,0);card.traverse(x=>{});sl.position.copy(card.position).add(V(1.4,2.6,1));sl.intensity=ap*12+(t>2.3?20*(1-E(2.3,3.2,t)):0);
    const w=E(2.3,3.3,t);wave.position.set(card.position.x,-1.58,card.position.z);wave.scale.setScalar(1+w*24);wave.material.opacity=w>0?(1-w):0;sph.position.copy(card.position);sph.scale.setScalar(1+w*40);sph.material.opacity=w>0?(1-w)*.8:0;amb.intensity=.18+(w>0?(1-w)*1.6:0)+(t>2.3?.25:0);
    if(t>nfw&&t<4.6){nfw=t+rnd(.18,.32);const cen=V(rnd(-4.5,4.5),rnd(2.6,5.2),rnd(-9,-4)),cols=[["#ff6ad5","#ffffff"],["#6ad5ff","#ffffff"],["#ffd34d","#ff8a3a"],["#8aff8a","#ffffff"]][Math.random()*4|0];const b=burstParts(130,cols,cen,rnd(2.5,4),-.6,.18);s.add(b.obj);fw.push({b,t0:t});c.sfx("pop")}
    fw.forEach(f=>{f.b.update(dt,t);f.b.mat.opacity=Math.max(0,1-(t-f.t0)/1.8)});
    toCam(cam,L3(V(-1.2,.2,16),V(0,1.1,7.8),eio(E(0,2.4,t))),L3(V(0,3,-20),rest,eio(E(.6,2.2,t))))}};

K.harry=c=>{const{s,cam,card,rest}=c;c.dur=5;const ceil=sky("#0b0f2a","#1b1438");s.add(ceil);s.fog=new T.FogExp2("#0d0a18",.03);
  const stars=field(320,[30,10,22,-40,6],["#ffffff","#cfd8ff"],.12,()=>[0,0,0]);s.add(stars.obj);
  const cm=new T.MeshStandardMaterial({color:"#f3e7c8",roughness:.7}),cds=[];for(let i=0;i<56;i++){const g=new T.Group(),h=rnd(.4,.8);g.add(new T.Mesh(new T.CylinderGeometry(.06,.06,h,10),cm));const f=glow("#ffb347",.45);f.position.y=h/2+.1;g.add(f);g.position.set(rnd(-9,9),rnd(2.5,6.5),rnd(-24,3));g.userData.ph=rnd(0,6);s.add(g);cds.push(g)}
  const wd=new T.MeshStandardMaterial({map:woodTex(),roughness:.8});[-3.2,3.2].forEach(x=>{const tb=new T.Mesh(new T.BoxGeometry(1.4,.12,30),wd);tb.position.set(x,-.7,-14);s.add(tb)});
  const fl=new T.Mesh(new T.PlaneGeometry(20,60),new T.MeshStandardMaterial({color:"#2a2018",roughness:.7}));fl.rotation.x=-Math.PI/2;fl.position.set(0,-1.6,-14);s.add(fl);
  const bns=["#9b111e","#1a7a3a","#1f3c9b","#d4a017"].map((cl,i)=>{const b=cloth(1.4,3.4,cl,6,12);b.position.set(-5.4+i*3.6,4.6,-26);s.add(b);return b});
  const wand=new T.Mesh(new T.CylinderGeometry(.02,.035,1.1,8),new T.MeshStandardMaterial({color:"#3a2414",roughness:.7}));wand.position.set(1.5,-.7,.4);wand.rotation.z=-.9;card.add(wand);const wtip=glow("#dfe8ff",.4,0);wtip.position.set(.42,.32,0);wand.add(wtip);
  const sp=new Parts(200,{cols:["#dfe8ff","#ffffff"],size:.07,init:(p,v,i,l)=>{p.set([0,-99,0],i*3);l[i]=i/200},step:(p,v,i,dt,t,l)=>{const k=E(1,1.7,t);if(k<=0){return}const u=Math.min(l[i],k),a=u*Math.PI*3;const w=V(1.9+Math.cos(a)*.6*u,.2+u*1.6,.4+Math.sin(a)*.4);card.localToWorld(w);p.set([w.x,w.y,w.z],i*3)}});s.add(sp.obj);
  const SP=stagPts(1700),stag=new T.Points(new T.BufferGeometry(),add(new T.PointsMaterial({color:"#cfe0ff",size:.09,map:dot()})));stag.geometry.setAttribute("position",new T.BufferAttribute(SP.slice(),3));stag.visible=false;s.add(stag);const sgl=glow("#9fc0ff",4,.5);stag.add(sgl);
  const glit=new Parts(500,{cols:["#e8eeff","#ffffff","#bcd0ff"],size:.08,init:(p,v,i,l)=>{p.set([0,-99,0],i*3);l[i]=rnd(0,.35)},step:(p,v,i,dt,t,l)=>{const k=eio(E(3.4+l[i],4.1+l[i],t));if(k<=0||k>=1){p.set([0,-99,0],i*3);return}const j=(i*3)%SP.length,w=V(SP[j],SP[j+1],SP[j+2]);stag.localToWorld(w);const tg=card.position.clone().add(V(rnd(-1,1),rnd(-1.4,1.4),.1));p.set([w.x+(tg.x-w.x)*k,w.y+(tg.y-w.y)*k,w.z+(tg.z-w.z)*k],i*3)}});s.add(glit.obj);
  s.add(new T.AmbientLight("#9a8cc8",.55));const pl=new T.PointLight("#ffcf8a",18,20);pl.position.set(0,4,2);s.add(pl);const sl=new T.PointLight("#bcd0ff",0,14);s.add(sl);
  at(c,1,()=>c.sfx("magic"));at(c,1.7,()=>{c.sfx("whoosh");c.flash(.35,"#dfe8ff")});at(c,2.6,()=>c.sfx("magic"));at(c,3.4,()=>c.sfx("magic"));at(c,3.6,()=>c.reveal());
  return (t,dt)=>{cds.forEach(g=>{g.position.y+=Math.sin(t*1.2+g.userData.ph)*dt*.12});bns.forEach((b,i)=>b.userData.wave(t+i,.12,1.2,"top"));
    card.visible=t>.7;const ap=eo(E(.7,1.2,t));card.position.set(0,rest.y-.5*(1-ap),rest.z);wtip.material.opacity=E(1,1.2,t);sp.update(dt,t);sp.mat.opacity=1-E(1.8,2.2,t);
    const g=E(1.7,3.4,t);stag.visible=g>0&&t<3.75;if(stag.visible){const a=-Math.PI/2+g*Math.PI*2.1,r=3.4;stag.position.set(Math.cos(a)*r,rest.y-.6+Math.abs(Math.sin(t*9))*.25,rest.z+Math.sin(a)*r*.7);stag.rotation.set(Math.sin(t*9)*.08,-Math.sin(a)>0?0:Math.PI,0);const sc=.8+eo(E(1.7,2,t))*.6;stag.scale.setScalar(sc);stag.material.opacity=Math.min(1,E(1.7,2,t)*1.2)*(1-E(3.4,3.75,t));sl.position.copy(stag.position);sl.intensity=20*stag.material.opacity}else sl.intensity=0;
    glit.update(dt,t);glit.mat.opacity=1-E(4.3,4.6,t);
    toCam(cam,L3(V(0,3,14),V(0,1.2,7.8),eio(E(0,2.2,t))),L3(V(0,3,-20),rest,eio(E(0,2,t))))}};

K.mickey=c=>{const{s,cam,card,rest}=c;c.dur=5.2;s.background=new T.Color("#07030c");s.fog=new T.FogExp2("#0c0614",.03);
  const st=new T.Mesh(new T.BoxGeometry(18,.4,8),new T.MeshStandardMaterial({map:woodTex("#7a4a26","#4a2a12"),roughness:.5}));st.position.set(0,-1.8,-1);s.add(st);
  const back=new T.Mesh(new T.PlaneGeometry(22,12),new T.MeshStandardMaterial({color:"#2a0a3a",roughness:.9}));back.position.set(0,3.5,-6);s.add(back);
  const vel={roughness:.75,metalness:.05};const cur=[-1,1].map(sd=>{const m=cloth(5.2,9,"#6a0f8a",22,8,vel);m.position.set(sd*2.6,2.5,1.2);s.add(m);return m});
  const val=cloth(16,1.8,"#5a0a78",30,4,vel);val.position.set(0,6.4,1.3);s.add(val);
  const spots=[-1,1].map(sd=>{const g=new T.Group(),h=new T.Mesh(new T.CylinderGeometry(.35,.5,.9,16),new T.MeshStandardMaterial({color:"#2a2a2e",metalness:.8,roughness:.4}));h.rotation.x=Math.PI/2;g.add(h);
    const cone=new T.Mesh(new T.CylinderGeometry(.4,3.2,12,32,1,true),add(new T.MeshBasicMaterial({color:"#fff3d0",opacity:0,side:T.DoubleSide})));cone.rotation.x=-Math.PI/2;cone.position.z=-6;g.add(cone);g.position.set(sd*7,6.5,4);g.lookAt(0,-.5,-.5);g.userData.cone=cone;s.add(g);return g});
  const pix=new Parts(360,{cols:["#fff3c4","#ffd34d","#ffffff","#ffb3e6"],size:.09,init:(p,v,i)=>{v.set([rnd(-10,10),rnd(0,6.28),rnd(-4,2)],i*3)},step:(p,v,i,dt,t)=>{const x=((v[i*3]+t*2.2+10)%20)-10;p.set([x,1.4+Math.sin(x*.7+t*2+v[i*3+1])*1.4,v[i*3+2]],i*3)}});s.add(pix.obj);
  const wand=new T.Group(),wst=new T.Mesh(new T.CylinderGeometry(.03,.03,1,8),new T.MeshStandardMaterial({color:"#111"}));wst.position.y=.5;wand.add(wst);const wt=glow("#fff3c4",.6,1);wt.position.y=1.05;wand.add(wt);wand.position.set(1.5,-.4,.4);wand.rotation.z=-.6;card.add(wand);wand.visible=false;
  const SH=[];for(let i=0;i<=10;i++){const a=Math.PI/2+i*Math.PI/5,r=i%2?.9:2.1;SH.push(V(Math.cos(a)*r,Math.sin(a)*r+3.6,-2))}const shc=new T.CatmullRomCurve3(SH,false,"catmullrom",0);const shp=shc.getSpacedPoints(160);
  const trace=new Parts(160,{cols:["#fff3c4","#ffd34d","#ffffff"],size:.14,init:(p,v,i,l)=>{p.set([0,-99,0],i*3);l[i]=i/160},step:(p,v,i,dt,t,l)=>{const k=E(2.9,3.6,t);if(l[i]>k){p.set([0,-99,0],i*3);return}const q=shp[i];p.set([q.x+Math.sin(t*9+i)*.02,q.y,q.z],i*3)}});s.add(trace.obj);
  const fw=[];
  s.add(new T.AmbientLight("#c0a0ff",.65));const pl=new T.PointLight("#fff3d0",0,16);pl.position.set(0,4,4);s.add(pl);
  at(c,.15,()=>c.sfx("magic"));[1.1,1.5,1.9].forEach(x=>at(c,x,()=>c.sfx("jump")));at(c,2.5,()=>c.sfx("jingle"));at(c,2.9,()=>c.sfx("magic"));
  at(c,3.6,()=>{SH.forEach((q,i)=>{if(i%2)return;const b=burstParts(110,[["#ff6ad5","#fff"],["#ffd34d","#fff"],["#6ad5ff","#fff"],["#8aff8a","#fff"],["#ff4a4a","#fff"]][i/2%5],q,rnd(3,4.5),-1.2,.17);s.add(b.obj);fw.push({b,t0:3.6+i*.03})});c.sfx("pop");c.sfx("pop")});at(c,3.65,()=>c.reveal());at(c,4.1,()=>c.sfx("pop"));
  return (t,dt)=>{const o=eio(E(.1,1,t));cur.forEach((m,i)=>{m.position.x=(i?1:-1)*(2.6+o*4.4);m.userData.wave(t,.25,2.4,"top")});val.userData.wave(t,.08,1.2,"top");
    spots.forEach(g=>g.userData.cone.material.opacity=.16*E(.3,.8,t));pl.intensity=E(.3,.8,t)*26;pix.update(dt,t);pix.mat.opacity=.9;
    card.visible=t>1;const hp=E(1,2.3,t),hx=-6+6*eio(hp),hop=Math.abs(Math.sin(hp*Math.PI*3))*1.3*(1-hp*.4);
    card.position.set(hx,rest.y-.35+hop+(t>2.3?.35*eo(E(2.3,2.5,t)):0),rest.z);const sq=t<2.3?1+.12*Math.cos(hp*Math.PI*6):1;card.scale.set(CS/Math.sqrt(sq),CS*sq,CS);
    card.rotation.set(t>2.4&&t<2.95?Math.sin(E(2.4,2.95,t)*Math.PI)*.55:0,0,t<2.3?Math.sin(hp*Math.PI*3)*.15:Math.sin(E(2.95,3.1,t)*Math.PI*4)*.05);
    wand.visible=t>2.85;wand.rotation.z=-.6+Math.sin(E(2.9,3.6,t)*Math.PI*4)*.5;trace.update(dt,t);trace.mat.opacity=1-E(3.6,4.1,t);
    fw.forEach(f=>{f.b.update(dt,t);f.b.mat.opacity=Math.max(0,1-(t-f.t0)/1.6)});
    toCam(cam,L3(V(0,1.6,13),V(0,1.2,7.8),eio(E(0,2.5,t))),L3(V(0,2.4,-4),V(t<3.4?0:0,t<3.4?1:2,-.5).lerp(rest,eio(E(3.4,4.2,t))),eio(E(0,1.5,t))))}};

K.buzz=c=>{const{s,cam,card,rest}=c;c.dur=5;s.background=new T.Color("#05040c");s.fog=new T.FogExp2("#0a0718",.03);
  const hm=new T.MeshStandardMaterial({map:gridTex("#1a1a24","#2c2c3a",32,10),roughness:.5,metalness:.8});const box=new T.Mesh(new T.BoxGeometry(18,10,40,1,1,1),hm);box.material.side=T.BackSide;box.position.set(0,3.4,-12);s.add(box);
  const pans=[];for(let i=0;i<12;i++){const m=new T.Mesh(new T.PlaneGeometry(2.2,1.3),add(new T.MeshBasicMaterial({map:uiTex(i%2?"#8aff5a":"#c08bff"),opacity:.6})));const sd=i%2?1:-1;m.position.set(sd*8.9,rnd(0,4),-2-Math.floor(i/2)*5);m.rotation.y=-sd*Math.PI/2;m.userData.ph=rnd(0,9);s.add(m);pans.push(m)}
  const rad=cnv(256,256,(g,w,h)=>{g.strokeStyle="#5aff8a";g.lineWidth=2;for(let r=30;r<128;r+=30){g.beginPath();g.arc(128,128,r,0,7);g.stroke()}g.beginPath();g.moveTo(0,128);g.lineTo(256,128);g.moveTo(128,0);g.lineTo(128,256);g.stroke();for(let i=0;i<7;i++){g.fillStyle="#8aff5a";g.beginPath();g.arc(rnd(40,216),rnd(40,216),4,0,7);g.fill()}});
  const radar=new T.Mesh(new T.CircleGeometry(2.2,48),add(new T.MeshBasicMaterial({map:rad,opacity:.55,side:T.DoubleSide})));radar.position.set(-4.5,4.5,-14);s.add(radar);const sweep=new T.Mesh(new T.CircleGeometry(2.2,32,0,.6),add(new T.MeshBasicMaterial({color:"#5aff8a",opacity:.35,side:T.DoubleSide})));sweep.position.copy(radar.position).add(V(0,0,.02));s.add(sweep);
  const radar2=radar.clone();radar2.position.set(4.5,4.5,-14);s.add(radar2);
  const vents=new T.Mesh(new T.PlaneGeometry(6,30),new T.MeshStandardMaterial({map:gridTex("#0c0c12","#3a3a4a",12,6),roughness:.6,metalness:.8}));vents.rotation.x=-Math.PI/2;vents.position.set(0,-1.58,-12);s.add(vents);
  const wings=[-1,1].map(sd=>{const sh=new T.Shape();sh.moveTo(0,.3);sh.lineTo(2.6*sd,.7);sh.lineTo(2.9*sd,.45);sh.lineTo(.2*sd,-.5);sh.lineTo(0,-.4);const m=new T.Mesh(new T.ExtrudeGeometry(sh,{depth:.06,bevelEnabled:false}),new T.MeshStandardMaterial({color:"#e8e8f0",metalness:.4,roughness:.3,side:T.DoubleSide}));
    const st=new T.Mesh(new T.BoxGeometry(2.4,.12,.08),new T.MeshStandardMaterial({color:"#7a3cc8",emissive:"#3a1060"}));st.position.set(1.3*sd,.42,.06);st.rotation.z=.14*sd;m.add(st);const led=glow(sd<0?"#ff2a2a":"#3cff6a",.5,1);led.position.set(2.8*sd,.55,.1);m.add(led);m.userData.led=led;m.position.set(sd*1.1,.4,-.1);card.add(m);return m});
  const fl=new Parts(240,{cols:["#ffb347","#7ab8ff","#ffffff"],size:.14,init:(p,v,i,l)=>{p.set([0,-99,0],i*3);l[i]=0},step:(p,v,i,dt,t,l)=>{l[i]-=dt;if(l[i]<=0&&t>.9&&t<2.6){l[i]=rnd(.15,.45);const w=V(rnd(-.4,.4),-1.9,-.3);card.localToWorld(w);p.set([w.x,w.y,w.z],i*3);v.set([rnd(-.5,.5),-2,rnd(-.5,.5)],i*3)}p[i*3]+=v[i*3]*dt;p[i*3+1]+=v[i*3+1]*dt;p[i*3+2]+=v[i*3+2]*dt}});s.add(fl.obj);
  const las=new T.Mesh(new T.CylinderGeometry(.04,.04,1,8),add(new T.MeshBasicMaterial({color:"#ff2a2a"})));const lg=new T.Mesh(new T.CylinderGeometry(.14,.14,1,8),add(new T.MeshBasicMaterial({color:"#ff4a4a",opacity:.45})));las.add(lg);las.visible=false;s.add(las);
  s.add(new T.AmbientLight("#b0a0ff",.55));const pl=new T.PointLight("#8aff5a",16,18);pl.position.set(0,4,2);s.add(pl);const pl2=new T.PointLight("#c08bff",16,18);pl2.position.set(-4,2,-6);s.add(pl2);
  at(c,.9,()=>c.sfx("fly"));at(c,1.55,()=>c.sfx("whoosh"));at(c,2.25,()=>c.sfx("hydraulic"));at(c,3.45,()=>c.sfx("laser"));at(c,3.55,()=>{c.flash(.9,"#ffd0d0");c.shake(.12)});at(c,3.6,()=>c.reveal());
  const a=V(),b=V();
  return (t,dt)=>{pans.forEach(m=>m.material.opacity=.45+.2*Math.sin(t*5+m.userData.ph));sweep.rotation.z=-t*2.4;fl.update(dt,t);
    card.visible=t>.9;const d=E(.9,1.9,t),e=eio(d);card.position.set(-5*(1-e),rest.y+6*(1-e)-Math.sin(e*Math.PI)*1.2,rest.z-8*(1-e));card.rotation.set(-.8*(1-e),.5*(1-e),eio(E(1.5,2.2,t))*Math.PI*2);
    const wo=eo(E(2.2,2.5,t));wings.forEach((w,i)=>{w.scale.set(Math.max(.01,wo),1,1);w.rotation.z=(i?-1:1)*(1-wo)*.8;w.userData.led.material.opacity=Math.sin(t*10)>0?1:.2});
    card.rotation.x+=t>2.5?-.12*eo(E(2.5,2.9,t))*(1-E(3.6,4.2,t)):0;
    const lk=E(3.45,3.6,t);las.visible=lk>0&&t<3.75;if(las.visible){card.localToWorld(a.set(1.3,-.6,.3));b.copy(cam.position).add(V(0,-.2,-.5));const len=a.distanceTo(b)*lk;const dir=b.clone().sub(a).normalize();las.position.copy(a).addScaledVector(dir,len/2);las.scale.y=len;las.lookAt(b);las.rotateX(Math.PI/2)}
    toCam(cam,L3(V(3,.5,12),V(0,1.2,7.6),eio(E(0,2.6,t))),L3(V(-2,3,-10),rest,eio(E(.8,2.2,t))))}};

K.shrek=c=>{const{s,cam,card,rest}=c;c.dur=5.2;s.add(sky("#2a3a14","#0a1406"));s.fog=new T.FogExp2("#1a2a0e",.07);
  const mud=new T.Mesh(new T.CircleGeometry(30,48),new T.MeshStandardMaterial({color:"#2a2412",roughness:.25,metalness:.3}));mud.rotation.x=-Math.PI/2;mud.position.y=-1.6;s.add(mud);
  const tm=new T.MeshStandardMaterial({color:"#1c140a",roughness:1});for(let i=0;i<16;i++){const a=Math.PI+rnd(0,Math.PI),r=rnd(7,14),h=rnd(5,9),x=Math.cos(a)*r*1.2,z=Math.sin(a)*r-3;
    const tr=new T.Mesh(new T.CylinderGeometry(.22,.6,h,7),tm);tr.position.set(x,-1.6+h/2,z);tr.rotation.z=rnd(-.35,.35);tr.rotation.x=rnd(-.2,.2);s.add(tr);const cp=new T.Mesh(new T.IcosahedronGeometry(rnd(1.6,2.6),0),new T.MeshStandardMaterial({color:"#22340f",roughness:1,flatShading:true}));cp.position.set(x+rnd(-1,1),-1.6+h,z);s.add(cp)}
  const sign=new T.Group(),post=new T.Mesh(new T.BoxGeometry(.18,2.2,.18),new T.MeshStandardMaterial({color:"#3a2814"}));post.position.y=1.1;sign.add(post);
  const pt=cnv(256,96,(g,w,h)=>{g.fillStyle="#6a4a28";g.fillRect(0,0,w,h);g.strokeStyle="#3a2412";for(let y=6;y<h;y+=12){g.beginPath();g.moveTo(0,y);g.lineTo(w,y+rnd(-3,3));g.stroke()}g.fillStyle="#1a0e04";g.font="900 30px Sora, sans-serif";g.textAlign="center";g.fillText("ATTENTION",w/2,40);g.fillText("OGRE !",w/2,76)});
  const plank=new T.Mesh(new T.BoxGeometry(1.8,.68,.08),[0,1,2,3].map(()=>new T.MeshStandardMaterial({color:"#5a3a1c"})).concat([new T.MeshStandardMaterial({map:pt}),new T.MeshStandardMaterial({color:"#5a3a1c"})]));plank.position.set(0,1.9,.05);plank.rotation.z=.12;sign.add(plank);sign.position.set(-3.2,-1.6,-1.5);sign.rotation.y=.4;s.add(sign);
  const frame=new T.Group(),fm=new T.MeshStandardMaterial({map:woodTex("#5a3a1c","#3a2410"),roughness:.9});[[-1.4,1.9,.3,4],[1.4,1.9,.3,4],[0,3.85,3.1,.3]].forEach(([x,y,w,h])=>{const b=new T.Mesh(new T.BoxGeometry(w,h,.4),fm);b.position.set(x,y-1.6,0);frame.add(b)});frame.position.set(0,0,-3.2);s.add(frame);
  const door=new T.Group(),dm=new T.Mesh(new T.BoxGeometry(2.5,3.7,.14),new T.MeshStandardMaterial({map:woodTex("#6b4426","#3a2210"),roughness:.85}));dm.position.x=1.25;door.add(dm);door.position.set(-1.25,.25,-3.15);s.add(door);
  const bub=[];for(let i=0;i<10;i++){const m=new T.Mesh(new T.SphereGeometry(.2,12,8),new T.MeshStandardMaterial({color:"#5a6a2a",roughness:.2,metalness:.3,transparent:true,opacity:.85}));m.position.set(rnd(-6,6),-1.6,rnd(-8,3));m.userData={t0:rnd(0,3),p:m.position.clone(),b:null};s.add(m);bub.push(m)}
  const fogS=new Smoke(s,16,texSmoke("160,200,120"),"#9cc87a",()=>({p:V(rnd(-7,7),rnd(-1.4,.4),rnd(-10,3)),v:V(rnd(.1,.3),0,0),s:rnd(3,5)}),{life:4,op:.22,grow:.6});
  const ff=field(120,[9,-1.2,4,-12,4],["#e4ff8a","#b8ff5a"],.13,()=>[rnd(-.3,.3),rnd(-.1,.2),rnd(-.3,.3)]);s.add(ff.obj);
  const lens=lensSplats(cam,9,"#4a3a18");let splat=null,splat2=null;
  const leaves=[],lt=cnv(64,64,(g)=>{g.fillStyle="#fff";g.beginPath();g.moveTo(32,4);g.quadraticCurveTo(62,32,32,60);g.quadraticCurveTo(2,32,32,4);g.fill()});const W=2.5,H=3.5;
  for(let i=0;i<40;i++){const u=i/40,d=u*2*(W+H);let x,y;if(d<W){x=-W/2+d;y=H/2}else if(d<W+H){x=W/2;y=H/2-(d-W)}else if(d<2*W+H){x=W/2-(d-W-H);y=-H/2}else{x=-W/2;y=-H/2+(d-2*W-H)}
    const m=new T.Mesh(new T.PlaneGeometry(.42,.42),new T.MeshStandardMaterial({map:lt,transparent:true,alphaTest:.4,color:"#4a3a18",side:T.DoubleSide,emissive:"#000000"}));m.userData.to=V(x,y,.1);m.userData.from=V(rnd(-3,3),rnd(-4,2),rnd(1,4));m.userData.r=rnd(0,6);m.visible=false;card.add(m);leaves.push(m)}
  s.add(new T.AmbientLight("#9fd07a",.45));const pl=new T.PointLight("#d8c07a",16,16);pl.position.set(0,2,3);s.add(pl);
  at(c,.3,()=>c.sfx("splat"));at(c,1,()=>{c.sfx("creak");c.shake(.08)});at(c,1.55,()=>{c.sfx("thump");c.shake(.22);splat=burstParts(80,["#4a3a18","#2a2410"],V(0,-1.5,-1.5),5,-9,.14);s.add(splat.obj);c.sfx("splat")});
  at(c,2.15,()=>{c.sfx("thump");c.shake(.25);splat2=burstParts(80,["#4a3a18","#5a4a20"],V(0,-1.5,-.5),5.5,-9,.15);s.add(splat2.obj);c.sfx("splat");lens.hit()});at(c,2.6,()=>{c.sfx("roar");c.shake(.5)});at(c,3.3,()=>c.sfx("magic"));at(c,3.35,()=>c.reveal());
  const col=new T.Color();
  return (t,dt)=>{fogS.update(dt);ff.update(dt,t);lens.update(dt);if(splat){splat.update(dt,t);splat.mat.opacity=Math.max(0,1-(t-1.55)/1.2)}if(splat2){splat2.update(dt,t);splat2.mat.opacity=Math.max(0,1-(t-2.15)/1.2)}
    bub.forEach(m=>{const u=m.userData,k=((t+u.t0)%2.2)/2.2;m.scale.setScalar(.2+k*1.8);m.visible=k<.95;if(k>.94&&!u.pop){u.pop=1;const b=burstParts(14,["#7a8a3a"],m.position.clone(),1.5,-3,.06);s.add(b.obj);u.b=b;u.bt=t}if(k<.1)u.pop=0;if(u.b){u.b.update(dt,t);u.b.mat.opacity=Math.max(0,1-(t-u.bt)/.6)}});
    door.rotation.y=-eo(E(1,1.25,t))*1.9;
    card.visible=t>1.05;const s1=E(1.2,1.55,t),s2=E(1.8,2.15,t);card.position.set(0,rest.y-.15+Math.sin(s1*Math.PI)*.18+Math.sin(s2*Math.PI)*.18,-3.2+1.4*eo(s1)+1.3*eo(s2));
    const ro=E(2.6,3.2,t);card.rotation.set(-.15*Math.sin(ro*Math.PI),0,Math.sin(t*40)*.03*Math.sin(ro*Math.PI));card.scale.setScalar(CS*(1+.08*Math.sin(ro*Math.PI)));
    leaves.forEach((m,i)=>{const k=eio(E(3.2+i*.012,3.75+i*.012,t));m.visible=k>0;m.position.lerpVectors(m.userData.from,m.userData.to,k);m.rotation.z=m.userData.r+(1-k)*6;const g=E(3.8,4.4,t);col.set("#4a3a18").lerp(new T.Color("#4caf2a"),Math.min(1,k)).lerp(new T.Color("#ffd34d"),g);m.material.color.copy(col);m.material.emissive.copy(col).multiplyScalar(g*.6)});
    toCam(cam,L3(V(2,.4,11),V(0,1.1,7.6),eio(E(0,2.8,t))),L3(V(-1,1,-4),rest,eio(E(.8,2.4,t))))}};

K.mario=c=>{const{s,cam,card,rest}=c;c.dur=5;s.add(sky("#3a8bff","#bfe6ff"));s.fog=new T.Fog("#bfe6ff",20,70);
  const hm=new T.MeshStandardMaterial({color:"#3fbf4a",roughness:.9});for(let i=0;i<7;i++){const m=new T.Mesh(new T.SphereGeometry(rnd(5,9),32,16),hm);m.scale.y=rnd(.5,.8);m.position.set(-24+i*8,-3.5,rnd(-30,-18));s.add(m)}
  const gr=new T.Mesh(new T.PlaneGeometry(60,60),new T.MeshStandardMaterial({color:"#c87a3a",roughness:1}));gr.rotation.x=-Math.PI/2;gr.position.y=-1.6;s.add(gr);const top=new T.Mesh(new T.PlaneGeometry(60,1.2),new T.MeshStandardMaterial({color:"#4caf2a"}));top.rotation.x=-Math.PI/2;top.position.set(0,-1.59,-1.8);s.add(top);
  const pm=new T.MeshStandardMaterial({color:"#2fbf3a",roughness:.35,metalness:.1});[[-6,-6,2.4],[6.5,-8,3.2],[-10,-12,4]].forEach(([x,z,h])=>{const p=new T.Mesh(new T.CylinderGeometry(.9,.9,h,24),pm);p.position.set(x,-1.6+h/2,z);s.add(p);const r=new T.Mesh(new T.CylinderGeometry(1.1,1.1,.6,24),pm);r.position.set(x,-1.6+h,z);s.add(r)});
  const bt=brickTex("#c8642a","#a8501e","#3a1a08",1),bm=new T.MeshStandardMaterial({map:bt,roughness:.8});
  const qt=cnv(128,128,(g)=>{g.fillStyle="#f5a623";g.fillRect(0,0,128,128);g.fillStyle="#ffd21f";g.fillRect(8,8,112,112);g.fillStyle="#c26a00";[[14,14],[106,14],[14,106],[106,106]].forEach(([x,y])=>g.fillRect(x,y,8,8));g.fillStyle="#fff";g.strokeStyle="#7a3a00";g.lineWidth=6;g.font="900 84px Sora, sans-serif";g.textAlign="center";g.textBaseline="middle";g.strokeText("?",64,70);g.fillText("?",64,70)});
  const qm=new T.MeshStandardMaterial({map:qt,roughness:.6});[-3,-2,0,2,3].forEach((x,i)=>{if(i===2)return;const m=new T.Mesh(new T.BoxGeometry(1,1,1),i%2?bm:qm);m.position.set(x*1+(x>0?.1:-.1),4.2,-3);s.add(m)});
  const qb=new T.Mesh(new T.BoxGeometry(1,1,1),qm);qb.position.set(0,4.2,-3);s.add(qb);
  const cl=new T.MeshStandardMaterial({color:"#ffffff",roughness:1});for(let i=0;i<9;i++){const g=new T.Group();for(let j=0;j<4;j++){const m=new T.Mesh(new T.SphereGeometry(rnd(.9,1.5),16,10),cl);m.position.set(j*1.1-1.6,rnd(-.2,.3),0);g.add(m)}g.position.set(rnd(-22,22),rnd(6,11),rnd(-34,-16));s.add(g)}
  const sh=new T.Shape();for(let i=0;i<10;i++){const a=Math.PI/2+i*Math.PI/5,r=i%2?.4:.95;i?sh.lineTo(Math.cos(a)*r,Math.sin(a)*r):sh.moveTo(Math.cos(a)*r,Math.sin(a)*r)}
  const star=new T.Mesh(new T.ExtrudeGeometry(sh,{depth:.3,bevelEnabled:true,bevelSize:.07,bevelThickness:.07,bevelSegments:2}),new T.MeshStandardMaterial({color:"#ffd21f",emissive:"#ffb000",emissiveIntensity:.8,metalness:.3,roughness:.3}));star.geometry.center();star.visible=false;s.add(star);star.add(glow("#fff6a0",3.2,.8));
  const cg=new T.CylinderGeometry(.32,.32,.07,24),cmt=new T.MeshStandardMaterial({color:"#ffd21f",metalness:.85,roughness:.22,emissive:"#5a4000"}),coins=[];for(let i=0;i<34;i++){const m=new T.Mesh(cg,cmt);m.rotation.x=Math.PI/2;m.userData={x:rnd(-5,5),z:rnd(-3,2),d:rnd(0,1.4),ph:rnd(0,6)};m.visible=false;s.add(m);coins.push(m)}
  const nt=[noteTex("♪","#ff3a8a"),noteTex("♫","#3a8aff"),noteTex("♪","#3fbf4a"),noteTex("♬","#ffb000")];const notes=[];for(let i=0;i<12;i++){const m=new T.Sprite(new T.SpriteMaterial({map:nt[i%4],transparent:true,opacity:0,depthWrite:false}));m.scale.set(.6,.6,1);m.userData={a:rnd(0,6.28),d:rnd(0,1.6)};s.add(m);notes.push(m)}
  const halo=card.userData.halo;
  s.add(new T.AmbientLight("#ffffff",1.1));const dl=new T.DirectionalLight("#ffffff",2.2);dl.position.set(4,8,6);s.add(dl);
  at(c,1,()=>c.sfx("jump"));at(c,1.6,()=>{c.sfx("bump");c.shake(.1)});at(c,1.75,()=>c.sfx("powerup"));at(c,2.45,()=>{c.sfx("magic");c.flash(.4,"#fff6a0")});at(c,2.5,()=>c.reveal());at(c,2.9,()=>c.sfx("jingle"));at(c,3.1,()=>c.sfx("coins"));at(c,3.9,()=>c.sfx("coins"));
  const hc=new T.Color();
  return (t,dt)=>{card.visible=t>.95;const j=E(.95,1.6,t);
    if(t<2.45){const y=-5+(rest.y+2.1+5)*Math.sin(j*Math.PI/2)-(t>1.6?eo(E(1.6,2.4,t))*2.1:0);card.position.set(0,y,-3+eo(E(1.6,2.4,t))*2.5);card.rotation.set(0,0,t<1.6?Math.sin(j*Math.PI)*.2:0)}else{card.position.lerp(rest,Math.min(1,dt*6));card.rotation.y=eio(E(2.5,3.3,t))*Math.PI*2}
    qb.position.y=4.2+Math.sin(E(1.6,1.85,t)*Math.PI)*.45;qb.rotation.y=E(1.6,2.4,t)*Math.PI*4;
    const sk=E(1.75,2.45,t);star.visible=sk>0&&sk<1;if(star.visible){star.position.set(0,5+Math.sin(sk*Math.PI)*1.4-sk*2.4,-3+sk*2.4);star.rotation.y=t*7}
    if(t>2.5){hc.setHSL((t*.8)%1,1,.6);halo.material.color.copy(hc)}
    coins.forEach(m=>{const k=E(3.05+m.userData.d,4.6+m.userData.d,t);m.visible=k>0&&k<1;if(m.visible){m.position.set(m.userData.x,9-k*11,m.userData.z);m.rotation.z=t*8+m.userData.ph}});
    notes.forEach(m=>{const k=E(2.7+m.userData.d,4.2+m.userData.d,t);m.material.opacity=k>0&&k<1?Math.sin(k*Math.PI):0;const a=m.userData.a+t;m.position.set(rest.x+Math.cos(a)*2.1,rest.y-1+k*3,rest.z+Math.sin(a)*1.2)});
    toCam(cam,L3(V(-5,1.5,12),V(0,1.3,7.8),eio(E(0,2.6,t))),L3(V(0,3,-3),rest,eio(E(1.9,2.7,t))))}};

K.ryu=c=>{const{s,cam,card,rest}=c;c.dur=5;s.background=new T.Color("#0a0608");s.fog=new T.FogExp2("#120a0a",.045);
  const tt=cnv(256,256,(g,w,h)=>{for(let y=0;y<2;y++)for(let x=0;x<2;x++){g.fillStyle=(x+y)%2?"#a89a5a":"#9a8c4e";g.fillRect(x*128,y*128,128,128);g.strokeStyle="#4a3a1a";g.lineWidth=6;g.strokeRect(x*128+3,y*128+3,122,122);g.strokeStyle="rgba(0,0,0,.12)";g.lineWidth=1;for(let i=0;i<128;i+=4){g.beginPath();g.moveTo(x*128,y*128+i);g.lineTo(x*128+128,y*128+i);g.stroke()}}});tt.wrapS=tt.wrapT=T.RepeatWrapping;tt.repeat.set(6,10);
  const fl=new T.Mesh(new T.PlaneGeometry(24,40),new T.MeshStandardMaterial({map:tt,roughness:.85}));fl.rotation.x=-Math.PI/2;fl.position.set(0,-1.6,-10);s.add(fl);
  const sj=cnv(128,256,(g,w,h)=>{g.fillStyle="#f6e9c8";g.fillRect(0,0,w,h);g.strokeStyle="#3a2412";g.lineWidth=5;g.strokeRect(2,2,w-4,h-4);for(let x=0;x<w;x+=32){g.beginPath();g.moveTo(x,0);g.lineTo(x,h);g.stroke()}for(let y=0;y<h;y+=42){g.beginPath();g.moveTo(0,y);g.lineTo(w,y);g.stroke()}});
  const sm=new T.MeshStandardMaterial({map:sj,emissive:"#ffb070",emissiveMap:sj,emissiveIntensity:.45});for(let i=0;i<8;i++){const p=new T.Mesh(new T.PlaneGeometry(2,4),sm);p.position.set(-7+i*2,.4,-16);s.add(p)}
  [-1,1].forEach(sd=>{for(let i=0;i<4;i++){const p=new T.Mesh(new T.PlaneGeometry(2,4),sm);p.position.set(sd*7,.4,-2-i*3.6);p.rotation.y=-sd*Math.PI/2;s.add(p)}});
  const wd=new T.MeshStandardMaterial({color:"#3a2010",roughness:.8});for(let i=0;i<6;i++){const p=new T.Mesh(new T.BoxGeometry(.35,7,.35),wd);p.position.set(i%2?6.6:-6.6,1.9,-Math.floor(i/2)*6-1);s.add(p)}
  const lans=[];for(let i=0;i<6;i++){const g=new T.Group(),m=new T.Mesh(new T.SphereGeometry(.45,18,12),new T.MeshStandardMaterial({color:"#e8231f",emissive:"#ff3a1a",emissiveIntensity:.8,roughness:.6}));m.scale.y=1.3;g.add(m);g.add(glow("#ff6a3a",2.2,.5));const pl=new T.PointLight("#ff6a3a",8,7);g.add(pl);g.position.set(i%2?5:-5,3.6,-Math.floor(i/2)*5-1);g.userData={pl,ph:rnd(0,9)};s.add(g);lans.push(g)}
  const rain=rainFx(800,[12,-1.6,9,-14,6],"#a8b8d8",.3,22,2);s.add(rain.obj);
  const ki=[];let nk=0;const aura=new Parts(180,{cols:["#bfe0ff","#4fa3ff","#ffffff"],size:.07,init:(p,v,i)=>{v.set([rnd(0,6.28),rnd(1.5,2.2),rnd(-1.6,1.6)],i*3)},step:(p,v,i,dt,t)=>{const a=v[i*3]+t*3,r=v[i*3+1]+Math.sin(t*20+i)*.08;p.set([card.position.x+Math.cos(a)*r,card.position.y+v[i*3+2],card.position.z+Math.sin(a)*r*.5],i*3)}});aura.obj.visible=false;s.add(aura.obj);
  const hd=new T.Group(),core=new T.Mesh(new T.SphereGeometry(.4,24,16),new T.MeshBasicMaterial({color:"#ffffff"}));hd.add(core,glow("#4fa3ff",3,.9),glow("#bfe0ff",1.5,1));const sw=new T.Mesh(new T.TorusGeometry(.7,.05,8,64),add(new T.MeshBasicMaterial({color:"#8fc6ff",opacity:.8})));hd.add(sw);const sw2=sw.clone();sw2.scale.setScalar(1.3);hd.add(sw2);hd.visible=false;s.add(hd);const hl=new T.PointLight("#4fa3ff",0,12);hd.add(hl);
  const wave=new T.Mesh(new T.RingGeometry(.8,1.2,96),add(new T.MeshBasicMaterial({color:"#bfe0ff",opacity:0,side:T.DoubleSide})));s.add(wave);
  const band=cloth(1.6,.22,"#d01020",14,2,{roughness:.6});band.geometry.translate(.8,0,0);band.position.set(-1.1,1.55,.05);card.add(band);
  s.add(new T.AmbientLight("#ffc8a8",.35));let ex=null;
  at(c,.1,()=>c.sfx("rain"));at(c,1,()=>c.sfx("charge"));at(c,1.8,()=>c.sfx("charge"));at(c,2.9,()=>{c.sfx("whoosh");c.shake(.1)});at(c,3.2,()=>{c.sfx("boom");c.flash(1,"#dff0ff");c.shake(.45)});at(c,3.25,()=>c.reveal());
  return (t,dt)=>{lans.forEach(g=>{const f=.8+.2*Math.sin(t*13+g.userData.ph)+(Math.random()-.5)*.1;g.userData.pl.intensity=8*f;g.rotation.z=Math.sin(t*1.3+g.userData.ph)*.06});
    const push=t>3.2?{x:0,z:0,s:30*(1-E(3.2,4.4,t))}:null;rain.update(dt,push);rain.obj.material.opacity=.3*(t<3.2?1:Math.max(.08,1-E(3.2,3.8,t)));
    card.visible=t>.6;card.position.set(0,rest.y,rest.z-1.5+1.5*eo(E(.6,1.2,t)));const vib=E(1,2.8,t)*(1-E(2.9,3.1,t));card.position.x+=(Math.random()-.5)*.06*vib;card.position.y+=(Math.random()-.5)*.04*vib;
    aura.obj.visible=vib>0;aura.update(dt,t);aura.mat.opacity=vib;
    if(vib>0&&t>nk){nk=t+.07;ki.forEach(b=>{s.remove(b)});ki.length=0;for(let i=0;i<3;i++){const a=rnd(0,6.28),r=rnd(1.2,2.4),p0=V(Math.cos(a)*r,-1.55,rest.z+Math.sin(a)*r),p1=p0.clone().add(V(rnd(-.8,.8),rnd(.1,.9),rnd(-.6,.6)));const m=boltMesh(p0,p1,"#6fb8ff",.02,4,.2);m.children.forEach(x=>x.material.opacity*=vib);s.add(m);ki.push(m)}}
    if(vib<=0&&ki.length){ki.forEach(b=>s.remove(b));ki.length=0}
    const g=E(1.8,2.85,t);hd.visible=g>0&&t<3.22;if(hd.visible){const f=E(2.9,3.2,t),sc=.3+eo(g)*.9+f*1.5;hd.scale.setScalar(sc);const p0=card.position.clone().add(V(0,-.2,1.4));hd.position.copy(p0).lerp(V(cam.position.x,cam.position.y-.2,cam.position.z-1.2),eio(f));sw.rotation.set(t*6,t*4,0);sw2.rotation.set(-t*5,t*3,0);hl.intensity=30*g}
    const w=E(3.2,4,t);wave.position.copy(cam.position).add(V(0,0,-2));wave.lookAt(cam.position);wave.scale.setScalar(.5+w*4);wave.material.opacity=w>0?(1-w):0;
    if(t>3.2&&!ex){ex=burstParts(300,["#4fa3ff","#bfe0ff","#ffffff"],card.position.clone().add(V(0,0,1)),10,-1,.15);s.add(ex.obj)}if(ex){ex.update(dt,t);ex.mat.opacity=Math.max(0,1-(t-3.2)/1.4)}
    band.userData.wave(t*2.2,.1+(t>3.2?.12:0),4,"left");band.rotation.y=-.3;
    toCam(cam,L3(V(5,.4,11),V(0,1.1,7.6),eio(E(0,2.4,t))),L3(V(-3,1.5,-10),rest,eio(E(.3,2,t))))}};

K.optimus=c=>{const{s,cam,card,rest}=c;c.dur=5.2;s.add(sky("#120a2a","#03040a"));s.fog=new T.FogExp2("#0a0818",.035);
  const rd=new T.Mesh(new T.PlaneGeometry(14,90),new T.MeshStandardMaterial({map:gridTex("#14141a","#24242e",64,8),roughness:.4,metalness:.8}));rd.rotation.x=-Math.PI/2;rd.position.set(0,-1.6,-30);s.add(rd);
  const lanes=[];for(let i=0;i<24;i++){const m=new T.Mesh(new T.PlaneGeometry(.18,1.6),add(new T.MeshBasicMaterial({color:"#6fb0ff",opacity:.8})));m.rotation.x=-Math.PI/2;m.position.set(i%2?-2.4:2.4,-1.58,-Math.floor(i/2)*6);s.add(m);lanes.push(m)}
  const crys=[];for(let i=0;i<14;i++){const m=new T.Mesh(new T.OctahedronGeometry(rnd(.5,1.4),0),new T.MeshStandardMaterial({color:i%2?"#5a6aff":"#b05aff",emissive:i%2?"#2a3aff":"#8a2aff",emissiveIntensity:1.2,roughness:.2,metalness:.3}));m.position.set((i%2?1:-1)*rnd(7.5,12),rnd(-1,3),-rnd(2,40));m.scale.y=rnd(1.4,2.6);s.add(m);crys.push(m)}
  const deb=new T.MeshStandardMaterial({color:"#3a3e48",metalness:.85,roughness:.4});for(let i=0;i<18;i++){const m=new T.Mesh(new T.BoxGeometry(rnd(.3,1.4),rnd(.2,.8),rnd(.3,1.4)),deb);m.position.set((i%2?1:-1)*rnd(3.4,7),-1.4,-rnd(0,40));m.rotation.set(rnd(0,1),rnd(0,3),rnd(0,1));s.add(m)}
  const towers=[];[-9,9].forEach(x=>{for(let z=0;z<4;z++){const tw=new T.Mesh(new T.BoxGeometry(.4,9,.4),deb);tw.position.set(x,2.9,-z*12-4);s.add(tw);towers.push(V(x,7.2,-z*12-4))}});
  const cables=[];for(let i=0;i<towers.length-1;i++){if(i===3)continue;const a=towers[i],b=towers[i+1],pts=[];for(let k=0;k<=16;k++){const p=a.clone().lerp(b,k/16);p.y-=Math.sin(k/16*Math.PI)*1.2;pts.push(p)}const l=new T.Line(new T.BufferGeometry().setFromPoints(pts),new T.LineBasicMaterial({color:"#8a8fa0"}));s.add(l);cables.push(pts)}
  let narc=0,arcs=[];
  const truck=new T.Group(),red=new T.MeshStandardMaterial({color:"#c8102e",metalness:.6,roughness:.3}),blu=new T.MeshStandardMaterial({color:"#1f3c9b",metalness:.6,roughness:.3}),sil=new T.MeshStandardMaterial({color:"#b8bcc8",metalness:.9,roughness:.25}),blk=new T.MeshStandardMaterial({color:"#111",roughness:.7}),gls=new T.MeshStandardMaterial({color:"#3a6aaa",metalness:.9,roughness:.1});
  const parts=[];const P=(geo,mat,x,y,z)=>{const m=new T.Mesh(geo,mat);m.position.set(x,y,z);truck.add(m);parts.push(m);return m};
  P(new T.BoxGeometry(2.2,1.6,1.8),red,0,.9,1.6);P(new T.BoxGeometry(2.2,.8,1.4),blu,0,.4,2.6);P(new T.BoxGeometry(1.9,.7,.05),gls,0,1.3,2.52);P(new T.BoxGeometry(2.3,2.2,5.6),sil,0,1.2,-2.4);P(new T.BoxGeometry(2.3,.3,5.6),blu,0,.05,-2.4);
  [[-1.1,1.9],[1.1,1.9],[-1.1,-.6],[1.1,-.6],[-1.1,-3.8],[1.1,-3.8]].forEach(([x,z])=>{const w=P(new T.CylinderGeometry(.42,.42,.3,18),blk,x,-.15,z);w.rotation.z=Math.PI/2});
  P(new T.BoxGeometry(.15,1.4,.15),sil,-.9,1.9,.8);P(new T.BoxGeometry(.15,1.4,.15),sil,.9,1.9,.8);truck.position.set(0,-1.25,-40);s.add(truck);
  const hls=[];[-.75,.75].forEach(x=>{const h=glow("#fff6d8",1.2,1);h.position.set(x,.5,3.32);truck.add(h);const sp=new T.SpotLight("#fff6d8",40,30,.5,.5);sp.position.set(x,.5,3.3);sp.target.position.set(x,-.5,12);truck.add(sp,sp.target);hls.push(h,sp)});
  s.add(new T.HemisphereLight("#8a90ff","#20203a",.6));
  const W=2.5,H=3.5;parts.forEach((m,i)=>{m.userData.s0=m.scale.clone();const u=i/parts.length,d=u*2*(W+H);let x,y;if(d<W){x=-W/2+d;y=H/2}else if(d<W+H){x=W/2;y=H/2-(d-W)}else if(d<2*W+H){x=W/2-(d-W-H);y=-H/2}else{x=-W/2;y=-H/2+(d-2*W-H)}m.userData.home=m.position.clone();m.userData.fq=m.quaternion.clone();m.userData.to=V(x*CS,y*CS,-.15);m.userData.sp=V(rnd(-1,1),rnd(-1,1),rnd(-1,1)).normalize().multiplyScalar(rnd(1.2,2.4))});
  const chest=[-1,1].map(sd=>{const m=new T.Mesh(new T.BoxGeometry(1.25,1.3,.12),new T.MeshStandardMaterial({color:"#8a909c",metalness:.9,roughness:.25}));m.position.set(sd*.625,.2,.12);card.add(m);m.userData.sd=sd;m.visible=false;return m});
  const mx=glow("#cfe8ff",.1,1);mx.position.set(0,.2,.15);card.add(mx);
  const sword=new T.Group(),bl=new T.Mesh(new T.BoxGeometry(.12,3.6,.04),new T.MeshBasicMaterial({color:"#e8f4ff"})),bg=new T.Mesh(new T.BoxGeometry(.5,3.8,.04),add(new T.MeshBasicMaterial({color:"#6fb0ff",opacity:.5})));bl.position.y=bg.position.y=1.9;sword.add(bl,bg);sword.visible=false;s.add(sword);
  const fr=frameFx(card);let dust=null,sparks=null;
  s.add(new T.AmbientLight("#7a80c0",.6));const kl=new T.PointLight("#6fb0ff",22,20);kl.position.set(0,3,4);s.add(kl);const rl=new T.PointLight("#ff3a3a",0,14);rl.position.set(0,0,-6);s.add(rl);
  at(c,.4,()=>c.sfx("fly"));at(c,1.2,()=>{c.sfx("sizzle");c.shake(.1)});at(c,1.6,()=>c.sfx("whoosh"));at(c,2,()=>c.sfx("transform"));at(c,2.95,()=>{c.sfx("thump");c.sfx("boom");c.shake(.5);dust=burstParts(120,["#8a8f99","#c0c4cc"],V(0,-1.5,-.5),6,-5,.16);s.add(dust.obj)});
  at(c,3.2,()=>c.sfx("hydraulic"));at(c,3.4,()=>c.sfx("charge"));at(c,3.95,()=>{c.sfx("swing");c.sfx("clank");c.flash(.7,"#dff0ff")});at(c,4,()=>c.reveal());
  const q=new T.Quaternion();
  return (t,dt)=>{lanes.forEach(m=>{m.position.z+=dt*(t<1.6?0:0)});crys.forEach((m,i)=>{m.rotation.y=t*.5+i;m.material.emissiveIntensity=1+.4*Math.sin(t*3+i)});
    if(t>narc){narc=t+.12;arcs.forEach(a=>s.remove(a));arcs=[];for(let i=0;i<2;i++){const pts=cables[Math.random()*cables.length|0],k=rnd(.1,.8),p0=pts[Math.floor(k*16)],p1=pts[Math.floor(k*16)+2];const m=boltMesh(p0.clone(),p1.clone(),"#8fb0ff",.02,4,.25);s.add(m);arcs.push(m)}}
    if(t<1.6){const k=E(0,1.6,t),e=1-Math.pow(1-k,2);truck.position.set(Math.sin(k*3)*.4,-1.25,-40+38*e);truck.rotation.y=E(1.1,1.6,t)*.6}
    else if(t<2){const k=E(1.6,2,t);truck.position.set(.4,-1.25+Math.sin(k*Math.PI)*2.2,-2+k*.8);truck.rotation.set(-.2*Math.sin(k*Math.PI),.6,0)}
    if(t>=1.15&&t<1.6&&!sparks){sparks=burstParts(80,["#ffb347","#ffffff"],V(1.2,-1.4,-6),4,-8,.08);s.add(sparks.obj)}if(sparks){sparks.update(dt,t);sparks.mat.opacity=Math.max(0,1-(t-1.15)/1)}
    hls.forEach(h=>h.visible=t<2.05);const tk=E(2,2.95,t);if(t>=2){parts.forEach((m,i)=>{const k=eio(Math.min(1,Math.max(0,tk*1.25-i*.012)));const w=card.position.clone().add(m.userData.to);const hw=truck.localToWorld(m.userData.home.clone());
        const mid=hw.clone().lerp(w,.5).addScaledVector(m.userData.sp,Math.sin(k*Math.PI));m.position.copy(truck.worldToLocal(k<.5?hw.clone().lerp(mid,k*2):mid.clone().lerp(w,(k-.5)*2)));m.rotation.set(k*6+i,k*4,k*5);if(k>=1)m.rotation.set(0,0,0);const sc=1-k*.8;m.scale.set(sc,sc,sc)})}
    card.visible=t>2.6;card.position.set(0,rest.y+(1-eo(E(2.6,2.95,t)))*2.5,rest.z);card.rotation.set(0,0,0);
    if(dust){dust.update(dt,t);dust.mat.opacity=Math.max(0,1-(t-2.95)/1.4)}
    const op=eio(E(3.2,3.55,t));chest.forEach(m=>{m.visible=t>2.95&&t<4.1;m.position.x=m.userData.sd*(.625+op*.75)});const mg=E(3.4,3.95,t);mx.scale.setScalar(.2+mg*4.5);mx.material.opacity=Math.min(1,mg*2)*(1-E(4.1,4.6,t));rl.intensity=mg*20;
    const sk=E(3.75,4.05,t);sword.visible=sk>0&&sk<1;if(sword.visible){sword.position.copy(card.position).add(V(2.4,-1.6,.6));sword.rotation.z=1.2-eio(sk)*2.6}
    fr.set(E(3.95,4.1,t)*(.7+.3*Math.sin(t*12)),["#6fb0ff","#c8102e","#6fb0ff","#c8102e"]);
    if(t<2)toCam(cam,L3(V(-3,-.8,8),V(-4,0,6),E(0,2,t)),truck.position.clone().add(V(0,1,0)));else toCam(cam,L3(V(-4,0,6),V(0,1.1,7.6),eio(E(2,3.2,t))),L3(V(.4,1,-1),rest,eio(E(2,2.8,t))))}};

K.leo=c=>{const{s,cam,card,rest}=c;c.dur=5.2;s.background=new T.Color("#030806");s.fog=new T.FogExp2("#06140c",.055);
  const bt=brickTex("#3a2a20","#2a1e18","#0e0a08",1);bt.repeat.set(10,3);const tun=new T.Mesh(new T.CylinderGeometry(5.5,5.5,50,32,1,true,0,Math.PI),new T.MeshStandardMaterial({map:bt,roughness:.3,metalness:.25,side:T.BackSide}));tun.rotation.z=Math.PI/2;tun.rotation.y=Math.PI/2;tun.position.set(0,-1.6,-14);s.add(tun);
  const wt=cnv(256,256,(g,w,h)=>{g.fillStyle="#0a2a14";g.fillRect(0,0,w,h);for(let i=0;i<60;i++){g.strokeStyle=`rgba(120,255,160,${rnd(.05,.25)})`;g.lineWidth=rnd(1,3);g.beginPath();const y=rnd(0,h);g.moveTo(0,y);for(let x=0;x<w;x+=16)g.lineTo(x,y+Math.sin(x*.05+i)*4);g.stroke()}});wt.wrapS=wt.wrapT=T.RepeatWrapping;wt.repeat.set(2,8);
  const water=new T.Mesh(new T.PlaneGeometry(4,50),new T.MeshStandardMaterial({map:wt,emissive:"#1a6a3a",emissiveMap:wt,emissiveIntensity:.8,roughness:.1,metalness:.5}));water.rotation.x=-Math.PI/2;water.position.set(0,-1.75,-14);s.add(water);
  const ledge=new T.MeshStandardMaterial({color:"#2a2a24",roughness:.8});[-1,1].forEach(sd=>{const l=new T.Mesh(new T.BoxGeometry(2.6,.3,50),ledge);l.position.set(sd*3.3,-1.6,-14);s.add(l)});
  const pm=new T.MeshStandardMaterial({color:"#7a3a1a",roughness:.6,metalness:.6});[[-4.6,1.4],[4.7,.6],[-4.4,2.6]].forEach(([x,y])=>{const p=new T.Mesh(new T.CylinderGeometry(.22,.22,50,12),pm);p.rotation.x=Math.PI/2;p.position.set(x,y,-14);s.add(p)});
  const hole=V(0,3.9,-5);const shafts=[];for(let i=0;i<3;i++){const m=new T.Mesh(new T.CylinderGeometry(.8,1.8,6.5,24,1,true),add(new T.MeshBasicMaterial({color:"#d8ffe0",opacity:.09,side:T.DoubleSide})));m.position.set(hole.x+rnd(-.2,.2),hole.y-3.2,hole.z+rnd(-.2,.2));m.rotation.z=rnd(-.1,.1);s.add(m);shafts.push(m)}
  const disc=glow("#e8fff0",2.6,.7);disc.position.copy(hole);s.add(disc);const dust=field(140,[1.4,-1.5,3.8,-6.4,-3.6],["#e8fff0"],.05,()=>[rnd(-.05,.05),rnd(-.1,.05),rnd(-.05,.05)]);s.add(dust.obj);
  const mut=new Smoke(s,26,texSmoke("120,255,120"),"#5aff6a",()=>({p:V(rnd(-1,1),-1.6,rnd(-4,-2.5)),v:V(rnd(-.4,.4),rnd(.6,1.4),rnd(.2,.8)),s:1.4}),{life:2,op:.35,grow:2.6,additive:true});
  const kat=[-1,1].map(sd=>{const g=new T.Group(),bl=new T.Mesh(new T.BoxGeometry(.07,2.6,.02),new T.MeshStandardMaterial({color:"#e8eef8",metalness:1,roughness:.15})),hl=new T.Mesh(new T.CylinderGeometry(.06,.06,.7,8),new T.MeshStandardMaterial({color:"#1a2a6a"}));bl.position.y=1.3;hl.position.y=-.35;g.add(bl,hl);const gl=glow("#ffffff",.5,0);gl.position.y=.2;g.add(gl);g.userData.gl=gl;g.position.set(sd*.6,-.6,.25);g.visible=false;card.add(g);return g});
  const slt=cnv(256,32,(g,w,h)=>{const q=g.createLinearGradient(0,0,w,0);q.addColorStop(0,"rgba(255,255,255,0)");q.addColorStop(.7,"rgba(200,230,255,.9)");q.addColorStop(1,"rgba(255,255,255,1)");g.fillStyle=q;g.fillRect(0,h*.3,w,h*.4)});
  const sl=[[-.75,"#2f8bff"],[.75,"#8fc6ff"]].map(([r,cl])=>{const m=new T.Mesh(new T.PlaneGeometry(16,.7),add(new T.MeshBasicMaterial({map:slt,color:cl,opacity:0,side:T.DoubleSide,depthTest:false})));m.rotation.z=r;m.renderOrder=990;s.add(m);return m});
  const kap=new T.Sprite(new T.SpriteMaterial({map:comicTex("KAPOW!"),transparent:true,opacity:0,depthTest:false}));kap.renderOrder=995;s.add(kap);
  s.add(new T.AmbientLight("#7fbf8f",.45));const gl=new T.PointLight("#5aff6a",0,12);gl.position.set(0,0,-2);s.add(gl);const kl=new T.PointLight("#cfe0ff",14,12);kl.position.set(0,3,3);s.add(kl);
  at(c,.2,()=>c.sfx("splat"));at(c,1,()=>c.sfx("sizzle"));at(c,1.55,()=>c.sfx("whoosh"));at(c,2.3,()=>{c.sfx("thump");c.shake(.15)});at(c,2.45,()=>c.sfx("shing"));at(c,2.95,()=>c.sfx("swing"));at(c,3.15,()=>{c.sfx("swing");c.flash(.5)});at(c,3.3,()=>{c.sfx("boom");c.shake(.35)});at(c,3.3,()=>c.reveal());
  return (t,dt)=>{wt.offset.y=-t*.15;mut.update(dt,t>.9&&t<2.6);gl.intensity=E(1,1.5,t)*18*(1-E(2.6,3.4,t));dust.update(dt,t);shafts.forEach((m,i)=>m.material.opacity=.08+.03*Math.sin(t*2+i));
    card.visible=t>1.5;const f=E(1.5,2.3,t);card.position.set(0,rest.y+Math.sin(f*Math.PI)*2.2,-3.6+3.1*eo(f));card.rotation.set(t<2.3?-eio(f)*Math.PI*4:0,0,0);
    kat.forEach((k,i)=>{const d=eo(E(2.45,2.7,t));k.visible=t>2.4;k.rotation.z=(i?-1:1)*(.4+d*.5);k.position.y=-.6+d*.4;k.userData.gl.material.opacity=Math.sin(E(2.5,2.85,t)*Math.PI);k.userData.gl.position.y=.2+E(2.5,2.85,t)*2.4});
    sl.forEach((m,i)=>{const k=E(2.95+i*.2,3.15+i*.2,t);m.position.copy(cam.position).add(V(0,-.05,-3));m.quaternion.copy(cam.quaternion);m.rotateZ(i?.75:-.75);m.scale.x=Math.max(.001,eo(k));m.material.opacity=k>0?1-E(3.6,4.4,t):0});
    const kp=E(3.3,3.55,t);kap.material.opacity=kp>0?1-E(4.5,5.1,t):0;const ks=eo(kp)*(1+.12*Math.sin(E(3.3,3.9,t)*Math.PI*3));kap.position.copy(cam.position).add(V(1.1,.75,-3).applyQuaternion(cam.quaternion));kap.scale.set(1.5*ks,1.12*ks,1);kap.material.rotation=-.15;
    toCam(cam,L3(V(.3,-.6,9),V(0,1.1,7.6),eio(E(0,2.4,t))),L3(V(0,0,-14),rest,eio(E(.6,2.2,t))))}};




K.spider=c=>{const{s,cam,card,rest}=c;c.dur=5;c.bloom=[.95,.55,.85];s.add(sky("#0a0d26","#2a0e22"));s.fog=new T.FogExp2("#0d0918",.022);
  const moon=glow("#dfe6ff",9,.55);moon.position.set(-14,16,-60);s.add(moon);
  const roofT=noiseTex(256,256,"#121218",["#000","#2a2a32","#1a1a20"],8,.5);const roof=new T.Mesh(new T.PlaneGeometry(26,26),new T.MeshStandardMaterial({map:roofT,roughness:.32,metalness:.35,envMap:CUR_ENV,envMapIntensity:.25}));roof.rotation.x=-Math.PI/2;roof.position.set(0,-1.6,-3);roof.receiveShadow=true;s.add(roof);
  const bt=brickTex("#3a1a16","#2a1210","#0c0606",4);const pm=new T.MeshStandardMaterial({map:bt,roughness:.85});
  [[0,-1.1,-15.8,26,1,.5],[-12.8,-1.1,-3,.5,1,26],[12.8,-1.1,-3,.5,1,26]].forEach(([x,y,z,w,h,d])=>{const m=new T.Mesh(new T.BoxGeometry(w,h,d),pm);m.position.set(x,y,z);m.receiveShadow=true;s.add(m)});
  const wt=waterTower();wt.position.set(-6,-1.6,-9);s.add(shadowy(wt));const ac1=acUnit();ac1.position.set(4.5,-1.6,-5.5);s.add(shadowy(ac1));const ac2=acUnit();ac2.position.set(6,-1.6,-7);ac2.rotation.y=.4;s.add(shadowy(ac2));
  const vents=[[-3.4,-3],[3.2,-2.6]];vents.forEach(([x,z])=>{const v=new T.Mesh(new T.CylinderGeometry(.32,.38,.9,20),metal("#7a7f88",.45,.6));v.position.set(x,-1.15,z);s.add(shadowy(v));const cp=new T.Mesh(new T.ConeGeometry(.5,.3,20),metal("#5a5f68",.5,.6));cp.position.set(x,-.5,z);s.add(cp)});
  const smoke=new Smoke(s,16,texSmoke("200,205,225"),"#c8cee6",()=>{const v=vents[Math.random()*2|0];return{p:V(v[0],-.4,v[1]),v:V(rnd(-.1,.1),rnd(.5,.9),0),s:.9}},{life:2.6,op:.28,grow:2.2});
  const win=winTex();const sky1=[];for(let i=0;i<26;i++){const a=Math.PI+Math.random()*Math.PI,r=rnd(20,44),w=rnd(2.4,5),h=rnd(8,30);const b=skyscraper(w,h,w,win,{tier:Math.random()<.35,spire:Math.random()<.4});b.position.set(Math.cos(a)*r*1.2,-14,Math.sin(a)*r-10);s.add(b);sky1.push(b)}
  const adj=new T.Mesh(new T.BoxGeometry(22,14,4),new T.MeshStandardMaterial({map:brickTex("#3a1c18","#2a1410","#0e0808",6),roughness:.85}));adj.position.set(0,4.2,-18);s.add(adj);
  const aw=winTex(["#ffcf7a","#ffb860"],.45,3,4);aw.repeat.set(5,2);const awp=new T.Mesh(new T.PlaneGeometry(20,6),new T.MeshStandardMaterial({color:"#000",emissive:"#ffffff",emissiveMap:aw,emissiveIntensity:.8,transparent:true,opacity:.95}));awp.position.set(0,8,-15.95);s.add(awp);
  const bb=new T.Group(),bbf=rbox(5.5,2.6,.2,.05,std("#14141a",.5,.6));bb.add(bbf);const bbt=new T.Mesh(new T.PlaneGeometry(5.2,2.3),new T.MeshBasicMaterial({map:cnv(512,220,(g,w,h)=>{const gr=g.createLinearGradient(0,0,w,h);gr.addColorStop(0,"#ff2a6d");gr.addColorStop(1,"#5a2aff");g.fillStyle=gr;g.fillRect(0,0,w,h);g.fillStyle="#fff";g.font="900 70px Sora, Arial";g.textAlign="center";g.textBaseline="middle";g.fillText("BREAKING NEWS",w/2,h/2-20);g.font="700 34px Arial";g.fillText("UN HÉROS SUR LES TOITS ?",w/2,h/2+46)}),color:H("#ffffff",1.25)}));bbt.position.z=.11;bb.add(bbt);
  for(let k=0;k<3;k++){const lp=glow("#fff2d0",.5,1);lp.position.set(-2+k*2,1.55,.4);bb.add(lp)}bb.position.set(9.5,6.5,-15.6);bb.rotation.y=-.25;s.add(bb);
  const signs=[["HOTEL","#ff2a6d",-5.2,3.2,4.6],["24/7","#22d3ee",0,4.6,3.2],["DINER","#ff9f1a",4.6,2.8,4.4]].map(([tx,cl,x,y,w])=>{const n=neon(tx,cl,w,1.3);n.position.set(x,y,-15.85);s.add(n);return n});
  const pud=[];signs.forEach((n,i)=>{const r=new T.Mesh(new T.PlaneGeometry(.5,6),add(new T.MeshBasicMaterial({map:dot(),color:n.userData.col,opacity:.35})));r.rotation.x=-Math.PI/2;r.position.set(n.position.x*.35,-1.59,-6+i*.6);s.add(r);pud.push(r)});
  const pdl=new T.Mesh(new T.CircleGeometry(1.6,40),new T.MeshStandardMaterial({color:"#06070a",roughness:.03,metalness:1,envMap:CUR_ENV,envMapIntensity:.35}));pdl.rotation.x=-Math.PI/2;pdl.position.set(-.5,-1.595,-1.4);pdl.scale.x=1.8;s.add(pdl);
  const antTop=V(2.8,4.4,-3);const ant=lattice(6,.55);ant.position.set(2.8,-1.6,-3);s.add(shadowy(ant));const tip=glow("#ff2a2a",1,1);tip.position.copy(antTop);tip.material.color=H("#ff2a2a",3);s.add(tip);
  const wpts=[],N=18,R=12;for(let i=0;i<N;i++){const a=i/N*Math.PI*2;wpts.push(0,0,0,Math.cos(a)*R,Math.sin(a)*R,0)}for(let r=1;r<=11;r++){const rr=r*R/11.4;for(let i=0;i<N;i++){const a=i/N*Math.PI*2,b=(i+1)/N*Math.PI*2,m=(a+b)/2;wpts.push(Math.cos(a)*rr,Math.sin(a)*rr,0,Math.cos(m)*rr*.93,Math.sin(m)*rr*.93,0,Math.cos(m)*rr*.93,Math.sin(m)*rr*.93,0,Math.cos(b)*rr,Math.sin(b)*rr,0)}}
  const wg=new T.BufferGeometry();wg.setAttribute("position",new T.Float32BufferAttribute(wpts,3));const web=new T.LineSegments(wg,new T.LineBasicMaterial({color:H("#cfe0ff",1.8),transparent:true,opacity:.75}));web.position.set(0,7,-17.5);s.add(web);
  const rain=rainFx(1100,[14,-1.6,12,-16,9],"#a8bad8",.3);s.add(rain.obj);
  const rip=[];for(let i=0;i<24;i++){const m=new T.Mesh(new T.RingGeometry(.05,.08,24),add(new T.MeshBasicMaterial({color:"#9fb3d9",opacity:0})));m.rotation.x=-Math.PI/2;m.userData.t=rnd(0,1);s.add(m);rip.push(m)}
  const line=new T.Mesh(new T.CylinderGeometry(.012,.012,1,6),hb("#ffffff",2.4));line.visible=false;s.add(line);
  const fr=frameFx(card),arcs=edgeArcs(card);let splash=null;
  s.add(new T.HemisphereLight("#6a7ac8","#2a1020",.7));const lamp=new T.PointLight("#ffcf8a",14,12);lamp.position.set(-4,1.5,-4);s.add(lamp);const lb=glow("#ffcf8a",.8,1);lb.position.copy(lamp.position);s.add(lb);const moonL=c.sun(new T.DirectionalLight("#9fb0ff",1.4));moonL.position.set(-6,10,4);moonL.target.position.set(0,0,-3);s.add(moonL,moonL.target);
  at(c,.05,()=>c.sfx("rain"));at(c,1.3,()=>c.sfx("web"));at(c,2.88,()=>{c.shake(.3);c.sfx("thump");splash=hdrP(burstParts(110,["#a8bad8","#ffffff"],V(0,-1.5,0),4,-6,.09),1.5);s.add(splash.obj)});
  at(c,3.05,()=>{c.flash(.6);c.sfx("shutter")});at(c,3.22,()=>c.flash(.7));at(c,3.1,()=>c.reveal());at(c,3.35,()=>c.sfx("crackle"));
  const p0=V(-8,7,-6),p1=V(antTop.x-2.4,antTop.y-2.2,antTop.z),q=V(),look=V(),tmp=V();
  return (t,dt)=>{rain.update(dt);smoke.update(dt);
    signs.forEach((n,i)=>{const f=(Math.sin(t*23+i*3)>-.9&&Math.sin(t*6.3+i*5)>-.97)?1:.12;n.userData.tm.color.copy(H("#"+n.userData.col.getHexString(),2*f+.1));n.userData.pl.intensity=10*f;pud[i].material.opacity=.35*f});
    tip.material.opacity=Math.sin(t*5)>0?1:.15;
    rip.forEach(m=>{m.userData.t+=dt*1.6;if(m.userData.t>1){m.userData.t=0;m.position.set(rnd(-6,6),-1.58,rnd(-9,2))}m.scale.setScalar(1+m.userData.t*6);m.material.opacity=(1-m.userData.t)*.5});
    if(splash){splash.update(dt,t);splash.mat.opacity=Math.max(0,1-(t-2.88)/1.2)}
    card.visible=t>.95;
    if(t<1.6){const k=eio(E(.95,1.6,t));q.lerpVectors(p0,p1,k);card.position.copy(q);card.rotation.set(k*Math.PI*4,0,(1-k)*.8)}
    else if(t<2.45){const k=E(1.6,2.45,t),a=Math.PI+k*Math.PI*1.5,r=2.4;card.position.set(antTop.x+Math.cos(a)*r,antTop.y-2.2-Math.sin(k*Math.PI)*.8,antTop.z+Math.sin(a)*r);card.rotation.set(0,-a+Math.PI/2,Math.sin(k*Math.PI)*.4)}
    else{const k=eio(E(2.45,2.88,t)),from=V(antTop.x+Math.cos(Math.PI*2.5)*2.4,antTop.y-2.2,antTop.z+Math.sin(Math.PI*2.5)*2.4);card.position.lerpVectors(from,rest,k);const cr=1-E(2.9,3.4,t);card.rotation.set(-.45*cr*(t>2.88?1:k),(1-k)*1.2,0);card.position.y-=.35*cr*(t>2.88?1:0)}
    line.visible=t>1.3&&t<2.45;if(line.visible){tmp.copy(card.position);tmp.y+=1.2;const L=tmp.distanceTo(antTop);line.position.copy(tmp).lerp(antTop,.5);line.scale.y=L;line.lookAt(antTop);line.rotateX(Math.PI/2)}
    wg.setDrawRange(0,Math.floor(wg.attributes.position.count*eo(E(.1,2.6,t))));web.rotation.z=t*.04;
    const fa=E(3.3,3.5,t)*(.55+.45*Math.sin(t*14));fr.set(fa*1.2,Math.sin(t*9)>0?"#ff2a3a":"#2f6bff");arcs.update(dt,E(3.3,3.5,t)*1.5,["#ff2a3a","#6fa8ff","#ffffff"]);
    if(t<1){toCam(cam,L3(V(-3,-.9,13),V(-1.5,0,11),eio(E(0,1,t))),V(0,2.4,-4))}
    else if(t<2.5){const k=E(1,2.5,t);look.copy(card.position);toCam(cam,L3(V(-1.5,0,11),V(.6,.8,10),k),L3(V(0,2.4,-4),look,eio(Math.min(1,k*2))))}
    else{const k=eio(E(2.5,3.1,t));toCam(cam,L3(V(.6,.8,10),V(0,1.15,7.4-(t-3)*.12),k),L3(card.position,rest,k))}}};

K.iron=c=>{const{s,cam,card,rest}=c;c.dur=5;c.bloom=[.9,.5,.85];s.background=new T.Color("#04080e");s.fog=new T.FogExp2("#05101a",.03);
  const gl=cnv(512,512,(g,w,h)=>{g.fillStyle="#000";g.fillRect(0,0,w,h);g.strokeStyle="#fff";g.lineWidth=2;for(let i=0;i<=w;i+=64){g.beginPath();g.moveTo(i,0);g.lineTo(i,h);g.stroke();g.beginPath();g.moveTo(0,i);g.lineTo(w,i);g.stroke()}g.lineWidth=1;g.globalAlpha=.4;for(let i=32;i<w;i+=64){g.beginPath();g.moveTo(i,0);g.lineTo(i,h);g.stroke();g.beginPath();g.moveTo(0,i);g.lineTo(w,i);g.stroke()}});gl.wrapS=gl.wrapT=T.RepeatWrapping;gl.repeat.set(10,10);
  const fl=new T.Mesh(new T.PlaneGeometry(50,50),new T.MeshStandardMaterial({color:"#0c1016",roughness:.22,metalness:.6,envMap:CUR_ENV,envMapIntensity:.35,emissive:H("#2aa8d8",.9),emissiveMap:gl}));fl.rotation.x=-Math.PI/2;fl.position.y=-1.6;fl.receiveShadow=true;s.add(fl);
  const wall=new T.Mesh(new T.PlaneGeometry(44,14),new T.MeshStandardMaterial({map:gridTex("#0b1016","#18242e",64,6),roughness:.5,metalness:.7,envMap:CUR_ENV,envMapIntensity:.25}));wall.position.set(0,5,-16);s.add(wall);
  for(let i=0;i<7;i++){const x=-12+i*4,ni=new T.Group();const fr=rbox(2.6,5,1,.08,metal("#2a3038",.35,.8));ni.add(fr);const bk=new T.Mesh(new T.PlaneGeometry(2.1,4.4),hb("#3ad8ff",.9));bk.position.z=.45;ni.add(bk);
    const gl2=new T.Mesh(new T.PlaneGeometry(2.1,4.4),new T.MeshPhysicalMaterial({color:"#9fe8ff",roughness:.05,metalness:0,transparent:true,opacity:.18,envMap:CUR_ENV,envMapIntensity:1.2}));gl2.position.z=.52;ni.add(gl2);
    const strip=new T.Mesh(new T.BoxGeometry(2.2,.06,.06),hb("#9ff0ff",3));strip.position.set(0,-2.3,.5);ni.add(strip);ni.position.set(x,.9,-15.4);s.add(ni)}
  for(let i=0;i<6;i++){const b=new T.Mesh(new T.BoxGeometry(6,.08,.4),hb("#dff6ff",2.4));b.position.set(-10+i*4,9,-6+(i%2)*3);s.add(b)}
  const ui=i=>cnv(512,320,(g,w,h)=>{const col=i%3===1?"#ffd34d":"#6ff7ff";g.strokeStyle=col;g.fillStyle=col;g.lineWidth=3;g.globalAlpha=.9;g.strokeRect(6,6,w-12,h-12);g.globalAlpha=.25;g.fillRect(6,6,w-12,36);g.globalAlpha=.9;g.font="700 22px monospace";g.fillText(["SYSTEM.DIAG","MARK_SUIT://","ARC.OUTPUT","TELEMETRY"][i%4],18,32);
    for(let k=0;k<7;k++){g.globalAlpha=rnd(.35,.9);g.fillRect(20,60+k*24,rnd(60,260),9)}g.globalAlpha=.9;g.beginPath();g.arc(w-110,h/2+20,70,0,7);g.stroke();g.beginPath();g.arc(w-110,h/2+20,48,-1,2.4);g.lineWidth=8;g.stroke();g.lineWidth=2;
    g.beginPath();for(let x=20;x<w-220;x+=6)g.lineTo(x,h-40-Math.abs(Math.sin(x*.05+i))*50*Math.random());g.stroke()});
  const holo=[];for(let i=0;i<11;i++){const m=new T.Mesh(new T.PlaneGeometry(rnd(1.8,3),rnd(1.1,1.8)),new T.MeshBasicMaterial({map:ui(i),color:H("#ffffff",1.6),transparent:true,opacity:.6,side:T.DoubleSide,blending:T.AdditiveBlending,depthWrite:false}));const a=rnd(-1.25,1.25);m.position.set(Math.sin(a)*rnd(5,9),rnd(0,4.2),-Math.cos(a)*rnd(4,9)-1);m.lookAt(0,1,5);m.userData.ph=rnd(0,9);s.add(m);holo.push(m)}
  const ring=new T.Group();[2.2,2.7,3.2].forEach((r,i)=>{const m=new T.Mesh(new T.TorusGeometry(r,.02,6,96,Math.PI*(1.3+i*.25)),hb(i===1?"#ffd34d":"#6ff7ff",2));ring.add(m)});ring.position.set(0,4.6,-12);s.add(ring);
  const arms=[];[[-6,-7],[6.5,-8]].forEach(([x,z],i)=>{const base=new T.Group(),mm=metal("#4a5058",.38,.9),acc=std("#ff8a1a",.5,.2,{emissive:"#5a2a00"}),jm=metal("#2a2e34",.3,1);
    const b=new T.Mesh(new T.CylinderGeometry(.6,.75,.4,24),mm);base.add(b);const s1=new T.Group();s1.position.y=.4;base.add(s1);const j1=new T.Mesh(new T.SphereGeometry(.32,20,12),jm);s1.add(j1);
    const a1=rbox(.34,2.3,.34,.08,mm);a1.position.y=1.2;s1.add(a1);const st1=new T.Mesh(new T.BoxGeometry(.36,.5,.36),acc);st1.position.y=1.5;s1.add(st1);const s2=new T.Group();s2.position.y=2.35;s1.add(s2);s2.add(new T.Mesh(new T.SphereGeometry(.24,20,12),jm));
    const a2=rbox(.26,1.7,.26,.06,mm);a2.position.y=.85;s2.add(a2);const s3=new T.Group();s3.position.y=1.75;s2.add(s3);s3.add(new T.Mesh(new T.CylinderGeometry(.16,.16,.22,16),jm));
    const cl1=new T.Mesh(new T.BoxGeometry(.06,.4,.12),jm),cl2=cl1.clone();cl1.position.set(-.1,.25,0);cl2.position.set(.1,.25,0);cl1.rotation.z=.25;cl2.rotation.z=-.25;s3.add(cl1,cl2);const tipP=new T.Object3D();tipP.position.y=.45;s3.add(tipP);
    const led=glow("#ff8a1a",.35,1);led.position.set(0,1.5,.2);s1.add(led);base.position.set(x,-1.6,z);s.add(shadowy(base));arms.push({s1,s2,s3,tipP,ph:i*2})});
  const sparks=[];let nsp=.3;
  s.add(new T.HemisphereLight("#6fd8ff","#05080c",.5));const kl=c.sun(new T.DirectionalLight("#cfefff",1.4));kl.position.set(3,8,6);kl.target.position.set(0,0,-2);s.add(kl,kl.target);
  const plates=[],W=2.5,Hc=3.5;for(let i=0;i<30;i++){const u=i/30,d=u*2*(W+Hc);let x,y,ry=0;if(d<W){x=-W/2+d;y=Hc/2}else if(d<W+Hc){x=W/2;y=Hc/2-(d-W);ry=1}else if(d<2*W+Hc){x=W/2-(d-W-Hc);y=-Hc/2}else{x=-W/2;y=-Hc/2+(d-2*W-Hc);ry=1}
    const m=rbox(.4,.3,.14,.04,metal(i%3?"#b3121f":"#e2b84a",.28,1.3,{emissive:i%3?"#2a0204":"#2a1d04"}));if(ry)m.rotation.z=Math.PI/2;m.userData.to=V(x,y,.06);m.userData.r0=m.rotation.z;m.userData.from=V(rnd(-8,8),rnd(-4,6),rnd(2,6));m.visible=false;card.add(m);plates.push(m)}
  const reactor=new T.Group();const rr=new T.Mesh(new T.TorusGeometry(.32,.06,12,48),hb("#9ff6ff",2.2));reactor.add(rr);const rc=new T.Mesh(new T.CircleGeometry(.24,32),hb("#e8fdff",1.6));reactor.add(rc);const rgl=glow("#bff6ff",1.2,.6);reactor.add(rgl);reactor.position.set(0,.25,.12);reactor.scale.setScalar(.01);card.add(reactor);
  const rp=[-.85,.85].map(x=>{const g=glow("#cff6ff",.5,0);g.position.set(x,-1.15,.15);card.add(g);return g});
  const boomR=new T.Mesh(new T.RingGeometry(.8,1,64),add(new T.MeshBasicMaterial({color:H("#cff6ff",2),opacity:0,side:T.DoubleSide})));s.add(boomR);
  const trail=hdrP(new Parts(180,{cols:["#cff6ff","#6ff7ff"],size:.12,init:(p,v,i,l)=>{p.set([0,-50,0],i*3);l[i]=0},step:(p,v,i,dt,t,l)=>{l[i]-=dt;if(l[i]<=0&&t>1&&t<2.25){l[i]=rnd(.2,.6);p.set([card.position.x+rnd(-.3,.3),card.position.y+rnd(-.3,.3),card.position.z-1],i*3)}}}),2);s.add(trail.obj);
  let deb=null;
  at(c,1.05,()=>c.sfx("fly"));at(c,1.5,()=>{c.sfx("boom");c.shake(.08)});at(c,2.2,()=>{c.shake(.45);c.sfx("thump");c.sfx("boom");deb=burstParts(140,["#8a8f99","#ffd34d","#ffffff"],V(0,-1.4,-.5),8,-9,.13);s.add(deb.obj)});
  at(c,2.35,()=>c.sfx("transform"));at(c,3.2,()=>c.sfx("charge"));at(c,3.85,()=>{c.flash(.7,"#e8fdff");c.sfx("hit");c.shake(.15)});at(c,3.85,()=>c.reveal());
  return (t,dt)=>{holo.forEach(m=>{m.material.opacity=.5+.15*Math.sin(t*7+m.userData.ph)-(Math.random()<.015?.35:0);m.position.y+=Math.sin(t+m.userData.ph)*dt*.1});ring.children.forEach((m,i)=>m.rotation.z=t*(.3+i*.2)*(i%2?-1:1));
    arms.forEach(a=>{a.s1.rotation.z=Math.sin(t*.9+a.ph)*.45;a.s2.rotation.z=-.9+Math.sin(t*1.3+a.ph)*.55;a.s1.rotation.y=Math.sin(t*.4+a.ph)*.8;a.s3.rotation.y=t*2});
    if(t>nsp){nsp=t+rnd(.3,.6);const a=arms[Math.random()*2|0],p=new T.Vector3();a.tipP.getWorldPosition(p);const b=hdrP(burstParts(45,["#ffb347","#ffffff","#ff7a1a"],p,3,-7,.06),2.5);s.add(b.obj);sparks.push({b,t0:t})}
    sparks.forEach(x=>{x.b.update(dt,t);x.b.mat.opacity=Math.max(0,1-(t-x.t0)/.9)});trail.update(dt,t);
    card.visible=t>1;if(t<2.2){const k=E(1,2.2,t),e=k*k;card.position.set(Math.sin(k*3)*1.5*(1-k),rest.y+3.5*(1-e)-.2,-60+59.5*e);card.rotation.set(-.6*(1-k),Math.sin(t*6)*.2*(1-k),Math.sin(k*9)*.3*(1-k))}
    else{const cr=1-eo(E(2.2,2.8,t));card.position.set(0,rest.y-.55*cr,rest.z);card.rotation.set(-.5*cr,0,0)}
    const bk=E(1.5,2.1,t);boomR.position.set(card.position.x,card.position.y,-30);boomR.lookAt(cam.position);boomR.scale.setScalar(1+bk*16);boomR.material.opacity=bk>0?(1-bk)*.8:0;
    if(deb){deb.update(dt,t);deb.mat.opacity=Math.max(0,1-(t-2.2)/1.6)}
    plates.forEach((m,i)=>{const k=eio(E(2.35+i*.02,2.75+i*.02,t));m.visible=k>0;m.position.lerpVectors(m.userData.from,m.userData.to,k);m.rotation.set((1-k)*6,(1-k)*4,m.userData.r0)});
    const ch=E(3.2,3.85,t),dn=1-E(3.9,4.6,t);reactor.scale.setScalar(Math.max(.01,E(2.7,3,t))*(1+ch*.8));rgl.scale.setScalar(1+ch*3.5*dn);rgl.material.opacity=(.35+ch*.45)*(t<3.85?1:.6);rp.forEach(r=>{r.scale.setScalar(.4+ch*1.8*dn);r.material.opacity=ch*.8});
    if(t<1){toCam(cam,L3(V(-6,1.4,6),V(-2.5,1,9),eio(t)),V(0,1,-4))}
    else if(t<2.2){const k=eio(E(1,2.2,t));toCam(cam,L3(V(-2.5,1,9),V(1.2,.4,8.5),k),L3(V(0,1,-4),V(0,.6,-.5),k))}
    else{const k=eio(E(2.3,3.6,t));toCam(cam,L3(V(1.2,.4,8.5),V(0,1.1,7.2-ch*.5),k),rest)}}};

K.bat=c=>{const{s,cam,card,rest}=c;c.dur=5.2;c.bloom=[.6,.55,.88];s.add(sky("#101624","#030405"));s.fog=new T.FogExp2("#0e1414",.032);
  const bt=brickTex("#2c1d18","#1d130f","#0a0706",3);const wm=new T.MeshStandardMaterial({map:bt,roughness:.8,envMap:CUR_ENV,envMapIntensity:.12});
  [[-3.6,1],[3.6,-1]].forEach(([x,sd])=>{const w=new T.Mesh(new T.PlaneGeometry(26,14),wm);w.position.set(x,5,-6);w.rotation.y=sd*Math.PI/2;w.receiveShadow=true;s.add(w);
    for(let k=0;k<4;k++){const wn=new T.Mesh(new T.PlaneGeometry(1,1.5),hb(Math.random()<.5?"#ffb060":"#202430",Math.random()<.5?1.2:1));wn.position.set(x+sd*.01,rnd(1,8),-2-k*4.5);wn.rotation.y=sd*Math.PI/2;s.add(wn)}
    for(let k=0;k<2;k++){const fe=new T.Group(),gm=metal("#22252b",.6,.4);const pf=new T.Mesh(new T.BoxGeometry(1.4,.06,3),gm);fe.add(pf);for(let j=0;j<8;j++){const p=new T.Mesh(new T.BoxGeometry(.03,.9,.03),gm);p.position.set(sd*.68,.45,-1.4+j*.4);fe.add(p)}const rl=new T.Mesh(new T.BoxGeometry(.04,.04,3),gm);rl.position.set(sd*.68,.9,0);fe.add(rl);
      const ld=new T.Mesh(new T.BoxGeometry(.5,2.6,.05),gm);ld.position.set(0,-1.3,1.6);ld.rotation.x=.5;fe.add(ld);fe.position.set(x+sd*.7,2.6+k*3.2,-4-k*2);s.add(shadowy(fe,true,false))}});
  const fac=new T.Group(),fm=new T.MeshStandardMaterial({map:brickTex("#26201c","#1a1512","#080606",4),roughness:.9});const fb=new T.Mesh(new T.BoxGeometry(14,14,1),fm);fb.position.y=6;fac.add(fb);
  const arch=cnv(128,256,(g,w,h)=>{g.fillStyle="#120e0c";g.fillRect(0,0,w,h);g.fillStyle="#ffb060";g.globalAlpha=.8;g.beginPath();g.moveTo(20,h-10);g.lineTo(20,80);g.quadraticCurveTo(w/2,-10,w-20,80);g.lineTo(w-20,h-10);g.fill();g.globalAlpha=1;g.strokeStyle="#120e0c";g.lineWidth=6;g.beginPath();g.moveTo(w/2,30);g.lineTo(w/2,h);g.moveTo(20,140);g.lineTo(w-20,140);g.stroke()});
  for(let i=0;i<5;i++){const wdw=new T.Mesh(new T.PlaneGeometry(1.4,2.8),new T.MeshBasicMaterial({map:arch,color:H("#ffffff",i%2?1.4:.6),transparent:true}));wdw.position.set(-5+i*2.5,7,.51);fac.add(wdw)}
  [-6.5,6.5,-2.2,2.2].forEach((x,i)=>{const sp=new T.Mesh(new T.ConeGeometry(.5,i<2?4:2.6,8),fm);sp.position.set(x,13+(i<2?2:1.3),0);fac.add(sp);const tw=new T.Mesh(new T.BoxGeometry(1,2,1),fm);tw.position.set(x,13,0);fac.add(tw)});
  fac.position.set(0,-1.6,-20);s.add(fac);
  const fl=new T.Mesh(new T.PlaneGeometry(10,40),new T.MeshStandardMaterial({color:"#0b0c0e",roughness:.12,metalness:.6,envMap:CUR_ENV,envMapIntensity:.3}));fl.rotation.x=-Math.PI/2;fl.position.set(0,-1.6,-6);fl.receiveShadow=true;s.add(fl);
  const dmp=new T.Group(),dm=std("#1f3a2a",.55,.4);const db=rbox(2.2,1.3,1.1,.05,dm);db.position.y=.65;dmp.add(db);const lid=rbox(2.3,.1,1.2,.03,std("#111",.5,.3));lid.position.set(0,1.32,0);lid.rotation.x=-.12;dmp.add(lid);dmp.position.set(-2.4,-1.6,-3.5);dmp.rotation.y=.3;s.add(shadowy(dmp));
  for(let i=0;i<4;i++){const b=new T.Mesh(new T.SphereGeometry(rnd(.35,.5),14,10),std("#0a0a0c",.25,.1,{envMap:CUR_ENV,envMapIntensity:.5}));b.scale.y=.75;b.position.set(rnd(1.6,2.8),-1.35,rnd(-6,-2));s.add(shadowy(b))}
  const disc=glow("#fff3c4",8,0);disc.material.fog=false;disc.material.color=H("#fff3c4",1.6);disc.position.set(0,12.5,-18.9);s.add(disc);const beam=new T.Mesh(new T.CylinderGeometry(2.6,.25,24,32,1,true),add(new T.MeshBasicMaterial({map:gradTex([[0,"rgba(255,255,255,1)"],[.5,"rgba(255,255,255,.45)"],[1,"rgba(255,255,255,.08)"]]),color:"#fff3c4",opacity:0,side:T.DoubleSide,fog:false})));beam.position.set(0,1,-12);beam.rotation.x=-.62;s.add(beam);
  const ct=texSmoke("80,90,100");const clouds=[];for(let i=0;i<16;i++){const m=new T.Sprite(new T.SpriteMaterial({map:ct,transparent:true,opacity:.8,depthWrite:false,fog:false}));const sc=rnd(8,14);m.scale.set(sc,sc*.6,1);m.position.set(rnd(-14,14),rnd(13,18),rnd(-26,-18));s.add(m);clouds.push(m)}
  const fog=new Smoke(s,14,texSmoke("120,150,135"),"#6f8a7c",()=>({p:V(rnd(-3.2,3.2),rnd(-1.5,-.6),rnd(-12,0)),v:V(rnd(.1,.4),rnd(0,.05),0),s:rnd(3,5)}),{life:4,op:.13,grow:.6});
  const steam=new Smoke(s,10,texSmoke("200,210,200"),"#cfd8cf",()=>({p:V(.8,-1.5,-5),v:V(rnd(-.1,.1),rnd(.6,1),0),s:.8}),{life:2.4,op:.25,grow:2.5});
  const rain=rainFx(700,[4,-1.6,12,-16,8],"#9fb3c9",.3,24,3);s.add(rain.obj);
  const wingG=new T.PlaneGeometry(.45,.32);wingG.translate(.22,0,0);const batM=new T.MeshBasicMaterial({map:cnv(64,48,(g)=>{g.fillStyle="#000";g.beginPath();g.moveTo(0,20);g.quadraticCurveTo(20,0,64,6);g.quadraticCurveTo(50,18,58,30);g.quadraticCurveTo(40,24,36,40);g.quadraticCurveTo(20,30,0,30);g.fill()}),transparent:true,alphaTest:.3,side:T.DoubleSide,fog:false,color:"#05050a"});
  const bats=[];for(let i=0;i<55;i++){const b=new T.Group(),body=new T.Mesh(new T.SphereGeometry(.07,8,6),std("#050508",.6));body.scale.set(1,.8,1.6);b.add(body);const wl=new T.Mesh(wingG,batM),wr=new T.Mesh(wingG,batM);wr.scale.x=-1;b.add(wl,wr);b.userData={wl,wr,s:V(rnd(-4,4),rnd(-1,3),rnd(-24,-14)),e:V(rnd(-9,9),rnd(-3,6),rnd(9,14)),d:rnd(0,.5),ph:rnd(0,6)};b.visible=false;s.add(b);bats.push(b)}
  const capeA=sd=>cnv(256,256,(g,w,h)=>{g.fillStyle="#000";g.fillRect(0,0,w,h);g.fillStyle="#fff";g.beginPath();const o=sd<0?0:w,i=w-o;g.moveTo(i,0);g.lineTo(i,h*.86);const n=4;for(let k=0;k<n;k++){const x0=i+(o-i)*k/n,x1=i+(o-i)*(k+1)/n;g.quadraticCurveTo((x0+x1)/2,h*.74+k*0,x1,h*(.86+k*.025))}g.lineTo(o,h*.35);g.quadraticCurveTo((o+i)/2,h*.12,i,0);g.fill()});
  const cape=[-1,1].map(sd=>{const m=cloth(3.8,4.4,"#232a40",14,14,{roughness:.36,metalness:.3,emissive:"#0d1426",envMap:CUR_ENV,envMapIntensity:.9,alphaMap:capeA(sd),alphaTest:.5});m.position.set(sd*.2,0,-.2);m.geometry.translate(sd*1.7,0,0);card.add(m);return m});
  const rang=new T.Mesh(new T.ExtrudeGeometry((()=>{const sh=new T.Shape();sh.moveTo(-.6,0);sh.quadraticCurveTo(0,.38,.6,0);sh.quadraticCurveTo(0,.16,-.6,0);return sh})(),{depth:.04,bevelEnabled:true,bevelSize:.01,bevelThickness:.01,bevelSegments:1}),metal("#2a2c34",.25,1.4));rang.geometry.center();rang.visible=false;s.add(rang);
  const rl=new T.PointLight("#d8e4ff",0,10);rl.position.set(2,3,1);s.add(rl);const rim=new T.PointLight("#7a9aff",0,12);rim.position.set(0,2.4,-3);s.add(rim);const cgl=glow("#5a7aff",7,0);cgl.position.set(0,0,-.6);card.add(cgl);
  const amb=new T.HemisphereLight("#8fa6ff","#0a0c0a",.35);s.add(amb);const wl1=new T.PointLight("#ffb060",8,9);wl1.position.set(-3,3,-6);s.add(wl1);const wl2=new T.PointLight("#ffb060",6,9);wl2.position.set(3,6,-9);s.add(wl2);const fl2=new T.PointLight("#fff3c4",30,30);fl2.position.set(0,6,-16);s.add(fl2);const ml=c.sun(new T.DirectionalLight("#bcd0ff",.5));ml.position.set(2,10,2);ml.target.position.set(0,0,-4);s.add(ml,ml.target);let sp=null;
  at(c,.1,()=>c.sfx("rain"));at(c,.55,()=>{c.flash(.55,"#cfe0ff");c.sfx("thunder")});at(c,1,()=>c.sfx("flutter"));at(c,1.4,()=>c.sfx("flutter"));at(c,2.6,()=>c.sfx("whoosh"));
  at(c,3.35,()=>{c.sfx("whoosh");c.shake(.12)});at(c,4,()=>{c.sfx("clank");c.shake(.18);sp=hdrP(burstParts(60,["#ffd34d","#ffffff"],card.position.clone().add(V(1,1.4,0)),4,-6,.08),2.5);s.add(sp.obj)});at(c,4,()=>c.reveal());at(c,4.3,()=>{c.flash(.4,"#cfe0ff");c.sfx("thunder")});
  return (t,dt)=>{rain.update(dt);fog.update(dt);steam.update(dt);clouds.forEach((m,i)=>{m.position.x+=Math.sin(i)*dt*.6});const ls=E(.4,1.2,t);disc.material.opacity=.85*ls;beam.material.opacity=.05*ls;
    const lit=(t>.55&&t<.65)||(t>4.3&&t<4.38);amb.intensity=.35+(lit?1.6:0);clouds.forEach(m=>m.material.color.setScalar(lit?2:1));
    bats.forEach(b=>{const k=E(1+b.userData.d,2.1+b.userData.d,t);b.visible=k>0&&k<1;if(b.visible){b.position.lerpVectors(b.userData.s,b.userData.e,k);b.lookAt(cam.position);const f=Math.sin(t*26+b.userData.ph)*.9;b.userData.wl.rotation.y=f;b.userData.wr.rotation.y=-f}});
    card.visible=t>1.7;const em=eo(E(1.8,3.2,t));card.position.set(0,rest.y,-6+5.5*em);card.rotation.set(0,(1-em)*.3,0);rl.intensity=em*20;rim.intensity=E(2.4,3.1,t)*26;cgl.material.opacity=E(2.4,3.1,t)*.35;
    cape.forEach((m,i)=>{const o=eo(E(2.4,3.1,t));m.scale.set(.15+o*1.1,1,1);m.rotation.y=(i?-1:1)*(1-o)*1.2;m.userData.wave(t,.12+o*.18,1.6,i?"left":"right");m.visible=t>1.7});
    rang.visible=t>3.15&&t<4.02;if(rang.visible){const k=E(3.15,4.02,t);const p=k<.55?L3(V(.3,1,0),V(cam.position.x+.6,cam.position.y-.15,cam.position.z-1.4),eo(k/.55)):L3(V(cam.position.x+.6,cam.position.y-.15,cam.position.z-1.4),card.position.clone().add(V(1.02,1.42,.1)),eio((k-.55)/.45));rang.position.copy(p);rang.rotation.set(1.3,t*28,0)}
    if(sp){sp.update(dt,t);sp.mat.opacity=Math.max(0,1-(t-4)/1)}
    if(t<1.8)toCam(cam,L3(V(.4,.2,12),V(.2,.6,9.5),eio(E(0,1.8,t))),V(0,2.2,-10));else toCam(cam,L3(V(.2,.6,9.5),V(0,1.1,7.6),eio(E(1.8,3.3,t))),L3(V(0,2.2,-10),rest,eio(E(1.8,3,t))))}};

function earthTex(){const t=cnv(1024,512,(g,w,h)=>{const o=g.createLinearGradient(0,0,0,h);o.addColorStop(0,"#0b2a6a");o.addColorStop(.5,"#1d5fd0");o.addColorStop(1,"#0b2a6a");g.fillStyle=o;g.fillRect(0,0,w,h);
  for(let k=0;k<26;k++){const cx=rnd(0,w),cy=rnd(h*.15,h*.85),R=rnd(30,120);g.fillStyle=Math.random()<.6?"#3f7a2a":"#8a7a4a";g.beginPath();for(let i=0;i<24;i++){const a=i/24*Math.PI*2,r=R*rnd(.6,1.2);g.lineTo(cx+Math.cos(a)*r*1.4,cy+Math.sin(a)*r)}g.fill()}
  g.fillStyle="#f2f6ff";g.fillRect(0,0,w,h*.06);g.fillRect(0,h*.94,w,h*.06)});return t}
function cloudTex(){const t=cnv(1024,512,(g,w,h)=>{g.clearRect(0,0,w,h);for(let i=0;i<500;i++){const x=rnd(0,w),y=rnd(0,h),r=rnd(8,40),q=g.createRadialGradient(x,y,0,x,y,r);q.addColorStop(0,"rgba(255,255,255,.55)");q.addColorStop(1,"rgba(255,255,255,0)");g.fillStyle=q;g.fillRect(x-r,y-r,r*2,r*2)}});return t}
const ATM_F=`varying vec3 vN;varying vec3 vV;uniform vec3 uC;void main(){float f=pow(1.-abs(dot(normalize(vN),normalize(-vV))),3.);gl_FragColor=vec4(uC*f*2.2,f);}`;
K.sup=c=>{const{s,cam,card,rest}=c;c.dur=5;c.bloom=[.55,.6,.95];s.add(sky("#01030c","#2a5fd0",95));
  const stars=field(300,[60,10,60,-80,-40],["#ffffff"],.15,()=>[0,0,0]);s.add(stars.obj);
  const earth=new T.Mesh(new T.SphereGeometry(80,96,64),new T.MeshStandardMaterial({map:earthTex(),roughness:.85,metalness:0,emissive:"#0a1a40",emissiveIntensity:.35}));earth.position.set(0,-86,-30);earth.rotation.z=.25;s.add(earth);
  const cl=new T.Mesh(new T.SphereGeometry(80.6,96,64),new T.MeshStandardMaterial({map:cloudTex(),transparent:true,depthWrite:false,roughness:1}));cl.position.copy(earth.position);s.add(cl);
  const atm=new T.Mesh(new T.SphereGeometry(83,96,64),new T.ShaderMaterial({vertexShader:HOLO_V,fragmentShader:ATM_F,uniforms:{uC:{value:new T.Color("#5fb0ff")}},transparent:true,blending:T.AdditiveBlending,side:T.BackSide,depthWrite:false}));atm.position.copy(earth.position);s.add(atm);
  const sunP=V(-14,4,-70);const sun=glow("#fff6dd",18,1);sun.material.color=H("#fff6dd",3);sun.position.copy(sunP);s.add(sun);const sun2=glow("#ffb347",70,.5);sun2.position.copy(sunP);s.add(sun2);
  const flares=[];[[.2,2.2,"#ffd7a0",.35],[.45,1.2,"#9fd0ff",.3],[.7,3,"#ffb36a",.18],[1.1,1.6,"#bfffd0",.22]].forEach(([k,sz,cl,op])=>{const f=glow(cl,sz,op);s.add(f);flares.push({f,k})});
  const ry=rays("#ffe7a8",20);ry.position.copy(sunP);ry.scale.setScalar(3.4);s.add(ry);
  const ct=texSmoke("255,225,180");const clouds=[];for(let i=0;i<34;i++){const m=new T.Sprite(new T.SpriteMaterial({map:ct,transparent:true,opacity:.9,depthWrite:false,color:i%3?"#ffe2b0":"#ffffff"}));const sc=rnd(7,15);m.scale.set(sc,sc*.42,1);m.position.set(rnd(-24,24),rnd(-6.5,-3),rnd(-44,6));s.add(m);clouds.push(m)}
  const dust=field(220,[20,-6,14,-30,6],["#fff1c4","#ffffff"],.07,()=>[rnd(-.2,.2),rnd(-.1,.1),rnd(-.2,.2)]);s.add(dust.obj);
  const cape=cloth(2.7,3.3,"#c8102e",14,18,{roughness:.5});cape.material=new T.MeshPhysicalMaterial({color:"#b80c26",roughness:.55,sheen:1,sheenColor:new T.Color("#ff6a7a"),sheenRoughness:.35,side:T.DoubleSide});cape.position.set(0,-.45,-.22);card.add(cape);
  const beams=[0,1].map(()=>{const g=new T.Group(),m=new T.Mesh(new T.CylinderGeometry(.035,.035,1,10),hb("#ff3a1a",4));const m2=new T.Mesh(new T.CylinderGeometry(.11,.11,1,10),add(new T.MeshBasicMaterial({color:H("#ff2a1a",1.5),opacity:.5})));g.add(m,m2);g.visible=false;s.add(g);return g});
  const fr=frameFx(card);let mol=null;
  s.add(new T.HemisphereLight("#ffe7c8","#3a6ad0",.9));const dl=c.sun(new T.DirectionalLight("#ffd9a0",2.4));dl.position.set(-8,5,8);s.add(dl);const rl=new T.PointLight("#ff3a1a",0,8);s.add(rl);
  at(c,.05,()=>c.sfx("rumble"));at(c,1.2,()=>c.sfx("fly"));at(c,2.6,()=>c.sfx("rumble"));at(c,3.05,()=>{c.sfx("sizzle");c.sfx("laser")});at(c,3,()=>c.reveal());at(c,3.9,()=>{mol=hdrP(burstParts(90,["#ffb347","#ff5a1a","#fff1c4"],card.position.clone(),3,-3,.09),2);s.add(mol.obj)});
  const eye=V(),tgt=V(),tmp=V(),sp=V();
  return (t,dt)=>{dust.update(dt,t);clouds.forEach(m=>{m.position.x+=dt*.4});ry.rotation.z=t*.05;ry.lookAt(cam.position);earth.rotation.y=t*.01;cl.rotation.y=t*.016;
    sp.copy(sunP).project(cam);flares.forEach(({f,k})=>{const x=sp.x*(1-k*1.6),y=sp.y*(1-k*1.6);tmp.set(x,y,.5).unproject(cam);f.position.copy(cam.position).add(tmp.sub(cam.position).setLength(10))});
    card.visible=t>1.1;const d=eo(E(1.1,3,t));card.position.set(Math.sin(t*.8)*.15*(1-d),rest.y+9*(1-d)+Math.sin(t*1.4)*.06,rest.z);card.rotation.set(-.25*(1-d),Math.sin(t*.6)*.12,0);
    cape.userData.wave(t*1.4,.22,1.5,"top");cape.rotation.x=-.25-.2*Math.sin(t*1.1);
    const bk=E(3.05,3.95,t);beams.forEach((b,i)=>{b.visible=bk>0&&bk<1;if(!b.visible)return;card.localToWorld(eye.set(i?.28:-.28,.95,.3));const W2=1.25,H2=1.75,u=(bk+i*.5)%1,dd=u*2*(W2*2+H2*2);let x,y;
      if(dd<W2*2){x=-W2+dd;y=H2}else if(dd<W2*2+H2*2){x=W2;y=H2-(dd-W2*2)}else if(dd<W2*4+H2*2){x=W2-(dd-W2*2-H2*2);y=-H2}else{x=-W2;y=-H2+(dd-W2*4-H2*2)}card.localToWorld(tgt.set(x,y,.1));
      tmp.copy(cam.position).sub(card.position).setLength(1.1);eye.add(tmp);const len=eye.distanceTo(tgt);b.position.copy(eye).lerp(tgt,.5);b.scale.y=len;b.lookAt(tgt);b.rotateX(Math.PI/2);rl.position.copy(tgt);rl.intensity=30});
    if(bk>=1)rl.intensity=0;fr.prog(E(3.05,3.95,t),bk>0?(1-E(4.2,5,t)*.6)*1.4:0,"#ffb347");if(mol){mol.update(dt,t);mol.mat.opacity=Math.max(0,1-(t-3.9)/1.2)}
    if(t<1.2)toCam(cam,L3(V(2,-4,10),V(1,-1.5,9),eio(E(0,1.2,t))),V(-4,1,-40));else toCam(cam,L3(V(1,-1.5,9),V(0,.9,7.6),eio(E(1.2,3,t))),L3(V(-4,1,-40),rest,eio(E(1.2,2.6,t))))}};

K.vader=c=>{const{s,cam,card,rest}=c;c.dur=5.2;c.bloom=[1,.5,.8];s.background=new T.Color("#020101");s.fog=new T.FogExp2("#0a0203",.04);
  const grate=cnvL(256,256,(g,w,h)=>{g.fillStyle="#fff";g.fillRect(0,0,w,h);g.fillStyle="#000";for(let y=0;y<h;y+=16)for(let x=0;x<w;x+=16)g.fillRect(x+3,y+3,10,10)});grate.wrapS=grate.wrapT=T.RepeatWrapping;grate.repeat.set(4,40);
  const cat=new T.Mesh(new T.BoxGeometry(4,.2,40),metal("#3a3c44",.35,.6,{alphaMap:grate,transparent:false,alphaTest:.5}));cat.position.set(0,-1.75,-12);cat.receiveShadow=true;s.add(cat);
  const cat2=new T.Mesh(new T.BoxGeometry(4.4,.06,40),metal("#1a1b20",.4,.5));cat2.position.set(0,-1.95,-12);s.add(cat2);
  [-2.2,2.2].forEach(x=>{const ed=new T.Mesh(new T.BoxGeometry(.12,.3,40),metal("#2a2b31",.35,.8));ed.position.set(x,-1.7,-12);s.add(ed);const st=new T.Mesh(new T.BoxGeometry(.03,.03,40),hb("#ff2a1a",3));st.position.set(x*.98,-1.55,-12);s.add(st)});
  const rm=metal("#2c2c33",.3,.9);[-2,2].forEach(x=>{const r=new T.Mesh(new T.CylinderGeometry(.035,.035,40,8),rm);r.rotation.x=Math.PI/2;r.position.set(x,-.7,-12);s.add(r);for(let z=8;z>-32;z-=2.5){const p=new T.Mesh(new T.CylinderGeometry(.03,.03,1.1,8),rm);p.position.set(x,-1.2,z);s.add(p)}});
  const shaft=new T.Group();for(let i=0;i<9;i++){const r=new T.Mesh(new T.TorusGeometry(7+i*.3,.18,8,64),metal("#1c1c22",.4,.7));r.rotation.x=Math.PI/2;r.position.y=-5-i*3.2;shaft.add(r);const lr=new T.Mesh(new T.TorusGeometry(6.8+i*.3,.03,4,64),hb("#ff2a1a",i%2?2.5:1.2));lr.rotation.x=Math.PI/2;lr.position.y=-5-i*3.2+.2;shaft.add(lr)}shaft.position.set(0,0,-10);s.add(shaft);
  const core=glow("#ff3a1a",30,.35);core.position.set(0,-40,-10);s.add(core);
  const pt=cnv(256,256,(g,w,h)=>{g.fillStyle="#1a1a20";g.fillRect(0,0,w,h);g.strokeStyle="#0a0a0e";g.lineWidth=4;for(let y=0;y<h;y+=64){g.beginPath();g.moveTo(0,y);g.lineTo(w,y);g.stroke()}for(let x=0;x<w;x+=128){g.beginPath();g.moveTo(x,0);g.lineTo(x,h);g.stroke()}g.strokeStyle="#2c2c34";g.lineWidth=2;for(let y=8;y<h;y+=64)g.strokeRect(16,y+8,96,40)});pt.wrapS=pt.wrapT=T.RepeatWrapping;pt.repeat.set(8,3);
  [-1,1].forEach(sd=>{const w=new T.Mesh(new T.PlaneGeometry(40,14),new T.MeshStandardMaterial({map:pt,roughness:.4,metalness:.8,envMap:CUR_ENV,envMapIntensity:.2}));w.position.set(sd*6,3,-12);w.rotation.y=-sd*Math.PI/2;s.add(w)});
  const mon=[];for(let i=0;i<6;i++){const g=new T.Group(),cs=rbox(1.8,1.1,.4,.06,metal("#18181c",.4,.6));g.add(cs);const sc=new T.Mesh(new T.PlaneGeometry(1.4,.6),new T.MeshBasicMaterial({map:cnv(256,110,(c,w,h)=>{c.fillStyle="#120204";c.fillRect(0,0,w,h);c.strokeStyle="#ff3a2a";c.lineWidth=2;for(let k=0;k<5;k++){c.beginPath();for(let x=0;x<w;x+=8)c.lineTo(x,20+k*18+Math.sin(x*.08+k)*6);c.stroke()}}),color:H("#ffffff",1.4)}));sc.position.set(0,.15,.21);g.add(sc);
    for(let j=0;j<6;j++){const d=new T.Mesh(new T.CircleGeometry(.04,10),hb(Math.random()<.7?"#ff2a2a":"#ffb347",3));d.position.set(-.6+j*.24,-.35,.21);g.add(d);mon.push({d,ph:rnd(0,9),sp:rnd(2,9)})}
    g.position.set(i<3?-5.6:5.6,-.4,-4-(i%3)*4);g.rotation.y=i<3?Math.PI/2:-Math.PI/2;s.add(g)}
  const vents=[];for(let i=0;i<8;i++){const v=new T.Mesh(new T.BoxGeometry(1.6,.06,.22),hb("#ff3a10",2.5));v.position.set(i%2?-4.4:4.4,-1.9,-i*3.4);s.add(v);vents.push(v)}
  const steam=new Smoke(s,22,texSmoke("255,90,60"),"#ff4a2a",()=>{const v=vents[Math.random()*vents.length|0];return{p:V(v.position.x,v.position.y,v.position.z),v:V(rnd(-.1,.1),rnd(.8,1.4),0),s:1.2}},{life:2.4,op:.25,grow:2.4,additive:true});
  const door=[-1,1].map(sd=>{const g=new T.Group(),d=rbox(3.6,7.4,.5,.1,metal("#1c1c22",.32,.9));g.add(d);for(let k=0;k<4;k++){const ln=new T.Mesh(new T.BoxGeometry(3,.05,.05),hb("#ff2a1a",1.6));ln.position.set(0,-2.6+k*1.8,.27);g.add(ln)}g.position.set(sd*1.8,2,-30);s.add(g);return g});
  const sb=saber("#ff1a2c",3.4);sb.userData.blade.children[0].material.color=H("#ffffff",3);sb.userData.blade.children[1].material.color=H("#ff1a2c",2.5);sb.position.set(1.7,-.3,.4);sb.rotation.z=-.15;card.add(sb);const lt=new T.PointLight("#ff1a2c",0,14);lt.position.set(1.4,1,2);card.add(lt);
  const amb=new T.HemisphereLight("#ff4050","#100204",0);s.add(amb);const arcs=[];let nArc=0;const smk=new Smoke(s,20,texSmoke("120,10,20"),"#7a0a14",()=>{const a=rnd(0,6.28);return{p:card.position.clone().add(V(Math.cos(a)*1.8,rnd(-1.4,1.4),Math.sin(a)*.6)),v:V(-Math.sin(a)*.8,rnd(.1,.4),Math.cos(a)*.3),s:1.4}},{life:1.6,op:.4,grow:1.4});
  at(c,.15,()=>c.sfx("breath"));at(c,1.25,()=>{c.sfx("ignite");c.flash(.25,"#ff3a3a")});at(c,1.9,()=>{c.sfx("thump");c.shake(.16)});at(c,2.55,()=>{c.sfx("thump");c.shake(.2)});at(c,3.05,()=>{c.sfx("crackle");c.sfx("rumble")});at(c,3.05,()=>c.reveal());at(c,3.7,()=>c.sfx("crackle"));
  return (t,dt)=>{const on=E(1.25,1.6,t);sb.userData.blade.scale.y=Math.max(.001,eo(on));sb.visible=t>1.2;lt.intensity=on*45*(.85+Math.random()*.15);amb.intensity=on*.35;
    mon.forEach(m=>m.d.material.color.copy(H(Math.sin(t*m.sp+m.ph)>0?"#ff2a2a":"#3a0808",Math.sin(t*m.sp+m.ph)>0?3:1)));steam.update(dt,t>.2);shaft.rotation.y=t*.05;door.forEach((d,i)=>d.position.x=(i?1:-1)*(1.8+E(.2,2,t)*.8));
    card.visible=t>1.2;const st=Math.min(1,E(1.6,1.9,t)*.5+E(2.25,2.55,t)*.5),bob=Math.sin(Math.min(1,st)*Math.PI*2)*.05;card.position.set(0,rest.y+bob,-4.2+3.7*eo(st));card.rotation.set(0,0,0);
    const fc=E(3.05,3.3,t);smk.update(dt,t>3.05);if(t>3.05&&t>nArc){nArc=t+.08;arcs.forEach(a=>{s.remove(a);a.traverse(x=>{x.geometry&&x.geometry.dispose()})});arcs.length=0;for(let i=0;i<3;i++){const a0=rnd(0,6.28),a1=a0+rnd(.6,1.4),r=1.9;const m=boltMesh(card.position.clone().add(V(Math.cos(a0)*r,rnd(-1.4,1.6),Math.sin(a0)*.6)),card.position.clone().add(V(Math.cos(a1)*r,rnd(-1.4,1.6),Math.sin(a1)*.6)),"#ff1a2c",.025,6,.3);m.children[0].material.color=H("#ffd0d0",2.5);m.children.forEach(x=>x.material.opacity*=fc*(1-E(4.6,5.2,t)));s.add(m);arcs.push(m)}}
    if(t<1.25)toCam(cam,V(0,.9,8.4),V(0,.6,-4));else toCam(cam,L3(V(0,.9,8.4),V(-.6,1,7.4),eio(E(1.3,3.4,t))),L3(V(0,.6,-4),rest,eio(E(1.3,2.8,t))))}};

K.luke=c=>{const{s,cam,card,rest}=c;c.dur=5;c.bloom=[.9,.6,.82];s.add(sky("#0e3a32","#03100e"));s.fog=new T.FogExp2("#0f2c27",.06);
  const bark=new T.MeshStandardMaterial({map:barkTex("#2a2a1c","#141410"),color:"#8a9a7a",roughness:.95}),leaf=new T.MeshStandardMaterial({color:"#1f3a1a",roughness:.95,flatShading:true});
  for(let i=0;i<16;i++){let a=rnd(0,6.28),r=rnd(6,16);for(let q=0;q<20;q++){const x=Math.cos(a)*r,z=Math.sin(a)*r-5;if(!(Math.abs(x)<4.6&&z>-7))break;a=rnd(0,6.28);r=rnd(6,16)}
    const tr=gnarlTree(rnd(8,13),rnd(.35,.6),bark,Math.random()<.6?leaf:null);tr.position.set(Math.cos(a)*r,-1.6,Math.sin(a)*r-5);tr.rotation.y=rnd(0,6);s.add(shadowy(tr,false,true))}
  const vines=[];for(let i=0;i<14;i++){const x=rnd(-7,7),z=rnd(-14,-3),l=rnd(3,6),pts=[V(x,7,z),V(x+rnd(-.3,.3),7-l*.5,z),V(x+rnd(-.4,.4),7-l,z)];const v=new T.Mesh(new T.TubeGeometry(new T.CatmullRomCurve3(pts),12,.03,5,false),std("#2a4a22",.9));s.add(v);vines.push(v)}
  const water=new T.Mesh(new T.PlaneGeometry(40,40),new T.MeshStandardMaterial({color:"#0a1a16",roughness:.08,metalness:.9,envMap:CUR_ENV,envMapIntensity:.25}));water.rotation.x=-Math.PI/2;water.position.y=-1.62;s.add(water);
  const mud=new T.Mesh(new T.CircleGeometry(5,32),new T.MeshStandardMaterial({map:noiseTex(128,128,"#1a2216",["#0a0e08","#2a3420"],3,.6),roughness:.9}));mud.rotation.x=-Math.PI/2;mud.position.set(0,-1.6,-.5);mud.receiveShadow=true;s.add(mud);
  const fern=cnv(128,128,(g)=>{g.strokeStyle="#3a6a2a";g.lineWidth=3;for(let k=0;k<7;k++){g.beginPath();g.moveTo(64,128);g.quadraticCurveTo(64+(k-3)*12,60,64+(k-3)*22,10);g.stroke();for(let j=0;j<10;j++){const y=120-j*11,x=64+(k-3)*(2+j*2);g.beginPath();g.moveTo(x,y);g.lineTo(x-8,y-6);g.moveTo(x,y);g.lineTo(x+8,y-6);g.stroke()}}});
  for(let i=0;i<22;i++){const f=new T.Mesh(new T.PlaneGeometry(1.4,1.4),new T.MeshStandardMaterial({map:fern,transparent:true,alphaTest:.3,side:T.DoubleSide,roughness:.9}));const a=rnd(0,6.28),r=rnd(2.8,8);f.position.set(Math.cos(a)*r,-1.0,Math.sin(a)*r-2);f.rotation.y=rnd(0,3);s.add(f);const f2=f.clone();f2.rotation.y+=Math.PI/2;s.add(f2)}
  const gods=[];for(let i=0;i<7;i++){const m=new T.Mesh(new T.CylinderGeometry(.3,2.4,20,24,1,true),add(new T.MeshBasicMaterial({color:H(i%2?"#5fd4ff":"#5fffb0",1),opacity:.06,side:T.DoubleSide})));m.position.set(rnd(-7,7),7,rnd(-14,-2));m.rotation.z=rnd(-.3,.3);s.add(m);gods.push(m)}
  const dust=hdrP(field(320,[12,-1.5,7,-14,6],["#bfffe0","#a8e6ff","#ffffff"],.06,()=>[rnd(-.08,.08),rnd(.05,.25),rnd(-.08,.08)]),1.6);s.add(dust.obj);
  const sb=saber("#3cff6a",3.2);sb.userData.blade.children[0].material.color=H("#ffffff",3);sb.userData.blade.children[1].material.color=H("#3cff6a",2.4);sb.position.set(1.5,-1.2,.5);card.add(sb);const lt=new T.PointLight("#3cff6a",0,12);lt.position.set(1.4,.5,1.5);card.add(lt);
  const tex=cnv(256,32,(g,w,h)=>{const q=g.createLinearGradient(0,0,w,0);q.addColorStop(0,"rgba(255,255,255,0)");q.addColorStop(.6,"rgba(200,255,210,.7)");q.addColorStop(1,"rgba(255,255,255,1)");g.fillStyle=q;g.fillRect(0,0,w,h)});
  const trails=[[-.3,2.3,0],[2.6,4.9,1]].map(([a0,a1,i])=>{const m=new T.Mesh(new T.RingGeometry(2.72,2.9,72,1,a0,a1-a0),add(new T.MeshBasicMaterial({color:H("#5aff8a",1.1),opacity:0,side:T.DoubleSide})));m.position.set(0,.2,.4);m.rotation.x=i?.5:-.4;card.add(m);return m});
  const ab=hdrP(new Parts(260,{cols:["#5aff8a","#d8ffe0","#ffffff"],size:.08,init:(p,v,i,l)=>{const a=rnd(-.3,4.9),r=rnd(2.6,2.95);v.set([Math.cos(a)*r,Math.sin(a)*r+.2,rnd(-.2,.2)],i*3);p.set([0,-99,0],i*3);l[i]=rnd(0,.4)},step:(p,v,i,dt,t,l)=>{const k=eio(E(3.4+l[i],4.2+l[i],t));if(k<=0||k>=1){p.set([0,-99,0],i*3);return}const w=V(v[i*3],v[i*3+1],v[i*3+2]);card.localToWorld(w);p.set([w.x+(card.position.x-w.x)*k,w.y+(card.position.y-w.y)*k,w.z+(card.position.z-w.z)*k],i*3)}}),2);s.add(ab.obj);
  s.add(new T.HemisphereLight("#8fe0c8","#0a1410",.55));const dl=c.sun(new T.DirectionalLight("#bfffe8",1.1));dl.position.set(3,12,2);dl.target.position.set(0,0,-3);s.add(dl,dl.target);
  at(c,1.25,()=>c.sfx("ignite"));at(c,1.65,()=>c.sfx("swing"));at(c,2.1,()=>c.sfx("swing"));at(c,3.4,()=>c.sfx("magic"));at(c,3.5,()=>c.reveal());
  return (t,dt)=>{dust.update(dt,t);gods.forEach((m,i)=>m.material.opacity=.05+.03*Math.sin(t*1.5+i));ab.update(dt,t);ab.mat.opacity=1-E(4.3,4.7,t);vines.forEach((v,i)=>v.rotation.z=Math.sin(t*.8+i)*.03);
    card.visible=t>.9;const ap=eo(E(.9,1.4,t));card.position.set(0,rest.y-.4*(1-ap),rest.z-1.5*(1-ap));
    const ig=eo(E(1.25,1.5,t));sb.userData.blade.scale.y=Math.max(.001,ig);sb.visible=t>1.2;lt.intensity=ig*30*(1-E(4,4.6,t)*.5);
    const s1=E(1.6,1.95,t),s2=E(2.05,2.45,t);sb.rotation.z=t<2?-.2+eio(s1)*-2.4:t<2.5?-2.6+eio(s2)*2.9:.3-E(2.6,3,t)*.9;sb.position.set(1.5-E(2.6,3,t)*.5,-1.2+E(2.6,3,t)*.6,.5);
    trails.forEach((m,i)=>{const sk=i?s2:s1;m.material.opacity=sk>0?(1-E(3.3,4.1,t))*.5:0;m.scale.setScalar(1-E(3.3,4.1,t)*.8)});
    card.rotation.y=Math.sin(t*.7)*.08;
    toCam(cam,L3(V(-2.5,.3,12),V(.2,1.1,7.6),eio(E(0,3,t))),L3(V(0,1.6,-6),rest,eio(E(.4,2.6,t))))}};

K.gandalf=c=>{const{s,cam,card,rest}=c;c.dur=5.2;c.bloom=[1,.6,.8];s.background=new T.Color("#030305");s.fog=new T.FogExp2("#08080b",.035);
  const rt=runeTex();rt.wrapS=rt.wrapT=T.RepeatWrapping;rt.repeat.set(3,2);const stone=noiseTex(256,256,"#3a3a40",["#222228","#4a4a52","#2a2a30"],3,.5);
  const pm=new T.MeshStandardMaterial({map:stone,color:"#7a7a84",roughness:.92,emissive:H("#ffb347",1),emissiveMap:rt,emissiveIntensity:.35});
  const prof=[[1.3,0],[1.3,.5],[1.05,.7],[1.05,1],[.9,1.2],[.85,14],[1,14.4],[1.25,14.8],[1.4,15.4],[1.4,16]];
  for(let z=0;z<6;z++)for(const x of[-5.2,5.2]){const p=lathe(prof,pm,20);p.position.set(x+rnd(-.3,.3),-1.6,-z*5.5-1.5);s.add(shadowy(p,true,true))}
  const beamM=new T.MeshStandardMaterial({map:stone,color:"#5a5a62",roughness:.95});for(let z=0;z<6;z++){const b=new T.Mesh(new T.BoxGeometry(12,1,1.2),beamM);b.position.set(0,14.6,-z*5.5-1.5);s.add(b)}
  const tiles=cnv(256,256,(g,w,h)=>{g.fillStyle="#2a2a30";g.fillRect(0,0,w,h);g.strokeStyle="#121216";g.lineWidth=5;for(let i=0;i<=w;i+=64){g.beginPath();g.moveTo(i,0);g.lineTo(i,h);g.stroke();g.beginPath();g.moveTo(0,i);g.lineTo(w,i);g.stroke()}for(let i=0;i<300;i++){g.fillStyle=Math.random()<.5?"#202026":"#34343c";g.globalAlpha=.4;g.fillRect(rnd(0,w),rnd(0,h),rnd(2,6),rnd(2,6))}});tiles.wrapS=tiles.wrapT=T.RepeatWrapping;tiles.repeat.set(10,16);
  const fl=new T.Mesh(new T.PlaneGeometry(40,64),new T.MeshStandardMaterial({map:tiles,roughness:.75,metalness:.1,envMap:CUR_ENV,envMapIntensity:.15}));fl.rotation.x=-Math.PI/2;fl.position.set(0,-1.6,-14);fl.receiveShadow=true;s.add(fl);
  const dust=field(320,[10,-1.5,8,-34,6],["#ffe0a0","#ffffff"],.05,()=>[rnd(-.05,.05),rnd(-.02,.06),rnd(-.05,.05)]);s.add(dust.obj);
  const tr=hdrP(new Parts(260,{cols:["#ffcc66","#ffe9b0"],size:.08,init:(p,v,i)=>{v.set([rnd(0,6.28),rnd(1.5,4),rnd(-30,-2)],i*3)},step:(p,v,i,dt,t)=>{const a=v[i*3]+t*.6;p.set([Math.cos(a)*v[i*3+1],2+Math.sin(a*1.3)*1.5,v[i*3+2]+Math.sin(t+i)*.3],i*3)}}),2.2);s.add(tr.obj);
  const staff=new T.Group(),sc=new T.CatmullRomCurve3([V(0,0,0),V(.05,1.2,.02),V(-.04,2.4,-.02),V(.02,3.5,0),V(.18,3.9,0),V(.05,4.1,0)]);staff.add(new T.Mesh(new T.TubeGeometry(sc,40,.055,8,false),new T.MeshStandardMaterial({map:barkTex("#6a4a2a","#3a2614"),roughness:.8})));
  const cry=new T.Mesh(new T.OctahedronGeometry(.13,0),hb("#e8f4ff",3.5));cry.position.set(.12,3.95,0);staff.add(cry);const sg=glow("#ffffff",1,1);sg.position.copy(cry.position);staff.add(sg);staff.position.set(1.55,-1.8,.3);card.add(shadowy(staff,true,false));
  const wave=new T.Mesh(new T.RingGeometry(.9,1.3,128),add(new T.MeshBasicMaterial({color:H("#ffffff",1.8),opacity:0,side:T.DoubleSide})));wave.rotation.x=-Math.PI/2;s.add(wave);const sph=glow("#ffffff",1,0);s.add(sph);
  const amb=new T.HemisphereLight("#8090b0","#0a0a0c",.25);s.add(amb);const sl=new T.PointLight("#fff3d0",8,12);s.add(sl);const torch=[];[[-5.2,-4],[5.2,-9.5],[-5.2,-15]].forEach(([x,z])=>{const l=new T.PointLight("#ff9a3a",10,10);l.position.set(x*.82,2.4,z);s.add(l);const g=glow("#ffb050",.9,1);g.material.color=H("#ffb050",2);g.position.copy(l.position);s.add(g);torch.push(l)});const fw=[];let nfw=2.7;
  at(c,.2,()=>c.sfx("rumble"));at(c,1.6,()=>c.sfx("magic"));at(c,2.3,()=>{c.sfx("boom");c.shake(.4);c.flash(.45)});at(c,2.4,()=>c.reveal());
  return (t,dt)=>{dust.update(dt,t);tr.update(dt,t);torch.forEach((l,i)=>l.intensity=10+Math.sin(t*13+i*3)*2+Math.random()*2);card.visible=t>.9;const ap=eo(E(.9,1.5,t)),lift=eo(E(1.6,2.15,t))*(1-eio(E(2.15,2.3,t)));
    card.position.set(0,rest.y+lift*.7,rest.z);card.rotation.set(0,0,0);sl.position.copy(card.position).add(V(1.4,2.6,1));sl.intensity=ap*12+(t>2.3?20*(1-E(2.3,3.2,t)):0);cry.material.color.copy(H("#e8f4ff",3.5+lift*3));
    const w=E(2.3,3.3,t);wave.position.set(card.position.x,-1.58,card.position.z);wave.scale.setScalar(1+w*24);wave.material.opacity=w>0?(1-w):0;sph.position.copy(card.position);sph.scale.setScalar(1+w*18);sph.material.opacity=w>0?(1-w)*.35:0;amb.intensity=.25+(w>0?(1-w)*.8:0)+(t>2.3?.25:0);
    if(t>nfw&&t<4.6){nfw=t+rnd(.18,.32);const cen=V(rnd(-4.5,4.5),rnd(2.6,5.2),rnd(-9,-4)),cols=[["#ff6ad5","#ffffff"],["#6ad5ff","#ffffff"],["#ffd34d","#ff8a3a"],["#8aff8a","#ffffff"]][Math.random()*4|0];const b=hdrP(burstParts(130,cols,cen,rnd(2.5,4),-.6,.16),2.2);s.add(b.obj);fw.push({b,t0:t});c.sfx("pop")}
    fw.forEach(f=>{f.b.update(dt,t);f.b.mat.opacity=Math.max(0,1-(t-f.t0)/1.8)});
    toCam(cam,L3(V(-1.2,.2,16),V(0,1.1,7.8),eio(E(0,2.4,t))),L3(V(0,3,-20),rest,eio(E(.6,2.2,t))))}};

K.harry=c=>{const{s,cam,card,rest}=c;c.dur=5;c.bloom=[.95,.6,.82];const ceil=sky("#0b0f2a","#1b1438");s.add(ceil);s.fog=new T.FogExp2("#0d0a18",.026);
  const ct=texSmoke("150,150,200");for(let i=0;i<10;i++){const m=new T.Sprite(new T.SpriteMaterial({map:ct,transparent:true,opacity:.35,depthWrite:false,fog:false}));const sc=rnd(8,14);m.scale.set(sc,sc*.5,1);m.position.set(rnd(-12,12),rnd(11,14),rnd(-30,-4));s.add(m)}
  const stars=hdrP(field(360,[30,11,22,-40,6],["#ffffff","#cfd8ff"],.1,()=>[0,0,0]),1.4);s.add(stars.obj);
  const stone=noiseTex(256,256,"#4a4250",["#2a2430","#5a5260","#3a3440"],4,.5);const wm=new T.MeshStandardMaterial({map:stone,roughness:.9});
  const archW=cnv(128,320,(g,w,h)=>{g.fillStyle="#0a0a14";g.fillRect(0,0,w,h);const gr=g.createLinearGradient(0,0,0,h);gr.addColorStop(0,"#6a7ad0");gr.addColorStop(1,"#2a2a60");g.fillStyle=gr;g.beginPath();g.moveTo(14,h-8);g.lineTo(14,100);g.quadraticCurveTo(w/2,-20,w-14,100);g.lineTo(w-14,h-8);g.fill();g.strokeStyle="#0a0a14";g.lineWidth=5;g.beginPath();g.moveTo(w/2,20);g.lineTo(w/2,h);for(let y=90;y<h;y+=56){g.moveTo(14,y);g.lineTo(w-14,y)}g.stroke()});
  [-1,1].forEach(sd=>{const w=new T.Mesh(new T.PlaneGeometry(40,14),wm);w.position.set(sd*8,5,-14);w.rotation.y=-sd*Math.PI/2;w.receiveShadow=true;s.add(w);for(let k=0;k<5;k++){const wi=new T.Mesh(new T.PlaneGeometry(1.8,4.4),new T.MeshBasicMaterial({map:archW,color:H("#ffffff",1.3)}));wi.position.set(sd*7.98,6,-2-k*6);wi.rotation.y=-sd*Math.PI/2;s.add(wi)}});
  const bw=new T.Mesh(new T.PlaneGeometry(18,14),wm);bw.position.set(0,5,-32);s.add(bw);
  const wd=new T.MeshStandardMaterial({map:woodTex("#6a4426","#3a2210"),roughness:.55,envMap:CUR_ENV,envMapIntensity:.15});const gold=metal("#e2b84a",.25,1.2);
  [-3.2,3.2].forEach(x=>{const tb=new T.Mesh(new T.BoxGeometry(1.5,.12,30),wd);tb.position.set(x,-.6,-15);s.add(shadowy(tb));[-1,1].forEach(sd=>{const bn=new T.Mesh(new T.BoxGeometry(.4,.1,30),wd);bn.position.set(x+sd*1.1,-1.05,-15);s.add(bn)});
    for(let z=0;z<12;z++){const pl=new T.Mesh(new T.CylinderGeometry(.18,.16,.03,20),gold);pl.position.set(x+(z%2?.4:-.4),-.52,-2-z*2.2);s.add(pl);const gb=lathe([[0,0],[.08,0],[.03,.04],[.025,.16],[.1,.24],[.11,.36],[0,.36]],gold,16);gb.position.set(x+(z%2?-.45:.45),-.54,-2.6-z*2.2);s.add(gb)}});
  const fl=new T.Mesh(new T.PlaneGeometry(20,60),new T.MeshStandardMaterial({map:noiseTex(256,256,"#2a2420",["#1a1410","#3a3028"],8,.5),roughness:.6,envMap:CUR_ENV,envMapIntensity:.12}));fl.rotation.x=-Math.PI/2;fl.position.set(0,-1.6,-14);fl.receiveShadow=true;s.add(fl);
  const cm=std("#f3e7c8",.6),cds=[];for(let i=0;i<64;i++){const g=new T.Group(),h=rnd(.4,.8);g.add(new T.Mesh(new T.CylinderGeometry(.055,.06,h,10),cm));const wx=glow("#ffb347",.45,1);wx.material.color=H("#ffb347",2.4);wx.position.y=h/2+.1;g.add(wx);g.position.set(rnd(-7,7),rnd(2.5,7),rnd(-28,3));g.userData.ph=rnd(0,6);s.add(g);cds.push(g)}
  const bns=["#9b111e","#1a7a3a","#1f3c9b","#d4a017"].map((cl,i)=>{const b=cloth(1.6,3.8,cl,6,14);b.material=new T.MeshPhysicalMaterial({color:cl,roughness:.6,sheen:1,sheenColor:new T.Color(cl).lerp(new T.Color("#fff"),.3),side:T.DoubleSide});b.position.set(-5.4+i*3.6,5.4,-31.5);s.add(b);const rod=new T.Mesh(new T.CylinderGeometry(.04,.04,2,8),gold);rod.rotation.z=Math.PI/2;rod.position.set(-5.4+i*3.6,7.4,-31.4);s.add(rod);return b});
  const wand=new T.Group(),wc=new T.Mesh(new T.CylinderGeometry(.015,.03,1.1,10),std("#3a2414",.6));wand.add(wc);const wh=new T.Mesh(new T.CylinderGeometry(.035,.035,.3,10),std("#24140a",.5));wh.position.y=-.45;wand.add(wh);const wtip=glow("#dfe8ff",.4,0);wtip.material.color=H("#dfe8ff",2.5);wtip.position.y=.58;wand.add(wtip);wand.position.set(1.5,-.7,.4);wand.rotation.z=-.9;card.add(wand);
  const sp=hdrP(new Parts(220,{cols:["#dfe8ff","#ffffff"],size:.07,init:(p,v,i,l)=>{p.set([0,-99,0],i*3);l[i]=i/220},step:(p,v,i,dt,t,l)=>{const k=E(1,1.7,t);if(k<=0)return;const u=Math.min(l[i],k),a=u*Math.PI*3;const w=V(1.9+Math.cos(a)*.6*u,.2+u*1.6,.4+Math.sin(a)*.4);card.localToWorld(w);p.set([w.x,w.y,w.z],i*3)}}),2);s.add(sp.obj);
  const SP=stagPts(1900),stag=new T.Points(new T.BufferGeometry(),add(new T.PointsMaterial({color:H("#cfe0ff",2.2),size:.085,map:dot()})));stag.geometry.setAttribute("position",new T.BufferAttribute(SP.slice(),3));stag.visible=false;s.add(stag);const sgl=glow("#9fc0ff",4,.45);stag.add(sgl);
  const glit=hdrP(new Parts(520,{cols:["#e8eeff","#ffffff","#bcd0ff"],size:.075,init:(p,v,i,l)=>{p.set([0,-99,0],i*3);l[i]=rnd(0,.35)},step:(p,v,i,dt,t,l)=>{const k=eio(E(3.4+l[i],4.1+l[i],t));if(k<=0||k>=1){p.set([0,-99,0],i*3);return}const j=(i*3)%SP.length,w=V(SP[j],SP[j+1],SP[j+2]);stag.localToWorld(w);const tg=card.position.clone().add(V(rnd(-1,1),rnd(-1.4,1.4),.1));p.set([w.x+(tg.x-w.x)*k,w.y+(tg.y-w.y)*k,w.z+(tg.z-w.z)*k],i*3)}}),2);s.add(glit.obj);
  s.add(new T.HemisphereLight("#9a8cc8","#1a1410",.5));const pl=new T.PointLight("#ffcf8a",22,24);pl.position.set(0,5,0);s.add(pl);const pl2=new T.PointLight("#ffcf8a",14,20);pl2.position.set(0,5,-12);s.add(pl2);const moonL=c.sun(new T.DirectionalLight("#8a9aff",.6));moonL.position.set(-8,10,4);s.add(moonL);const sl=new T.PointLight("#bcd0ff",0,14);s.add(sl);
  at(c,1,()=>c.sfx("magic"));at(c,1.7,()=>{c.sfx("whoosh");c.flash(.35,"#dfe8ff")});at(c,2.6,()=>c.sfx("magic"));at(c,3.4,()=>c.sfx("magic"));at(c,3.6,()=>c.reveal());
  return (t,dt)=>{cds.forEach(g=>{g.position.y+=Math.sin(t*1.2+g.userData.ph)*dt*.12});bns.forEach((b,i)=>b.userData.wave(t+i,.1,1.2,"top"));
    card.visible=t>.7;const ap=eo(E(.7,1.2,t));card.position.set(0,rest.y-.5*(1-ap),rest.z);wtip.material.opacity=E(1,1.2,t);sp.update(dt,t);sp.mat.opacity=1-E(1.8,2.2,t);
    const g=E(1.7,3.4,t);stag.visible=g>0&&t<3.75;if(stag.visible){const a=-Math.PI/2+g*Math.PI*2.1,r=3.4;stag.position.set(Math.cos(a)*r,rest.y-.6+Math.abs(Math.sin(t*9))*.25,rest.z+Math.sin(a)*r*.7);stag.rotation.set(Math.sin(t*9)*.08,-Math.sin(a)>0?0:Math.PI,0);const sc=.8+eo(E(1.7,2,t))*.6;stag.scale.setScalar(sc);stag.material.opacity=Math.min(1,E(1.7,2,t)*1.2)*(1-E(3.4,3.75,t));sl.position.copy(stag.position);sl.intensity=20*stag.material.opacity}else sl.intensity=0;
    glit.update(dt,t);glit.mat.opacity=1-E(4.3,4.6,t);
    toCam(cam,L3(V(0,3,14),V(0,1.2,7.8),eio(E(0,2.2,t))),L3(V(0,3,-20),rest,eio(E(0,2,t))))}};

K.mickey=c=>{const{s,cam,card,rest}=c;c.dur=5.2;c.bloom=[.9,.6,.85];s.background=new T.Color("#060209");s.fog=new T.FogExp2("#0c0614",.02);
  const planks=cnv(256,256,(g,w,h)=>{for(let i=0;i<8;i++){g.fillStyle=i%2?"#7a4a26":"#6a3e1e";g.fillRect(0,i*32,w,32);g.fillStyle="rgba(0,0,0,.35)";g.fillRect(0,i*32,w,2);for(let k=0;k<6;k++){g.strokeStyle="rgba(40,20,8,.35)";g.beginPath();g.moveTo(0,i*32+rnd(6,28));g.lineTo(w,i*32+rnd(6,28));g.stroke()}}});planks.wrapS=planks.wrapT=T.RepeatWrapping;planks.repeat.set(3,2);
  const st=new T.Mesh(new T.BoxGeometry(20,.5,9),new T.MeshStandardMaterial({map:planks,roughness:.35,metalness:.05,envMap:CUR_ENV,envMapIntensity:.3}));st.position.set(0,-1.85,-1.5);st.receiveShadow=true;s.add(st);
  const lip=new T.Mesh(new T.BoxGeometry(20,.12,.2),metal("#e2b84a",.3,1.1));lip.position.set(0,-1.6,3);s.add(lip);
  for(let i=0;i<14;i++){const b=glow("#fff2c8",.45,1);b.material.color=H("#fff2c8",2.4);b.position.set(-8.5+i*1.3,-1.45,2.9);s.add(b)}
  const back=velvet(22,12,"#8a0c1c",14);back.position.set(0,4.2,-6);s.add(back);
  const cur=[-1,1].map(sd=>{const m=velvet(5.6,10,"#b0101e",6);m.position.set(sd*2.8,3.2,1.6);s.add(m);return m});
  const val=velvet(18,2,"#9a0c1a",16);val.position.set(0,7.4,1.7);s.add(val);const fr=new T.Mesh(new T.BoxGeometry(18,.14,.14),metal("#e2b84a",.25,1.3));fr.position.set(0,6.4,1.85);s.add(fr);
  for(let i=0;i<30;i++){const tt=new T.Mesh(new T.ConeGeometry(.08,.3,8),metal("#e2b84a",.3,1.2));tt.rotation.x=Math.PI;tt.position.set(-8.7+i*.6,6.2,1.85);s.add(tt)}
  const arch=new T.Group(),am=metal("#c89a3a",.35,1);[-9.2,9.2].forEach(x=>{const p=new T.Mesh(new T.BoxGeometry(.8,11,.8),am);p.position.set(x,3.6,1.9);arch.add(p)});const top=new T.Mesh(new T.BoxGeometry(19.2,.8,.8),am);top.position.set(0,8.6,1.9);arch.add(top);s.add(arch);
  const spots=[-1,1].map(sd=>{const g=new T.Group(),h=lathe([[0,-.5],[.35,-.5],[.45,-.1],[.5,.5],[0,.5]],metal("#2a2a2e",.4,.9),20);h.rotation.x=Math.PI/2;g.add(h);const lens=new T.Mesh(new T.CircleGeometry(.42,24),hb("#fff6d8",3));lens.position.z=.52;g.add(lens);
    const cone=new T.Mesh(new T.CylinderGeometry(.4,1.9,10,32,1,true),add(new T.MeshBasicMaterial({color:H("#fff3d0",1),opacity:0,side:T.DoubleSide})));cone.rotation.x=-Math.PI/2;cone.position.z=5;g.add(cone);
    const sl=new T.SpotLight("#fff3d0",0,30,.32,.5,1.2);g.add(sl);sl.position.set(0,0,0);sl.target.position.set(0,0,10);g.add(sl.target);if(c.shadows){sl.castShadow=true;sl.shadow.mapSize.set(1024,1024);sl.shadow.bias=-.0005}
    g.position.set(sd*7.5,7,4.5);g.lookAt(0,-.6,-.5);g.userData={cone,sl};s.add(g);return g});
  const pix=hdrP(new Parts(420,{cols:["#fff3c4","#ffd34d","#ffffff","#ffb3e6"],size:.075,init:(p,v,i)=>{v.set([rnd(-10,10),rnd(0,6.28),rnd(-5,2)],i*3)},step:(p,v,i,dt,t)=>{const x=((v[i*3]+t*2.2+10)%20)-10;p.set([x,1.4+Math.sin(x*.7+t*2+v[i*3+1])*1.6,v[i*3+2]],i*3)}}),2);s.add(pix.obj);
  const wand=new T.Group(),wst=new T.Mesh(new T.CylinderGeometry(.03,.03,1,10),std("#111",.3,.3));wst.position.y=.5;wand.add(wst);const wtp=new T.Mesh(new T.CylinderGeometry(.035,.035,.12,10),hb("#ffffff",2));wtp.position.y=1.02;wand.add(wtp);const wt=glow("#fff3c4",.6,1);wt.material.color=H("#fff3c4",2.5);wt.position.y=1.1;wand.add(wt);wand.position.set(1.5,-.4,.4);wand.rotation.z=-.6;card.add(wand);wand.visible=false;
  const SH=[];for(let i=0;i<=10;i++){const a=Math.PI/2+i*Math.PI/5,r=i%2?.9:2.1;SH.push(V(Math.cos(a)*r,Math.sin(a)*r+3.6,-2))}const shc=new T.CatmullRomCurve3(SH,false,"catmullrom",0);const shp=shc.getSpacedPoints(180);
  const trace=hdrP(new Parts(180,{cols:["#fff3c4","#ffd34d","#ffffff"],size:.13,init:(p,v,i,l)=>{p.set([0,-99,0],i*3);l[i]=i/180},step:(p,v,i,dt,t,l)=>{const k=E(2.9,3.6,t);if(l[i]>k){p.set([0,-99,0],i*3);return}const q=shp[i];p.set([q.x+Math.sin(t*9+i)*.02,q.y,q.z],i*3)}}),2.5);s.add(trace.obj);
  const fw=[];
  s.add(new T.HemisphereLight("#ffd0e0","#1a0a10",.6));const pl=new T.PointLight("#fff3d0",0,16);pl.position.set(0,4,4);s.add(pl);[-5,0,5].forEach(x=>{const f=new T.PointLight("#ffd8a0",3,10);f.position.set(x,-1,2.5);s.add(f)});const bw=new T.SpotLight("#ff4a5a",90,26,.55,.8,1.2);bw.position.set(0,-1.2,4);bw.target.position.set(0,4,-6);s.add(bw,bw.target);
  at(c,.15,()=>c.sfx("magic"));[1.1,1.5,1.9].forEach(x=>at(c,x,()=>c.sfx("jump")));at(c,2.5,()=>c.sfx("jingle"));at(c,2.9,()=>c.sfx("magic"));
  at(c,3.6,()=>{SH.forEach((q,i)=>{if(i%2)return;const b=hdrP(burstParts(120,[["#ff6ad5","#fff"],["#ffd34d","#fff"],["#6ad5ff","#fff"],["#8aff8a","#fff"],["#ff4a4a","#fff"]][i/2%5],q,rnd(3,4.5),-1.2,.15),2.2);s.add(b.obj);fw.push({b,t0:3.6})});c.sfx("pop");c.sfx("pop")});at(c,3.65,()=>c.reveal());at(c,4.1,()=>c.sfx("pop"));
  return (t,dt)=>{const o=eio(E(.1,1,t));cur.forEach((m,i)=>{m.position.x=(i?1:-1)*(2.8+o*2.7);m.scale.x=1-o*.3});
    spots.forEach(g=>{g.userData.cone.material.opacity=.016*E(.3,.8,t);g.userData.sl.intensity=E(.3,.8,t)*55});pl.intensity=E(.3,.8,t)*14;pix.update(dt,t);
    card.visible=t>1;const hp=E(1,2.3,t),hx=-6+6*eio(hp),hop=Math.abs(Math.sin(hp*Math.PI*3))*1.3*(1-hp*.4);
    card.position.set(hx,rest.y-.35+hop+(t>2.3?.35*eo(E(2.3,2.5,t)):0),rest.z);const sq=t<2.3?1+.12*Math.cos(hp*Math.PI*6):1;card.scale.set(CS/Math.sqrt(sq),CS*sq,CS);
    card.rotation.set(t>2.4&&t<2.95?Math.sin(E(2.4,2.95,t)*Math.PI)*.55:0,0,t<2.3?Math.sin(hp*Math.PI*3)*.15:Math.sin(E(2.95,3.1,t)*Math.PI*4)*.05);
    wand.visible=t>2.85;wand.rotation.z=-.6+Math.sin(E(2.9,3.6,t)*Math.PI*4)*.5;trace.update(dt,t);trace.mat.opacity=1-E(3.6,4.1,t);
    fw.forEach(f=>{f.b.update(dt,t);f.b.mat.opacity=Math.max(0,1-(t-f.t0)/1.6)});
    toCam(cam,L3(V(0,1.6,13),V(0,1.2,7.8),eio(E(0,2.5,t))),L3(V(0,2.4,-4),V(0,t<3.4?1:2,-.5).lerp(rest,eio(E(3.4,4.2,t))),eio(E(0,1.5,t))))}};

K.buzz=c=>{const{s,cam,card,rest}=c;c.dur=5;c.bloom=[.95,.55,.85];s.background=new T.Color("#04030a");s.fog=new T.FogExp2("#0a0718",.025);
  const rib=cnv(256,256,(g,w,h)=>{g.fillStyle="#22222c";g.fillRect(0,0,w,h);for(let x=0;x<w;x+=32){const gr=g.createLinearGradient(x,0,x+32,0);gr.addColorStop(0,"#16161e");gr.addColorStop(.5,"#34343e");gr.addColorStop(1,"#16161e");g.fillStyle=gr;g.fillRect(x,0,32,h)}g.fillStyle="#0e0e14";for(let y=0;y<h;y+=64)g.fillRect(0,y,w,4)});rib.wrapS=rib.wrapT=T.RepeatWrapping;rib.repeat.set(10,3);
  const hm=new T.MeshStandardMaterial({map:rib,roughness:.4,metalness:.85,envMap:CUR_ENV,envMapIntensity:.3,side:T.BackSide});const box=new T.Mesh(new T.BoxGeometry(18,10,40),hm);box.position.set(0,3.4,-12);s.add(box);
  const haz=cnv(256,64,(g,w,h)=>{g.fillStyle="#ffcc00";g.fillRect(0,0,w,h);g.fillStyle="#111";for(let x=-64;x<w;x+=32){g.beginPath();g.moveTo(x,h);g.lineTo(x+16,h);g.lineTo(x+48,0);g.lineTo(x+32,0);g.fill()}});haz.wrapS=T.RepeatWrapping;haz.repeat.set(8,1);
  const fl=new T.Mesh(new T.PlaneGeometry(18,40),new T.MeshStandardMaterial({map:gridTex("#14141c","#2a2a38",32,10),roughness:.3,metalness:.8,envMap:CUR_ENV,envMapIntensity:.3}));fl.rotation.x=-Math.PI/2;fl.position.set(0,-1.59,-12);fl.receiveShadow=true;s.add(fl);
  [-3.2,3.2].forEach(x=>{const st=new T.Mesh(new T.PlaneGeometry(.5,40),new T.MeshStandardMaterial({map:haz,roughness:.6}));st.material.map.repeat.set(1,40);st.rotation.x=-Math.PI/2;st.position.set(x,-1.58,-12);s.add(st);for(let z=0;z<10;z++){const l=new T.Mesh(new T.CircleGeometry(.08,12),hb(z%2?"#8aff5a":"#c08bff",3));l.rotation.x=-Math.PI/2;l.position.set(x*1.25,-1.57,1-z*3.5);s.add(l)}});
  const scrT=i=>cnv(256,160,(g,w,h)=>{g.fillStyle="#08080e";g.fillRect(0,0,w,h);const col=i%2?"#8aff5a":"#c08bff";g.strokeStyle=col;g.fillStyle=col;g.lineWidth=2;for(let k=0;k<6;k++){g.globalAlpha=rnd(.4,1);g.fillRect(12,14+k*22,rnd(40,150),8)}g.globalAlpha=1;g.beginPath();g.arc(w-50,h/2,34,0,7);g.stroke();for(let k=0;k<5;k++){g.fillStyle=["#ff3a3a","#ffcc00","#3cff6a"][k%3];g.beginPath();g.arc(w-90+k*16,h-16,5,0,7);g.fill()}});
  const pans=[];for(let i=0;i<10;i++){const sd=i%2?1:-1,g=new T.Group(),cs=rbox(2.6,1.6,.5,.08,metal("#2a2a34",.35,.8));g.add(cs);const sc=new T.Mesh(new T.PlaneGeometry(2.2,1.2),new T.MeshBasicMaterial({map:scrT(i),color:H("#ffffff",1.5)}));sc.position.z=.26;g.add(sc);g.position.set(sd*8.7,rnd(.2,3.5),-2-Math.floor(i/2)*6);g.rotation.y=-sd*Math.PI/2;g.userData.sc=sc;g.userData.ph=rnd(0,9);s.add(g);pans.push(g)}
  const rad=cnv(256,256,(g,w,h)=>{g.strokeStyle="#5aff8a";g.lineWidth=2;for(let r=30;r<128;r+=30){g.beginPath();g.arc(128,128,r,0,7);g.stroke()}g.beginPath();g.moveTo(0,128);g.lineTo(256,128);g.moveTo(128,0);g.lineTo(128,256);g.stroke();for(let i=0;i<7;i++){g.fillStyle="#8aff5a";g.beginPath();g.arc(rnd(40,216),rnd(40,216),4,0,7);g.fill()}});
  const radars=[-4.5,4.5].map(x=>{const r=new T.Mesh(new T.CircleGeometry(2.1,48),add(new T.MeshBasicMaterial({map:rad,color:H("#ffffff",1.6),opacity:.7,side:T.DoubleSide})));r.position.set(x,5,-16);s.add(r);const sw=new T.Mesh(new T.CircleGeometry(2.1,32,0,.6),add(new T.MeshBasicMaterial({color:H("#5aff8a",1.6),opacity:.35,side:T.DoubleSide})));sw.position.set(x,5,-15.98);s.add(sw);return sw});
  const port=new T.Mesh(new T.CircleGeometry(3,48),new T.MeshBasicMaterial({map:cnv(256,256,(g,w,h)=>{g.fillStyle="#02020a";g.fillRect(0,0,w,h);for(let i=0;i<200;i++){g.fillStyle="#fff";g.globalAlpha=rnd(.3,1);g.fillRect(rnd(0,w),rnd(0,h),1.5,1.5)}g.globalAlpha=1;const p=g.createRadialGradient(80,170,10,90,180,80);p.addColorStop(0,"#c08bff");p.addColorStop(1,"#2a0a5a");g.fillStyle=p;g.beginPath();g.arc(90,180,70,0,7);g.fill()}),color:H("#ffffff",1.2)}));port.position.set(0,5.2,-31.9);s.add(port);const pr=new T.Mesh(new T.TorusGeometry(3,.2,12,64),metal("#3a3a46",.3,1));pr.position.copy(port.position);s.add(pr);
  for(let i=0;i<5;i++){const lt=new T.Mesh(new T.BoxGeometry(5,.1,.3),hb("#e8e0ff",1.4));lt.position.set(0,8.3,-2-i*6);s.add(lt)}
  const wings=[-1,1].map(sd=>{const sh=new T.Shape();sh.moveTo(0,.3);sh.lineTo(2.6*sd,.7);sh.lineTo(2.9*sd,.45);sh.lineTo(.2*sd,-.5);sh.lineTo(0,-.4);const m=new T.Mesh(new T.ExtrudeGeometry(sh,{depth:.06,bevelEnabled:true,bevelSize:.02,bevelThickness:.02,bevelSegments:2}),phys("#a9a9b6",{roughness:.55,clearcoat:.3,clearcoatRoughness:.4,envMapIntensity:.28}));
    const st=rbox(2.4,.12,.1,.03,phys("#7a3cc8",{roughness:.3,clearcoat:1}));st.position.set(1.3*sd,.42,.06);st.rotation.z=.14*sd;m.add(st);const gst=rbox(1.6,.08,.1,.03,phys("#3cff6a",{roughness:.3,clearcoat:1,emissive:"#0a3a14"}));gst.position.set(1.1*sd,.2,.07);gst.rotation.z=.2*sd;m.add(gst);
    const led=new T.Mesh(new T.SphereGeometry(.06,10,8),hb(sd<0?"#ff2a2a":"#3cff6a",4));led.position.set(2.82*sd,.52,.08);m.add(led);m.userData.led=led;m.position.set(sd*1.1,.4,-.1);card.add(shadowy(m,true,false));return m});
  const fl2=hdrP(new Parts(260,{cols:["#ffb347","#7ab8ff","#ffffff"],size:.13,init:(p,v,i,l)=>{p.set([0,-99,0],i*3);l[i]=0},step:(p,v,i,dt,t,l)=>{l[i]-=dt;if(l[i]<=0&&t>.9&&t<2.6){l[i]=rnd(.15,.45);const w=V(rnd(-.4,.4),-1.9,-.3);card.localToWorld(w);p.set([w.x,w.y,w.z],i*3);v.set([rnd(-.5,.5),-2,rnd(-.5,.5)],i*3)}p[i*3]+=v[i*3]*dt;p[i*3+1]+=v[i*3+1]*dt;p[i*3+2]+=v[i*3+2]*dt}}),2.5);s.add(fl2.obj);
  const las=new T.Group(),lc=new T.Mesh(new T.CylinderGeometry(.03,.03,1,8),hb("#ffd0d0",4)),lg=new T.Mesh(new T.CylinderGeometry(.1,.1,1,8),add(new T.MeshBasicMaterial({color:H("#ff2a2a",2),opacity:.6})));las.add(lc,lg);las.visible=false;s.add(las);
  s.add(new T.HemisphereLight("#b0a0ff","#0a0814",.5));const kl=c.sun(new T.DirectionalLight("#e8e0ff",.8));kl.position.set(2,8,6);s.add(kl);const pl=new T.PointLight("#8aff5a",12,18);pl.position.set(-4,2,-6);s.add(pl);const pl2=new T.PointLight("#c08bff",12,18);pl2.position.set(4,2,-6);s.add(pl2);
  at(c,.9,()=>c.sfx("fly"));at(c,1.55,()=>c.sfx("whoosh"));at(c,2.25,()=>c.sfx("hydraulic"));at(c,3.45,()=>c.sfx("laser"));at(c,3.55,()=>{c.flash(.55,"#ffd0d0");c.shake(.12)});at(c,3.6,()=>c.reveal());
  const a=V(),b=V();
  return (t,dt)=>{pans.forEach(g=>g.userData.sc.material.color.setScalar(1.3+.3*Math.sin(t*5+g.userData.ph)));radars.forEach(r=>r.rotation.z=-t*2.4);fl2.update(dt,t);
    card.visible=t>.9;const d=E(.9,1.9,t),e=eio(d);card.position.set(-5*(1-e),rest.y+6*(1-e)-Math.sin(e*Math.PI)*1.2,rest.z-8*(1-e));card.rotation.set(-.8*(1-e),.5*(1-e),eio(E(1.5,2.2,t))*Math.PI*2);
    const wo=eo(E(2.2,2.5,t));wings.forEach((w,i)=>{w.scale.set(Math.max(.01,wo),1,1);w.rotation.z=(i?-1:1)*(1-wo)*.8;w.userData.led.material.color.copy(H(i?"#3cff6a":"#ff2a2a",Math.sin(t*10)>0?4:.4))});
    card.rotation.x+=t>2.5?-.12*eo(E(2.5,2.9,t))*(1-E(3.6,4.2,t)):0;
    const lk=E(3.45,3.6,t);las.visible=lk>0&&t<3.75;if(las.visible){card.localToWorld(a.set(1.3,-.6,.3));b.copy(cam.position).add(V(0,-.2,-.5));const len=a.distanceTo(b)*lk;const dir=b.clone().sub(a).normalize();las.position.copy(a).addScaledVector(dir,len/2);las.scale.y=len;las.lookAt(b);las.rotateX(Math.PI/2)}
    toCam(cam,L3(V(3,.5,12),V(0,1.2,7.6),eio(E(0,2.6,t))),L3(V(-2,3,-10),rest,eio(E(.8,2.2,t))))}};

K.shrek=c=>{const{s,cam,card,rest}=c;c.dur=5.2;c.bloom=[.85,.6,.85];s.add(sky("#2a3a14","#0a1406"));s.fog=new T.FogExp2("#1a2a0e",.055);
  const mud=new T.Mesh(new T.CircleGeometry(30,64),new T.MeshStandardMaterial({map:noiseTex(256,256,"#2a2412",["#1a1608","#3a3218","#24200e"],10,.6),roughness:.18,metalness:.25,envMap:CUR_ENV,envMapIntensity:.18}));mud.rotation.x=-Math.PI/2;mud.position.y=-1.6;mud.receiveShadow=true;s.add(mud);
  const bark=new T.MeshStandardMaterial({map:barkTex("#2c2214","#16100a"),roughness:.95}),leaf=new T.MeshStandardMaterial({color:"#2a4a14",roughness:.95,flatShading:true});
  for(let i=0;i<12;i++){const a=Math.PI+rnd(.1,Math.PI-.1),r=rnd(8,15),x=Math.cos(a)*r*1.2,z=Math.sin(a)*r-3;const tr=gnarlTree(rnd(6,9),rnd(.3,.5),bark,leaf);tr.position.set(x,-1.6,z);tr.rotation.y=rnd(0,6);s.add(shadowy(tr,false,true))}
  const moss=[];for(let i=0;i<16;i++){const m=new T.Mesh(new T.PlaneGeometry(.3,rnd(1.2,2.6)),new T.MeshStandardMaterial({color:"#4a5a2a",roughness:1,side:T.DoubleSide,transparent:true,opacity:.85}));m.position.set(rnd(-9,9),rnd(3,6),rnd(-14,-5));s.add(m);moss.push(m)}
  const hut=new T.Group(),pl=new T.MeshStandardMaterial({map:woodTex("#6a4a26","#3a2410"),roughness:.9});const hb2=new T.Mesh(new T.BoxGeometry(3.2,4,2.4),pl);hb2.position.y=2;hut.add(hb2);
  const roof=new T.Mesh(new T.BoxGeometry(3.6,.2,3),pl);roof.position.set(0,4.2,.1);roof.rotation.x=.15;hut.add(roof);hut.position.set(0,-1.6,-4.5);s.add(shadowy(hut));
  const door=new T.Group(),dtex=cnv(128,256,(g,w,h)=>{g.fillStyle="#5a3a1c";g.fillRect(0,0,w,h);g.strokeStyle="#2a1808";g.lineWidth=4;for(let x=0;x<w;x+=32){g.beginPath();g.moveTo(x,0);g.lineTo(x,h);g.stroke()}g.fillStyle="#0a0604";g.beginPath();g.arc(64,46,22,0,7);g.fill();g.fillStyle="#5a3a1c";g.beginPath();g.arc(74,40,20,0,7);g.fill();g.fillStyle="#3a2412";g.fillRect(8,60,w-16,10);g.fillRect(8,190,w-16,10)});
  const dm=new T.Mesh(new T.BoxGeometry(1.5,2.8,.1),new T.MeshStandardMaterial({map:dtex,roughness:.85}));dm.position.x=.75;door.add(dm);door.position.set(-.75,-.2,-3.28);s.add(shadowy(door));
  const sign=new T.Group(),post=new T.Mesh(new T.BoxGeometry(.18,2.4,.18),pl);post.position.y=1.2;sign.add(post);
  const ptx=cnv(256,110,(g,w,h)=>{g.fillStyle="#7a5a30";g.fillRect(0,0,w,h);g.strokeStyle="#4a2e14";for(let y=6;y<h;y+=10){g.beginPath();g.moveTo(0,y);g.lineTo(w,y+rnd(-3,3));g.stroke()}g.fillStyle="#1a0e04";g.font="900 34px Sora, Arial";g.textAlign="center";g.fillText("ATTENTION",w/2,46);g.fillText("OGRE !",w/2,88);g.fillStyle="#222";[[10,10],[w-14,10],[10,h-14],[w-14,h-14]].forEach(([x,y])=>{g.beginPath();g.arc(x,y,4,0,7);g.fill()})});
  const plank=new T.Mesh(new T.BoxGeometry(1.9,.8,.08),[0,1,2,3].map(()=>std("#5a3a1c",.9)).concat([std("#ffffff",.85,0,{map:ptx}),std("#5a3a1c",.9)]));plank.position.set(0,2.1,.05);plank.rotation.z=.12;sign.add(plank);sign.position.set(-3.6,-1.6,-1.2);sign.rotation.y=.45;s.add(shadowy(sign));
  for(let i=0;i<18;i++){const g=new T.Group(),h=rnd(.8,1.6),st=new T.Mesh(new T.CylinderGeometry(.015,.02,h,5),std("#4a5a2a",.9));st.position.y=h/2;g.add(st);const hd=new T.Mesh(new T.CapsuleGeometry(.045,.22,4,8),std("#4a2a14",.8));hd.position.y=h-.05;g.add(hd);g.position.set(rnd(-6,6),-1.6,rnd(-3,3));if(Math.abs(g.position.x)<1.8)g.position.x+=Math.sign(g.position.x||1)*2;g.rotation.z=rnd(-.15,.15);s.add(g)}
  for(let i=0;i<10;i++){const lp=new T.Mesh(new T.CircleGeometry(rnd(.25,.45),16,.3,5.9),std("#3a6a24",.6));lp.rotation.x=-Math.PI/2;lp.position.set(rnd(-7,7),-1.58,rnd(-2,4));s.add(lp)}
  const bub=[];for(let i=0;i<10;i++){const m=new T.Mesh(new T.SphereGeometry(.2,14,10),phys("#6a7a3a",{roughness:.1,transparent:true,opacity:.75,clearcoat:1}));m.position.set(rnd(-6,6),-1.6,rnd(-6,3));m.userData={t0:rnd(0,3),b:null};s.add(m);bub.push(m)}
  const fogS=new Smoke(s,14,texSmoke("160,200,120"),"#8ab86a",()=>({p:V(rnd(-7,7),rnd(-1.5,0),rnd(-10,3)),v:V(rnd(.1,.3),0,0),s:rnd(3,5)}),{life:4,op:.16,grow:.6});
  const ff=hdrP(field(140,[9,-1.2,4,-12,4],["#e4ff8a","#b8ff5a"],.12,()=>[rnd(-.3,.3),rnd(-.1,.2),rnd(-.3,.3)]),2.6);s.add(ff.obj);
  const lens=lensSplats(cam,9,"#4a3a18");let splat=null,splat2=null;
  const leaves=[],lt=cnv(64,64,(g)=>{g.fillStyle="#fff";g.beginPath();g.moveTo(32,4);g.quadraticCurveTo(62,32,32,60);g.quadraticCurveTo(2,32,32,4);g.fill();g.strokeStyle="#888";g.lineWidth=2;g.beginPath();g.moveTo(32,6);g.lineTo(32,58);g.stroke()});const W=2.5,Hc=3.5;
  for(let i=0;i<44;i++){const u=i/44,d=u*2*(W+Hc);let x,y;if(d<W){x=-W/2+d;y=Hc/2}else if(d<W+Hc){x=W/2;y=Hc/2-(d-W)}else if(d<2*W+Hc){x=W/2-(d-W-Hc);y=-Hc/2}else{x=-W/2;y=-Hc/2+(d-2*W-Hc)}
    const m=new T.Mesh(new T.PlaneGeometry(.44,.44),new T.MeshStandardMaterial({map:lt,transparent:true,alphaTest:.4,color:"#4a3a18",side:T.DoubleSide,metalness:.6,roughness:.35,envMap:CUR_ENV,envMapIntensity:1,emissive:"#000000"}));m.userData.to=V(x,y,.1);m.userData.from=V(rnd(-3,3),rnd(-4,2),rnd(1,4));m.userData.r=rnd(0,6);m.visible=false;card.add(m);leaves.push(m)}
  s.add(new T.HemisphereLight("#a8d880","#1a1408",.5));const ml=c.sun(new T.DirectionalLight("#e8ffc8",1));ml.position.set(4,9,5);s.add(ml);const lan=new T.PointLight("#ffb050",14,10);lan.position.set(1.8,1.8,-3);s.add(lan);const lg=glow("#ffb050",.7,1);lg.material.color=H("#ffb050",2.4);lg.position.copy(lan.position);s.add(lg);
  at(c,.3,()=>c.sfx("splat"));at(c,1,()=>{c.sfx("creak");c.shake(.08)});at(c,1.55,()=>{c.sfx("thump");c.shake(.22);splat=burstParts(90,["#4a3a18","#2a2410"],V(0,-1.5,-2.5),5,-9,.14);s.add(splat.obj);c.sfx("splat")});
  at(c,2.15,()=>{c.sfx("thump");c.shake(.25);splat2=burstParts(90,["#4a3a18","#5a4a20"],V(0,-1.5,-1),5.5,-9,.15);s.add(splat2.obj);c.sfx("splat");lens.hit()});at(c,2.6,()=>{c.sfx("roar");c.shake(.5)});at(c,3.3,()=>c.sfx("magic"));at(c,3.35,()=>c.reveal());
  const col=new T.Color(),gold=new T.Color("#ffd34d"),grn=new T.Color("#4caf2a"),brn=new T.Color("#4a3a18");
  return (t,dt)=>{fogS.update(dt);ff.update(dt,t);lens.update(dt);moss.forEach((m,i)=>m.rotation.z=Math.sin(t+i)*.05);if(splat){splat.update(dt,t);splat.mat.opacity=Math.max(0,1-(t-1.55)/1.2)}if(splat2){splat2.update(dt,t);splat2.mat.opacity=Math.max(0,1-(t-2.15)/1.2)}
    bub.forEach(m=>{const u=m.userData,k=((t+u.t0)%2.2)/2.2;m.scale.setScalar(.2+k*1.6);m.visible=k<.95;if(k>.94&&!u.pop){u.pop=1;const b=burstParts(14,["#7a8a3a"],m.position.clone(),1.5,-3,.06);s.add(b.obj);u.b=b;u.bt=t}if(k<.1)u.pop=0;if(u.b){u.b.update(dt,t);u.b.mat.opacity=Math.max(0,1-(t-u.bt)/.6)}});
    door.rotation.y=-eo(E(1,1.25,t))*1.9;
    card.visible=t>1.05;const s1=E(1.2,1.55,t),s2=E(1.8,2.15,t);card.position.set(0,rest.y-.15+Math.sin(s1*Math.PI)*.18+Math.sin(s2*Math.PI)*.18,-3.4+1.5*eo(s1)+1.4*eo(s2));
    const ro=E(2.6,3.2,t);card.rotation.set(-.15*Math.sin(ro*Math.PI),0,Math.sin(t*40)*.03*Math.sin(ro*Math.PI));card.scale.setScalar(CS*(1+.08*Math.sin(ro*Math.PI)));
    leaves.forEach((m,i)=>{const k=eio(E(3.2+i*.01,3.75+i*.01,t));m.visible=k>0;m.position.lerpVectors(m.userData.from,m.userData.to,k);m.rotation.z=m.userData.r+(1-k)*6;const g=E(3.8,4.4,t);col.copy(brn).lerp(grn,Math.min(1,k)).lerp(gold,g);m.material.color.copy(col);m.material.emissive.copy(col).multiplyScalar(g*.5)});
    toCam(cam,L3(V(2,.4,11),V(0,1.1,7.6),eio(E(0,2.8,t))),L3(V(-1,1,-4),rest,eio(E(.8,2.4,t))))}};

K.mario=c=>{const{s,cam,card,rest}=c;c.dur=5;c.bloom=[.45,.45,1.05];s.add(sky("#2a7bff","#bfe6ff"));s.fog=new T.Fog("#bfe6ff",22,75);
  const stripe=cnv(256,256,(g,w,h)=>{g.fillStyle="#3fbf4a";g.fillRect(0,0,w,h);g.fillStyle="#36a840";for(let x=-w;x<w*2;x+=48){g.beginPath();g.moveTo(x,0);g.lineTo(x+24,0);g.lineTo(x+24+h*.4,h);g.lineTo(x+h*.4,h);g.fill()}});stripe.wrapS=stripe.wrapT=T.RepeatWrapping;stripe.repeat.set(4,2);
  const hm=new T.MeshStandardMaterial({map:stripe,roughness:.85});for(let i=0;i<7;i++){const m=new T.Mesh(new T.SphereGeometry(rnd(5,9),40,20),hm);m.scale.y=rnd(.55,.85);m.position.set(-26+i*8.6,-3.5,rnd(-32,-20));s.add(m);for(let k=0;k<2;k++){const ey=new T.Mesh(new T.CapsuleGeometry(.25,.6,4,8),std("#111",.4));ey.position.set(m.position.x-1+k*2,m.position.y+m.scale.y*6.2,m.position.z+5.8);if(i%3===0)s.add(ey)}}
  const dirt=cnv(256,128,(g,w,h)=>{g.fillStyle="#c8743a";g.fillRect(0,0,w,h);for(let i=0;i<60;i++){g.fillStyle=Math.random()<.5?"#a85e2a":"#d88a4a";g.beginPath();g.ellipse(rnd(0,w),rnd(0,h),rnd(6,16),rnd(3,7),0,0,7);g.fill()}});dirt.wrapS=dirt.wrapT=T.RepeatWrapping;dirt.repeat.set(12,6);
  const gr=new T.Mesh(new T.BoxGeometry(60,3,30),new T.MeshStandardMaterial({map:dirt,roughness:1}));gr.position.set(0,-3.1,-10);gr.receiveShadow=true;s.add(gr);const top=rbox(60,.35,30,.12,std("#4caf2a",.8));top.position.set(0,-1.75,-10);top.receiveShadow=true;s.add(top);
  const pm=phys("#16a524",{roughness:.25,clearcoat:1,clearcoatRoughness:.15,envMapIntensity:.6});[[0,-3,.9,1.45],[-6,-6,2.6,1],[6.5,-8,3.4,1],[-10.5,-12,4.2,1],[11,-14,2.2,1]].forEach(([x,z,h,k])=>{const p=new T.Mesh(new T.CylinderGeometry(.9,.9,h,32),pm);p.scale.set(k,1,k);p.position.set(x,-1.6+h/2,z);s.add(shadowy(p));const r=lathe([[.85,0],[1.15,0],[1.2,.1],[1.2,.6],[1.15,.7],[.85,.7]],pm,32);r.scale.set(k,1,k);r.position.set(x,-1.6+h-.05,z);s.add(shadowy(r));const hole=new T.Mesh(new T.CircleGeometry(.85,24),std("#0a2a0a",1));hole.scale.setScalar(k);hole.rotation.x=-Math.PI/2;hole.position.set(x,-1.6+h+.64,z);s.add(hole)});
  for(let i=0;i<6;i++){const b=new T.Group();for(let k=0;k<3;k++){const sp=new T.Mesh(new T.SphereGeometry(rnd(.5,.8),20,12),std("#3fbf4a",.7));sp.position.set(k*.7-.7,0,0);b.add(sp)}b.position.set(rnd(-12,12),-1.4,rnd(-6,-2));if(Math.abs(b.position.x)<3)b.position.x+=6;s.add(shadowy(b))}
  const brT=cnv(128,128,(g,w,h)=>{g.fillStyle="#3a1608";g.fillRect(0,0,w,h);for(let y=0;y<4;y++)for(let x=-(y%2)*32;x<w;x+=64){g.fillStyle="#c8642a";g.fillRect(x+3,y*32+3,58,26);g.fillStyle="#e88a4a";g.fillRect(x+3,y*32+3,58,5)}});
  const bm=new T.MeshStandardMaterial({map:brT,roughness:.7});
  const qt=cnv(128,128,(g)=>{g.fillStyle="#d88a10";g.fillRect(0,0,128,128);const q=g.createLinearGradient(0,0,0,128);q.addColorStop(0,"#ffd84a");q.addColorStop(1,"#f5a623");g.fillStyle=q;g.fillRect(6,6,116,116);g.fillStyle="#8a4a00";[[16,16],[106,16],[16,106],[106,106]].forEach(([x,y])=>{g.beginPath();g.arc(x+3,y+3,5,0,7);g.fill()});g.fillStyle="#fff";g.strokeStyle="#7a3a00";g.lineWidth=7;g.font="900 84px Sora, Arial";g.textAlign="center";g.textBaseline="middle";g.strokeText("?",64,70);g.fillText("?",64,70)});
  const qm=new T.MeshStandardMaterial({map:qt,roughness:.35,metalness:.1,envMap:CUR_ENV,envMapIntensity:.3});[-3,-2,0,2,3].forEach((x,i)=>{if(i===2)return;const m=rbox(1,1,1,.06,i%2?bm:qm);m.position.set(x+(x>0?.1:-.1),4.2,-3);s.add(shadowy(m))});
  const qb=rbox(1,1,1,.06,qm);qb.position.set(0,4.2,-3);s.add(shadowy(qb));
  const cl=std("#ffffff",.9);for(let i=0;i<10;i++){const g=new T.Group();for(let j=0;j<5;j++){const m=new T.Mesh(new T.SphereGeometry(rnd(.9,1.6),24,16),cl);m.position.set(j*1.05-2,rnd(-.2,.4)+(j%2?.35:0),rnd(-.3,.3));g.add(m)}g.position.set(rnd(-24,24),rnd(6,11),rnd(-36,-14));s.add(g)}
  const sh=new T.Shape();for(let i=0;i<10;i++){const a=Math.PI/2+i*Math.PI/5,r=i%2?.42:1;i?sh.lineTo(Math.cos(a)*r,Math.sin(a)*r):sh.moveTo(Math.cos(a)*r,Math.sin(a)*r)}
  const star=new T.Mesh(new T.ExtrudeGeometry(sh,{depth:.32,bevelEnabled:true,bevelSize:.1,bevelThickness:.12,bevelSegments:4}),new T.MeshStandardMaterial({color:"#ffd21f",emissive:H("#ffb000",1.6),metalness:.3,roughness:.25,envMap:CUR_ENV,envMapIntensity:.8}));star.geometry.center();star.visible=false;s.add(star);star.add(glow("#fff6a0",3.2,.7));
  const coinG=new T.LatheGeometry([[0,-.06],[.3,-.06],[.34,-.03],[.34,.03],[.3,.06],[0,.06]].map(([x,y])=>new T.Vector2(x,y)),32);coinG.rotateX(Math.PI/2);const cmt=metal("#ffcc22",.18,1.4,{emissive:"#5a3a00",emissiveIntensity:.5}),coins=[];
  for(let i=0;i<36;i++){const m=new T.Mesh(coinG,cmt);const ln=new T.Mesh(new T.BoxGeometry(.06,.3,.14),cmt);m.add(ln);m.userData={x:rnd(-5,5),z:rnd(-3,2),d:rnd(0,1.4),ph:rnd(0,6)};m.visible=false;s.add(m);coins.push(m)}
  const nt=[noteTex("♪","#ff3a8a"),noteTex("♫","#3a8aff"),noteTex("♪","#3fbf4a"),noteTex("♬","#ffb000")];const notes=[];for(let i=0;i<12;i++){const m=new T.Sprite(new T.SpriteMaterial({map:nt[i%4],transparent:true,opacity:0,depthWrite:false}));m.scale.set(.6,.6,1);m.userData={a:rnd(0,6.28),d:rnd(0,1.6)};s.add(m);notes.push(m)}
  const halo=card.userData.halo;
  s.add(new T.HemisphereLight("#ffffff","#7a5a3a",1));const dl=c.sun(new T.DirectionalLight("#fff6e8",2.4),14);dl.position.set(5,10,7);dl.target.position.set(0,0,-3);s.add(dl,dl.target);
  at(c,1,()=>c.sfx("jump"));at(c,1.6,()=>{c.sfx("bump");c.shake(.1)});at(c,1.75,()=>c.sfx("powerup"));at(c,2.45,()=>{c.sfx("magic");c.flash(.4,"#fff6a0")});at(c,2.5,()=>c.reveal());at(c,2.9,()=>c.sfx("jingle"));at(c,3.1,()=>c.sfx("coins"));at(c,3.9,()=>c.sfx("coins"));
  const hc=new T.Color();
  return (t,dt)=>{card.visible=t>.95;const j=E(.95,1.6,t);
    if(t<2.45){const y=-5+(rest.y+2.1+5)*Math.sin(j*Math.PI/2)-(t>1.6?eo(E(1.6,2.4,t))*2.1:0);card.position.set(0,y,-3+eo(E(1.6,2.4,t))*2.5);card.rotation.set(0,0,t<1.6?Math.sin(j*Math.PI)*.2:0)}else{card.position.lerp(rest,Math.min(1,dt*6));card.rotation.y=eio(E(2.5,3.3,t))*Math.PI*2}
    qb.position.y=4.2+Math.sin(E(1.6,1.85,t)*Math.PI)*.45;qb.rotation.y=E(1.6,2.4,t)*Math.PI*4;
    const sk=E(1.75,2.45,t);star.visible=sk>0&&sk<1;if(star.visible){star.position.set(0,5+Math.sin(sk*Math.PI)*1.4-sk*2.4,-3+sk*2.4);star.rotation.y=t*7}
    if(t>2.5){hc.setHSL((t*.8)%1,1,.6);halo.material.color.copy(hc)}
    coins.forEach(m=>{const k=E(3.05+m.userData.d,4.6+m.userData.d,t);m.visible=k>0&&k<1;if(m.visible){m.position.set(m.userData.x,9-k*11,m.userData.z);m.rotation.y=t*8+m.userData.ph}});
    notes.forEach(m=>{const k=E(2.7+m.userData.d,4.2+m.userData.d,t);m.material.opacity=k>0&&k<1?Math.sin(k*Math.PI):0;const a=m.userData.a+t;m.position.set(rest.x+Math.cos(a)*2.1,rest.y-1+k*3,rest.z+Math.sin(a)*1.2)});
    toCam(cam,L3(V(-5,1.5,12),V(0,1.3,7.8),eio(E(0,2.6,t))),L3(V(0,3,-3),rest,eio(E(1.9,2.7,t))))}};

K.ryu=c=>{const{s,cam,card,rest}=c;c.dur=5;c.bloom=[.9,.55,.85];s.background=new T.Color("#07040a");s.fog=new T.FogExp2("#120a0c",.035);
  const tt=cnv(256,256,(g,w,h)=>{for(let y=0;y<2;y++)for(let x=0;x<2;x++){g.fillStyle=(x+y)%2?"#b0a060":"#a09052";g.fillRect(x*128,y*128,128,128);g.strokeStyle="rgba(0,0,0,.12)";g.lineWidth=1;for(let i=0;i<128;i+=3){g.beginPath();g.moveTo(x*128,y*128+i);g.lineTo(x*128+128,y*128+i);g.stroke()}g.fillStyle="#1a1a2a";g.fillRect(x*128,y*128,128,7);g.fillRect(x*128,y*128+121,128,7)}});tt.wrapS=tt.wrapT=T.RepeatWrapping;tt.repeat.set(6,10);
  const fl=new T.Mesh(new T.PlaneGeometry(24,40),new T.MeshStandardMaterial({map:tt,roughness:.75,envMap:CUR_ENV,envMapIntensity:.1}));fl.rotation.x=-Math.PI/2;fl.position.set(0,-1.6,-10);fl.receiveShadow=true;s.add(fl);
  const sj=cnv(128,256,(g,w,h)=>{g.fillStyle="#f6e9c8";g.fillRect(0,0,w,h);g.strokeStyle="#3a2412";g.lineWidth=6;g.strokeRect(3,3,w-6,h-6);g.lineWidth=3;for(let x=0;x<w;x+=32){g.beginPath();g.moveTo(x,0);g.lineTo(x,h);g.stroke()}for(let y=0;y<h;y+=42){g.beginPath();g.moveTo(0,y);g.lineTo(w,y);g.stroke()}});
  const sm=new T.MeshStandardMaterial({map:sj,emissive:H("#ffb070",.8),emissiveMap:sj,roughness:.9});for(let i=0;i<8;i++){const p=new T.Mesh(new T.PlaneGeometry(2,4),sm);p.position.set(-7+i*2,.4,-16);s.add(p)}
  [-1].forEach(sd=>{for(let i=0;i<4;i++){const p=new T.Mesh(new T.PlaneGeometry(2,4),sm);p.position.set(sd*7,.4,-2-i*3.6);p.rotation.y=-sd*Math.PI/2;s.add(p)}});
  const wd=new T.MeshStandardMaterial({map:woodTex("#4a2a14","#2a160a"),roughness:.7});for(let i=0;i<8;i++){const p=new T.Mesh(new T.BoxGeometry(.4,7,.4),wd);p.position.set(i%2?6.8:-6.8,1.9,-Math.floor(i/2)*5.2-.5);s.add(shadowy(p))}
  for(let i=0;i<6;i++){const b=new T.Mesh(new T.BoxGeometry(14,.35,.35),wd);b.position.set(0,5.4,-i*3.4);s.add(b)}for(let i=0;i<9;i++){const r=new T.Mesh(new T.BoxGeometry(.25,.25,20),wd);r.position.set(-6+i*1.5,5.7,-8);s.add(r)}
  const garden=new T.Group();for(let i=0;i<24;i++){const h=rnd(4,8),b=new T.Mesh(new T.CylinderGeometry(.06,.07,h,8),std("#4a7a3a",.5));b.position.set(10+rnd(-1.5,1.5),-1.6+h/2,-rnd(0,16));garden.add(b);for(let k=1;k<h;k+=.8){const n=new T.Mesh(new T.TorusGeometry(.07,.015,4,10),std("#3a6a2a",.5));n.rotation.x=Math.PI/2;n.position.set(b.position.x,-1.6+k,b.position.z);garden.add(n)}}s.add(garden);
  const scroll=new T.Mesh(new T.PlaneGeometry(1.2,3),new T.MeshStandardMaterial({map:cnv(128,320,(g,w,h)=>{g.fillStyle="#efe4c8";g.fillRect(0,0,w,h);g.fillStyle="#1a1008";g.font="900 80px serif";g.textAlign="center";g.fillText("風",w/2,110);g.fillText("林",w/2,220);g.fillStyle="#8a1a10";g.fillRect(w/2-10,270,20,20)}),roughness:.9}));scroll.position.set(-6.75,1.6,-6);scroll.rotation.y=Math.PI/2;s.add(scroll);
  const lt=cnv(128,128,(g,w,h)=>{g.fillStyle="#e8231f";g.fillRect(0,0,w,h);g.strokeStyle="rgba(0,0,0,.25)";g.lineWidth=2;for(let y=8;y<h;y+=10){g.beginPath();g.moveTo(0,y);g.lineTo(w,y);g.stroke()}g.fillStyle="#1a0a04";g.font="900 60px serif";g.textAlign="center";g.textBaseline="middle";g.fillText("祭",w/2,h/2)});
  const lans=[];for(let i=0;i<6;i++){const g=new T.Group(),m=lathe([[0,-.6],[.25,-.58],[.42,-.4],[.5,0],[.42,.4],[.25,.58],[0,.6]],new T.MeshStandardMaterial({map:lt,emissive:H("#ff5a2a",.75),emissiveMap:lt,roughness:.8,side:T.DoubleSide}),24);g.add(m);
    [-.62,.62].forEach(y=>{const cap=new T.Mesh(new T.CylinderGeometry(.22,.22,.08,16),std("#111",.5));cap.position.y=y;g.add(cap)});const pl=new T.PointLight("#ff6a3a",7,7);g.add(pl);g.position.set(i%2?5:-5,3.4,-Math.floor(i/2)*5-1);g.userData={pl,ph:rnd(0,9)};s.add(g);lans.push(g)}
  const rain=rainFx(800,[12,-1.6,9,-14,6],"#a8b8d8",.28,22,2);s.add(rain.obj);
  const ki=[];let nk=0;const aura=hdrP(new Parts(200,{cols:["#bfe0ff","#4fa3ff","#ffffff"],size:.07,init:(p,v,i)=>{v.set([rnd(0,6.28),rnd(1.5,2.2),rnd(-1.6,1.6)],i*3)},step:(p,v,i,dt,t)=>{const a=v[i*3]+t*3,r=v[i*3+1]+Math.sin(t*20+i)*.08;p.set([card.position.x+Math.cos(a)*r,card.position.y+v[i*3+2],card.position.z+Math.sin(a)*r*.5],i*3)}}),2);aura.obj.visible=false;s.add(aura.obj);
  const hd=new T.Group(),core=new T.Mesh(new T.SphereGeometry(.4,32,20),hb("#ffffff",1.7));hd.add(core);const shell=new T.Mesh(new T.SphereGeometry(.62,32,20),add(new T.MeshBasicMaterial({color:H("#4fa3ff",1.1),opacity:.32})));hd.add(shell,glow("#4fa3ff",2.2,.55));const sw=new T.Mesh(new T.TorusGeometry(.75,.04,8,64),add(new T.MeshBasicMaterial({color:H("#8fc6ff",2.4),opacity:.9})));hd.add(sw);const sw2=sw.clone();sw2.scale.setScalar(1.3);hd.add(sw2);hd.visible=false;s.add(hd);const hl=new T.PointLight("#4fa3ff",0,12);hd.add(hl);
  const wave=new T.Mesh(new T.RingGeometry(.8,1.2,96),add(new T.MeshBasicMaterial({color:H("#bfe0ff",2),opacity:0,side:T.DoubleSide})));s.add(wave);
  const band=cloth(1.6,.22,"#d01020",14,2,{roughness:.6});band.geometry.translate(.8,0,0);band.position.set(-1.1,1.55,.05);card.add(band);
  s.add(new T.HemisphereLight("#ffc8a8","#1a0a0a",.3));const ml=c.sun(new T.DirectionalLight("#ffd8b0",.7));ml.position.set(-4,9,6);s.add(ml);let ex=null;
  at(c,.1,()=>c.sfx("rain"));at(c,1,()=>c.sfx("charge"));at(c,1.8,()=>c.sfx("charge"));at(c,2.9,()=>{c.sfx("whoosh");c.shake(.1)});at(c,3.2,()=>{c.sfx("boom");c.flash(.7,"#dff0ff");c.shake(.45)});at(c,3.25,()=>c.reveal());
  return (t,dt)=>{lans.forEach(g=>{const f=.8+.2*Math.sin(t*13+g.userData.ph)+(Math.random()-.5)*.1;g.userData.pl.intensity=7*f;g.rotation.z=Math.sin(t*1.3+g.userData.ph)*.06});
    const push=t>3.2?{x:0,z:0,s:30*(1-E(3.2,4.4,t))}:null;rain.update(dt,push);rain.obj.material.opacity=.28*(t<3.2?1:Math.max(.08,1-E(3.2,3.8,t)));
    card.visible=t>.6;card.position.set(0,rest.y,rest.z-1.5+1.5*eo(E(.6,1.2,t)));const vib=E(1,2.8,t)*(1-E(2.9,3.1,t));card.position.x+=(Math.random()-.5)*.06*vib;card.position.y+=(Math.random()-.5)*.04*vib;
    aura.obj.visible=vib>0;aura.update(dt,t);aura.mat.opacity=vib;
    if(vib>0&&t>nk){nk=t+.07;ki.forEach(b=>{s.remove(b)});ki.length=0;for(let i=0;i<3;i++){const a=rnd(0,6.28),r=rnd(1.2,2.4),p0=V(Math.cos(a)*r,-1.55,rest.z+Math.sin(a)*r),p1=p0.clone().add(V(rnd(-.8,.8),rnd(.1,.9),rnd(-.6,.6)));const m=boltMesh(p0,p1,"#6fb8ff",.02,4,.2);m.children[0].material.color=H("#dff0ff",2.5);m.children.forEach(x=>x.material.opacity*=vib);s.add(m);ki.push(m)}}
    if(vib<=0&&ki.length){ki.forEach(b=>s.remove(b));ki.length=0}
    const g=E(1.8,2.85,t);hd.visible=g>0&&t<3.13;if(hd.visible){const f=E(2.9,3.2,t),sc=.25+eo(g)*.6+f*.8;hd.scale.setScalar(sc);const p0=card.position.clone().add(V(1.25,-.5,1.1));hd.position.copy(p0).lerp(V(cam.position.x+.4,cam.position.y-.3,cam.position.z-2.2),eio(f)*.85);sw.rotation.set(t*6,t*4,0);sw2.rotation.set(-t*5,t*3,0);hl.intensity=14*g}
    const w=E(3.2,4,t);wave.position.copy(cam.position).add(V(0,0,-2));wave.lookAt(cam.position);wave.scale.setScalar(.5+w*4);wave.material.opacity=w>0?(1-w):0;
    if(t>3.2&&!ex){ex=hdrP(burstParts(300,["#4fa3ff","#bfe0ff","#ffffff"],card.position.clone().add(V(0,0,1)),10,-1,.14),2);s.add(ex.obj)}if(ex){ex.update(dt,t);ex.mat.opacity=Math.max(0,1-(t-3.2)/1.4)}
    band.userData.wave(t*2.2,.1+(t>3.2?.12:0),4,"left");band.rotation.y=-.3;
    toCam(cam,L3(V(5,.4,11),V(0,1.1,7.6),eio(E(0,2.4,t))),L3(V(-3,1.5,-10),rest,eio(E(.3,2,t))))}};

function bake(g,mat){g.updateMatrixWorld(true);const ps=[],ns=[];g.traverse(o=>{if(!o.isMesh)return;const q=o.geometry.index?o.geometry.toNonIndexed():o.geometry.clone();q.applyMatrix4(o.matrixWorld);ps.push(q.attributes.position.array);ns.push(q.attributes.normal.array)});
  const n=ps.reduce((a,b)=>a+b.length,0),P=new Float32Array(n),N=new Float32Array(n);let o=0;ps.forEach((a,i)=>{P.set(a,o);N.set(ns[i],o);o+=a.length});const G=new T.BufferGeometry();G.setAttribute("position",new T.BufferAttribute(P,3));G.setAttribute("normal",new T.BufferAttribute(N,3));return new T.Mesh(G,mat)}
function gradTex(stops,w=8,h=128){return cnv(w,h,(g)=>{const q=g.createLinearGradient(0,0,0,h);stops.forEach(([k,c])=>q.addColorStop(k,c));g.fillStyle=q;g.fillRect(0,0,w,h)})}

K.optimus=c=>{const{s,cam,card,rest}=c;c.dur=5.2;c.bloom=[.8,.5,.9];s.add(sky("#07050f","#3a1820"));s.fog=new T.FogExp2("#140a12",.026);
  const hz=glow("#ff7a3a",70,.35);hz.position.set(0,-2,-95);s.add(hz);
  const asp=noiseTex(256,256,"#1d1d22",["#34343a","#0c0c0e","#45454c"],1,.55);asp.repeat.set(3,20);
  const rd=new T.Mesh(new T.PlaneGeometry(13,110),std("#ffffff",.38,.15,{map:asp,envMap:CUR_ENV,envMapIntensity:.2}));rd.rotation.x=-Math.PI/2;rd.position.set(0,-1.6,-45);rd.receiveShadow=true;s.add(rd);
  const gnd=new T.Mesh(new T.PlaneGeometry(90,110),std("#120d10",1));gnd.rotation.x=-Math.PI/2;gnd.position.set(0,-1.64,-45);s.add(gnd);
  const dashG=new T.Group();for(let z=6;z>-100;z-=6){const m=new T.Mesh(new T.PlaneGeometry(.16,2.4),hb("#e8e8f0",1));m.rotation.x=-Math.PI/2;m.position.set(0,-1.585,z);dashG.add(m)}const dash=bake(dashG,hb("#e8e8f0",1));s.add(dash);
  [-1,1].forEach(sd=>{const m=new T.Mesh(new T.PlaneGeometry(.14,110),hb("#e0a820",.9));m.rotation.x=-Math.PI/2;m.position.set(sd*5.9,-1.585,-45);s.add(m)});
  const gm=metal("#9aa0aa",.35,.7);const pg=new T.Group();for(let z=5;z>-80;z-=3)[-1,1].forEach(sd=>{const p=new T.Mesh(new T.BoxGeometry(.12,.8,.12),gm);p.position.set(sd*6.8,-1.2,z);pg.add(p)});s.add(bake(pg,gm));
  [-1,1].forEach(sd=>{const r=new T.Mesh(new T.BoxGeometry(.07,.34,86),gm);r.position.set(sd*6.72,-.95,-37);s.add(r)});
  const poles=new T.Group(),pmat=std("#3a3c44",.5,.7);const lamps=[];for(let z=2;z>-80;z-=14)[-1,1].forEach(sd=>{const p=new T.Mesh(new T.CylinderGeometry(.07,.12,7,8),pmat);p.position.set(sd*7.6,1.9,z);poles.add(p);const a=new T.Mesh(new T.BoxGeometry(1.7,.08,.08),pmat);a.position.set(sd*6.9,5.35,z);poles.add(a);const h=new T.Mesh(new T.BoxGeometry(.65,.14,.3),pmat);h.position.set(sd*6.1,5.3,z);poles.add(h);lamps.push(V(sd*6.1,5.2,z))});s.add(bake(poles,pmat));
  const lens=new T.Group();lamps.forEach(p=>{const m=new T.Mesh(new T.PlaneGeometry(.55,.22),hb("#ffb35a",2.6));m.rotation.x=Math.PI/2;m.position.copy(p);lens.add(m)});s.add(bake(lens,hb("#ffb35a",2.6)));
  const ct=gradTex([[0,"rgba(255,180,90,.55)"],[1,"rgba(255,180,90,0)"]]);lamps.forEach((p,i)=>{const g=glow("#ffb35a",2.2,.8);g.position.copy(p);s.add(g);const cn=new T.Mesh(new T.CylinderGeometry(.25,2.2,6.8,20,1,true),add(new T.MeshBasicMaterial({map:ct,opacity:.07,side:T.DoubleSide})));cn.position.set(p.x,p.y-3.4,p.z);s.add(cn);if(p.z>-30){const pl=new T.PointLight("#ffb060",18,16,1.6);pl.position.set(p.x,p.y-.6,p.z);s.add(pl)}});
  const crys=[],cmats=["#3fd0ff","#b05aff"].map(col=>new T.MeshStandardMaterial({color:"#0c1626",emissive:col,emissiveIntensity:1.6,roughness:.12,metalness:.3,envMap:CUR_ENV,envMapIntensity:1}));
  [[-10,-6],[11,-12],[-12,-20],[10.5,-28],[-11,-38],[12,-46],[-9.5,-58],[10,-66]].forEach(([x,z],k)=>{const g=new T.Group(),mt=cmats[k%2];for(let i=0;i<6;i++){const r=rnd(.18,.42),h=rnd(1,2.8),pr=new T.Group(),b=new T.Mesh(new T.CylinderGeometry(r,r*1.1,h,6),mt),tp=new T.Mesh(new T.ConeGeometry(r,r*2,6),mt);b.position.y=h/2;tp.position.y=h+r;pr.add(b,tp);pr.position.set(rnd(-.6,.6),-1.6,rnd(-.6,.6));pr.rotation.set(rnd(-.5,.5),rnd(0,3),rnd(-.5,.5));g.add(pr)}g.position.set(x,0,z);s.add(g);const gl=glow(k%2?"#c08aff":"#7fe0ff",4,.5);gl.position.set(x,0,z);s.add(gl);g.userData.gl=gl;crys.push(g);if(k<2){const pl=new T.PointLight(k%2?"#b05aff":"#3fd0ff",14,10);pl.position.set(x,.5,z+1);s.add(pl)}});
  const lat=bake(lattice(10,1.1),std("#4a4c56",.45,.8));const towers=[];[[-13,-10],[-13,-34],[13,-16],[13,-40]].forEach(([x,z])=>{const m=lat.clone();m.position.set(x,-1.6,z);s.add(m);const arm=new T.Mesh(new T.BoxGeometry(3.6,.18,.18),std("#4a4c56",.45,.8));arm.position.set(x,7.6,z);s.add(arm);[-1.6,1.6].forEach(dx=>{const ins=new T.Mesh(new T.CylinderGeometry(.06,.06,.5,8),std("#7a5a3a",.3,.2));ins.position.set(x+dx,7.3,z);s.add(ins);towers.push(V(x+dx,7.05,z))})});
  const cables=[];[[0,4],[1,5],[2,6],[3,7]].forEach(([a,b])=>{const A=towers[a],B=towers[b],pts=[];for(let k=0;k<=24;k++){const p=A.clone().lerp(B,k/24);p.y-=Math.sin(k/24*Math.PI)*1.4;pts.push(p)}s.add(new T.Line(new T.BufferGeometry().setFromPoints(pts),new T.LineBasicMaterial({color:"#5a5e6a"})));cables.push(pts)});
  const wt=winTex(["#ffcf8a","#ffb86a","#9fd0ff"],.32);for(let i=0;i<12;i++){const w=rnd(4,9),h=rnd(12,34),b=skyscraper(w,h,w,wt,{ei:.45,tier:i%3===0,spire:i%4===0});b.position.set(-48+i*8.6+rnd(-2,2),-1.6,-86-rnd(0,10));s.add(b)}
  let narc=0,arcs=[];
  const red=phys("#c8102e",{metalness:.35,roughness:.32,clearcoat:1,clearcoatRoughness:.06,envMapIntensity:.9}),blu=phys("#1d3a9e",{metalness:.35,roughness:.32,clearcoat:1,clearcoatRoughness:.06,envMapIntensity:.9}),chr=metal("#dfe3ea",.1,1.4),rub=std("#121214",.88),dk=std("#1a1a1e",.6,.6),gls=phys("#081428",{metalness:.3,roughness:.04,clearcoat:1,envMapIntensity:1.5});
  const grT=cnv(128,96,(g,w,h)=>{g.fillStyle="#0a0a0c";g.fillRect(0,0,w,h);for(let x=4;x<w;x+=10){const q=g.createLinearGradient(x,0,x+6,0);q.addColorStop(0,"#666");q.addColorStop(.5,"#fff");q.addColorStop(1,"#555");g.fillStyle=q;g.fillRect(x,4,6,h-8)}g.fillStyle="#bbb";g.fillRect(0,h/2-3,w,6)});
  const ribT=cnv(256,64,(g,w,h)=>{for(let x=0;x<w;x+=16){const q=g.createLinearGradient(x,0,x+16,0);q.addColorStop(0,"#8a9099");q.addColorStop(.35,"#e4e8ee");q.addColorStop(.7,"#b0b6c0");q.addColorStop(1,"#6a7078");g.fillStyle=q;g.fillRect(x,0,16,h)}});ribT.wrapS=T.RepeatWrapping;ribT.repeat.set(10,1);
  const trl=new T.MeshStandardMaterial({map:ribT,color:"#9aa0aa",metalness:.75,roughness:.38,envMap:CUR_ENV,envMapIntensity:.45});
  const truck=new T.Group(),parts=[];const P=(o,x,y,z,rx=0,ry=0,rz=0)=>{o.position.set(x,y,z);o.rotation.set(rx,ry,rz);truck.add(o);parts.push(o);return o};
  const wheel=()=>{const g=new T.Group(),ti=new T.Mesh(new T.CylinderGeometry(.48,.48,.34,28),rub),rim=new T.Mesh(new T.CylinderGeometry(.29,.29,.36,22),chr),hub=new T.Mesh(new T.CylinderGeometry(.09,.12,.42,10),chr),ring=new T.Mesh(new T.TorusGeometry(.33,.025,6,24),chr);ring.rotation.x=Math.PI/2;ring.position.y=.17;g.add(ti,rim,hub,ring);return g};
  P(new T.Mesh(new T.BoxGeometry(1.5,.28,9.4),dk),0,.32,-1.9);
  P(rbox(2.4,.34,.36,.08,chr),0,.42,3.25);
  P(rbox(2,.8,1.15,.12,red),0,.95,2.6);
  P(rbox(1.46,.86,.06,.03,chr),0,.93,3.17);P(new T.Mesh(new T.PlaneGeometry(1.3,.72),metal("#ffffff",.2,1.2,{map:grT})),0,.93,3.205);
  const hl=new T.Group();[-.82,.82].forEach(x=>{const m=rbox(.32,.18,.06,.03,hb("#fff4e0",3));m.position.set(x,.72,0);hl.add(m)});P(hl,0,0,3.2);
  [-1,1].forEach(sd=>P(rbox(.44,.22,1.15,.08,blu),sd*1.05,.82,2.55));
  P(rbox(2.2,1.75,1.5,.14,red),0,1.45,1.25);P(rbox(2.24,.5,1.54,.1,blu),0,.82,1.25);
  [-1,1].forEach(sd=>P(rbox(.9,.62,.04,.02,gls),sd*.5,1.85,2.02,-.12));[-1,1].forEach(sd=>P(rbox(.04,.5,.72,.02,gls),sd*1.11,1.88,1.4));
  P(rbox(2.1,.55,1,.2,red),0,2.5,.95);
  const mk=new T.Group();for(let i=0;i<5;i++){const m=new T.Mesh(new T.SphereGeometry(.05,10,8),hb("#ffa020",2.6));m.position.set(-.6+i*.3,0,0);mk.add(m)}P(mk,0,2.36,1.98);
  [-1,1].forEach(sd=>{const g=new T.Group(),st=new T.Mesh(new T.CylinderGeometry(.085,.085,2.4,14),chr),cap=new T.Mesh(new T.CylinderGeometry(.06,.1,.25,12),chr);cap.position.y=1.3;cap.rotation.x=.4;g.add(st,cap);P(g,sd*1.18,1.75,.4)});
  [-1,1].forEach(sd=>P(new T.Mesh(new T.CylinderGeometry(.035,.075,.55,10),chr),sd*.4,2.6,1.55,Math.PI/2));
  [-1,1].forEach(sd=>{const g=new T.Group(),arm=new T.Mesh(new T.BoxGeometry(.3,.04,.04),chr),mr=rbox(.08,.42,.22,.03,chr);arm.position.x=-sd*.15;g.add(arm,mr);P(g,sd*1.4,1.85,1.95)});
  [-1,1].forEach(sd=>{const g=new T.Group(),tk=new T.Mesh(new T.CylinderGeometry(.32,.32,.95,24),chr);[-.4,.4].forEach(y=>{const b=new T.Mesh(new T.TorusGeometry(.325,.02,6,24),dk);b.rotation.x=Math.PI/2;b.position.y=y;g.add(b)});g.add(tk);P(g,sd*1.08,.5,.45,Math.PI/2)});
  [[2.55],[-.75],[-1.75],[-5.7],[-6.6]].forEach(([z])=>[-1,1].forEach(sd=>P(wheel(),sd*1.05,.1,z,0,0,Math.PI/2)));
  P(rbox(2.36,2.35,5.8,.06,trl),0,1.98,-3.95);P(new T.Mesh(new T.BoxGeometry(2.38,.3,4),blu),0,.72,-3.6);
  const tl=new T.Group();[-.9,.9].forEach(x=>{const m=rbox(.3,.14,.05,.02,hb("#ff1a1a",2.4));m.position.x=x;tl.add(m)});P(tl,0,1,-6.87);
  const tm=new T.Group();for(let i=0;i<5;i++)[-1,1].forEach(sd=>{const m=new T.Mesh(new T.SphereGeometry(.045,8,6),hb("#ffa020",2.4));m.position.set(sd*1.19,0,-1.4-i*1.2);tm.add(m)});P(tm,0,3.12,0);
  truck.position.set(0,-1.22,-40);s.add(shadowy(truck));
  const hls=[];[-.75,.75].forEach(x=>{const h=glow("#fff6d8",1.4,1);h.position.set(x,.72,3.3);truck.add(h);const sp=new T.SpotLight("#fff6d8",60,34,.45,.5,1.2);sp.position.set(x,.72,3.3);sp.target.position.set(x,-.6,14);truck.add(sp,sp.target);hls.push(h,sp)});
  const W=2.5,Hh=3.5;parts.forEach((m,i)=>{const u=i/parts.length,d=u*2*(W+Hh);let x,y;if(d<W){x=-W/2+d;y=Hh/2}else if(d<W+Hh){x=W/2;y=Hh/2-(d-W)}else if(d<2*W+Hh){x=W/2-(d-W-Hh);y=-Hh/2}else{x=-W/2;y=-Hh/2+(d-2*W-Hh)}m.userData.home=m.position.clone();m.userData.r0=m.rotation.clone();m.userData.to=V(x*CS,y*CS,-.15);m.userData.sp=V(rnd(-1,1),rnd(-1,1),rnd(-1,1)).normalize().multiplyScalar(rnd(1.2,2.4))});
  const chest=[-1,1].map(sd=>{const g=new T.Group(),b=rbox(1.22,1.3,.14,.05,red),w=rbox(.92,.62,.04,.02,gls),f=rbox(1.0,.7,.03,.02,chr);w.position.set(-sd*.04,.2,.09);f.position.set(-sd*.04,.2,.075);const st=rbox(1.1,.14,.03,.02,blu);st.position.set(0,-.42,.085);g.add(b,f,w,st);g.position.set(sd*.625,.2,.12);g.userData.sd=sd;g.visible=false;card.add(g);return g});
  const mx=glow("#cfe8ff",.1,1);mx.position.set(0,.2,.15);card.add(mx);const core=new T.Mesh(new T.SphereGeometry(.16,24,16),hb("#bfe4ff",2.6));core.position.set(0,.2,.05);core.visible=false;card.add(core);
  const bs=new T.Shape();bs.moveTo(-.1,0);bs.lineTo(-.12,2.5);bs.lineTo(-.22,2.85);bs.lineTo(0,3.7);bs.lineTo(.22,2.85);bs.lineTo(.12,2.5);bs.lineTo(.1,0);bs.lineTo(-.1,0);
  const sword=new T.Group(),bl=new T.Mesh(new T.ExtrudeGeometry(bs,{depth:.03,bevelEnabled:true,bevelSize:.025,bevelThickness:.02,bevelSegments:2}),new T.MeshStandardMaterial({color:"#0a1830",emissive:H("#5fd0ff",2.2),roughness:.2,metalness:.4}));bl.position.set(0,.2,-.015);
  const gtx=cnv(64,8,(g,w,h)=>{const q=g.createLinearGradient(0,0,w,0);q.addColorStop(0,"rgba(255,255,255,0)");q.addColorStop(.5,"rgba(255,255,255,1)");q.addColorStop(1,"rgba(255,255,255,0)");g.fillStyle=q;g.fillRect(0,0,w,h)});
  const bg=new T.Mesh(new T.PlaneGeometry(.9,4),add(new T.MeshBasicMaterial({map:gtx,color:H("#4fb0ff",1.2),opacity:.6})));bg.position.y=2.1;const gd=rbox(.75,.14,.16,.04,chr),hd=new T.Mesh(new T.CylinderGeometry(.06,.07,.7,10),dk);hd.position.y=-.3;sword.add(bl,bg,gd,hd);sword.visible=false;s.add(sword);
  const fr=frameFx(card);let dust=null,sparks=null;
  s.add(new T.HemisphereLight("#6a70c0","#24141a",.45));const ml=c.sun(new T.DirectionalLight("#9aa8ff",.7),22);ml.position.set(-6,12,8);ml.target.position.set(0,0,-6);s.add(ml,ml.target);
  const kl=new T.PointLight("#8fc0ff",10,18);kl.position.set(0,3,4);s.add(kl);const rl=new T.PointLight("#5fc8ff",0,14);rl.position.set(0,1,2);s.add(rl);
  at(c,.4,()=>c.sfx("fly"));at(c,1.2,()=>{c.sfx("sizzle");c.shake(.1)});at(c,1.6,()=>c.sfx("whoosh"));at(c,2,()=>c.sfx("transform"));at(c,2.95,()=>{c.sfx("thump");c.sfx("boom");c.shake(.5);dust=burstParts(140,["#8a8f99","#c0c4cc","#5a5e66"],V(0,-1.5,-.5),6,-5,.16);s.add(dust.obj)});
  at(c,3.2,()=>c.sfx("hydraulic"));at(c,3.4,()=>c.sfx("charge"));at(c,3.95,()=>{c.sfx("swing");c.sfx("clank");c.flash(.6,"#dff0ff")});at(c,4,()=>c.reveal());
  return (t,dt)=>{crys.forEach((g,i)=>{const k=1.4+.5*Math.sin(t*3+i);g.children.forEach(p=>p.children.forEach(m=>m.material.emissiveIntensity=k));g.userData.gl.material.opacity=.35+.2*Math.sin(t*3+i)});
    if(t>narc){narc=t+.1;arcs.forEach(a=>s.remove(a));arcs=[];for(let i=0;i<2;i++){const pts=cables[Math.random()*cables.length|0],k=rnd(.1,.8),p0=pts[Math.floor(k*24)],p1=pts[Math.floor(k*24)+2];const m=boltMesh(p0.clone(),p1.clone(),"#8fd0ff",.02,4,.25);m.children[0]&&(m.children[0].material.color=H("#dff4ff",2));s.add(m);arcs.push(m)}}
    if(t<1.6){const k=E(0,1.6,t),e=1-Math.pow(1-k,2);truck.position.set(Math.sin(k*3)*.4,-1.22,-40+38*e);truck.rotation.set(0,E(1.1,1.6,t)*.6,0)}
    else if(t<2){const k=E(1.6,2,t);truck.position.set(.4,-1.22+Math.sin(k*Math.PI)*2.2,-2+k*.8);truck.rotation.set(-.2*Math.sin(k*Math.PI),.6,0)}
    parts.forEach(m=>{if(m.userData.wh)return});if(t<2)parts.forEach(m=>{if(m.children.length===4&&m.rotation.z===Math.PI/2)m.rotation.y-=0});
    if(t>=1.15&&t<1.6&&!sparks){sparks=hdrP(burstParts(90,["#ffb347","#ffffff"],V(1.2,-1.4,-6),4,-8,.08),2);s.add(sparks.obj)}if(sparks){sparks.update(dt,t);sparks.mat.opacity=Math.max(0,1-(t-1.15)/1)}
    hls.forEach(h=>h.visible=t<2.05);const tk=E(2,2.95,t);if(t>=2){parts.forEach((m,i)=>{const k=eio(Math.min(1,Math.max(0,tk*1.25-i*.01)));const w=card.position.clone().add(m.userData.to);const hw=truck.localToWorld(m.userData.home.clone());
        const mid=hw.clone().lerp(w,.5).addScaledVector(m.userData.sp,Math.sin(k*Math.PI));m.position.copy(truck.worldToLocal(k<.5?hw.clone().lerp(mid,k*2):mid.clone().lerp(w,(k-.5)*2)));const r0=m.userData.r0;m.rotation.set(r0.x+k*6+i,r0.y+k*4,r0.z+k*5);const sc=1-eo(k)*.85;m.scale.set(sc,sc,sc);m.visible=k<.98})}
    card.visible=t>2.6;card.position.set(0,rest.y+(1-eo(E(2.6,2.95,t)))*2.5,rest.z);card.rotation.set(0,0,0);
    if(dust){dust.update(dt,t);dust.mat.opacity=Math.max(0,1-(t-2.95)/1.4)}
    const op=eio(E(3.2,3.55,t));chest.forEach(m=>{m.visible=t>2.95&&t<4.1;m.position.x=m.userData.sd*(.625+op*.8)});const mg=E(3.4,3.95,t);core.visible=t>3.25&&t<4.2;core.scale.setScalar(.6+mg*1.2+.15*Math.sin(t*20));mx.scale.setScalar(.2+mg*4.5);mx.material.opacity=Math.min(1,mg*2)*(1-E(4.1,4.6,t));rl.intensity=mg*16;
    const sk=E(3.75,4.05,t);sword.visible=sk>0&&sk<1;if(sword.visible){sword.position.copy(card.position).add(V(2.4,-1.6,.6));sword.rotation.z=1.2-eio(sk)*2.6}
    fr.set(E(3.95,4.1,t)*(.7+.3*Math.sin(t*12)),["#6fb0ff","#c8102e","#6fb0ff","#c8102e"]);
    if(t<2)toCam(cam,L3(V(-3.4,-.6,9),V(-4.6,.3,7),E(0,2,t)),truck.position.clone().add(V(0,1,0)));else toCam(cam,L3(V(-4.6,.3,7),V(0,1.1,7.6),eio(E(2,3.2,t))),L3(V(.4,1,-1),rest,eio(E(2,2.8,t))))}};

K.leo=c=>{const{s,cam,card,rest}=c;c.dur=5.2;c.bloom=[.8,.5,.86];s.background=new T.Color("#020504");s.fog=new T.FogExp2("#06130d",.048);
  const R=5.4,L=56,Z0=-18;
  const brT=cnv(512,512,(g,w,h)=>{g.fillStyle="#140e0a";g.fillRect(0,0,w,h);for(let y=0;y<h;y+=32)for(let x=-((y/32)%2)*48;x<w;x+=96){const v=rnd(.75,1.1),r=Math.round(78*v),gg=Math.round(52*v),b=Math.round(38*v);g.fillStyle=`rgb(${r},${gg},${b})`;g.fillRect(x+3,y+3,90,26);g.fillStyle="rgba(255,255,255,.06)";g.fillRect(x+3,y+3,90,4)}
    for(let i=0;i<26;i++){const x=rnd(0,w),q=g.createLinearGradient(0,0,0,h);q.addColorStop(0,"rgba(20,40,20,0)");q.addColorStop(rnd(.3,.8),"rgba(30,60,30,.35)");q.addColorStop(1,"rgba(10,20,10,0)");g.fillStyle=q;g.fillRect(x,0,rnd(3,12),h)}});
  brT.wrapS=brT.wrapT=T.RepeatWrapping;brT.repeat.set(5,10);
  const arch=new T.Mesh(new T.CylinderGeometry(R,R,L,48,1,true,-Math.PI/2,Math.PI),new T.MeshStandardMaterial({map:brT,roughness:.38,metalness:.15,envMap:CUR_ENV,envMapIntensity:.18,side:T.BackSide}));arch.rotation.x=-Math.PI/2;arch.position.set(0,-1.6,Z0);s.add(arch);
  const rib=new T.Group();for(let z=4;z>Z0-L/2;z-=5){const m=new T.Mesh(new T.TorusGeometry(R-.08,.2,6,48,Math.PI),std("#2a2620",.7));m.position.set(0,-1.6,z);rib.add(m)}s.add(bake(rib,std("#2a2620",.6,.1,{envMap:CUR_ENV,envMapIntensity:.15})));
  const stT=noiseTex(256,256,"#2c2a24",["#3a3830","#1a1814","#4a463c"],1,.5);stT.repeat.set(2,14);const stone=std("#ffffff",.55,.05,{map:stT,envMap:CUR_ENV,envMapIntensity:.15});
  [-1,1].forEach(sd=>{const w=new T.Mesh(new T.BoxGeometry(3.8,.4,L),stone);w.position.set(sd*3.5,-1.8,Z0);w.receiveShadow=true;s.add(w);const cb=rbox(.3,.5,L,.06,std("#3a362e",.5));cb.position.set(sd*1.62,-1.75,Z0);s.add(cb)});
  const ch=new T.Mesh(new T.BoxGeometry(3.2,.2,L),std("#0a0f0c",.9));ch.position.set(0,-2.4,Z0);s.add(ch);
  const wt=cnv(256,256,(g,w,h)=>{g.fillStyle="#0b2214";g.fillRect(0,0,w,h);for(let i=0;i<70;i++){g.strokeStyle=`rgba(140,255,170,${rnd(.04,.22)})`;g.lineWidth=rnd(1,3);g.beginPath();const y=rnd(0,h);g.moveTo(0,y);for(let x=0;x<=w;x+=16)g.lineTo(x,y+Math.sin(x*.05+i)*4);g.stroke()}});wt.wrapS=wt.wrapT=T.RepeatWrapping;wt.repeat.set(1.5,10);
  const water=new T.Mesh(new T.PlaneGeometry(3.2,L),new T.MeshPhysicalMaterial({color:"#0d2a1a",map:wt,emissive:"#1a7a40",emissiveMap:wt,emissiveIntensity:.9,roughness:.06,metalness:.25,clearcoat:1,clearcoatRoughness:.05,envMap:CUR_ENV,envMapIntensity:.55}));water.rotation.x=-Math.PI/2;water.position.set(0,-1.9,Z0);s.add(water);
  const rust=std("#5a3418",.55,.75,{envMap:CUR_ENV,envMapIntensity:.3}),rail=new T.Group();for(let z=4;z>Z0-L/2;z-=2.2){const p=new T.Mesh(new T.CylinderGeometry(.035,.035,1,8),rust);p.position.set(1.85,-1.05,z);rail.add(p)}[-.65,-1.1].forEach(y=>{const r=new T.Mesh(new T.CylinderGeometry(.03,.03,L,8),rust);r.rotation.x=Math.PI/2;r.position.set(1.85,y+.1,Z0);rail.add(r)});s.add(bake(rail,rust));
  const pipeM=std("#6a3c1c",.45,.7,{envMap:CUR_ENV,envMapIntensity:.35}),pipes=new T.Group();[[-4.75,.2,.26],[-4.45,1.3,.18],[4.7,.7,.22]].forEach(([x,y,r])=>{const p=new T.Mesh(new T.CylinderGeometry(r,r,L,16),pipeM);p.rotation.x=Math.PI/2;p.position.set(x,y,Z0);pipes.add(p);for(let z=3;z>Z0-L/2;z-=3.2){const f=new T.Mesh(new T.CylinderGeometry(r*1.3,r*1.3,.14,16),pipeM);f.rotation.x=Math.PI/2;f.position.set(x,y,z);pipes.add(f)}});s.add(bake(pipes,pipeM));
  const vw=new T.Group(),vm=std("#b0201a",.4,.5,{envMap:CUR_ENV,envMapIntensity:.4});const vr=new T.Mesh(new T.TorusGeometry(.32,.04,8,28),vm);vw.add(vr);for(let i=0;i<4;i++){const sp=new T.Mesh(new T.CylinderGeometry(.02,.02,.64,6),vm);sp.rotation.z=i*Math.PI/4;vw.add(sp)}const vs=new T.Mesh(new T.CylinderGeometry(.05,.05,.3,8),pipeM);vs.rotation.z=Math.PI/2;vs.position.x=-.15;vw.add(vs);vw.rotation.y=Math.PI/2;vw.position.set(-4.35,.2,-2.5);s.add(vw);
  const lad=new T.Group(),lm=metal("#7a7a74",.4,.5);[-.3,.3].forEach(dx=>{const r=new T.Mesh(new T.CylinderGeometry(.03,.03,4.2,6),lm);r.position.set(dx,0,0);lad.add(r)});for(let y=-1.9;y<2;y+=.35){const r=new T.Mesh(new T.CylinderGeometry(.02,.02,.6,6),lm);r.rotation.z=Math.PI/2;r.position.y=y;lad.add(r)}const ld=bake(lad,lm);ld.position.set(4.25,.5,-9);s.add(ld);
  const hole=V(0,R-1.6,-5);const ring=new T.Mesh(new T.TorusGeometry(.95,.12,8,32),metal("#4a4a48",.4,.6));ring.rotation.x=Math.PI/2;ring.position.copy(hole).add(V(0,-.05,0));s.add(ring);const disc=new T.Mesh(new T.CircleGeometry(.9,32),hb("#e8fff0",2.2));disc.rotation.x=Math.PI/2;disc.position.copy(hole).add(V(0,-.02,0));s.add(disc);{const hg=glow("#e8fff0",3.2,.6);hg.position.copy(hole).add(V(0,-.2,0));s.add(hg)}
  const sT=gradTex([[0,"rgba(220,255,230,.9)"],[.6,"rgba(220,255,230,.25)"],[1,"rgba(220,255,230,0)"]]);const shafts=[];for(let i=0;i<3;i++){const m=new T.Mesh(new T.CylinderGeometry(.75+i*.12,1.6+i*.35,R+.3,28,1,true),add(new T.MeshBasicMaterial({map:sT,color:H("#e8fff0",1),opacity:.16,side:T.DoubleSide})));m.position.set(hole.x+rnd(-.1,.1),hole.y-(R+.3)/2,hole.z+rnd(-.1,.1));m.rotation.z=rnd(-.06,.06);s.add(m);shafts.push(m)}
  const sp=new T.SpotLight("#e0ffe8",80,14,.42,.6,1.3);sp.position.copy(hole);sp.target.position.set(0,-2,-4.6);s.add(sp,sp.target);
  const lampsP=[[-5,-1],[5,-7],[-5,-14],[5,-21]];lampsP.forEach(([x,z],i)=>{const g=new T.Group(),b=new T.Mesh(new T.SphereGeometry(.13,16,12),hb("#ffd890",2.4)),cg=new T.Group();for(let k=0;k<4;k++){const w=new T.Mesh(new T.TorusGeometry(.18,.012,4,16),std("#222",.5,.6));w.rotation.y=k*Math.PI/4;cg.add(w)}const bs=new T.Mesh(new T.CylinderGeometry(.12,.16,.12,12),std("#222",.5,.6));bs.position.y=.18;g.add(b,cg,bs,glow("#ffcf7a",1.6,.7));g.position.set(x*.9,1.6,z);s.add(g);if(i<3){const pl=new T.PointLight("#ffc87a",7,10,1.5);pl.position.set(x*.82,1.4,z);s.add(pl)}});
  const can=new T.Group(),cgm=phys("#bfffcf",{transmission:0,opacity:.45,transparent:true,roughness:.05,clearcoat:1,envMapIntensity:1.2}),cb=lathe([[0,-.5],[.3,-.5],[.32,-.45],[.32,.45],[.3,.5],[0,.5]],cgm,24),fl=new T.Mesh(new T.CylinderGeometry(.27,.27,.75,20),hb("#5aff6a",.85));const caps=[-.55,.55].map(y=>{const m=new T.Mesh(new T.CylinderGeometry(.34,.34,.12,20),metal("#8a8a90",.3,.8));m.position.y=y;return m});can.add(fl,cb,...caps);can.rotation.set(0,.4,Math.PI/2-.15);can.position.set(-2.4,-1.3,-3.6);s.add(can);
  const pud=new T.Mesh(new T.CircleGeometry(1,32),add(new T.MeshBasicMaterial({map:dot(),color:H("#5aff6a",.6),opacity:.6})));pud.rotation.x=-Math.PI/2;pud.scale.set(1.6,1,1);pud.position.set(-1.6,-1.58,-3.4);s.add(pud);
  const dust=field(140,[1.4,-1.5,3.8,-6.4,-3.6],["#e8fff0"],.05,()=>[rnd(-.05,.05),rnd(-.1,.05),rnd(-.05,.05)]);s.add(dust.obj);
  const drips=hdrP(new Parts(40,{cols:["#cfffe0","#9fe8b8"],size:.05,init:(p,v,i)=>{v.set([rnd(-1.4,1.4),rnd(-14,1),rnd(0,1.6)],i*3)},step:(p,v,i,dt,t)=>{const k=((t+v[i*3+2])%1.6)/1.6;p.set([v[i*3],R-1.8-k*k*(R-.2),v[i*3+1]],i*3)}}),1.4);s.add(drips.obj);
  const rings=[];for(let i=0;i<6;i++){const m=new T.Mesh(new T.RingGeometry(.08,.11,24),add(new T.MeshBasicMaterial({color:H("#cfffe0",1.2),opacity:0,side:T.DoubleSide})));m.rotation.x=-Math.PI/2;m.userData={ph:rnd(0,1.2),x:rnd(-1.3,1.3),z:rnd(-12,1)};s.add(m);rings.push(m)}
  const mut=new Smoke(s,26,texSmoke("120,255,120"),"#5aff6a",()=>({p:V(rnd(-1,1),-1.7,rnd(-4,-2.5)),v:V(rnd(-.4,.4),rnd(.6,1.4),rnd(.2,.8)),s:1.4}),{life:2,op:.32,grow:2.6,additive:true});
  const wrap=cnv(32,128,(g,w,h)=>{g.fillStyle="#0a0a12";g.fillRect(0,0,w,h);g.fillStyle="#1d4cc8";for(let y=0;y<h;y+=16){g.beginPath();g.moveTo(0,y);g.lineTo(w/2,y+8);g.lineTo(w,y);g.lineTo(w/2,y+6);g.fill()}});
  const ks=new T.Shape();ks.moveTo(-.04,0);ks.lineTo(-.04,2.2);ks.quadraticCurveTo(-.03,2.45,.04,2.6);ks.lineTo(.045,2.2);ks.lineTo(.04,0);ks.lineTo(-.04,0);const kG=new T.ExtrudeGeometry(ks,{depth:.012,bevelEnabled:true,bevelSize:.012,bevelThickness:.01,bevelSegments:1});
  const kat=[-1,1].map(sd=>{const g=new T.Group(),bl=new T.Mesh(kG,metal("#eef3fa",.08,1.6)),ts=new T.Mesh(new T.CylinderGeometry(.13,.13,.035,20),metal("#b08a3a",.35,1)),hl=new T.Mesh(new T.CylinderGeometry(.045,.05,.6,10),new T.MeshStandardMaterial({map:wrap,roughness:.8})),pm=new T.Mesh(new T.CylinderGeometry(.055,.05,.05,10),metal("#b08a3a",.35,1));bl.position.set(0,.02,-.006);hl.position.y=-.32;pm.position.y=-.64;g.add(bl,ts,hl,pm);const gl=glow("#ffffff",.5,0);gl.position.y=.2;g.add(gl);g.userData.gl=gl;g.position.set(sd*.6,-.6,.25);g.visible=false;card.add(g);return g});
  const slt=cnv(256,32,(g,w,h)=>{const q=g.createLinearGradient(0,0,w,0);q.addColorStop(0,"rgba(255,255,255,0)");q.addColorStop(.7,"rgba(200,230,255,.9)");q.addColorStop(1,"rgba(255,255,255,1)");g.fillStyle=q;g.fillRect(0,h*.3,w,h*.4)});
  const sl=[[-.75,"#2f8bff"],[.75,"#8fc6ff"]].map(([r,cl])=>{const m=new T.Mesh(new T.PlaneGeometry(16,.7),add(new T.MeshBasicMaterial({map:slt,color:H(cl,1.3),opacity:0,side:T.DoubleSide,depthTest:false})));m.rotation.z=r;m.renderOrder=990;s.add(m);return m});
  const kap=new T.Sprite(new T.SpriteMaterial({map:comicTex("KAPOW!"),transparent:true,opacity:0,depthTest:false}));kap.renderOrder=995;s.add(kap);
  s.add(new T.HemisphereLight("#7fbf8f","#0a140e",.35));const gl=new T.PointLight("#5aff6a",0,12);gl.position.set(-1,-.6,-3);s.add(gl);const kl=new T.PointLight("#cfe0ff",9,12);kl.position.set(0,3,3);s.add(kl);
  at(c,.2,()=>c.sfx("splat"));at(c,1,()=>c.sfx("sizzle"));at(c,1.55,()=>c.sfx("whoosh"));at(c,2.3,()=>{c.sfx("thump");c.shake(.15)});at(c,2.45,()=>c.sfx("shing"));at(c,2.95,()=>c.sfx("swing"));at(c,3.15,()=>{c.sfx("swing");c.flash(.3)});at(c,3.3,()=>{c.sfx("boom");c.shake(.35)});at(c,3.3,()=>c.reveal());
  return (t,dt)=>{wt.offset.y=-t*.18;mut.update(dt,t>.9&&t<2.6);gl.intensity=4+E(1,1.5,t)*10*(1-E(2.6,3.4,t));dust.update(dt,t);drips.update(dt,t);shafts.forEach((m,i)=>m.material.opacity=.13+.04*Math.sin(t*2+i));pud.material.opacity=.45+.15*Math.sin(t*4);
    rings.forEach(m=>{const k=((t+m.userData.ph)%1.2)/1.2;m.position.set(m.userData.x,-1.88,m.userData.z);m.scale.setScalar(1+k*5);m.material.opacity=(1-k)*.6});
    card.visible=t>1.5;const f=E(1.5,2.3,t);card.position.set(0,rest.y+Math.sin(f*Math.PI)*2.2,-3.6+3.1*eo(f));card.rotation.set(t<2.3?-eio(f)*Math.PI*4:0,0,0);
    kat.forEach((k,i)=>{const d=eo(E(2.45,2.7,t));k.visible=t>2.4;k.rotation.z=(i?-1:1)*(.4+d*.5);k.position.y=-.6+d*.4;k.userData.gl.material.opacity=Math.sin(E(2.5,2.85,t)*Math.PI);k.userData.gl.position.y=.2+E(2.5,2.85,t)*2.4});
    sl.forEach((m,i)=>{const k=E(2.95+i*.2,3.15+i*.2,t);m.position.copy(cam.position).add(V(0,-.05,-3));m.quaternion.copy(cam.quaternion);m.rotateZ(i?.75:-.75);m.scale.x=Math.max(.001,eo(k));m.material.opacity=k>0?1-E(3.6,4.4,t):0});
    const kp=E(3.3,3.55,t);kap.material.opacity=kp>0?1-E(4.5,5.1,t):0;const kss=eo(kp)*(1+.12*Math.sin(E(3.3,3.9,t)*Math.PI*3));kap.position.copy(cam.position).add(V(1.1,.75,-3).applyQuaternion(cam.quaternion));kap.scale.set(1.5*kss,1.12*kss,1);kap.material.rotation=-.15;
    toCam(cam,L3(V(.3,-.6,9),V(0,1.1,7.6),eio(E(0,2.4,t))),L3(V(0,0,-14),rest,eio(E(.6,2.2,t))))}};

const MAP={"mv:Spider-Man (Peter Parker)":"spider","mv:Iron Man (Anthony 'Tony' Stark)":"iron","dc:Batman (Bruce Wayne)":"bat","dc:Superman (Clark Kent)":"sup","sw:Darth Vader":"vader","sw:Luke Skywalker":"luke",
  "di:Mickey Mouse":"mickey","di:Buzz l'Éclair":"buzz","dw:Shrek":"shrek","hp:Harry Potter":"harry","lo:Gandalf":"gandalf","jv:Mario":"mario","fg:Ryu":"ryu","tf:Optimus Prime":"optimus","tf:Leonardo":"leo"};

export const has=id=>!!MAP[id];



let REN=null;
function getRen(){if(REN&&!REN.getContext().isContextLost())return REN;try{REN&&REN.dispose()}catch(_){}ENV=null;
  const cv=document.createElement("canvas");REN=new T.WebGLRenderer({canvas:cv,antialias:true,powerPreference:"high-performance"});REN.toneMapping=T.ACESFilmicToneMapping;REN.toneMappingExposure=1;REN.shadowMap.type=T.PCFSoftShadowMap;return REN}
const QK="rosika_q3d";
function qLevel(){try{const v=localStorage.getItem(QK);if(v!==null)return +v}catch(_){}const coarse=matchMedia("(pointer:coarse)").matches,c=navigator.hardwareConcurrency||4,m=navigator.deviceMemory||4;return(!coarse&&c>=8)?2:(c>=6&&m>=4)?1:1}
function qSave(v){try{localStorage.setItem(QK,String(v))}catch(_){}}
function rays(col,n=14){const g=new T.Group(),t=cnv(64,256,(c,w,h)=>{const q=c.createLinearGradient(0,h,0,0);q.addColorStop(0,"rgba(255,255,255,.9)");q.addColorStop(1,"rgba(255,255,255,0)");c.fillStyle=q;c.beginPath();c.moveTo(w/2-3,h);c.lineTo(0,0);c.lineTo(w,0);c.lineTo(w/2+3,h);c.fill()});
  for(let i=0;i<n;i++){const m=new T.Mesh(new T.PlaneGeometry(1.6,9),add(new T.MeshBasicMaterial({map:t,color:col,opacity:.5,side:T.DoubleSide})));m.geometry.translate(0,4.5,0);m.rotation.z=i/n*Math.PI*2;m.scale.x=rnd(.5,1.4);m.scale.y=rnd(.7,1.2);g.add(m)}return g}
function mount(o){const ren=getRen(),cv=ren.domElement;let q=typeof window.__c3q==="number"?window.__c3q:qLevel();
  const ph=o.host&&o.host.querySelector("canvas");if(ph)ph.replaceWith(cv);else if(o.host)o.host.prepend(cv);
  CUR_ENV=env(ren);
  const s=new T.Scene(),cam=new T.PerspectiveCamera(45,1,.1,300);
  let comp=null,bloom=null;
  const setup=()=>{ren.setPixelRatio(Math.min([1,1.25,1.5][q],window.devicePixelRatio||1));ren.shadowMap.enabled=q>=2;
    if(comp){comp.dispose();bloom.dispose();comp=bloom=null}
    if(q>=1){comp=new EffectComposer(ren);comp.addPass(new RenderPass(s,cam));bloom=new UnrealBloomPass(new T.Vector2(innerWidth*(q>=2?.6:.4),innerHeight*(q>=2?.6:.4)),.85,.55,.72);comp.addPass(bloom);comp.addPass(new OutputPass())}
    fit()};
  const fit=()=>{const W=innerWidth,H=innerHeight;ren.setSize(W,H,false);cam.aspect=W/H;cam.fov=W/H<.8?58:45;cam.updateProjectionMatrix();if(comp){comp.setPixelRatio(ren.getPixelRatio());comp.setSize(W,H);bloom.resolution.set(W*(q>=2?.6:.4),H*(q>=2?.6:.4))}};
  setup();addEventListener("resize",fit);
  const flash=new T.Mesh(new T.PlaneGeometry(4,4),new T.MeshBasicMaterial({color:"#ffffff",transparent:true,opacity:0,depthWrite:false,fog:false,depthTest:false,toneMapped:false}));flash.position.z=-.5;flash.renderOrder=999;cam.add(flash);s.add(cam);
  let fc=0,acc=0;
  const render=(dt)=>{if(comp)comp.render(dt);else ren.render(s,cam);
    if(typeof window.__c3t!=="number"&&typeof window.__c3q!=="number"){fc++;if(fc>8&&fc<=48)acc+=dt;if(fc===48){const avg=acc/40;if(avg>.034&&q>0){q--;qSave(q);s.traverse(x=>{if(x.material)(Array.isArray(x.material)?x.material:[x.material]).forEach(m=>m.needsUpdate=true)});setup()}else if(avg<.02&&q<2&&!matchMedia("(pointer:coarse)").matches){qSave(Math.min(2,q+1))}}}};
  const setBloom=(st,r,th)=>{if(bloom){bloom.strength=st;bloom.radius=r;bloom.threshold=th}};
  const clean=()=>{removeEventListener("resize",fit);if(comp){comp.dispose();bloom.dispose()}s.traverse(x=>{if(x.geometry)x.geometry.dispose();const m=x.material;if(m)(Array.isArray(m)?m:[m]).forEach(mm=>{["map","emissiveMap","normalMap","roughnessMap","alphaMap"].forEach(k=>{if(mm[k]&&mm[k]!==DOT)mm[k].dispose()});mm.dispose()})});ren.renderLists.dispose();cv.remove()};
  return{ren,cv,s,cam,flash,clean,render,setBloom,q:()=>q}}

export function run(o){
  const{ren,s,cam,flash,clean,render,setBloom,q}=mount(o);
  const card=makeCard(o,ren);card.visible=false;card.scale.setScalar(CS);s.add(card);
  const rest=new T.Vector3(0,1,-.5),ev=[],flashC=new T.Color("#ffffff");let shakeA=0,flashA=o.fromSus?1:0,revT=-1,tNow=0,fText=false,burst=null;
  const ry=rays(o.col);ry.visible=false;s.add(ry);const ry2=rays("#ffffff",10);ry2.visible=false;s.add(ry2);
  const shock=new T.Mesh(new T.RingGeometry(.9,1.05,96),add(new T.MeshBasicMaterial({color:o.col,opacity:0,side:T.DoubleSide})));s.add(shock);
  const keyL=new T.PointLight("#ffffff",0,12);s.add(keyL);
  const ctx={s,cam,card,rest,ren,col:o.col,col2:o.col2,dur:5,shadows:q()>=2,bloom:[.8,.5,.88],
    at:(time,fn)=>ev.push({time,fn,done:false}),
    sfx:k=>{try{o.sfx&&o.sfx(k)}catch(_){}},
    shake:a=>{shakeA=Math.max(shakeA,a)},
    flash:(a,col)=>{flashA=Math.max(flashA,a);flashC.set(col||"#ffffff")},
    sun:(l,size=12)=>{if(!ctx.shadows)return l;l.castShadow=true;l.shadow.mapSize.set(1024,1024);l.shadow.bias=-.0004;l.shadow.normalBias=.02;if(l.shadow.camera.isOrthographicCamera){const c=l.shadow.camera;c.left=c.bottom=-size;c.right=c.top=size;c.near=.5;c.far=60}else{l.shadow.camera.near=.5;l.shadow.camera.far=60}return l},
    reveal:()=>{if(revT>=0)return;revT=tNow;card.visible=true;ry.visible=ry2.visible=true;o.onCard&&o.onCard();burst=burstParts(240,[o.col,o.col2,"#ffffff","#ffd34d"],card.position.clone(),7,-1.2,.15);s.add(burst.obj)}};
  let upd=null;try{upd=(K[MAP[o.id]]||K.mickey)(ctx)}catch(e){console.error(e)}
  setBloom(...ctx.bloom);
  const hu=card.userData.holo.uniforms;
  let t0=performance.now(),last=t0,raf=0,stop=false;
  let vt=0;const loop=now=>{if(stop)return;let t=(now-t0)/1000,dt=Math.min(.05,(now-last)/1000);last=now;if(typeof window.__c3t==="number"){dt=Math.max(0,Math.min(.05,window.__c3t-vt));t=vt=window.__c3t}tNow=t;
    for(const e of ev)if(!e.done&&t>=e.time){e.done=true;try{e.fn()}catch(_){}}
    try{upd&&upd(t,dt)}catch(e){if(!run.err){run.err=1;console.error(e)}}
    hu.uT.value=t;
    if(revT>=0){const u=t-revT,sh=card.userData;
      ry.position.copy(card.position);ry.lookAt(cam.position);ry.translateZ(-1.3);ry2.position.copy(ry.position);ry2.quaternion.copy(ry.quaternion);
      const ro=E(0,.8,u)*(1-E(ctx.dur-revT-.5,ctx.dur-revT,u));ry.children.forEach((m,i)=>m.material.opacity=ro*(.26+.12*Math.sin(t*2+i)));ry2.children.forEach((m,i)=>m.material.opacity=ro*(.1+.07*Math.sin(t*3+i*1.7)));
      ry.children.forEach(m=>m.rotation.z+=dt*.15);ry2.children.forEach(m=>m.rotation.z-=dt*.22);const rs=.55+eo(E(0,.9,u))*.55;ry.scale.setScalar(rs);ry2.scale.setScalar(rs);
      hu.uOp.value=.25+E(0,.5,u)*.75;hu.uBand.value=E(.1,.4,u);sh.halo.material.opacity=Math.max(sh.halo.material.opacity,.45*E(0,.5,u));sh.halo.scale.setScalar(8+Math.sin(t*2)*.6);
      keyL.position.copy(card.position).add(new T.Vector3(1.5,1.5,3.5));keyL.intensity=E(0,.4,u)*9;
      const sk=E(0,.9,u);shock.position.copy(card.position);shock.lookAt(cam.position);shock.scale.setScalar(1+sk*9);shock.material.opacity=sk>0?(1-sk)*.9:0;
      if(burst){burst.update(dt,t);burst.mat.opacity=Math.max(0,1-u/1.6)}
      if(!fText&&u>.45){fText=true;o.onText&&o.onText()}}
    if(shakeA>.001){cam.position.x+=(Math.random()-.5)*shakeA;cam.position.y+=(Math.random()-.5)*shakeA;cam.rotation.z+=(Math.random()-.5)*shakeA*.08;shakeA*=Math.exp(-dt*7)}
    flash.material.color.copy(flashC);flash.material.opacity=Math.min(1,flashA);flashA*=Math.exp(-dt*5.5);
    render(dt);
    if(t>=ctx.dur+.35){o.onEnd&&o.onEnd();return}
    raf=requestAnimationFrame(loop)};
  raf=requestAnimationFrame(loop);
  return{stop(){stop=true;cancelAnimationFrame(raf);clean()}}}

const SUS=[["#60a5fa","r",1.4],["#c084fc","e",3.1],["#f59e0b","l",4.8],["#f43f5e","m",6.5]],SDUR=10.4,BOOM=9.2;
export function suspense(o){
  const{ren,s,cam,flash,clean,render}=mount(o);s.background=new T.Color("#000000");s.fog=new T.FogExp2("#000000",.06);
  const back=backTex({});const cg=new T.Group(),cardM=new T.Mesh(new T.BoxGeometry(2.5,3.5,.07),[0,1,2,3].map(()=>new T.MeshStandardMaterial({color:"#d4af37",metalness:.85,roughness:.3,emissive:"#3a2a05"})).concat([new T.MeshBasicMaterial({map:back,alphaTest:.5}),new T.MeshBasicMaterial({map:back,alphaTest:.5})]));
  cg.add(cardM);cg.position.set(0,.5,0);s.add(cg);
  const crk=cnv(512,716,(g,w,h)=>{g.strokeStyle="#fff";g.lineCap="round";g.shadowColor="#fff";g.shadowBlur=14;
    for(let k=0;k<16;k++){let x=w/2,y=h/2,a=k/16*Math.PI*2+rnd(-.2,.2);g.lineWidth=rnd(2,5);g.beginPath();g.moveTo(x,y);for(let j=0;j<9;j++){a+=rnd(-.6,.6);const l=rnd(20,55);x+=Math.cos(a)*l;y+=Math.sin(a)*l;g.lineTo(x,y)}g.stroke()}});
  const cr=new T.Mesh(new T.PlaneGeometry(2.5,3.5),add(new T.MeshBasicMaterial({map:crk,opacity:0})));cr.position.z=.04;cg.add(cr);
  const rim=glow("#ffffff",6,0);rim.position.z=-.25;cg.add(rim);const rim2=glow("#ffffff",14,0);rim2.position.z=-.4;cg.add(rim2);
  const ry=rays("#ffffff",16);ry.position.set(0,.5,-1.4);s.add(ry);
  const conv=new Parts(420,{cols:["#ffffff"],size:.09,init:(p,v,i,l)=>{const a=Math.random()*6.28,b=Math.acos(rnd(-1,1)),r=rnd(7,12);p.set([Math.sin(b)*Math.cos(a)*r,Math.cos(b)*r*.7+.5,Math.sin(b)*Math.sin(a)*r-1],i*3);l[i]=rnd(.6,1.6)},
    step:(p,v,i,dt,t,l)=>{const x=p[i*3],y=p[i*3+1]-.5,z=p[i*3+2],d=Math.hypot(x,y,z)||1,sp=(1.5+t*.9)*l[i]*dt;p[i*3]-=x/d*sp;p[i*3+1]-=y/d*sp;p[i*3+2]-=z/d*sp;
      if(d<1){const a=Math.random()*6.28,b=Math.acos(rnd(-1,1)),r=rnd(8,12);p.set([Math.sin(b)*Math.cos(a)*r,Math.cos(b)*r*.7+.5,Math.sin(b)*Math.sin(a)*r-1],i*3)}}});
  s.add(conv.obj);
  const fl=new T.Mesh(new T.CircleGeometry(30,64),new T.MeshStandardMaterial({color:"#050505",roughness:.25,metalness:.7}));fl.rotation.x=-Math.PI/2;fl.position.y=-2.4;s.add(fl);
  const pl=new T.PointLight("#ffffff",0,14);pl.position.set(0,.5,1.5);s.add(pl);s.add(new T.AmbientLight("#ffffff",.08));
  const colA=new T.Color("#000000"),colB=new T.Color(),cur=new T.Color("#ffffff");
  let t0=performance.now(),last=t0,raf=0,stop=false,stage=-1,nb=.9,lineI=-1,boom=false,ex=null;
  const LINES=[[1.4,"Le paquet se met à trembler…"],[3.1,"Quelque chose se réveille…"],[4.8,"Ce n'est pas une carte ordinaire…"],[6.5,"Plus haut… encore plus haut…"],[7.9,""]];
  const loop=now=>{if(stop)return;const t=(now-t0)/1000,dt=Math.min(.05,(now-last)/1000);last=now;
    let st=-1;SUS.forEach((x,i)=>{if(t>=x[2])st=i});
    if(st!==stage&&t<7.9){stage=st;if(st>=0){o.sfx&&o.sfx("rar",SUS[st][1]);cur.set(SUS[st][0])}}
    const dark=t>7.9&&t<BOOM,lv=st<0?0:(st+1)/4;
    colB.copy(cur);const inten=dark?.02:(st<0?E(.3,1.4,t)*.25:.35+lv*.65)*(1+.12*Math.sin(t*(6+lv*10)));
    rim.material.color.copy(colB);rim2.material.color.copy(colB);rim.material.opacity=inten*.9;rim2.material.opacity=inten*.45;rim.scale.setScalar(5+lv*3+Math.sin(t*9)*.3);rim2.scale.setScalar(12+lv*8);
    pl.color.copy(colB);pl.intensity=inten*40;
    ry.children.forEach((m,i)=>{m.material.color.copy(colB);m.material.opacity=(st>=2&&!dark?(.15+.12*Math.sin(t*3+i))*(lv):0)});ry.rotation.z=t*(.1+lv*.25);
    conv.update(dt,t);conv.mat.opacity=dark?0:E(1.2,2,t)*(.4+lv*.6);conv.mat.color.copy(colB);
    cr.material.opacity=dark?.08:E(6.5,7.8,t)*(.6+.4*Math.sin(t*25));cr.scale.setScalar(1+E(6.5,7.8,t)*.05);
    const shake=dark?.015:(lv*lv*.07+(st===3?E(6.5,7.9,t)*.08:0));cg.position.set((Math.random()-.5)*shake,.5+Math.sin(t*1.6)*.08+(Math.random()-.5)*shake,0);
    cg.rotation.y=Math.PI+Math.sin(t*.7)*.12;cg.rotation.z=Math.sin(t*1.1)*.03+(Math.random()-.5)*shake*.6;
    const k=eio(E(0,BOOM,t));cam.position.set(Math.sin(t*.25)*.6*(1-k),.7+.8*(1-k),10-3*k+(Math.random()-.5)*shake*.5);cam.lookAt(0,.5,0);
    if(t>=nb&&t<BOOM-.2&&!dark){o.sfx&&o.sfx("beat",.08+lv*.14);nb+=Math.max(.36,1.15-lv*.75)}
    if(dark&&nb<7.9+.6){o.sfx&&o.sfx("beat",.05);nb=99}
    const li=LINES.reduce((a,x,i)=>t>=x[0]?i:a,-1);if(li!==lineI){lineI=li;o.line&&o.line(LINES[li][1])}
    if(t>=BOOM&&!boom){boom=true;o.sfx&&o.sfx("whoosh");o.line&&o.line("");cur.set("#fff1b8");ex=burstParts(400,["#ffffff","#fff1b8","#ffd34d"],new T.Vector3(0,.5,0),11,0,.18);s.add(ex.obj);cardM.visible=false;cr.visible=false}
    if(boom){ex.update(dt,t);rim.material.color.set("#fff1b8");rim.material.opacity=1;rim.scale.setScalar(8+E(BOOM,SDUR,t)*30);rim2.material.opacity=1;rim2.scale.setScalar(20+E(BOOM,SDUR,t)*40)}
    flash.material.opacity=boom?eo(E(BOOM+.1,SDUR-.2,t)):0;
    render(dt);
    if(t>=SDUR){o.onEnd&&o.onEnd();return}
    raf=requestAnimationFrame(loop)};
  raf=requestAnimationFrame(loop);
  return{stop(){stop=true;cancelAnimationFrame(raf);clean()}}}
