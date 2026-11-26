import * as THREE from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {GLTFExporter} from 'three/addons/exporters/GLTFExporter.js';
import {BUILDINGS,createBuilding,buildingDefinition} from './buildings.js';
import {createIsland} from './world.js';

const canvas=document.querySelector('#world');
const renderer=new THREE.WebGLRenderer({canvas,antialias:true,alpha:true});
renderer.setPixelRatio(Math.min(devicePixelRatio,2));
renderer.shadowMap.enabled=true;
renderer.shadowMap.type=THREE.PCFSoftShadowMap;
renderer.outputColorSpace=THREE.SRGBColorSpace;

const scene=new THREE.Scene();
scene.background=new THREE.Color(0x9bb6bb);
scene.fog=new THREE.Fog(0x9bb6bb,38,92);
const camera=new THREE.PerspectiveCamera(37,1,.1,150);
camera.position.set(20,24,27);

const controls=new OrbitControls(camera,renderer.domElement);
controls.target.set(0,0,0);
controls.enableDamping=true;
controls.dampingFactor=.06;
controls.minDistance=17;
controls.maxDistance=58;
controls.maxPolarAngle=Math.PI*.43;
controls.minPolarAngle=.2;
controls.enablePan=true;

scene.add(new THREE.HemisphereLight(0xe8f4e5,0x526b4e,2.0));
const sun=new THREE.DirectionalLight(0xfff2d7,2.5);
sun.position.set(-12,25,15);
sun.castShadow=true;
sun.shadow.mapSize.set(2048,2048);
sun.shadow.camera.left=-30;
sun.shadow.camera.right=30;
sun.shadow.camera.top=30;
sun.shadow.camera.bottom=-30;
scene.add(sun);

const mainCtx=createIsland(scene);
const {root,surfaceMap,topSurfaceMeshes,treePositions,obstaclePositions,islandGroups}=mainCtx;
const placed=[];
const raycaster=new THREE.Raycaster();
const pointer=new THREE.Vector2();
const $=s=>document.querySelector(s);
const toast=$('#toast');
const STORE_KEY='floating-isles-save-v2';
const DEFAULT_BUILDINGS=[
  {id:'keep',x:0,z:0,level:1},
  {id:'farm',x:-5.04,z:-5.04,level:1},
  {id:'sawmill',x:5.04,z:-5.04,level:1},
  {id:'mine',x:-5.04,z:5.04,level:1},
  {id:'barracks',x:5.04,z:5.04,level:1}
];

let selected=null;
let placing=null;
let ghostGroup=null;
let ghostValid=false;
let ghostPos=null;
let dragState=null;
let movingItem=null;
let moveMode=false;
const FOOTPRINT_HALF=1.12;
const BUILDING_GAP=.18;

function notify(msg){
  toast.textContent=msg;
  toast.classList.add('show');
  clearTimeout(notify.t);
  notify.t=setTimeout(()=>toast.classList.remove('show'),2200);
}
function formatNumber(value){
  return Math.max(0,Math.floor(Number(value)||0)).toLocaleString('ru-RU');
}
function readNumber(id){
  const node=$('#'+id);
  return Number((node?.textContent||'0').replace(/[^\d-]/g,''))||0;
}
function writeNumber(id,value){
  const node=$('#'+id);
  if(node)node.textContent=formatNumber(value);
}
function getResourceState(){
  return {gold:readNumber('gold'),food:readNumber('food'),gems:readNumber('gems'),wood:readNumber('wood'),stone:readNumber('stone')};
}
function readSave(){
  try{
    const raw=localStorage.getItem(STORE_KEY);
    if(!raw)return null;
    const data=JSON.parse(raw);
    if(!data||data.version!==2||!Array.isArray(data.buildings))return null;
    return data;
  }catch(error){
    console.warn('Не удалось прочитать сохранение:',error);
    return null;
  }
}
function persistGame(){
  try{
    const data={
      version:2,
      resources:getResourceState(),
      buildings:placed.map(item=>({
        id:item.id,
        x:item.x,
        y:item.y,
        z:item.z,
        level:item.level||1
      }))
    };
    localStorage.setItem(STORE_KEY,JSON.stringify(data));
  }catch(error){
    console.warn('Не удалось сохранить игру:',error);
    notify('Не удалось сохранить прогресс в этом браузере');
  }
}
function resize(){
  const w=canvas.clientWidth,h=canvas.clientHeight;
  renderer.setSize(w,h,false);
  camera.aspect=w/h;
  camera.updateProjectionMatrix();
}
addEventListener('resize',resize);
resize();

function screenRay(e){
  const r=canvas.getBoundingClientRect();
  pointer.set((e.clientX-r.left)/r.width*2-1,-((e.clientY-r.top)/r.height)*2+1);
  raycaster.setFromCamera(pointer,camera);
}
function surfaceHit(e){
  screenRay(e);
  const hits=raycaster.intersectObjects(topSurfaceMeshes,false);
  return hits[0]||null;
}
function modelHit(e){
  screenRay(e);
  const hits=raycaster.intersectObjects(placed.map(item=>item.model),true);
  return hits[0]||null;
}
function snapCell(value){return Math.round(value/.72);}
function findPlacedItem(hit){
  if(!hit)return null;
  for(let node=hit.object;node&&node!==root;node=node.parent){
    const item=placed.find(entry=>entry.model===node);
    if(item)return item;
  }
  return null;
}
function openInspect(item){
  selected=item;
  $('#inspectPanel').classList.remove('hidden');
  $('#buildPanel').classList.add('hidden');
  const def=buildingDefinition(item.id);
  $('#inspectArt').textContent=def.icon;
  $('#inspectName').textContent=def.name;
  $('#inspectDesc').textContent=def.desc;
  $('#inspectLevel').textContent=item.level||1;
  $('#exportNote').textContent='Экспортируется только выбранная модель, без острова и интерфейса.';
}
function closeInspect(){
  $('#inspectPanel').classList.add('hidden');
  selected=null;
}

function addPlacedBuilding(record){
  const def=buildingDefinition(record.id);
  if(!def)return null;
  const x=Number(record.x),z=Number(record.z);
  if(!Number.isFinite(x)||!Number.isFinite(z))return null;
  const y=Number.isFinite(Number(record.y))?Number(record.y):.11;
  const model=createBuilding(def.id);
  model.position.set(x,y,z);
  root.add(model);
  const item={id:def.id,model,level:Math.max(1,Math.floor(Number(record.level)||1)),x,y,z};
  placed.push(item);
  return item;
}
function loadGame(){
  const save=readSave();
  if(save){
    if(save.resources){
      Object.keys(save.resources).forEach(key=>{
        if(['gold','food','gems','wood','stone'].includes(key))writeNumber(key,save.resources[key]);
      });
    }
    save.buildings.forEach(record=>addPlacedBuilding(record));
    notify('Сохранение загружено');
  }else{
    DEFAULT_BUILDINGS.forEach(record=>addPlacedBuilding(record));
    persistGame();
  }
}
loadGame();

function makeGhost(def){
  if(ghostGroup)root.remove(ghostGroup);
  ghostGroup=new THREE.Group();
  ghostGroup.name='Placement Ghost';
  const ghostMat=new THREE.MeshStandardMaterial({color:0x22c55e,transparent:true,opacity:.42,roughness:1,depthWrite:false});
  for(let x=-1;x<=1;x++)for(let z=-1;z<=1;z++){
    const cell=new THREE.Mesh(new THREE.BoxGeometry(.68,.08,.68),ghostMat);
    cell.position.set(x*.72,.045,z*.72);
    ghostGroup.add(cell);
  }
  const outline=new THREE.LineSegments(
    new THREE.EdgesGeometry(new THREE.BoxGeometry(2.16,.12,2.16)),
    new THREE.LineBasicMaterial({color:0x22c55e,transparent:true,opacity:.95})
  );
  outline.position.y=.065;
  ghostGroup.add(outline);
  const model=createBuilding(def.id);
  model.traverse(object=>{
    if(object.isMesh){
      object.material=object.material.clone();
      object.material.transparent=true;
      object.material.opacity=.36;
      object.material.depthWrite=false;
    }
  });
  ghostGroup.add(model);
  ghostGroup.userData.footprintMat=ghostMat;
  ghostGroup.userData.outline=outline;
  ghostGroup.userData.model=model;
  root.add(ghostGroup);
  ghostGroup.visible=false;
}

function rectangleOverlapsBuilding(x,z,item){
  const required=FOOTPRINT_HALF+FOOTPRINT_HALF+BUILDING_GAP;
  return Math.abs(x-item.x)<required&&Math.abs(z-item.z)<required;
}
function rectangleOverlapsObstacle(x,z,obstacle){
  const nearestX=Math.max(-FOOTPRINT_HALF,Math.min(FOOTPRINT_HALF,obstacle.x-x));
  const nearestZ=Math.max(-FOOTPRINT_HALF,Math.min(FOOTPRINT_HALF,obstacle.z-z));
  return Math.hypot(obstacle.x-x-nearestX,obstacle.z-z-nearestZ)<(obstacle.radius||.7)+.08;
}
function canPlaceAt(gx,gz){
  if(Math.abs(gx)>18||Math.abs(gz)>16)return {valid:false,reason:'Слишком близко к краю острова'};
  const centerH=surfaceMap.get(gx+','+gz);
  if(centerH===undefined)return {valid:false,reason:'Здесь нет земли'};
  for(let dx=-1;dx<=1;dx++){
    for(let dz=-1;dz<=1;dz++){
      const height=surfaceMap.get((gx+dx)+','+(gz+dz));
      if(height===undefined||Math.abs(height-centerH)>.001)return {valid:false,reason:'Нужна ровная площадка 3×3'};
    }
  }

  const wx=gx*.72,wz=gz*.72;
  for(const tree of treePositions){
    const radius=tree.collisionRadius||1.65;
    if(Math.hypot(wx-tree.x,wz-tree.z)<FOOTPRINT_HALF+radius*.55)return {valid:false,reason:'Мешают деревья'};
  }
  for(const obstacle of obstaclePositions){
    if(rectangleOverlapsObstacle(wx,wz,obstacle))return {valid:false,reason:'Мешает камень или объект окружения'};
  }
  for(const item of placed){
    if(item===movingItem)continue;
    if(rectangleOverlapsBuilding(wx,wz,item))return {valid:false,reason:'Фундамент пересекается с другим зданием'};
  }
  return {valid:true,y:centerH};
}

function updateGhost(e){
  if(!placing||!ghostGroup)return;
  const hit=surfaceHit(e);
  if(!hit){
    ghostGroup.visible=false;
    ghostValid=false;
    ghostPos=null;
    return;
  }
  const local=root.worldToLocal(hit.point.clone());
  const gx=snapCell(local.x),gz=snapCell(local.z);
  const check=canPlaceAt(gx,gz);
  ghostPos={x:gx*.72,y:check.y??.11,z:gz*.72,gx,gz};
  ghostValid=check.valid;
  ghostGroup.position.set(ghostPos.x,ghostPos.y,ghostPos.z);
  ghostGroup.visible=true;
  const color=ghostValid?0x22c55e:0xef4444;
  ghostGroup.userData.footprintMat.color.setHex(color);
  ghostGroup.userData.outline.material.color.setHex(color);
  ghostGroup.userData.model.traverse(object=>{
    if(object.isMesh)object.material.color.setHex(color);
  });
  ghostGroup.userData.reason=check.reason||'Можно разместить';
}

function showPlacementBar(isMove){
  $('#placementBar').classList.remove('hidden');
  $('#placementMessage').textContent=isMove
    ?'Выбери новое место для здания. Само здание сохранит уровень.'
    :'Выбери свободное место на острове.';
}
function clearPlacementState(){
  if(ghostGroup){
    root.remove(ghostGroup);
    ghostGroup=null;
  }
  placing=null;
  ghostValid=false;
  ghostPos=null;
  moveMode=false;
  movingItem=null;
  controls.enabled=true;
  $('#placementBar').classList.add('hidden');
}
function cancelPlacement(showMessage=true){
  if(movingItem&&movingItem.model)movingItem.model.visible=true;
  clearPlacementState();
  selected=null;
  $('#inspectPanel').classList.add('hidden');
  if(showMessage)notify('Размещение отменено');
}
function beginPlacement(def,itemToMove=null){
  if(placing)cancelPlacement(false);
  placing=def;
  movingItem=itemToMove;
  moveMode=Boolean(itemToMove);
  selected=itemToMove;
  if(itemToMove)itemToMove.model.visible=false;
  controls.enabled=false;
  $('#inspectPanel').classList.add('hidden');
  if(moveMode)$('#buildPanel').classList.add('hidden');
  makeGhost(def);
  showPlacementBar(moveMode);
  notify(moveMode?'Режим перемещения здания':'Выбери место для нового здания');
}
function startPlacement(def){beginPlacement(def,null);}
function startMovingSelected(){
  if(!selected)return;
  const item=selected;
  beginPlacement(buildingDefinition(item.id),item);
}

function finishPlacement(){
  clearPlacementState();
  selected=null;
  $('#buildPanel').classList.add('hidden');
  $('#inspectPanel').classList.add('hidden');
}
function confirmPlacement(){
  if(!placing||!ghostValid||!ghostPos)return;
  if(moveMode&&movingItem){
    const item=movingItem;
    item.x=ghostPos.x;
    item.y=ghostPos.y;
    item.z=ghostPos.z;
    item.model.position.set(item.x,item.y,item.z);
    item.model.visible=true;
    persistGame();
    const name=buildingDefinition(item.id).name;
    finishPlacement();
    notify(name+' перемещено без потери уровня');
    return;
  }

  const def=placing;
  const currentGold=readNumber('gold');
  if(currentGold<def.cost){
    notify('Недостаточно золота для постройки');
    return;
  }
  if(def.cost>0)writeNumber('gold',currentGold-def.cost);
  addPlacedBuilding({id:def.id,x:ghostPos.x,y:ghostPos.y,z:ghostPos.z,level:1});
  persistGame();
  finishPlacement();
  notify(def.name+' построено');
}

function onPointerDown(event){
  if(event.button!==undefined&&event.button!==0)return;
  dragState={x:event.clientX,y:event.clientY,moved:false};
  if(canvas.setPointerCapture&&event.pointerId!==undefined){
    try{canvas.setPointerCapture(event.pointerId);}catch(_){}
  }
}
function onPointerMove(event){
  if(dragState&&!dragState.moved&&
    (Math.abs(event.clientX-dragState.x)>4||Math.abs(event.clientY-dragState.y)>4)){
    dragState.moved=true;
  }
  if(placing)updateGhost(event);
}
function onPointerUp(event){
  const state=dragState;
  dragState=null;
  if(placing){
    updateGhost(event);
    if(ghostValid)confirmPlacement();
    else notify(ghostGroup?.userData.reason||'Здесь нельзя размещать здание');
    return;
  }
  if(!state||state.moved)return;
  const item=findPlacedItem(modelHit(event));
  if(item)openInspect(item);
}
canvas.addEventListener('pointerdown',onPointerDown);
canvas.addEventListener('pointermove',onPointerMove);
canvas.addEventListener('pointerup',onPointerUp);
canvas.addEventListener('pointercancel',()=>{dragState=null;});

function renderBuildings(category='all'){
  const list=$('#buildingList');
  list.innerHTML='';
  BUILDINGS.filter(def=>category==='all'||def.category===category).forEach(def=>{
    const element=document.createElement('button');
    element.className='building-item';
    element.innerHTML='<span class="building-thumb">'+def.icon+'</span><span><b>'+def.name+'</b><small>'+(def.cost?def.cost+' ◆':'Уже доступно')+'</small></span>';
    element.addEventListener('click',()=>startPlacement(def));
    list.append(element);
  });
}
renderBuildings();

$('#buildModeBtn').addEventListener('click',()=>{
  if(placing)cancelPlacement(false);
  const panel=$('#buildPanel');
  panel.classList.toggle('hidden');
  closeInspect();
});
$('#closeBuild').addEventListener('click',()=>{
  if(placing)cancelPlacement(false);
  $('#buildPanel').classList.add('hidden');
});
$('#closeInspect').addEventListener('click',closeInspect);
$('#moveBtn').addEventListener('click',startMovingSelected);
$('#cancelPlacement').addEventListener('click',()=>cancelPlacement());

document.querySelectorAll('[data-category]').forEach(button=>{
  button.addEventListener('click',()=>{
    document.querySelectorAll('[data-category]').forEach(item=>item.classList.remove('selected'));
    button.classList.add('selected');
    renderBuildings(button.dataset.category);
  });
});

$('#exportBtn').addEventListener('click',()=>{
  if(!selected)return;
  const exporter=new GLTFExporter();
  const item=selected;
  const clone=item.model.clone(true);
  clone.position.set(0,0,0);
  clone.rotation.set(0,0,0);
  clone.scale.set(1,1,1);
  exporter.parse(clone,result=>{
    const blob=new Blob([result],{type:'model/gltf-binary'});
    const url=URL.createObjectURL(blob);
    const link=document.createElement('a');
    link.href=url;
    link.download=item.id+'_voxel.glb';
    link.click();
    URL.revokeObjectURL(url);
    notify('GLB-модель экспортирована');
  },error=>{
    console.error(error);
    notify('Не удалось экспортировать модель');
  },{binary:true});
});
$('#upgradeBtn').addEventListener('click',()=>{
  if(!selected)return;
  selected.level=(selected.level||1)+1;
  $('#inspectLevel').textContent=selected.level;
  persistGame();
  notify('Уровень здания повышен до '+selected.level);
});

$('#exploreBtn').addEventListener('click',()=>notify('Экспедиции и Башня появятся в следующем этапе прототипа.'));
$('#towerBtn').addEventListener('click',()=>notify('Башня: подготовка к исследованию скоро будет доступна.'));
$('#dailyBtn').addEventListener('click',()=>notify('Новые события скоро появятся.'));
$('#shopBtn').addEventListener('click',()=>notify('Магазин прототипа — следующий этап.'));
$('#inventoryBtn').addEventListener('click',()=>notify('Инвентарь прототипа — следующий этап.'));
document.querySelectorAll('[data-add]').forEach(button=>button.addEventListener('click',()=>notify('Пополнение валюты будет подключено позже.')));
document.querySelectorAll('.rail-btn').forEach(button=>{
  button.addEventListener('click',()=>{
    document.querySelectorAll('.rail-btn').forEach(item=>item.classList.remove('active'));
    button.classList.add('active');
    if(button.dataset.tab!=='island')notify('Раздел «'+button.innerText.trim()+'» пока в разработке.');
  });
});
addEventListener('keydown',event=>{
  if(event.key==='Escape'&&placing)cancelPlacement();
});
addEventListener('beforeunload',persistGame);

const clock=new THREE.Clock();
function animate(){
  requestAnimationFrame(animate);
  const time=clock.getElapsedTime();
  islandGroups.forEach(group=>{
    const baseY=group.userData.baseY||0;
    const phase=group.userData.phase||0;
    const amplitude=group.userData.amplitude??.25;
    const speed=group.userData.speed??1.1;
    group.position.y=baseY+Math.sin(time*speed+phase)*amplitude;
  });
  controls.update();
  renderer.render(scene,camera);
}
animate();
