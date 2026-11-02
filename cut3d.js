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

const K={};
K.spider=(c)=>{const{s,cam,col,col2}=c;s.add(sky("#05081c","#3a0c1c"));s.fog=new T.FogExp2("#140812",.025);
  const ci=city(46,10,26,"#ffd27a",-6);s.add(ci);
  const web=new T.Group(),wm=add(new T.LineBasicMaterial({color:"#ffffff",opacity:.55})),pts=[],N=14,R=8.5;
  for(let i=0;i<N;i++){const a=i/N*Math.PI*2;pts.push(0,0,0,Math.cos(a)*R,Math.sin(a)*R,0)}
  for(let r=1;r<=8;r++){const rr=r*R/8.6;for(let i=0;i<N;i++){const a=i/N*Math.PI*2,b=(i+1)/N*Math.PI*2,sg=.92;pts.push(Math.cos(a)*rr,Math.sin(a)*rr,0,Math.cos((a+b)/2)*rr*sg,Math.sin((a+b)/2)*rr*sg,0,Math.cos((a+b)/2)*rr*sg,Math.sin((a+b)/2)*rr*sg,0,Math.cos(b)*rr,Math.sin(b)*rr,0)}}
  const wg=new T.BufferGeometry();wg.setAttribute("position",new T.Float32BufferAttribute(pts,3));const wl=new T.LineSegments(wg,wm);web.add(wl);web.position.set(0,.4,-4);s.add(web);
  const dust=field(260,[16,-6,10,-26,6],["#ffffff","#ffd6e0"],.07,()=>[rnd(-.2,.2),rnd(.1,.4),rnd(-.2,.2)]);s.add(dust.obj);
  s.add(new T.AmbientLight("#6070a0",.6));const pl=new T.PointLight(col,40,30);pl.position.set(0,2,4);s.add(pl);const pl2=new T.PointLight(col2,30,30);pl2.position.set(-5,-2,2);s.add(pl2);
  const total=wg.attributes.position.count;
  return (t,dt)=>{dust.update(dt,t);wg.setDrawRange(0,Math.floor(total*eo(E(.3,2.2,t))));web.rotation.z=t*.05;
    const k=eio(E(0,TC,t)),a=(1-k)*1.4;cam.position.set(Math.sin(a)*(9+12*(1-k)),.4+4*(1-k)*Math.sin(k*Math.PI+.4),Math.cos(a)*(8+10*(1-k)));cam.lookAt(0,.4+(1-k)*-1,0)}};

K.iron=(c)=>{const{s,cam}=c;s.background=new T.Color("#02060c");s.fog=new T.FogExp2("#02060c",.03);
  const grid=new T.GridHelper(60,60,"#1b7f99","#0c3a48");grid.position.y=-3;grid.material.transparent=true;grid.material.opacity=.5;s.add(grid);
  const rings=[];[[2.2,.03,"#6ff7ff"],[2.9,.02,"#ffd34d"],[3.6,.05,"#3ad8ff"],[4.5,.015,"#6ff7ff"],[5.4,.03,"#ff3b30"]].forEach(([r,tb,cl],i)=>{const m=new T.Mesh(new T.TorusGeometry(r,tb,8,120,Math.PI*(1.2+i*.15)),add(new T.MeshBasicMaterial({color:cl,opacity:.85})));m.position.set(0,.4,-1);rings.push(m);s.add(m)});
  const core=new T.Mesh(new T.SphereGeometry(.55,32,16),new T.MeshBasicMaterial({color:"#bff6ff"}));core.position.set(0,.4,-1);s.add(core);const cg=glow("#3ad8ff",5);core.add(cg);
  const tri=new T.Mesh(new T.RingGeometry(.7,.9,3),add(new T.MeshBasicMaterial({color:"#bff6ff",side:T.DoubleSide})));core.add(tri);
  const sp=field(220,[14,-3,8,-20,6],["#6ff7ff","#ffd34d"],.06,()=>[0,rnd(.2,1),0]);s.add(sp.obj);
  s.add(new T.AmbientLight("#3ad8ff",.5));const pl=new T.PointLight("#ff3b30",30,25);pl.position.set(3,2,4);s.add(pl);
  return (t,dt)=>{sp.update(dt,t);rings.forEach((m,i)=>{m.rotation.x=t*(.4+i*.13)*(i%2?1:-1);m.rotation.y=t*(.3+i*.1);m.scale.setScalar(eo(E(i*.15,1+i*.15,t))*(1+E(2.2,2.7,t)*1.5));m.material.opacity=.85*(1-E(2.3,2.8,t))});
    const pr=E(.6,2.3,t);core.scale.setScalar(.45+pr*.5+Math.sin(t*20)*.03);cg.scale.setScalar(2.4+pr*3);tri.rotation.z=t*2;core.visible=t<2.7;
    const k=eio(E(0,TC,t));cam.position.set(Math.sin(t*.25)*(3*(1-k)+.5),.6+2*(1-k),8+8*(1-k));cam.lookAt(0,.4,0)}};

K.bat=(c)=>{const{s,cam}=c;s.add(sky("#0a0e1c","#020205"));s.fog=new T.FogExp2("#05060c",.04);
  const ci=city(40,9,24,"#ffcf6a",-7);ci.children.forEach(m=>m.material.emissiveIntensity=.25);s.add(ci);
  const rg=new T.BufferGeometry(),N=700,ra=new Float32Array(N*6),rp=[];for(let i=0;i<N;i++)rp.push([rnd(-14,14),rnd(-6,12),rnd(-18,8)]);rg.setAttribute("position",new T.BufferAttribute(ra,3));
  const rain=new T.LineSegments(rg,add(new T.LineBasicMaterial({color:"#9fb3d9",opacity:.35})));rain.frustumCulled=false;s.add(rain);
  const cone=new T.Mesh(new T.CylinderGeometry(3.5,.25,26,32,1,true),add(new T.MeshBasicMaterial({color:"#fff3c4",opacity:.0,side:T.DoubleSide})));cone.position.set(-6,6,-14);cone.rotation.z=-.45;s.add(cone);
  const disc=glow("#fff3c4",9,0);disc.position.set(-11.5,17,-14);s.add(disc);
  const bt=cnv(128,64,(g)=>{g.fillStyle="#000";g.beginPath();g.moveTo(64,40);g.quadraticCurveTo(44,10,6,18);g.quadraticCurveTo(26,28,20,44);g.quadraticCurveTo(40,34,64,52);g.quadraticCurveTo(88,34,108,44);g.quadraticCurveTo(102,28,122,18);g.quadraticCurveTo(84,10,64,40);g.fill()});
  const bats=[];for(let i=0;i<26;i++){const m=new T.Mesh(new T.PlaneGeometry(.9,.45),new T.MeshBasicMaterial({map:bt,transparent:true,alphaTest:.3,side:T.DoubleSide,fog:false}));m.position.set(rnd(-12,12),rnd(-2,6),rnd(-14,2));m.userData.v=rnd(2,5);m.userData.ph=Math.random()*6;s.add(m);bats.push(m)}
  const amb=new T.AmbientLight("#8fa6ff",.25);s.add(amb);const pl=new T.PointLight("#ffd34d",20,20);pl.position.set(0,2,5);s.add(pl);
  return (t,dt)=>{for(let i=0;i<N;i++){const q=rp[i];q[1]-=dt*22;q[0]-=dt*4;if(q[1]<-6){q[1]=12;q[0]=rnd(-14,14)}ra.set([q[0],q[1],q[2],q[0]+.12,q[1]+.6,q[2]],i*6)}rg.attributes.position.needsUpdate=true;
    bats.forEach(b=>{b.position.x+=b.userData.v*dt;if(b.position.x>14)b.position.x=-14;b.scale.y=.6+.4*Math.abs(Math.sin(t*14+b.userData.ph));b.lookAt(cam.position)});
    const ls=E(.6,1.4,t);cone.material.opacity=.12*ls*(1-E(5.6,6.4,t));disc.material.opacity=.7*ls;
    amb.intensity=.25+((t>1.2&&t<1.3)||(t>2.45&&t<2.55)?1.4:0);
    const k=eio(E(0,TC,t));cam.position.set(-3*(1-k),.5+5*(1-k),8+12*(1-k));cam.lookAt(0,.4+2*(1-k),0)}};

K.sup=(c)=>{const{s,cam}=c;s.add(sky("#0b2a78","#bfe3ff"));s.fog=new T.Fog("#9cc8ff",10,60);
  const sun=glow("#fff6d8",40,.9);sun.position.set(0,26,-50);s.add(sun);
  const ct=cnv(128,128,(g)=>{for(let i=0;i<14;i++){const x=rnd(30,98),y=rnd(40,88),r=rnd(18,34),q=g.createRadialGradient(x,y,0,x,y,r);q.addColorStop(0,"rgba(255,255,255,.9)");q.addColorStop(1,"rgba(255,255,255,0)");g.fillStyle=q;g.fillRect(0,0,128,128)}});
  const cl=[];for(let i=0;i<46;i++){const m=new T.Sprite(new T.SpriteMaterial({map:ct,transparent:true,opacity:.85,depthWrite:false}));const sc=rnd(5,12);m.scale.set(sc,sc*.7,1);m.position.set(rnd(-16,16),rnd(-30,20),rnd(-30,0));s.add(m);cl.push(m)}
  const sl=streaks(90,"#ffffff",4);sl.rotation.x=Math.PI/2;s.add(sl);
  s.add(new T.AmbientLight("#ffffff",1));
  c.from=new T.Vector3(0,-16,0);
  return (t,dt)=>{const sp=6+E(0,2.4,t)*40-E(3,4,t)*38;cl.forEach(m=>{m.position.y-=sp*dt*.6;if(m.position.y<-30){m.position.y=22;m.position.x=rnd(-16,16)}});sl.userData.step(dt,sp*1.4);sl.material.opacity=.3*(1-E(2.8,3.4,t));
    const k=eio(E(0,TC,t));cam.position.set(0,-1+1.4*k,9+4*(1-k));cam.lookAt(0,.6+2*(1-k),0)}};

function saber(col,len){const g=new T.Group(),core=new T.Mesh(new T.CylinderGeometry(.035,.035,len,10),new T.MeshBasicMaterial({color:"#ffffff"}));core.position.y=len/2;g.add(core);
  const gl=new T.Mesh(new T.CylinderGeometry(.13,.13,len,16),add(new T.MeshBasicMaterial({color:col,opacity:.55})));gl.position.y=len/2;g.add(gl);
  const gl2=new T.Mesh(new T.CylinderGeometry(.3,.3,len,16),add(new T.MeshBasicMaterial({color:col,opacity:.18})));gl2.position.y=len/2;g.add(gl2);
  const hilt=new T.Mesh(new T.CylinderGeometry(.06,.06,.6,12),new T.MeshStandardMaterial({color:"#888",metalness:.9,roughness:.3}));hilt.position.y=-.3;g.add(hilt);
  const blade=new T.Group();blade.add(core,gl,gl2);g.add(blade);g.userData.blade=blade;return g}

K.vader=(c)=>{const{s,cam}=c;s.background=new T.Color("#030102");s.fog=new T.FogExp2("#120204",.05);
  const em=field(340,[12,-5,9,-14,6],["#ff3a1a","#ff7a1a","#ffb04a"],.09,()=>[rnd(-.2,.2),rnd(.5,1.6),0]);s.add(em.obj);
  const sb=saber("#ff1a2c",4.2);sb.position.set(0,-2.4,1.2);s.add(sb);const lt=new T.PointLight("#ff1a2c",0,18);lt.position.set(0,0,2.5);s.add(lt);
  const floor=new T.Mesh(new T.CircleGeometry(12,48),new T.MeshStandardMaterial({color:"#0a0203",roughness:.4,metalness:.6}));floor.rotation.x=-Math.PI/2;floor.position.y=-2.6;s.add(floor);
  s.add(new T.AmbientLight("#401015",.6));
  return (t,dt)=>{em.update(dt,t);const ig=eo(E(1.4,1.85,t)),fl=.85+Math.random()*.15;sb.userData.blade.scale.y=Math.max(.001,ig);sb.userData.blade.position.y=0;
    sb.rotation.z=-eio(E(2.25,2.6,t))*1.9;sb.visible=t<3.4;lt.intensity=ig*45*fl*(1-E(3.2,3.6,t));
    const k=eio(E(0,TC,t));cam.position.set(Math.sin(t*.3)*1.5*(1-k),.3+1.5*(1-k),7.5+5*(1-k));cam.lookAt(0,.2,0)}};

K.luke=(c)=>{const{s,cam}=c;s.background=new T.Color("#010208");const st=streaks(520,"#cfe2ff",.5);s.add(st);
  const desert=new T.Group();desert.visible=false;desert.add(sky("#1b0f2e","#ffb347"));
  [[-3,"#ffe9b0",9],[3.5,"#ffd08a",7]].forEach(([x,cl,sc])=>{const g=glow(cl,sc,1);g.position.set(x,2.2,-40);desert.add(g);const g2=glow(cl,sc*3,.35);g2.position.copy(g.position);desert.add(g2)});
  [["#3a1a0c",-3,-30],["#25100a",-3.6,-18],["#170a06",-4,-8]].forEach(([cl,y,z],i)=>{const m=new T.Mesh(new T.SphereGeometry(30,32,16),new T.MeshBasicMaterial({color:cl,fog:false}));m.scale.set(1.6,.12,.5);m.position.set((i-1)*8,y,z-10);desert.add(m)});
  s.add(desert);const sb=saber("#3cff6a",3.6);sb.position.set(2.6,-2.6,1);sb.rotation.z=.2;s.add(sb);
  s.add(new T.AmbientLight("#ffd8a8",.8));
  return (t,dt)=>{const hy=E(0,1.7,t);st.visible=t<1.95;if(st.visible)st.userData.step(dt,4+Math.pow(hy,3)*260);desert.visible=t>=1.95;
    const ig=eo(E(2.1,2.5,t));sb.userData.blade.scale.y=Math.max(.001,ig);sb.visible=t>2.05;
    const k=eio(E(1.95,TC+.2,t));if(t<1.95){cam.position.set(0,0,8);cam.lookAt(0,0,-10);cam.rotation.z=t*.25}else{cam.rotation.z=0;cam.position.set(0,.6+1.5*(1-k),8+3*(1-k));cam.lookAt(0,.5,0)}}};

K.mickey=(c)=>{const{s,cam}=c;s.add(sky("#2c1660","#070b2e"));
  const stars=field(400,[40,-2,30,-60,-15],["#ffffff","#fff3c4"],.18,()=>[0,0,0]);s.add(stars.obj);
  const fw=[];const spawn=()=>{const cen=new T.Vector3(rnd(-7,7),rnd(1.5,6),rnd(-9,-3)),cols=[["#ffd34d","#fff"],["#e8233a","#ffd34d"],["#ff8ad8","#fff"],["#7ab8ff","#fff"]][Math.floor(Math.random()*4)];const b=burstParts(150,cols,cen,rnd(3.5,5.5),-1.6,.32);s.add(b.obj);fw.push({b,t:0})};
  const spiral=new Parts(260,{cols:["#fff3c4","#ffd34d","#ffffff"],size:.09,init:(p,v,i)=>{v.set([i/260,Math.random(),0],i*3)},step:(p,v,i,dt,t)=>{const u=v[i*3],a=u*Math.PI*10+t*2.4,r=2.1+Math.sin(u*9+t)*.3;p.set([Math.cos(a)*r,(u-.5)*5+.4,Math.sin(a)*r],i*3)}});spiral.obj.visible=false;s.add(spiral.obj);
  s.add(new T.AmbientLight("#b0a0ff",.7));let nx=.3;
  return (t,dt)=>{if(t>nx&&t<2.6){spawn();nx+=rnd(.18,.34)}if(t>2.62&&!c.fwBig){c.fwBig=1;for(let i=0;i<3;i++)spawn()}
    fw.forEach(f=>{f.t+=dt;f.b.update(dt,t);f.b.mat.opacity=Math.max(0,1-f.t/2)});
    spiral.obj.visible=t>2.7;spiral.update(dt,t);spiral.mat.opacity=E(2.7,3.4,t)*(1-E(5.6,6.4,t));
    const k=eio(E(0,TC,t));cam.position.set(Math.sin((1-k)*.8)*10,1+3*(1-k),8+6*(1-k));cam.lookAt(0,.6+2.5*(1-k),0)}};

K.buzz=(c)=>{const{s,cam}=c;s.background=new T.Color("#02020e");
  const stars=field(500,[50,-30,30,-80,-20],["#ffffff","#d8ccff","#bfffcf"],.2,()=>[0,0,0]);s.add(stars.obj);
  const st=streaks(260,"#d8e6ff",.3);s.add(st);
  const pl=new T.Mesh(new T.SphereGeometry(5,48,24),new T.MeshStandardMaterial({color:"#6a3fb0",roughness:.8,emissive:"#24103f",emissiveIntensity:.8}));pl.position.set(-13,-6,-30);s.add(pl);
  const ring=new T.Mesh(new T.RingGeometry(6.4,9.5,96),add(new T.MeshBasicMaterial({color:"#3cff6a",opacity:.35,side:T.DoubleSide})));ring.rotation.x=-1.2;ring.rotation.y=.3;pl.add(ring);
  const sun=new T.DirectionalLight("#ffffff",2.5);sun.position.set(6,4,6);s.add(sun);s.add(new T.AmbientLight("#8a7bff",.4));
  const rk=glow("#bfffcf",2.2);s.add(rk);const tr=new Parts(200,{cols:["#3cff6a","#a855f7","#ffffff"],size:.14,init:(p,v,i,l)=>{p.set([0,-50,0],i*3);l[i]=0},step:(p,v,i,dt,t,l)=>{l[i]-=dt;if(l[i]<=0&&t>1.7&&t<2.6){l[i]=rnd(.4,.9);p.set([rk.position.x+rnd(-.1,.1),rk.position.y+rnd(-.1,.1),rk.position.z],i*3)}p[i*3+1]-=dt*.2}});s.add(tr.obj);
  return (t,dt)=>{stars.obj.rotation.z=t*.02;st.userData.step(dt,20+E(0,2,t)*120);st.material.opacity=.7*(1-E(2.4,3,t));pl.rotation.y=t*.08;
    const r=eo(E(1.7,2.55,t));rk.position.set(-9+9*r,-6+6.4*r,-6+6*r);rk.visible=t>1.7&&t<2.62;tr.update(dt,t);
    const k=eio(E(0,TC,t));cam.position.set(Math.sin(t*.2)*2*(1-k),.5+2*(1-k),8+8*(1-k));cam.lookAt(0,.4,0)}};

K.shrek=(c)=>{const{s,cam}=c;s.add(sky("#26340f","#071406"));s.fog=new T.FogExp2("#132309",.07);
  const moon=glow("#f4ffd0",14,.8);moon.position.set(6,9,-30);s.add(moon);
  const gr=new T.Mesh(new T.CircleGeometry(40,48),new T.MeshStandardMaterial({color:"#16220c",roughness:1}));gr.rotation.x=-Math.PI/2;gr.position.y=-2.5;s.add(gr);
  for(let i=0;i<18;i++){const a=i/18*Math.PI*2+rnd(-.1,.1),r=rnd(7,13),h=rnd(5,9),x=Math.cos(a)*r,z=Math.sin(a)*r-3;
    const tr=new T.Mesh(new T.CylinderGeometry(.25,.6,h,8),new T.MeshStandardMaterial({color:"#1c140a",roughness:1}));tr.position.set(x,-2.5+h/2,z);s.add(tr);
    const cp=new T.Mesh(new T.IcosahedronGeometry(rnd(1.8,2.8),0),new T.MeshStandardMaterial({color:"#1f3a12",roughness:1,flatShading:true}));cp.position.set(x,-2.5+h,z);s.add(cp)}
  const ff=new Parts(160,{cols:["#e4ff8a","#b8ff5a","#fff6a0"],size:.16,init:(p,v,i)=>{p.set([rnd(-9,9),rnd(-2,4),rnd(-12,4)],i*3);v.set([Math.random()*6.28,rnd(.5,1.4),0],i*3)},step:(p,v,i,dt,t)=>{p[i*3]+=Math.cos(v[i*3]+t*v[i*3+1])*dt*.6;p[i*3+1]+=Math.sin(v[i*3]*1.7+t*v[i*3+1]*1.3)*dt*.4;p[i*3+2]+=Math.sin(v[i*3]+t*.7)*dt*.5}});s.add(ff.obj);
  s.add(new T.AmbientLight("#9fd07a",.5));const pl=new T.PointLight("#d8a93a",25,20);pl.position.set(0,1,4);s.add(pl);
  return (t,dt)=>{ff.update(dt,t);ff.mat.opacity=.6+.4*Math.sin(t*3);
    const k=eio(E(0,TC,t));cam.position.set(Math.sin((1-k)*1.2)*12,.4+1.6*(1-k),8+4*(1-k));cam.lookAt(0,.4,0)}};

function bolt(from,to,seg,jit){const pts=[];for(let i=0;i<=seg;i++){const k=i/seg,p=from.clone().lerp(to,k);if(i&&i<seg){p.x+=(i%2?1:-1)*jit;p.z+=rnd(-jit,jit)*.3}pts.push(p)}return new T.CatmullRomCurve3(pts,false,"catmullrom",0)}

K.harry=(c)=>{const{s,cam}=c;s.add(sky("#1d1433","#06060e"));s.fog=new T.FogExp2("#0a0814",.04);
  const cm=new T.MeshStandardMaterial({color:"#f3e7c8",roughness:.7}),cds=[];
  for(let i=0;i<46;i++){const g=new T.Group(),h=rnd(.4,.9),m=new T.Mesh(new T.CylinderGeometry(.07,.07,h,10),cm);g.add(m);const f=glow("#ffb347",.5);f.position.y=h/2+.12;g.add(f);
    g.position.set(rnd(-10,10),rnd(1.5,6.5),rnd(-14,2));g.userData.ph=Math.random()*6;s.add(g);cds.push(g)}
  const bc=bolt(new T.Vector3(.8,9,-2),new T.Vector3(0,.4,0),9,.8),bm=new T.Mesh(new T.TubeGeometry(bc,90,.07,6,false),add(new T.MeshBasicMaterial({color:"#ffe08a"})));s.add(bm);
  const bm2=new T.Mesh(new T.TubeGeometry(bc,90,.22,6,false),add(new T.MeshBasicMaterial({color:"#ffcc33",opacity:.35})));s.add(bm2);
  const sn=new T.Group(),ball=new T.Mesh(new T.SphereGeometry(.13,20,12),new T.MeshStandardMaterial({color:"#ffcc33",metalness:.9,roughness:.25,emissive:"#5a4000"}));sn.add(ball);
  const wg=new T.PlaneGeometry(.5,.16),wmt=add(new T.MeshBasicMaterial({color:"#ffffff",opacity:.7,side:T.DoubleSide})),w1=new T.Mesh(wg,wmt),w2=new T.Mesh(wg,wmt);w1.position.x=.3;w2.position.x=-.3;sn.add(w1,w2,glow("#ffe08a",.8));s.add(sn);
  s.add(new T.AmbientLight("#8a7bb0",.6));const pl=new T.PointLight("#ffb347",30,25);pl.position.set(0,3,3);s.add(pl);
  return (t,dt)=>{cds.forEach(g=>{g.position.y+=Math.sin(t*1.2+g.userData.ph)*dt*.15});
    const b=E(1.9,2.25,t);bm.material.opacity=bm2.material.opacity=b>0?(1-E(2.4,2.9,t)):0;bm.geometry.setDrawRange(0,Math.floor(bm.geometry.index.count*eo(b)));bm2.geometry.setDrawRange(0,Math.floor(bm2.geometry.index.count*eo(b)));
    const a=t*3.2,r=t<2.6?4.5-E(0,2.6,t)*1.5:2.2;sn.position.set(Math.cos(a)*r,.6+Math.sin(t*2.1)*1.1,Math.sin(a)*r*.6+.6);w1.rotation.x=w2.rotation.x=Math.sin(t*60)*.9;
    const k=eio(E(0,TC,t));cam.position.set(Math.sin((1-k)*.7)*8,1.5+3*(1-k),8+8*(1-k));cam.lookAt(0,.6+2*(1-k),0)}};

K.gandalf=(c)=>{const{s,cam}=c;s.background=new T.Color("#040509");s.fog=new T.FogExp2("#08090e",.05);
  const rm=new T.MeshStandardMaterial({color:"#2a2c33",roughness:1,flatShading:true});
  for(let i=0;i<30;i++){const a=Math.PI+i/29*Math.PI,r=rnd(9,15),m=new T.Mesh(new T.IcosahedronGeometry(rnd(1.4,3.6),0),rm);m.position.set(Math.cos(a)*r*1.3,rnd(-3,6),Math.sin(a)*r-5);m.rotation.set(rnd(0,3),rnd(0,3),0);s.add(m)}
  const fl=new T.Mesh(new T.CircleGeometry(20,48),new T.MeshStandardMaterial({color:"#121318",roughness:.9}));fl.rotation.x=-Math.PI/2;fl.position.y=-2.6;s.add(fl);
  const fire=field(320,[10,-4,7,-16,2],["#ff6a1a","#ffb347","#ff3a1a"],.13,()=>[rnd(-.3,.3),rnd(.8,2.2),0]);s.add(fire.obj);const fo=new T.PointLight("#ff6a1a",30,30);fo.position.set(0,-2,-8);s.add(fo);
  const beam=new T.Mesh(new T.CylinderGeometry(.35,.35,22,24,1,true),add(new T.MeshBasicMaterial({color:"#ffffff",opacity:0,side:T.DoubleSide})));beam.position.set(0,11,0);s.add(beam);
  const beam2=new T.Mesh(new T.CylinderGeometry(1.2,1.2,22,24,1,true),add(new T.MeshBasicMaterial({color:"#cfe0ff",opacity:0,side:T.DoubleSide})));beam2.position.copy(beam.position);s.add(beam2);
  const wave=new T.Mesh(new T.RingGeometry(.9,1.2,96),add(new T.MeshBasicMaterial({color:"#e8f0ff",opacity:0,side:T.DoubleSide})));wave.rotation.x=-Math.PI/2;wave.position.y=-2.55;s.add(wave);
  const amb=new T.AmbientLight("#8090b0",.35);s.add(amb);
  return (t,dt)=>{fire.update(dt,t);fo.intensity=25+Math.random()*10;
    const b=E(1.6,2.3,t),bo=b*(1-E(2.9,3.6,t));beam.material.opacity=bo;beam2.material.opacity=bo*.25;beam.scale.x=beam.scale.z=.6+Math.sin(t*30)*.08;
    const w=E(2.55,3.6,t);wave.scale.setScalar(1+w*14);wave.material.opacity=w>0?(1-w)*.9:0;amb.intensity=.35+bo*1.2;
    const k=eio(E(0,TC,t));cam.position.set(Math.sin((1-k)*.6)*5,-1.2+1.8*k,8+7*(1-k));cam.lookAt(0,.4+3*(1-k)*(1-b),0)}};

K.mario=(c)=>{const{s,cam}=c;s.add(sky("#2f6bff","#9fd8ff"));s.fog=new T.Fog("#9fd8ff",18,70);
  const qt=cnv(128,128,(g)=>{g.fillStyle="#f5a623";g.fillRect(0,0,128,128);g.fillStyle="#ffd21f";g.fillRect(8,8,112,112);g.fillStyle="#c26a00";[[14,14],[106,14],[14,106],[106,106]].forEach(([x,y])=>g.fillRect(x,y,8,8));g.fillStyle="#fff";g.font="900 84px Sora, sans-serif";g.textAlign="center";g.textBaseline="middle";g.fillText("?",64,70)});
  const bm=new T.MeshStandardMaterial({map:qt,roughness:.6}),blocks=[];for(let i=0;i<9;i++){const m=new T.Mesh(new T.BoxGeometry(1.1,1.1,1.1),bm);m.position.set(rnd(-9,9),rnd(-1,5),rnd(-14,-3));m.userData.ph=Math.random()*6;s.add(m);blocks.push(m)}
  const cg=new T.CylinderGeometry(.35,.35,.07,24),cmt=new T.MeshStandardMaterial({color:"#ffd21f",metalness:.8,roughness:.25,emissive:"#5a4000"}),coins=[];
  for(let i=0;i<22;i++){const m=new T.Mesh(cg,cmt);m.rotation.x=Math.PI/2;m.position.set(rnd(-8,8),rnd(-2,5),rnd(-10,2));m.userData.ph=Math.random()*6;s.add(m);coins.push(m)}
  const cloud=new T.MeshStandardMaterial({color:"#ffffff",roughness:1});for(let i=0;i<8;i++){const g=new T.Group();for(let j=0;j<4;j++){const m=new T.Mesh(new T.SphereGeometry(rnd(.9,1.5),16,10),cloud);m.position.set(j*1.1-1.6,rnd(-.2,.3),0);g.add(m)}g.position.set(rnd(-20,20),rnd(4,10),rnd(-30,-15));s.add(g)}
  const sh=new T.Shape();for(let i=0;i<10;i++){const a=Math.PI/2+i*Math.PI/5,r=i%2?.55:1.25;i?sh.lineTo(Math.cos(a)*r,Math.sin(a)*r):sh.moveTo(Math.cos(a)*r,Math.sin(a)*r)}
  const star=new T.Mesh(new T.ExtrudeGeometry(sh,{depth:.35,bevelEnabled:true,bevelSize:.08,bevelThickness:.08,bevelSegments:2}),new T.MeshStandardMaterial({color:"#ffd21f",emissive:"#ffb000",emissiveIntensity:.7,metalness:.3,roughness:.35}));star.geometry.center();s.add(star);const sg=glow("#fff6a0",5,.8);star.add(sg);
  s.add(new T.AmbientLight("#ffffff",1.2));const dl=new T.DirectionalLight("#ffffff",2);dl.position.set(4,8,6);s.add(dl);
  return (t,dt)=>{blocks.forEach(m=>{m.position.y+=Math.sin(t*1.5+m.userData.ph)*dt*.3;m.rotation.y=t*.5+m.userData.ph});coins.forEach(m=>{m.rotation.z=t*4+m.userData.ph;m.position.y+=Math.sin(t*2+m.userData.ph)*dt*.25});
    const r=eo(E(1.2,2.3,t));star.position.set(0,-5+5.4*r,0);star.rotation.y=t*5;star.visible=t<2.62;star.scale.setScalar(.6+r*.6);
    const k=eio(E(0,TC,t));cam.position.set(Math.sin((1-k)*.9)*9,.8+2*(1-k),8+6*(1-k));cam.lookAt(0,.4,0)}};

K.ryu=(c)=>{const{s,cam}=c;s.add(sky("#120a24","#ff7a3d"));s.fog=new T.FogExp2("#3a1a2a",.035);
  const fl=new T.Mesh(new T.PlaneGeometry(60,60),new T.MeshStandardMaterial({color:"#3a2418",roughness:.8}));fl.rotation.x=-Math.PI/2;fl.position.y=-2.6;s.add(fl);
  const sun=glow("#ffb070",26,.7);sun.position.set(0,2,-40);s.add(sun);
  const pt=new Parts(220,{cols:["#ffb7d5","#ff8ab8","#ffd6e8"],size:.12,init:(p,v,i)=>{p.set([rnd(-12,12),rnd(-2,9),rnd(-14,5)],i*3);v.set([rnd(.3,.9),rnd(-.9,-.4),Math.random()*6],i*3)},
    step:(p,v,i,dt,t)=>{p[i*3]+=(v[i*3]+Math.sin(t*2+v[i*3+2])*.3)*dt;p[i*3+1]+=v[i*3+1]*dt;if(p[i*3+1]<-2.6){p[i*3+1]=9;p[i*3]=rnd(-12,12)}if(p[i*3]>12)p[i*3]=-12}});s.add(pt.obj);
  const hd=new T.Group(),core=new T.Mesh(new T.SphereGeometry(.45,24,16),new T.MeshBasicMaterial({color:"#ffffff"}));hd.add(core,glow("#4fa3ff",3.2),glow("#bfe0ff",1.6));
  const sw=new T.Mesh(new T.TorusGeometry(.75,.06,8,64),add(new T.MeshBasicMaterial({color:"#8fc6ff",opacity:.8})));hd.add(sw);const sw2=sw.clone();sw2.scale.setScalar(1.3);hd.add(sw2);s.add(hd);
  const hl=new T.PointLight("#4fa3ff",0,14);hd.add(hl);s.add(new T.AmbientLight("#ffb090",.7));
  let ex=null;
  return (t,dt)=>{pt.update(dt,t);const m=E(1.5,2.5,t);hd.position.set(-14+14*eo(m),.4,-6+6*eo(m));hd.visible=t>1.4&&t<2.6;sw.rotation.set(t*6,t*4,0);sw2.rotation.set(-t*5,t*3,0);hl.intensity=hd.visible?40:0;
    if(t>2.55&&!ex){ex=burstParts(260,["#4fa3ff","#bfe0ff","#ffffff"],new T.Vector3(0,.4,0),9,-1,.16);s.add(ex.obj)}if(ex){ex.update(dt,t);ex.mat.opacity=Math.max(0,1-(t-2.55)/1.6)}
    const k=eio(E(0,TC,t));cam.position.set(4*(1-k)+Math.sin(t*.2)*.4,.2+1.2*(1-k),8+5*(1-k));cam.lookAt(-2*(1-k),.4,0)}};

K.optimus=(c)=>{const{s,cam}=c;s.background=new T.Color("#02050c");s.fog=new T.FogExp2("#02050c",.035);
  const hm=new T.MeshStandardMaterial({color:"#3a4660",metalness:.9,roughness:.32,emissive:"#0b1a40",emissiveIntensity:.6}),hx=[];
  for(let z=0;z<9;z++)for(let i=0;i<12;i++){const a=i/12*Math.PI*2,m=new T.Mesh(new T.CylinderGeometry(.95,.95,.35,6),hm);m.position.set(Math.cos(a)*4.6,Math.sin(a)*4.6+.4,-z*3.2);m.rotation.set(Math.PI/2,0,a);m.userData.a=a;m.userData.z=z;s.add(m);hx.push(m)}
  const ec=new T.Mesh(new T.EdgesGeometry(new T.CylinderGeometry(.95,.95,.35,6)),add(new T.LineBasicMaterial({color:"#6fb0ff",opacity:.8})));
  hx.forEach(m=>m.add(ec.clone()));
  const core=glow("#6fb0ff",4,1);core.position.set(0,.4,-3);s.add(core);const core2=glow("#e8233a",2.5,.8);core.add(core2);
  const sp=field(240,[8,-4,6,-30,4],["#6fb0ff","#e8233a","#ffffff"],.07,()=>[0,0,rnd(2,6)]);s.add(sp.obj);
  s.add(new T.AmbientLight("#5070c0",.5));const b=new T.PointLight("#2f6bff",60,30),r=new T.PointLight("#e8233a",40,30);s.add(b,r);
  return (t,dt)=>{sp.update(dt,t);hx.forEach(m=>{const a=m.userData.a+t*(m.userData.z%2?.25:-.25),rr=4.6+Math.sin(t*2+m.userData.z)*.15;m.position.x=Math.cos(a)*rr;m.position.y=Math.sin(a)*rr+.4;m.rotation.z=a});
    b.position.set(Math.cos(t*1.5)*3,Math.sin(t*1.5)*3,-4);r.position.set(-Math.cos(t*1.2)*3,-Math.sin(t*1.2)*3,-8);core.scale.setScalar(3+E(1,2.5,t)*5);core.visible=t<2.7;
    const k=eio(E(0,TC,t));cam.position.set(0,.4,-22+30*k);cam.lookAt(0,.4,-30+30*Math.min(1,k*1.1));cam.rotation.z=(1-k)*t*.4}};

K.leo=(c)=>{const{s,cam}=c;s.add(sky("#0c2413","#020a04"));s.fog=new T.FogExp2("#041008",.045);
  const ci=city(36,9,22,"#9dffb0",-6);ci.children.forEach(m=>m.material.emissiveIntensity=.35);s.add(ci);
  const moon=glow("#e8fff0",12,.75);moon.position.set(-8,10,-30);s.add(moon);
  const oz=field(260,[12,-4,8,-14,5],["#3ecf5a","#8dff7a","#b4ffbf"],.11,()=>[rnd(-.15,.15),rnd(.3,1.1),0]);s.add(oz.obj);
  const smt=cnv(128,128,(g)=>{const q=g.createRadialGradient(64,64,0,64,64,64);q.addColorStop(0,"rgba(120,160,130,.5)");q.addColorStop(1,"rgba(120,160,130,0)");g.fillStyle=q;g.fillRect(0,0,128,128)});
  const sm=[];for(let i=0;i<16;i++){const m=new T.Sprite(new T.SpriteMaterial({map:smt,transparent:true,opacity:.16,depthWrite:false}));const sc=rnd(4,8);m.scale.set(sc,sc,1);m.position.set(rnd(-12,12),rnd(-3,0),rnd(-16,-5));s.add(m);sm.push(m)}
  const slt=cnv(256,32,(g,w,h)=>{const q=g.createLinearGradient(0,0,w,0);q.addColorStop(0,"rgba(255,255,255,0)");q.addColorStop(.7,"rgba(200,230,255,.9)");q.addColorStop(1,"rgba(255,255,255,1)");g.fillStyle=q;g.fillRect(0,h*.35,w,h*.3)});
  const sl=[];[[-.75,"#2f8bff"],[.75,"#8fc6ff"]].forEach(([r,cl])=>{const m=new T.Mesh(new T.PlaneGeometry(14,.6),add(new T.MeshBasicMaterial({map:slt,color:cl,opacity:0,side:T.DoubleSide})));m.rotation.z=r;m.position.set(0,.4,1.4);s.add(m);sl.push(m)});
  s.add(new T.AmbientLight("#7fbf8f",.5));const pl=new T.PointLight("#2f8bff",30,20);pl.position.set(0,1,4);s.add(pl);
  return (t,dt)=>{oz.update(dt,t);sm.forEach((m,i)=>{m.position.x+=Math.sin(t*.4+i)*dt*.3});
    sl.forEach((m,i)=>{const k=E(1.95+i*.18,2.2+i*.18,t);m.scale.x=Math.max(.001,eo(k));m.material.opacity=k>0?1-E(2.5+i*.1,3.1,t):0});
    const k=eio(E(0,TC,t));cam.position.set(Math.sin((1-k)*1.1)*10,1+4*(1-k),8+6*(1-k));cam.lookAt(0,.4+1.5*(1-k),0)}};

const MAP={"mv:Spider-Man (Peter Parker)":"spider","mv:Iron Man (Anthony 'Tony' Stark)":"iron","dc:Batman (Bruce Wayne)":"bat","dc:Superman (Clark Kent)":"sup","sw:Darth Vader":"vader","sw:Luke Skywalker":"luke",
  "di:Mickey Mouse":"mickey","di:Buzz l'Éclair":"buzz","dw:Shrek":"shrek","hp:Harry Potter":"harry","lo:Gandalf":"gandalf","jv:Mario":"mario","fg:Ryu":"ryu","tf:Optimus Prime":"optimus","tf:Leonardo":"leo"};

export const has=id=>!!MAP[id];

let REN=null;
function getRen(){if(REN&&!REN.getContext().isContextLost())return REN;try{REN&&REN.dispose()}catch(_){}
  const cv=document.createElement("canvas");REN=new T.WebGLRenderer({canvas:cv,antialias:true,powerPreference:"high-performance"});REN.toneMapping=T.ACESFilmicToneMapping;REN.toneMappingExposure=1.05;return REN}
export function run(o){
  const dpr=Math.min(1.5,window.devicePixelRatio||1),ren=getRen(),cv=ren.domElement;ren.setPixelRatio(dpr);
  const ph=o.host&&o.host.querySelector("canvas");if(ph)ph.replaceWith(cv);else if(o.host)o.host.prepend(cv);
  const s=new T.Scene(),cam=new T.PerspectiveCamera(45,1,.1,300);
  const fit=()=>{const W=innerWidth,H=innerHeight;ren.setSize(W,H,false);cam.aspect=W/H;cam.fov=W/H<.8?58:45;cam.updateProjectionMatrix()};fit();addEventListener("resize",fit);
  const ctx={s,cam,col:o.col,col2:o.col2,from:null};
  const upd=(K[MAP[o.id]]||K.mickey)(ctx);
  const card=makeCard(o,ren);card.visible=false;s.add(card);
  const from=ctx.from||new T.Vector3(0,.4,-34);const rest=new T.Vector3(0,.9,-.5);
  const shock=new T.Mesh(new T.RingGeometry(.9,1.05,96),add(new T.MeshBasicMaterial({color:o.col,opacity:0,side:T.DoubleSide})));s.add(shock);
  const flash=new T.Mesh(new T.PlaneGeometry(4,4),add(new T.MeshBasicMaterial({color:"#ffffff",opacity:0,blending:T.NormalBlending,fog:false,depthTest:false})));flash.position.z=-.5;flash.renderOrder=999;cam.add(flash);s.add(cam);
  const keyL=new T.PointLight("#ffffff",0,12);keyL.position.set(1.5,2,3.5);s.add(keyL);
  let burst=null,t0=performance.now(),last=t0,raf=0,stop=false,fCard=false,fText=false;
  const loop=now=>{if(stop)return;const t=(now-t0)/1000,dt=Math.min(.05,(now-last)/1000);last=now;
    try{upd(t,dt)}catch(_){}
    if(t>=TC){if(!card.visible){card.visible=true;if(!fCard){fCard=true;o.onCard&&o.onCard()}burst=burstParts(240,[o.col,o.col2,"#ffffff","#ffd34d"],rest,7,-1.2,.15);s.add(burst.obj)}
      const k=E(TC,TC+.95,t),e=eo(k);card.position.lerpVectors(from,rest,e);card.rotation.y=(1-e)*Math.PI*5+Math.sin(t*.8)*.16*e;card.rotation.x=Math.sin(t*.6)*.06*e+(1-e)*.5;card.rotation.z=(1-e)*-.4;
      card.position.y+=Math.sin(t*1.3)*.06*e;
      const sh=card.userData;sh.st.offset.x=-1+((t-TC-.6)*.55)%2;sh.sheen.material.opacity=E(TC+.7,TC+1,t)*.8;sh.halo.material.opacity=e*.55*(1-E(DUR-.6,DUR,t));sh.halo.scale.setScalar(8+Math.sin(t*2)*.6);
      keyL.intensity=e*30;
      const sk=E(TC+.85,TC+1.7,t);shock.position.copy(rest);shock.lookAt(cam.position);shock.scale.setScalar(1+sk*9);shock.material.opacity=sk>0?(1-sk)*.9:0;
      if(burst){burst.update(dt,t);burst.mat.opacity=Math.max(0,1-(t-TC)/1.8)}
      if(!fText&&t>TC+1){fText=true;o.onText&&o.onText()}}
    flash.material.opacity=t>TC-.05&&t<TC+.5?1-E(TC-.05,TC+.5,t):0;
    ren.render(s,cam);
    if(t>=DUR){o.onEnd&&o.onEnd();return}
    raf=requestAnimationFrame(loop)};
  raf=requestAnimationFrame(loop);
  return{stop(){stop=true;cancelAnimationFrame(raf);removeEventListener("resize",fit);
    s.traverse(x=>{if(x.geometry)x.geometry.dispose();const m=x.material;if(m)(Array.isArray(m)?m:[m]).forEach(mm=>{if(mm.map)mm.map.dispose();mm.dispose()})});
    ren.renderLists.dispose();cv.remove()}}}
