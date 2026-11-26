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
const {root,placed,ground}=createIsland(scene);
const raycaster=new THREE.Raycaster(),pointer=new THREE.Vector2();let selected=null,placing=null,dragging=null,dragOffset=new THREE.Vector3(),pointerDown=null;
const $=s=>document.querySelector(s),toast=$('#toast');
function notify(msg){toast.textContent=msg;toast.classList.add('show');clearTimeout(notify.t);notify.t=setTimeout(()=>toast.classList.remove('show'),2100);}
function resize(){const w=canvas.clientWidth,h=canvas.clientHeight;renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix();}
addEventListener('resize',resize);resize();
function screenRay(e){const r=canvas.getBoundingClientRect();pointer.set((e.clientX-r.left)/r.width*2-1,-((e.clientY-r.top)/r.height)*2+1);raycaster.setFromCamera(pointer,camera);}
function groundPoint(e){screenRay(e);const hits=raycaster.intersectObject(ground);return hits[0]?.point||null;}
function modelHit(e){screenRay(e);const list=placed.flatMap(p=>p.model.children);const hits=raycaster.intersectObjects(list,true);return hits.find(h=>h.object.parent?.parent===root||h.object.parent?.parent?.parent===root||h.object.parent?.parent?.parent?.parent===root);}
function snap(v){return Math.round(v/.72)*.72;}
function openInspect(item){selected=item;$('#inspectPanel').classList.remove('hidden');$('#buildPanel').classList.add('hidden');const def=buildingDefinition(item.id);$('#inspectArt').textContent=def.icon;$('#inspectName').textContent=def.name;$('#inspectDesc').textContent=def.desc;$('#inspectLevel').textContent=item.level||1;$('#exportNote').textContent='Экспортируется только выбранная модель, без острова и интерфейса.';}
function closeInspect(){$('#inspectPanel').classList.add('hidden');selected=null;}
canvas.addEventListener('pointerdown',e=>{if(e.button!==0)return;pointerDown={x:e.clientX,y:e.clientY};if(placing){const p=groundPoint(e);if(p){const model=createBuilding(placing.id);model.position.set(snap(p.x),.22,snap(p.z));root.add(model);placed.push({id:placing.id,model,level:1});notify(placing.name+' построено');placing=null;$('#buildPanel').classList.add('hidden');$('#buildModeBtn').classList.remove('active');}return;}const hit=modelHit(e);if(hit){const item=placed.find(p=>p.model===hit.object||p.model===hit.object.parent||p.model.children.includes(hit.object));if(item){dragging=item;const p=groundPoint(e);if(p)dragOffset.copy(item.model.position).sub(p);controls.enabled=false;openInspect(item);}}});
canvas.addEventListener('pointermove',e=>{if(!dragging)return;const p=groundPoint(e);if(p){dragging.model.position.x=snap(p.x+dragOffset.x);dragging.model.position.z=snap(p.z+dragOffset.z);}});
function stopDrag(){if(dragging){dragging=null;controls.enabled=true;}}
canvas.addEventListener('pointerup',stopDrag);canvas.addEventListener('pointercancel',stopDrag);
canvas.addEventListener('click',e=>{if(pointerDown&&Math.hypot(e.clientX-pointerDown.x,e.clientY-pointerDown.y)>5)return;if(placing)return;const hit=modelHit(e);if(hit){for(const item of placed){let node=hit.object;while(node&&node!==root){if(node===item.model){openInspect(item);return;}node=node.parent;}}}});
function renderBuildings(category='all'){const list=$('#buildingList');list.innerHTML='';BUILDINGS.filter(b=>category==='all'||b.category===category).forEach(def=>{const el=document.createElement('button');el.className='building-item';el.innerHTML='<span class="building-thumb">'+def.icon+'</span><span><b>'+def.name+'</b><small>'+(def.cost?def.cost+' ◆':'Уже доступно')+'</small></span>';el.addEventListener('click',()=>{placing=def;list.querySelectorAll('.building-item').forEach(x=>x.classList.remove('selected'));el.classList.add('selected');notify('Выбрано: '+def.name+'. Нажми на острове, чтобы разместить.');});list.append(el);});}
renderBuildings();
$('#buildModeBtn').addEventListener('click',()=>{$('#buildPanel').classList.toggle('hidden');closeInspect();placing=null;});
$('#closeBuild').addEventListener('click',()=>{$('#buildPanel').classList.add('hidden');placing=null;});
$('#closeInspect').addEventListener('click',closeInspect);
document.querySelectorAll('[data-category]').forEach(btn=>btn.addEventListener('click',()=>{document.querySelectorAll('[data-category]').forEach(x=>x.classList.remove('selected'));btn.classList.add('selected');renderBuildings(btn.dataset.category);}));
$('#exportBtn').addEventListener('click',()=>{if(!selected)return;const exporter=new GLTFExporter();const clone=selected.model.clone(true);clone.position.set(0,0,0);clone.rotation.set(0,0,0);clone.scale.set(1,1,1);exporter.parse(clone,result=>{const blob=new Blob([result],{type:'model/gltf-binary'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=selected.id+'_voxel.glb';a.click();URL.revokeObjectURL(url);notify('GLB-модель экспортирована');},err=>{console.error(err);notify('Не удалось экспортировать модель');},{binary:true});});
$('#upgradeBtn').addEventListener('click',()=>{if(!selected)return;selected.level=(selected.level||1)+1;$('#inspectLevel').textContent=selected.level;notify('Уровень здания повышен до '+selected.level);});
$('#exploreBtn').addEventListener('click',()=>notify('Экспедиции и Башня появятся в следующем этапе прототипа.'));
$('#towerBtn').addEventListener('click',()=>notify('Башня: подготовка к исследованию скоро будет доступна.'));
$('#dailyBtn').addEventListener('click',()=>notify('Новые события скоро появятся.'));
$('#shopBtn').addEventListener('click',()=>notify('Магазин прототипа — следующий этап.'));
$('#inventoryBtn').addEventListener('click',()=>notify('Инвентарь прототипа — следующий этап.'));
document.querySelectorAll('[data-add]').forEach(b=>b.addEventListener('click',()=>notify('Пополнение валюты будет подключено позже.')));
document.querySelectorAll('.rail-btn').forEach(b=>b.addEventListener('click',()=>{document.querySelectorAll('.rail-btn').forEach(x=>x.classList.remove('active'));b.classList.add('active');if(b.dataset.tab!=='island')notify('Раздел «'+b.innerText.trim()+'» пока в разработке.');}));
function animate(){requestAnimationFrame(animate);controls.update();renderer.render(scene,camera);}animate();
