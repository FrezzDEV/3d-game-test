import * as THREE from 'three';

export const BUILDINGS = [
  {id:'keep',name:'Штаб-квартира',category:'special',icon:'♜',cost:0,desc:'Главное здание острова. Открывает новые уровни развития.',color:0xb98b55},
  {id:'farm',name:'Ферма',category:'economy',icon:'♧',cost:180,desc:'Производит еду для экспедиций и героев.',color:0x83b85d},
  {id:'sawmill',name:'Лесопилка',category:'economy',icon:'▥',cost:220,desc:'Перерабатывает древесину для строительства.',color:0xa87948},
  {id:'mine',name:'Шахта',category:'economy',icon:'◆',cost:260,desc:'Добывает камень и железную руду.',color:0x7e9293},
  {id:'barracks',name:'Казармы',category:'military',icon:'⚔',cost:300,desc:'Здесь размещаются и тренируются герои.',color:0x9a7654},
  {id:'forge',name:'Кузница',category:'economy',icon:'⚒',cost:340,desc:'Создание и улучшение экипировки.',color:0x8c7770},
  {id:'summon',name:'Алтарь призыва',category:'special',icon:'✧',cost:420,desc:'Призывай новых героев в свою коллекцию.',color:0x8d83bd},
  {id:'tower',name:'Башня',category:'special',icon:'♜',cost:500,desc:'Испытания, этажи и редкие награды.',color:0x87959a},
  {id:'storehouse',name:'Склад',category:'economy',icon:'▣',cost:240,desc:'Увеличивает вместимость ресурсов.',color:0xb28b58},
  {id:'training',name:'Тренировочная площадка',category:'military',icon:'⚑',cost:280,desc:'Повышает боевую подготовку героев.',color:0x6f9c62},
  {id:'clinic',name:'Лазарет',category:'military',icon:'✚',cost:260,desc:'Помогает героям восстановиться после боя.',color:0xc1b8a0},
  {id:'library',name:'Библиотека',category:'special',icon:'▤',cost:360,desc:'Открывает постоянные улучшения и исследования.',color:0x8a6b9f}
];

const MAT = (color, roughness=1) => new THREE.MeshStandardMaterial({color,roughness,flatShading:true});
function block(parent, material, x,y,z,w,h,d) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w,h,d),material);
  mesh.position.set(x,y,z); mesh.castShadow=true; mesh.receiveShadow=true; parent.add(mesh); return mesh;
}
function roof(parent, mat, x,y,z,w,d,levels=3) {
  for(let i=0;i<levels;i++) block(parent,mat,x,y+i*.18,z,Math.max(.2,w-i*.34),.2,Math.max(.2,d-i*.34));
}
function tree(parent,x,z,scale=1){
  const trunk=MAT(0x76513a),leaf1=MAT(0x43834b),leaf2=MAT(0x65a957);
  block(parent,trunk,x,.45*scale,z,.22*scale,.9*scale,.22*scale);
  block(parent,leaf1,x,.98*scale,z,.9*scale,.65*scale,.9*scale);
  block(parent,leaf2,x,.1+1.3*scale,z,.65*scale,.55*scale,.65*scale);
}
function makeBuilding(def){
  const g=new THREE.Group(); g.name=def.id; g.userData={buildingId:def.id,buildingName:def.name};
  const base=MAT(0xb9aa83),wall=MAT(def.color),dark=MAT(0x514b43),roofMat=MAT(0x5c7550),wood=MAT(0x805a3d),glass=MAT(0x9bc9c5);
  block(g,base,0,.12,0,2.2,.24,2.2);
  // Small voxel foundation stones
  for(let i=-1;i<=1;i+=2)for(let j=-1;j<=1;j+=2)block(g,dark,i*.82,.27,j*.82,.22,.28,.22);
  if(def.id==='farm'){
    block(g,wall,0,.75,0,1.35,.95,1.25); roof(g,roofMat,0,1.3,0,1.75,1.65,2);
    for(let i=-2;i<=2;i++)block(g,MAT(0x9cbd58),i*.24,.28,1.02,.12,.12,.12);
    block(g,wood,.52,.55,.64,.25,.55,.08);
  }else if(def.id==='mine'){
    block(g,dark,0,.65,0,1.5,.8,1.3); block(g,wall,0,1.08,-.15,1.7,.22,1.5);
    block(g,wood,0,.85,.7,.22,1.25,.22); block(g,wood,-.48,.85,.7,.18,1.25,.18); block(g,wood,.48,.85,.7,.18,1.25,.18);
    block(g,glass,0,.58,.68,.5,.3,.08);
  }else if(def.id==='sawmill'){
    block(g,wall,0,.7,0,1.5,.9,1.2); roof(g,wood,0,1.25,0,1.9,1.6,2);
    block(g,wood,.92,.42,.25,.38,.32,.38); block(g,wood,.92,.42,.72,.38,.32,.38);
    block(g,dark,-.72,.36,.75,.28,.3,.28);
  }else if(def.id==='tower'){
    block(g,wall,0,.95,0,1.2,1.65,1.2); block(g,dark,0,1.85,0,1.45,.2,1.45);
    roof(g,roofMat,0,2,0,1.35,1.35,3); block(g,glass,0,1.1,.62,.35,.5,.08);
    block(g,wood,0,2.72,0,.2,.55,.2);
  }else if(def.id==='keep'){
    block(g,wall,0,.85,0,1.65,1.2,1.55); block(g,dark,0,1.52,0,1.9,.18,1.8);
    for(const [x,z] of [[-.62,-.62],[.62,-.62],[-.62,.62],[.62,.62]]){
      block(g,wall,x,1.45,z,.48,1.3,.48); roof(g,roofMat,x,2.12,z,.58,.58,2);
    }
    block(g,wood,0,.62,.8,.48,.85,.12); block(g,glass,-.48,1,.79,.2,.32,.07); block(g,glass,.48,1,.79,.2,.32,.07);
  }else if(def.id==='summon'){
    block(g,wall,0,.55,0,1.35,.65,1.35); block(g,dark,0,1,0,1.55,.22,1.55);
    block(g,glass,0,1.42,0,.48,.65,.48); block(g,glass,0,1.88,0,.22,.35,.22);
    for(let i=0;i<4;i++){const a=i*Math.PI/2;block(g,roofMat,Math.cos(a)*.8,.75,Math.sin(a)*.8,.18,.9,.18);}
  }else if(def.id==='barracks'||def.id==='storehouse'||def.id==='clinic'||def.id==='library'||def.id==='training'){
    block(g,wall,0,.72,0,1.6,.95,1.35); roof(g,roofMat,0,1.28,0,1.95,1.65,3);
    block(g,wood,0,.5,.72,.38,.65,.1);
    block(g,glass,-.48,.82,.69,.25,.28,.08); block(g,glass,.48,.82,.69,.25,.28,.08);
    if(def.id==='training'){block(g,wood,.95,.7,-.4,.15,1.2,.15);block(g,wood,.95,1.22,-.4,.8,.12,.12);}
  }else{
    block(g,wall,0,.72,0,1.6,.95,1.35);roof(g,roofMat,0,1.28,0,1.9,1.65,2);
  }
  // Small chimney and readable door on all models
  block(g,dark,-.52,1.58,-.35,.2,.48,.2);
  block(g,wood,0,.48,.69,.32,.6,.09);
  g.userData.exportRoot=true;
  return g;
}
export function createBuilding(defOrId){
  const def=typeof defOrId==='string'?BUILDINGS.find(x=>x.id===defOrId):defOrId;
  if(!def) throw new Error('Unknown building: '+defOrId);
  return makeBuilding(def);
}
export function createTree(parent,x,z,scale=1){tree(parent,x,z,scale);}
export function buildingDefinition(id){return BUILDINGS.find(x=>x.id===id);}
