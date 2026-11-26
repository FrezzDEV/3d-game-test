import * as THREE from 'three';
import {createBuilding,createTree,BUILDINGS} from './buildings.js';

const mat=(c)=>new THREE.MeshStandardMaterial({color:c,roughness:1,flatShading:true});
function box(parent,m,x,y,z,w,h,d){const o=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),m);o.position.set(x,y,z);o.castShadow=true;o.receiveShadow=true;parent.add(o);return o;}
export function createIsland(scene){
  const root=new THREE.Group();root.name='Floating Island';scene.add(root);
  const grass=mat(0x70b95d),grass2=mat(0x80c96a),soil=mat(0x8a6948),rock=mat(0x6e7771),sand=mat(0xcdb879),path=mat(0xd6c28d);
  // Grid-based rounded island: small blocks leave enough space for 50+ compact buildings.
  const size=18;
  for(let x=-size;x<=size;x++)for(let z=-size;z<=size;z++){
    const d=Math.sqrt(x*x+z*z);
    if(d>17.2 || (Math.abs(x)>16.5&&Math.abs(z)>16.5))continue;
    const edge=d>15.2, y=edge?-.03:0;
    box(root,edge?grass2:grass,x*.72,y,z*.72,.74,.22,.74);
    if(edge && ((x+z)%3===0)) box(root,soil,x*.72,-.22,z*.72,.74,.24,.74);
  }
  // Floating rocky underside, layered and tapered.
  for(let layer=0;layer<7;layer++){
    const radius=12.5-layer*1.45;
    for(let x=-14;x<=14;x++)for(let z=-14;z<=14;z++){
      if(Math.sqrt(x*x+z*z)>radius)continue;
      if((x*7+z*3+layer)%4===0)continue;
      box(root,layer%2?rock:soil,x*.72,-.38-layer*.28,z*.72,.74,.34,.74);
    }
  }
  // Decorative outer rim and scattered rocks.
  for(let i=0;i<34;i++){const a=i/34*Math.PI*2,r=12.1;box(root,rock,Math.cos(a)*r*.72,-.08,Math.sin(a)*r*.72,.48,.38,.48);}
  // Cross paths, central plaza and small empty build pads.
  box(root,path,0,.14,0,4.1,.12,4.1);
  box(root,sand,0,.13,-5.2,3.6,.12,3.2);box(root,sand,0,.13,5.2,3.6,.12,3.2);
  box(root,sand,-5.3,.13,0,3.2,.12,3.6);box(root,sand,5.3,.13,0,3.2,.12,3.6);
  box(root,path,0,.13,-2.5,1.05,.13,3.1);box(root,path,0,.13,2.5,1.05,.13,3.1);
  box(root,path,-2.5,.13,0,3.1,.13,1.05);box(root,path,2.5,.13,0,3.1,.13,1.05);
  // Trees and stones around the perimeter, never blocking the main building grid.
  const trees=[[-10,-5],[-11,3],[-8,9],[9,-9],[11,-3],[10,7],[-4,12],[4,-12],[-13,0],[13,2]];
  trees.forEach(([x,z],i)=>createTree(root,x*.72,z*.72,i%3===0?1.15:.9));
  for(const [x,z] of [[-8,-9],[8,-10],[-12,6],[12,8],[-5,13],[5,-13]])box(root,rock,x*.72,.22,z*.72,.7,.48,.65);
  // Initial buildings positioned compactly around the plaza.
  const initial=[['keep',0,0],['farm',-5.2,-5.2],['sawmill',5.2,-5.2],['mine',-5.2,5.2],['barracks',5.2,5.2]];
  const placed=[];
  for(const [id,x,z] of initial){const model=createBuilding(id);model.position.set(x,.22,z);root.add(model);placed.push({id,model,level:1});}
  // Invisible logical ground plane for raycasting/build placement.
  const ground=new THREE.Mesh(new THREE.PlaneGeometry(30,30),new THREE.MeshBasicMaterial({visible:false,side:THREE.DoubleSide}));
  ground.rotation.x=-Math.PI/2;ground.position.y=.19;ground.name='build-ground';root.add(ground);
  return {root,placed,ground};
}
