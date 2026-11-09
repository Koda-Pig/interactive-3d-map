import { KitShape, random } from './shared.mjs';
import * as THREE from 'three';

function block(s,w,d,h,floors=2){
 s.box(w,h,d,0,h/2,0);s.box(w, .45,d,0,h,0,'roof-dark');
 for(let n=0;n<floors;n++){const y=(n+.6)*h/floors;s.box(w*.96,h/floors*.55,d*1.006,0,y,0,'glass');s.box(w*1.02,.35,d*1.025,0,(n+1)*h/floors,0,'wall-grey');}
 s.box(w*.16,h*.07,.18,0,h*.9,d*.515,'brand-teal');
}
function doors(s,w,d,h,count){for(let i=0;i<count;i++){const x=-w/2+(i+.5)*w/count;s.box(w/count*.77,h*.48,.25,x,h*.24,d/2+.15,'screen-dark');s.box(w/count*.8,.3,.5,x,h*.5,d/2+.3,'metal');}}
function stand(s,w,d,h,covered,end){
 const seatHeight=covered?h*.63:h;const steps=10;
 for(let n=0;n<steps;n++){const dz=d/steps,z=d/2-(n+.5)*dz,sh=(n+1)*seatHeight/steps;s.box(w,sh,dz,0,sh/2,z,'concrete');s.box(w,.18,dz*.54,0,sh+.1,z,'brand-navy');}
 if(covered){
  for(const x of [-w/2+.35,w/2-.35])s.beam([x,0,-d*.42],[x,h*.9,-d*.3],.22,'metal');
  const pts=[];for(let i=0;i<=12;i++){const z=-d/2+i*d/12;const y=h-1.4*Math.pow((z+d*.05)/(d*.55),2);pts.push([z,y]);}
  // Constant X cross-section gives matching roof edges on adjacent bays.
  const shape=new THREE.Shape(pts.map(([z,y])=>new THREE.Vector2(z,y)));for(let i=pts.length-1;i>=0;i--)shape.lineTo(pts[i][0],pts[i][1]-.45);shape.closePath();
  const roof=new THREE.ExtrudeGeometry(shape,{depth:w,bevelEnabled:false,curveSegments:1});roof.rotateY(-Math.PI/2);roof.translate(w/2,0,0);s.add(roof,'roof-dark');
  s.box(w,.2,d*.16,0,h*.87,d*.4,'canopy-white');
 }
 if(end)s.box(.35,h*.64,d,-w/2+.175,h*.32,0,'wall-white');
}
function vehicle(s,a){const {id,w,d,h}=a;
 if(id==='light-aircraft'){
  s.poly([[-w*.45,h*.3],[-w*.35,h*.6],[w*.27,h*.62],[w*.5,h*.4],[w*.27,h*.28]],d*.11,'wall-white');
  s.poly([[-w*.22,h*.42],[w*.16,h*.42],[w*.04,h*.5],[-w*.2,h*.5]],d,'wall-white');
  s.box(w*.15,h*.45,d*.05,-w*.36,h*.65,0,'brand-teal');s.box(w*.2,.12,d*.35,-w*.35,h*.45,0,'wall-grey');s.box(w*.2,h*.28,d*.09,w*.05,h*.62,0,'glass');
  for(const z of [-d*.1,d*.1])s.cylinder(.18,.2,0,.18,z,'roof-dark',5);return;
 }
 const race=id==='race-car-generic',bus=id==='shuttle-bus';
 s.box(w*.9,h*.35,d*.72,0,h*.36,0,race?'brand-teal':'wall-white');
 if(race){s.box(w*.18,h*.25,d*.45,-w*.05,h*.68,0,'screen-dark');s.poly([[-w*.05,h*.5],[w*.49,h*.2],[w*.49,h*.38]],d*.22,'brand-teal');s.box(w*.08,.1,d,-w*.43,h*.75,0,'roof-dark');s.box(w*.08,.1,d,w*.43,h*.18,0,'brand-teal');}
 else {s.box(w*(bus?.87:.52),h*.42,d*.67,-w*.05,h*.7,0,'glass');s.box(w*(bus?.9:.57),.12,d*.74,-w*.05,h*.94,0,'wall-grey');if(bus)s.box(w*.88,h*.12,d*.74,0,h*.34,0,'brand-teal');}
 // Wheels use five-sided cylinders with axes across Z.
 for(const x of [-w*.3,w*.3])for(const z of [-d*.4,d*.4])s.add(new THREE.CylinderGeometry(h*.22,h*.22,d*.18,5), 'roof-dark',x,h*.22,z,[Math.PI/2,0,0]);
}
function nature(s,a){const r=random(418+a.variant*731),{w,d,h,base}=a;
 if(base==='rock-outcrop'){for(let i=0;i<3;i++){const g=new THREE.IcosahedronGeometry(1,0);g.scale(w*(.24+r()*.12),h*(.35+r()*.2),d*.4);s.add(g,'stone',(i-1)*w*.23,h*.35,(r()-.5)*d*.2);}return;}
 if(base==='shrub-fynbos'){for(let i=0;i<3;i++)s.add(new THREE.IcosahedronGeometry(1,0).scale(w*.3,h*.44,d*.32),i%2?'foliage-dark':'foliage-dry',(i-1)*w*.23,h*.45,(r()-.5)*d*.3);return;}
 s.cylinder(w*.045,h*.7,0,h*.35,0,'trunk',5,w*.025);
 const pine=base==='tree-pine',gum=base==='tree-gum';
 for(let i=0;i<3;i++){const x=(i-1)*w*.23,z=(r()-.5)*d*.3,y=h*(pine?.77:gum?.58+i*.13:.65);s.beam([0,h*.4,0],[x,y,z],w*.02,'trunk',3);const g=new THREE.IcosahedronGeometry(1,0);g.scale(w*.34,h*(pine?.18:gum?.2:.28),d*.42);g.rotateY(r()*2);s.add(g,i===1?'foliage-dry':'foliage-dark',x,y,z);}
}
export function design(a){
 const s=new KitShape(),{id,w,d,h}=a;
 if(a.category==='nature'){nature(s,a);return s.finish(a);}
 if(['race-car-generic','car-parked','shuttle-bus','light-aircraft'].includes(id)){vehicle(s,{...a,w:a.d,d:a.w});for(const p of s.parts)p.g.rotateY(-Math.PI/2);return s.finish(a);}
 if(id.startsWith('grandstand')||id==='temporary-bleacher'){
  stand(s,w,d,h,id==='grandstand-bay-covered'||id==='grandstand-end-cap',id==='grandstand-end-cap');
 }else if(id==='pit-conference-building'){
  s.box(w*.96,h*.29,d*.8,0,h*.145,-d*.06,'wall-white');doors(s,w*.96,d*.68,h*.5,36);
  for(let i=0;i<3;i++){s.box(w*.96,h*.17,d*.79,0,h*(.38+i*.18),-d*.06,'glass');s.box(w,.5,d*.86,0,h*(.48+i*.18),-d*.06,'wall-white');}
  for(let x=-w*.47;x<=w*.48;x+=w/20)s.beam([x,0,d*.44],[x+w*.016,h*.88,d*.27],.65,'wall-grey');
  s.box(w,1.1,d*.98,0,h*.95,0,'roof-dark',[.055,0,0]);s.box(w,.4,d*.21,0,h*.91,d*.39,'canopy-white');
 }else if(id==='amphitheatre'){
  const rows=12,segments=24;for(let n=0;n<rows;n++){const inner=17+n*3,outer=inner+3,yt=1+n*1.12;const pts=[];for(let j=0;j<=segments;j++){const t=-.12+j*(Math.PI+.24)/segments;pts.push([Math.cos(t)*outer,Math.sin(t)*outer]);}for(let j=segments;j>=0;j--){const t=-.12+j*(Math.PI+.24)/segments;pts.push([Math.cos(t)*inner,Math.sin(t)*inner]);}
  const shape=new THREE.Shape(pts.map(p=>new THREE.Vector2(...p)));const g=new THREE.ExtrudeGeometry(shape,{depth:yt,bevelEnabled:false,curveSegments:1});g.rotateX(Math.PI/2);s.add(g,n%3===0?'brand-navy':'concrete',0,yt,0);}
  s.box(42,2,20,0,1,-24,'concrete');s.box(42,8,2,0,6,-32,'screen-dark');s.roof(48,25,3,15,'canopy-white',0,-23);for(const x of [-21,21])s.box(.7,15,.7,x,7.5,-19,'metal');
 }else if(id==='gateway-arch'){
  // Elliptical ring with straight piers and a clear opening.
  for(const x of [-w*.43,w*.43])s.box(w*.14,h*.53,d,x,h*.265,0,'stone');
  const shape=new THREE.Shape();for(let i=0;i<=16;i++){const t=i*Math.PI/16;const x=Math.cos(t)*w/2,y=h*.5+Math.sin(t)*h*.5;i?shape.lineTo(x,y):shape.moveTo(x,y);}for(let i=16;i>=0;i--){const t=i*Math.PI/16;shape.lineTo(Math.cos(t)*w*.36,h*.5+Math.sin(t)*h*.29);}shape.closePath();s.add(new THREE.ExtrudeGeometry(shape,{depth:d,bevelEnabled:false,curveSegments:1}),'wall-white',0,0,-d/2);s.box(w*.38,h*.16,d*1.01,0,h*.85,0,'brand-navy');
 }else if(id==='conference-foyer'){
  s.box(w,h*.88,d,0,h*.44,0,'glass');s.box(w,.35,d,0,h*.9,0,'roof-dark');s.box(w,.35,d,0,.175,0,'wall-grey');
  for(const x of [-w*.49,w*.49])s.box(.65,h,d,x,h/2,0,'wall-white');
  for(let x=-w*.45;x<w*.46;x+=w*.09)s.box(.18,h,d*1.01,x,h/2,0,'metal');
 }else if(id==='plaza-tower'){
  s.box(w,h,d,0,h/2,0,'stone');s.box(w*1.05,.8,d*1.05,0,h,0,'roof-dark');s.box(w*.65,h*.2,d*1.02,0,h*.74,0,'screen-dark');s.box(w*.28,h*.5,d*1.02,0,h*.28,0,'wall-grey');
 }else if(id==='lakeside-pavilion'||id==='promenade-segment'){
  const promenade=id==='promenade-segment';const deckY=promenade?h*.85:1.5;
  s.box(w,.35,d,0,deckY,0,'timber');for(const x of [-w*.44,0,w*.44])for(const z of [-d*.38,d*.38])s.box(.4,deckY,.4,x,deckY/2,z,'timber');
  if(!promenade){s.box(w*.86,h*.5,d*.59,0,h*.46,-d*.13,'glass');for(const x of [-w*.42,0,w*.42])s.box(.3,h*.6,.3,x,h*.47,d*.18,'timber');s.roof(w,d*.76,h*.18,h*.81,'roof-dark',0,-d*.1);}
  else {for(const z of [-d/2+.12,d/2-.12]){s.box(w,.1,.12,0,h,z,'metal');for(const x of [-w*.45,0,w*.45])s.box(.1,h-deckY,.1,x,(h+deckY)/2,z,'metal');}}
 }else if(id==='hospitality-marquee'){
  s.box(w,.2,d,0,.1,0,'concrete');for(const x of [-w*.45,0,w*.45]){s.cone(w*.27,h*.5,x,h*.75,0,'canopy-white',4);s.box(.2,h*.55,.2,x,h*.275,0,'metal');}for(const z of [-d*.46,d*.46])s.box(w,h*.45,.1,0,h*.225,z,'canopy-white');
 }else if(id==='start-finish-gantry'||id==='footbridge-over-track'){
  for(const x of [-w*.46,w*.46])s.box(w*.035,h,d*.6,x,h/2,0,'metal');
  s.box(w,h*.24,d,0,h*.83,0,id==='start-finish-gantry'?'brand-navy':'wall-grey');s.box(w*.74,h*.16,.15,0,h*.84,d/2+.1,'screen-dark');
  if(id==='footbridge-over-track')for(let x=-w*.4;x<w*.4;x+=w*.1)s.beam([x,h*.74,d/2],[x+w*.09,h*.94,d/2],.12,'metal');
 }else if(id==='big-screen'){
  for(const x of [-w*.25,w*.25])s.box(.6,h*.52,d*.7,x,h*.26,0,'metal');s.box(w,h*.57,d,0,h*.715,0,'roof-dark');s.box(w*.94,h*.51,.1,0,h*.72,d*.51,'screen-dark');
 }else if(id==='light-pole'){
  s.cylinder(.14,h*.96,0,h*.48,0,'metal',5,.1);s.box(w,.15,d,0,h*.98,0,'metal');s.box(w*.9,.1,d*.9,0,h*.96,0,'canopy-white');
 }else if(id==='race-fence-segment'){
  for(const x of [-w/2+.05,0,w/2-.05])s.box(.1,h,.12,x,h/2,0,'metal');for(let y=.2;y<h;y+=h/5)s.box(w,.035,.035,0,y,0,'metal');
  for(let x=-w/2+.5;x<w/2;x+=1.25)s.box(.025,h,.035,x,h/2,0,'metal');
 }else if(id==='barrier-segment'){
  s.poly([[-d/2,0],[d/2,0],[d*.23,h],[ -d*.23,h]],w,'concrete');
  // The profile's extrusion runs along Z; rotate it to tile along X.
  for(const p of s.parts)p.g.rotateY(Math.PI/2);
 }else if(id==='hoarding-blank'){
  s.box(w,h*.83,d,0,h*.58,0,'wall-white');for(const x of [-w*.4,w*.4])s.box(.1,h*.5,d*.8,x,h*.25,0,'metal');
 }else if(id==='food-stall'){
  s.box(w,h*.8,d,0,h*.4,0,'wall-white');s.box(w*.78,h*.28,.1,0,h*.53,d*.51,'screen-dark');s.box(w,.15,d*.25,0,h*.37,d*.43,'timber');s.roof(w,d,h*.13,h*.86,'brand-teal');
 }else if(id==='shuttle-stop'||id==='kalbaskraal-station'){
  s.box(w,.5,d,0,.25,0,'concrete');for(let x=-w*.42;x<=w*.43;x+=w/6)s.box(.25,h*.85,.25,x,h*.425,-d*.15,'metal');s.roof(w,d,h*.1,h*.89,'roof-dark');s.box(w*.65,.5,d*.15,0,1,-d*.15,'timber');
 }else if(id==='entrance-gate'){
  s.box(w,h*.2,d,0,h*.9,0,'brand-navy');for(let i=0;i<8;i++){const x=-w*.45+i*w*.9/7;s.box(.4,h*.8,d*.6,x,h*.4,0,'metal');s.box(w*.07,.15,.15,x,h*.4,d*.3,'metal');}s.box(w*.3,h*.12,.1,0,h*.91,d*.51,'screen-dark');
 }else if(id==='aerodrome-control-tower'){
  s.box(w*.48,h*.76,d*.48,0,h*.38,0,'wall-grey');s.box(w,h*.18,d,0,h*.85,0,'glass');s.box(w*1.08,.6,d*1.08,0,h,0,'roof-dark');
 }else if(id==='farm-silo-group'){
  for(const x of [-w/3,0,w/3]){s.cylinder(w*.15,h*.86,x,h*.43,0,'wall-grey',10);s.cone(w*.15,h*.14,x,h*.93,0,'metal',10);}s.box(w*.95,.4,1,0,h*.86,0,'metal');
 }else if(id==='farmhouse'){
  s.box(w,h*.65,d,0,h*.325,0,'wall-white');s.roof(w*1.03,d*1.03,h*.35,h*.65);s.box(w*.65,.2,d*.25,0,h*.5,d*.45,'roof-dark');doors(s,w*.8,d,h*.6,3);
 }else if(id==='table-mountain-silhouette'){
  const ridge=[[-.5,0],[-.48,.18],[-.4,.31],[-.34,.49],[-.3,.69],[-.27,.7],[-.23,.48],[-.2,.55],[-.17,.91],[-.13,.98],[.04,1],[.13,.97],[.19,.91],[.22,.49],[.26,.38],[.29,.62],[.32,.66],[.38,.33],[.46,.15],[.5,0]];s.poly(ridge.map(([x,y])=>[x*w,y*h]),d,'rock-distant');
 }else if(id==='townhouse-row'){
  for(let i=0;i<5;i++){const x=(i-2)*w/5; s.box(w/5*.98,h*.65,d*.9,x,h*.325,0,i%2?'wall-grey':'wall-white');s.roof(w/5,d,h*.35,h*.65,'roof-dark',x);s.box(w/5*.65,h*.25,.2,x,h*.4,d*.46,'glass');}
 }else if(id==='aerodrome-hangar'){
  s.box(w,h*.72,d,0,h*.36,0,'wall-grey');s.roof(w*1.02,d*1.02,h*.28,h*.72);doors(s,w*.95,d,h*1.15,2);
 }else {
  const floors=id==='hotel-tower'?10:id==='hotel-low'?4:id==='residential-trackside'?5:id==='research-block'?4:2;
  if(id==='conference-hall'||id==='automotive-hub'){
   s.box(w,h*.76,d,0,h*.38,0,'wall-white');s.roof(w,d,h*.24,h*.76);doors(s,w*.95,d,h*.8,id==='automotive-hub'?10:4);s.box(w*.94,h*.13,d*1.003,0,h*.62,0,'glass');
  }else {block(s,w,d,h,floors);}
  if(id==='residential-trackside'||id.startsWith('hotel')){
   for(let n=0;n<floors;n++){const y=(n+1)*h/floors-.4;s.box(w,.3,d*.2,0,y,d*.52,'wall-white');s.box(w,.6,.15,0,y+.4,d*.61,'metal');for(let x=-w*.45;x<w*.5;x+=w/10)s.box(.18,h/floors,.18,x,y-h/floors*.5,d*.61,'wall-grey');}
  }
  if(id==='retail-block'){for(let i=0;i<6;i++){const x=(i-2.5)*w/6;s.box(w*.13,h*.42,.15,x,h*.25,d*.51,'glass');s.box(w*.15,.15,d*.15,x,h*.52,d*.52,'canopy-white');}}
  if(id==='karting-clubhouse')s.roof(w,d,h*.18,h,'roof-dark');
  if(id==='driving-academy'){s.box(w*.35,.3,d*.6,w*.33,h*1.04,0,'brand-teal',[0,0,.09]);}
  if(id==='media-centre'||id==='driving-academy'||id==='karting-clubhouse'||id==='aerodrome-terminal')s.box(w*1.05,.3,d*.27,0,h*.58,d*.43,'canopy-white');
 }
 return s.finish(a);
}
