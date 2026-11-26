import * as THREE from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {GLTFExporter} from 'three/addons/exporters/GLTFExporter.js';
import {BUILDINGS,createBuilding,buildingDefinition} from './buildings.js';
import {createIsland} from './world.js';

const canvas=document.querySelector('#world');
const renderer=new THREE.WebGLRenderer({canvas,antialias:true,alpha:true});
renderer.setPixelRatio(Math.min(devicePixelRatio,2));renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;renderer.outputColorSpace=THREE.SRGBColorSpace;
const scene=new THREE.Scene();scene.background=new THREE.Color(0x9bb6bb);scene.fog=new THREE.Fog(0x9bb6bb,35,75);
const camera=new THREE.PerspectiveCamera(37,1,.1,120);camera.position.set(20,24,27);
const controls=new OrbitControls(camera,renderer.domElement);controls.target.set(0,0,0);controls.enableDamping=true;controls.dampingFactor=.06;controls.minDistance=17;controls.maxDistance=48;controls.maxPolarAngle=Math.PI*.43;controls.minPolarAngle=.2;controls.enablePan=true;
scene.add(new THREE.HemisphereLight(0xe8f4e5,0x526b4e,2.0));
const sun=new THREE.DirectionalLight(0xfff2d7,2.5);sun.position.set(-12,25,15);sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);sun.shadow.camera.left=-25;sun.shadow.camera.right=25;sun.shadow.camera.top=25;sun.shadow.camera.bottom=-25;scene.add(sun);

const mainCtx=createIsland(scene);
const {root,placed,surfaceMap,topSurfaceMeshes,treePositions}=mainCtx;
const islandGroups=[root];
const raycaster=new THREE.Raycaster(),pointer=new THREE.Vector2();
let selected=null,placing=null,ghostGroup=null,ghostValid=false,ghostPos=null,dragState=null;
const $=s=>document.querySelector(s),toast=$('#toast');
function notify(msg){toast.textContent=msg;toast.classList.add('show');clearTimeout(notify.t);notify.t=setTimeout(()=>toast.classList.remove('show'),2100);}
function resize(){const w=canvas.clientWidth,h=canvas.clientHeight;renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix();}
addEventListener('resize',resize);resize();
function screenRay(e){const r=canvas.getBoundingClientRect();pointer.set((e.clientX-r.left)/r.width*2-1,-((e.clientY-r.top)/r.height)*2+1);raycaster.setFromCamera(pointer,camera);}
function surfaceHit(e){screenRay(e);const hits=raycaster.intersectObjects(topSurfaceMeshes,false);return hits[0]||null;}
function modelHit(e){screenRay(e);const list=placed.map(p=>p.model);const hits=raycaster.intersectObjects(list,true);return hits[0]||null;}
function snapCell(v){return Math.round(v/.72);}
function openInspect(item){selected=item;$('#inspectPanel').classList.remove('hidden');$('#buildPanel').classList.add('hidden');const def=buildingDefinition(item.id);$('#inspectArt').textContent=def.icon;$('#inspectName').textContent=def.name;$('#inspectDesc').textContent=def.desc;$('#inspectLevel').textContent=item.level||1;$('#exportNote').textContent='Экспортируется только выбранная модель, без острова и интерфейса.';}
function closeInspect(){$('#inspectPanel').classList.add('hidden');selected=null;}

function makeGhost(){
  if(ghostGroup)root.remove(ghostGroup);
  ghostGroup=new THREE.Group();ghostGroup.name='Placement Ghost';
  const ghostMat=new THREE.MeshStandardMaterial({color:0x22c55e,transparent:true,opacity:.42,roughness:1,depthWrite:false});
  for(let x=-1;x<=1;x++)for(let z=-1;z<=1;z++){
    const cell=new THREE.Mesh(new THREE.BoxGeometry(.68,.10,.68),ghostMat);
    cell.position.set(x*.72,.07,z*.72);ghostGroup.add(cell);
  }
  const outline=new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(2.16,.12,2.16)),new THREE.LineBasicMaterial({color:0x22c55e,transparent:true,opacity:.95}));
  outline.position.y=.08;ghostGroup.add(outline);
  const model=createBuilding(placing.id);model.traverse(o=>{if(o.isMesh){o.material=o.material.clone();o.material.transparent=true;o.material.opacity=.34;o.material.depthWrite=false;}});model.position.y=.11;ghostGroup.add(model);
  ghostGroup.userData.footprintMat=ghostMat;ghostGroup.userData.outline=outline;ghostGroup.userData.model=model;
  root.add(ghostGroup);ghostGroup.visible=false;
}
function canPlaceAt(gx,gz){
  if(Math.abs(gx)>18||Math.abs(gz)>16)return {valid:false,reason:'Слишком близко к краю острова'};
  const centerH=surfaceMap.get(`${gx},${gz}`);
  if(centerH===undefined)return {valid:false,reason:'Здесь нет земли'};
  for(let dx=-1;dx<=1;dx++)for(let dz=-1;dz<=1;dz++){
    const h=surfaceMap.get(`${gx+dx},${gz+dz}`);
    if(h===undefined||Math.abs(h-centerH)>.001)return {valid:false,reason:'Нужна ровная площадка 3×3'};
  }
  const wx=gx*.72,wz=gz*.72;
  for(const tree of treePositions)if(Math.hypot(wx-tree.x,wz-tree.z)<=3.5)return {valid:false,reason:'Мешают деревья'};
  for(const item of placed){
    if(item===selected&&moveMode)continue;
    if(Math.abs(wx-item.x)<3.4&&Math.abs(wz-item.z)<3.4)return {valid:false,reason:'Место занято другим зданием'};
  }
  return {valid:true,y:centerH};
}
let moveMode=false;
function updateGhost(e){
  if(!placing||!ghostGroup)return;
  const hit=surfaceHit(e);
  if(!hit){ghostGroup.visible=false;ghostValid=false;return;}
  const local=root.worldToLocal(hit.point.clone());
  const gx=snapCell(local.x),gz=snapCell(local.z),check=canPlaceAt(gx,gz);
  ghostPos={x:gx*.72,y:check.y??.11,z:gz*.72,gx,gz};ghostValid=check.valid;
  ghostGroup.position.set(ghostPos.x,ghostPos.y,ghostPos.z);ghostGroup.visible=true;
  const color=ghostValid?0x22c55e:0xef4444;
  ghostGroup.userData.footprintMat.color.setHex(color);ghostGroup.userData.outline.material.color.setHex(color);
  ghostGroup.userData.model.traverse(o=>{if(o.isMesh)o.material.color.setHex(color);});
  ghostGroup.userData.reason=check.reason||'Можно построить';
}
function startPlacement(def){
  placing=def;moveMode=false;selected=null;closeInspect();$('#buildPanel').classList.remove('hidden');
  makeGhost();notify('Перемещай призрак по острову и нажми, чтобы построить.');
}
function confirmPlacement(){
  if(!placing||!ghostValid||!ghostPos)return;
  const def=placing;
  const goldNode=$('#gold');
  const currentGold=Number(goldNode.textContent.replace(/\\s/g,''));
  if(currentGold<def.cost){notify('Недостаточно золота для постройки');return;}
  if(def.cost>0)goldNode.textContent=(currentGold-def.cost).toLocaleString('ru-RU');
  const model=createBuilding(def.id);model.position.set(ghostPos.x,ghostPos.y,ghostPos.z);root.add(model);
  placed.push({id:def.id,model,level:1,x:ghostPos.x,y:ghostPos.y,z:ghostPos.z});
  root.remove(ghostGroup);ghostGroup=null;placing=null;ghostValid=false;ghostPos=null;
  $('#buildPanel').classList.add('hidden');notify(def.name+' построено');
}

function onPointerDown(e){if(e.button!==undefined&&e.button!==0)return;dragState={x:e.clientX,y:e.clientY,moved:false};}
function onPointerMove(e){
  if(dragState&&!dragState.moved&&(Math.abs(e.clientX-dragState.x)>4||Math.abs(e.clientY-dragState.y)>4))dragState.moved=true;
  if(placing)updateGhost(e);
}
function onPointerUp(e){
  if(!dragState)return;
  const wasTap=!dragState.moved;dragState=null;
  if(wasTap&&placing){updateGhost(e);if(ghostValid)confirmPlacement();else notify(ghostGroup?.userData.reason||'Здесь нельзя строить');}
  else if(wasTap&&!placing){const hit=modelHit(e);if(hit){const item=placed.find(p=>{let n=hit.object;while(n&&n!==root){if(n===p.model)return true;n=n.parent;}return false;});if(item)openInspect(item);}}
}
canvas.addEventListener('pointerdown',onPointerDown);
canvas.addEventListener('pointermove',onPointerMove);
canvas.addEventListener('pointerup',onPointerUp);
canvas.addEventListener('pointercancel',()=>{dragState=null;});

function renderBuildings(category='all'){
  const list=$('#buildingList');list.innerHTML='';
  BUILDINGS.filter(b=>category==='all'||b.category===category).forEach(def=>{
    const el=document.createElement('button');el.className='building-item';
    el.innerHTML='<span class="building-thumb">'+def.icon+'</span><span><b>'+def.name+'</b><small>'+(def.cost?def.cost+' ◆':'Уже доступно')+'</small></span>';
    el.addEventListener('click',()=>{list.querySelectorAll('.building-item').forEach(x=>x.classList.remove('selected'));el.classList.add('selected');startPlacement(def);});
    list.append(el);
  });
}
renderBuildings();
$('#buildModeBtn').addEventListener('click',()=>{$('#buildPanel').classList.toggle('hidden');closeInspect();if(!$('#buildPanel').classList.contains('hidden')){placing=null;if(ghostGroup){root.remove(ghostGroup);ghostGroup=null;}}else{placing=null;if(ghostGroup){root.remove(ghostGroup);ghostGroup=null;}}});
$('#closeBuild').addEventListener('click',()=>{$('#buildPanel').classList.add('hidden');placing=null;if(ghostGroup){root.remove(ghostGroup);ghostGroup=null;}});
$('#closeInspect').addEventListener('click',closeInspect);
document.querySelectorAll('[data-category]').forEach(btn=>btn.addEventListener('click',()=>{document.querySelectorAll('[data-category]').forEach(x=>x.classList.remove('selected'));btn.classList.add('selected');renderBuildings(btn.dataset.category);}));
$('#exportBtn').addEventListener('click',()=>{
  if(!selected)return;const exporter=new GLTFExporter(),item=selected,clone=item.model.clone(true);clone.position.set(0,0,0);clone.rotation.set(0,0,0);clone.scale.set(1,1,1);
  exporter.parse(clone,result=>{const blob=new Blob([result],{type:'model/gltf-binary'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=item.id+'_voxel.glb';a.click();URL.revokeObjectURL(url);notify('GLB-модель экспортирована');},err=>{console.error(err);notify('Не удалось экспортировать модель');},{binary:true});
});
$('#upgradeBtn').addEventListener('click',()=>{if(!selected)return;selected.level=(selected.level||1)+1;$('#inspectLevel').textContent=selected.level;notify('Уровень здания повышен до '+selected.level);});
$('#exploreBtn').addEventListener('click',()=>notify('Экспедиции и Башня появятся в следующем этапе прототипа.'));
$('#towerBtn').addEventListener('click',()=>notify('Башня: подготовка к исследованию скоро будет доступна.'));
$('#dailyBtn').addEventListener('click',()=>notify('Новые события скоро появятся.'));
$('#shopBtn').addEventListener('click',()=>notify('Магазин прототипа — следующий этап.'));
$('#inventoryBtn').addEventListener('click',()=>notify('Инвентарь прототипа — следующий этап.'));
document.querySelectorAll('[data-add]').forEach(b=>b.addEventListener('click',()=>notify('Пополнение валюты будет подключено позже.')));
document.querySelectorAll('.rail-btn').forEach(b=>b.addEventListener('click',()=>{document.querySelectorAll('.rail-btn').forEach(x=>x.classList.remove('active'));b.classList.add('active');if(b.dataset.tab!=='island')notify('Раздел «'+b.innerText.trim()+'» пока в разработке.');}));

const clock=new THREE.Clock();
function animate(){
  requestAnimationFrame(animate);const t=clock.getElapsedTime();
  islandGroups.forEach((grp,idx)=>{grp.position.y=grp.userData.baseY+Math.sin(t*1.1+grp.userData.phase)*.65;});
  controls.update();renderer.render(scene,camera);
}
animate();
