import * as T from "./vendor/three.module.min.js";

const E=(a,b,t)=>Math.max(0,Math.min(1,(t-a)/(b-a)));
const eo=x=>1-Math.pow(1-x,3);
const eio=x=>x<.5?4*x*x*x:1-Math.pow(-2*x+2,3)/2;
const rnd=(a,b)=>a+Math.random()*(b-a);
const TC=2.6,DUR=6.6;

function cnv(w,h,f){const c=document.createElement("canvas");c.width=w;c.height=h;f(c.getContext("2d"),w,h);const t=new T.CanvasTexture(c);t.colorSpace=T.SRGBColorSpace;return t}
let DOT=null;
const dot=()=>DOT||(DOT=cnv(64,64,(g)=>{const r=g.createRadialGradient(32,32,0,32,32,32);r.addColorStop(0,"#fff");r.addColorStop(.22,"rgba(255,255,255,.85)");r.addColorStop(.5,"rgba(255,255,255,.25)");r.addColorStop(1,"rgba(255,255,255,0)");g.fillStyle=r;g.fillRect(0,0,64,64)}));
const add=(m,o={})=>Object.assign(m,{transparent:true,depthWrite:false,blending:T.AdditiveBlending},o);

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

function burstParts(n,cols,center,speed=6,grav=-2,size=.14){const P=new Parts(n,{cols,size,init:(p,v,i,l)=>{p.set([center.x,center.y,center.z],i*3);const a=Math.random()*Math.PI*2,b=Math.acos(rnd(-1,1)),s=rnd(.3,1)*speed;v.set([Math.sin(b)*Math.cos(a)*s,Math.cos(b)*s,Math.sin(b)*Math.sin(a)*s],i*3);l[i]=1},
  step:(p,v,i,dt)=>{p[i*3]+=v[i*3]*dt;p[i*3+1]+=v[i*3+1]*dt;p[i*3+2]+=v[i*3+2]*dt;v[i*3]*=.985;v[i*3+1]=v[i*3+1]*.985+grav*dt;v[i*3+2]*=.985}});return P}

function field(n,box,cols,size,vel){return new Parts(n,{cols,size,init:(p,v,i)=>{p.set([rnd(-box[0],box[0]),rnd(box[1],box[2]),rnd(box[3],box[4])],i*3);const w=vel();v.set(w,i*3)},
  step:(p,v,i,dt)=>{p[i*3]+=v[i*3]*dt;p[i*3+1]+=v[i*3+1]*dt;p[i*3+2]+=v[i*3+2]*dt;
    if(p[i*3+1]>box[2])p[i*3+1]=box[1];if(p[i*3+1]<box[1])p[i*3+1]=box[2];if(p[i*3]>box[0])p[i*3]=-box[0];if(p[i*3]<-box[0])p[i*3]=box[0];if(p[i*3+2]>box[4])p[i*3+2]=box[3];if(p[i*3+2]<box[3])p[i*3+2]=box[4]}})}

function streaks(n,col,len){const g=new T.BufferGeometry(),a=new Float32Array(n*6),d=[];for(let i=0;i<n;i++){const r=rnd(1.5,14),th=Math.random()*Math.PI*2;d.push([Math.cos(th)*r,Math.sin(th)*r,rnd(-120,0)])}
  g.setAttribute("position",new T.BufferAttribute(a,3));const L=new T.LineSegments(g,add(new T.LineBasicMaterial({color:col,opacity:.9})));L.frustumCulled=false;
  L.userData.step=(dt,sp)=>{for(let i=0;i<n;i++){const q=d[i];q[2]+=sp*dt;if(q[2]>10){q[2]=rnd(-120,-60)}const l=Math.min(30,len+sp*.08);a.set([q[0],q[1],q[2],q[0],q[1],q[2]-l],i*6)}g.attributes.position.needsUpdate=true};return L}

function city(n,R0,R1,win,base=-3,zc=-6){const grp=new T.Group(),wt=cnv(64,128,(g,w,h)=>{g.fillStyle="#05060a";g.fillRect(0,0,w,h);for(let y=4;y<h;y+=10)for(let x=4;x<w;x+=10)if(Math.random()<.35){g.fillStyle=win;g.globalAlpha=rnd(.4,1);g.fillRect(x,y,5,6)}});
  wt.wrapS=wt.wrapT=T.RepeatWrapping;
  for(let i=0;i<n;i++){const a=Math.PI+Math.random()*Math.PI,r=rnd(R0,R1),w=rnd(1.2,3),h=rnd(3,14),m=new T.Mesh(new T.BoxGeometry(w,h,w),new T.MeshStandardMaterial({color:"#0b0c14",emissive:"#ffffff",emissiveMap:wt,emissiveIntensity:.9,roughness:.9}));
    m.position.set(Math.cos(a)*r*1.3,base+h/2,Math.sin(a)*r+zc);grp.add(m)}return grp}

function cardTex(o){const W=600,H=840;return cnv(W,H,(g)=>{
  let fr;try{fr=g.createConicGradient(0,W/2,H/2)}catch(_){fr=null}
  if(fr){[[0,"#fff6cc"],[.2,o.col],[.4,"#ffd34d"],[.6,o.col2],[.8,"#ffffff"],[1,"#fff6cc"]].forEach(([k,c])=>fr.addColorStop(k,c))}else{fr=g.createLinearGradient(0,0,W,H);fr.addColorStop(0,"#fff6cc");fr.addColorStop(.5,o.col);fr.addColorStop(1,"#ffd34d")}
  g.fillStyle=fr;g.beginPath();g.roundRect(0,0,W,H,46);g.fill();
  g.fillStyle="#0a0a0b";g.beginPath();g.roundRect(18,18,W-36,H-36,32);g.fill();
  const ig=g.createLinearGradient(0,0,0,H);ig.addColorStop(0,o.col);ig.addColorStop(1,"#0a0a0b");g.fillStyle=ig;g.beginPath();g.roundRect(30,96,W-60,H-250,22);g.fill();
  g.fillStyle="rgba(255,255,255,.85)";g.font="900 150px Sora, sans-serif";g.textAlign="center";g.textBaseline="middle";if(!o.img)g.fillText((o.name||"?").slice(0,2).toUpperCase(),W/2,H/2-40);
  g.fillStyle="#fff";g.font="800 46px Sora, sans-serif";g.textAlign="left";g.textBaseline="alphabetic";
  let nm=o.name||"";while(g.measureText(nm).width>W-170&&nm.length>3)nm=nm.slice(0,-2);if(nm!==o.name)nm+="…";g.fillText(nm,44,72);
  g.fillStyle="#ffd34d";g.beginPath();g.arc(W-70,56,28,0,7);g.fill();g.fillStyle="#1a1200";g.font="900 30px Sora, sans-serif";g.textAlign="center";g.fillText("D",W-70,67);
  g.textAlign="left";g.fillStyle="rgba(255,255,255,.7)";g.font="600 30px 'Plus Jakarta Sans', sans-serif";g.fillText(o.uni||"",44,H-104);
  g.fillStyle="#ffd34d";g.font="800 34px 'Plus Jakarta Sans', sans-serif";g.fillText("DIVIN",44,H-56);
  g.textAlign="right";g.fillStyle="rgba(255,255,255,.55)";g.font="800 30px Sora, sans-serif";g.fillText("ROSIKA",W-44,H-56)})}

function backTex(o){return cnv(600,840,(g,W,H)=>{const b=g.createLinearGradient(0,0,W,H);b.addColorStop(0,"#2a0b10");b.addColorStop(1,"#050505");g.fillStyle="#d4af37";g.beginPath();g.roundRect(0,0,W,H,46);g.fill();
  g.fillStyle=b;g.beginPath();g.roundRect(14,14,W-28,H-28,34);g.fill();g.strokeStyle="rgba(255,211,77,.35)";g.lineWidth=3;
  for(let r=60;r<520;r+=46){g.beginPath();g.arc(W/2,H/2,r,0,7);g.stroke()}
  g.fillStyle="#ffd34d";g.font="900 84px Sora, sans-serif";g.textAlign="center";g.textBaseline="middle";g.fillText("ROSIKA",W/2,H/2)})}

function makeCard(o,ren){const W=2.5,H=3.5,D=.07,grp=new T.Group();
  const front=cardTex(o),back=backTex(o);front.anisotropy=back.anisotropy=Math.min(8,ren.capabilities.getMaxAnisotropy());
  const edge=new T.MeshStandardMaterial({color:"#d4af37",metalness:.85,roughness:.28,emissive:"#5a3e05",emissiveIntensity:.6});
  const box=new T.Mesh(new T.BoxGeometry(W,H,D),[edge,edge,edge,edge,new T.MeshBasicMaterial({map:front,alphaTest:.5}),new T.MeshBasicMaterial({map:back,alphaTest:.5})]);grp.add(box);
  if(o.img){const im=new Image();im.onload=()=>{const c=front.image,g=c.getContext("2d"),x=30,y=96,w=c.width-60,h=c.height-250,s=Math.max(w/im.width,h/im.height),dw=im.width*s,dh=im.height*s;
      g.save();g.beginPath();g.roundRect(x,y,w,h,22);g.clip();g.drawImage(im,x+(w-dw)/2,y+(h-dh)*.15,dw,dh);
      const sh=g.createLinearGradient(0,y+h*.65,0,y+h);sh.addColorStop(0,"rgba(0,0,0,0)");sh.addColorStop(1,"rgba(0,0,0,.55)");g.fillStyle=sh;g.fillRect(x,y,w,h);g.restore();front.needsUpdate=true};im.src=o.img}
  const st=cnv(256,64,(g,w,h)=>{const r=g.createLinearGradient(0,0,w,0);r.addColorStop(0,"rgba(255,255,255,0)");r.addColorStop(.45,"rgba(255,255,255,0)");r.addColorStop(.5,"rgba(255,255,255,.9)");r.addColorStop(.55,"rgba(255,230,180,.4)");r.addColorStop(.6,"rgba(255,255,255,0)");r.addColorStop(1,"rgba(255,255,255,0)");g.fillStyle=r;g.fillRect(0,0,w,h)});
  st.wrapS=T.RepeatWrapping;st.repeat.set(.6,1);
  const sheen=new T.Mesh(new T.PlaneGeometry(W*.98,H*.98),add(new T.MeshBasicMaterial({map:st,opacity:.0})));sheen.position.z=D/2+.002;sheen.rotation.z=-.5;grp.add(sheen);
  const halo=glow(o.col,9,.0);halo.position.z=-.3;grp.add(halo);
  grp.userData={sheen,halo,st};return grp}

const CS=.82;
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

const MAP={"mv:Spider-Man (Peter Parker)":"spider","mv:Iron Man (Anthony 'Tony' Stark)":"iron","dc:Batman (Bruce Wayne)":"bat","dc:Superman (Clark Kent)":"sup","sw:Darth Vader":"vader","sw:Luke Skywalker":"luke",
  "di:Mickey Mouse":"mickey","di:Buzz l'Éclair":"buzz","dw:Shrek":"shrek","hp:Harry Potter":"harry","lo:Gandalf":"gandalf","jv:Mario":"mario","fg:Ryu":"ryu","tf:Optimus Prime":"optimus","tf:Leonardo":"leo"};

export const has=id=>!!MAP[id];

let REN=null;
function getRen(){if(REN&&!REN.getContext().isContextLost())return REN;try{REN&&REN.dispose()}catch(_){}
  const cv=document.createElement("canvas");REN=new T.WebGLRenderer({canvas:cv,antialias:true,powerPreference:"high-performance"});REN.toneMapping=T.ACESFilmicToneMapping;REN.toneMappingExposure=1.05;return REN}
function mount(o){const dpr=Math.min(1.5,window.devicePixelRatio||1),ren=getRen(),cv=ren.domElement;ren.setPixelRatio(dpr);
  const ph=o.host&&o.host.querySelector("canvas");if(ph)ph.replaceWith(cv);else if(o.host)o.host.prepend(cv);
  const s=new T.Scene(),cam=new T.PerspectiveCamera(45,1,.1,300);
  const fit=()=>{const W=innerWidth,H=innerHeight;ren.setSize(W,H,false);cam.aspect=W/H;cam.fov=W/H<.8?58:45;cam.updateProjectionMatrix()};fit();addEventListener("resize",fit);
  const flash=new T.Mesh(new T.PlaneGeometry(4,4),new T.MeshBasicMaterial({color:"#ffffff",transparent:true,opacity:0,depthWrite:false,fog:false,depthTest:false}));flash.position.z=-.5;flash.renderOrder=999;cam.add(flash);s.add(cam);
  const clean=()=>{removeEventListener("resize",fit);s.traverse(x=>{if(x.geometry)x.geometry.dispose();const m=x.material;if(m)(Array.isArray(m)?m:[m]).forEach(mm=>{if(mm.map&&mm.map!==DOT)mm.map.dispose();mm.dispose()})});ren.renderLists.dispose();cv.remove()};
  return{ren,cv,s,cam,flash,clean}}

function rays(col,n=14){const g=new T.Group(),t=cnv(64,256,(c,w,h)=>{const q=c.createLinearGradient(0,h,0,0);q.addColorStop(0,"rgba(255,255,255,.9)");q.addColorStop(1,"rgba(255,255,255,0)");c.fillStyle=q;c.beginPath();c.moveTo(w/2-3,h);c.lineTo(0,0);c.lineTo(w,0);c.lineTo(w/2+3,h);c.fill()});
  for(let i=0;i<n;i++){const m=new T.Mesh(new T.PlaneGeometry(1.6,9),add(new T.MeshBasicMaterial({map:t,color:col,opacity:.5,side:T.DoubleSide})));m.geometry.translate(0,4.5,0);m.rotation.z=i/n*Math.PI*2;m.scale.x=rnd(.5,1.4);m.scale.y=rnd(.7,1.2);g.add(m)}return g}

export function run(o){
  const{ren,s,cam,flash,clean}=mount(o);
  const card=makeCard(o,ren);card.visible=false;card.scale.setScalar(CS);s.add(card);
  const rest=new T.Vector3(0,1,-.5),ev=[],flashC=new T.Color("#ffffff");let shakeA=0,flashA=o.fromSus?1:0,revT=-1,tNow=0,fText=false,burst=null;
  const ry=rays(o.col);ry.visible=false;s.add(ry);const ry2=rays("#ffffff",10);ry2.visible=false;s.add(ry2);
  const shock=new T.Mesh(new T.RingGeometry(.9,1.05,96),add(new T.MeshBasicMaterial({color:o.col,opacity:0,side:T.DoubleSide})));s.add(shock);
  const keyL=new T.PointLight("#ffffff",0,12);s.add(keyL);
  const ctx={s,cam,card,rest,ren,col:o.col,col2:o.col2,dur:5,
    at:(time,fn)=>ev.push({time,fn,done:false}),
    sfx:k=>{try{o.sfx&&o.sfx(k)}catch(_){}},
    shake:a=>{shakeA=Math.max(shakeA,a)},
    flash:(a,col)=>{flashA=Math.max(flashA,a);flashC.set(col||"#ffffff")},
    reveal:()=>{if(revT>=0)return;revT=tNow;card.visible=true;ry.visible=ry2.visible=true;o.onCard&&o.onCard();burst=burstParts(240,[o.col,o.col2,"#ffffff","#ffd34d"],card.position.clone(),7,-1.2,.15);s.add(burst.obj)}};
  let upd=null;try{upd=(K[MAP[o.id]]||K.mickey)(ctx)}catch(e){console.error(e)}
  let t0=performance.now(),last=t0,raf=0,stop=false;
  let vt=0;const loop=now=>{if(stop)return;let t=(now-t0)/1000,dt=Math.min(.05,(now-last)/1000);last=now;if(typeof window.__c3t==="number"){dt=Math.max(0,Math.min(.05,window.__c3t-vt));t=vt=window.__c3t}tNow=t;
    for(const e of ev)if(!e.done&&t>=e.time){e.done=true;try{e.fn()}catch(_){}}
    try{upd&&upd(t,dt)}catch(e){if(!run.err){run.err=1;console.error(e)}}
    if(revT>=0){const u=t-revT,sh=card.userData;
      ry.position.copy(card.position);ry.lookAt(cam.position);ry.translateZ(-1.3);ry2.position.copy(ry.position);ry2.quaternion.copy(ry.quaternion);
      const ro=E(0,.8,u)*(1-E(ctx.dur-revT-.5,ctx.dur-revT,u));ry.children.forEach((m,i)=>m.material.opacity=ro*(.3+.15*Math.sin(t*2+i)));ry2.children.forEach((m,i)=>m.material.opacity=ro*(.12+.08*Math.sin(t*3+i*1.7)));
      ry.rotation.z+=0;ry.children.forEach(m=>m.rotation.z+=dt*.15);ry2.children.forEach(m=>m.rotation.z-=dt*.22);const rs=.55+eo(E(0,.9,u))*.55;ry.scale.setScalar(rs);ry2.scale.setScalar(rs);
      sh.st.offset.x=-1+((u-.2)*.55)%2;sh.sheen.material.opacity=E(.1,.4,u)*.8;sh.halo.material.opacity=Math.max(sh.halo.material.opacity,.5*E(0,.5,u));sh.halo.scale.setScalar(8+Math.sin(t*2)*.6);
      keyL.position.copy(card.position).add(new T.Vector3(1.5,1.5,3.5));keyL.intensity=E(0,.4,u)*26;
      const sk=E(0,.9,u);shock.position.copy(card.position);shock.lookAt(cam.position);shock.scale.setScalar(1+sk*9);shock.material.opacity=sk>0?(1-sk)*.9:0;
      if(burst){burst.update(dt,t);burst.mat.opacity=Math.max(0,1-u/1.6)}
      if(!fText&&u>.45){fText=true;o.onText&&o.onText()}}
    if(shakeA>.001){cam.position.x+=(Math.random()-.5)*shakeA;cam.position.y+=(Math.random()-.5)*shakeA;cam.rotation.z+=(Math.random()-.5)*shakeA*.08;shakeA*=Math.exp(-dt*7)}
    flash.material.color.copy(flashC);flash.material.opacity=Math.min(1,flashA);flashA*=Math.exp(-dt*5.5);
    ren.render(s,cam);
    if(t>=ctx.dur+.35){o.onEnd&&o.onEnd();return}
    raf=requestAnimationFrame(loop)};
  raf=requestAnimationFrame(loop);
  return{stop(){stop=true;cancelAnimationFrame(raf);clean()}}}

const SUS=[["#60a5fa","r",1.4],["#c084fc","e",3.1],["#f59e0b","l",4.8],["#f43f5e","m",6.5]],SDUR=10.4,BOOM=9.2;
export function suspense(o){
  const{ren,s,cam,flash,clean}=mount(o);s.background=new T.Color("#000000");s.fog=new T.FogExp2("#000000",.06);
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
    ren.render(s,cam);
    if(t>=SDUR){o.onEnd&&o.onEnd();return}
    raf=requestAnimationFrame(loop)};
  raf=requestAnimationFrame(loop);
  return{stop(){stop=true;cancelAnimationFrame(raf);clean()}}}
