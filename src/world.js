import * as THREE from 'three';
import {createBuilding,createTree} from './buildings.js';

const mat=(c)=>new THREE.MeshStandardMaterial({color:c,roughness:1,flatShading:true});
export function createIsland(scene){
  const root=new THREE.Group();root.name='Main Floating Island';
  root.userData.baseY=0;root.userData.phase=0.4;scene.add(root);
  const grass=mat(0x70b95d),grass2=mat(0x80c96a),soil=mat(0x8a6948),rock=mat(0x6e7771),sand=mat(0xcdb879),path=mat(0xd6c28d);
  const batches=new Map();
  function voxel(material,x,y,z,w,h,d){
    if(!batches.has(material))batches.set(material,[]);
    batches.get(material).push({x,y,z,w,h,d});
  }
  const surfaceMap=new Map(),topCells=[];
  const size=18;
  for(let x=-size;x<=size;x++)for(let z=-size;z<=size;z++){
    const dist=Math.sqrt(x*x+z*z);
    if(dist>17.2||(Math.abs(x)>16.5&&Math.abs(z)>16.5))continue;
    const edge=dist>15.2, y=edge?-.03:0, topY=y+.11;
    voxel(edge?grass2:grass,x*.72,y,z*.72,.74,.22,.74);
    surfaceMap.set(`${x},${z}`,topY);
    topCells.push({x:x*.72,y:topY,z:z*.72});
    if(edge&&(x+z)%3===0)voxel(soil,x*.72,-.22,z*.72,.74,.24,.74);
  }
  for(let layer=0;layer<7;layer++){
    const radius=12.5-layer*1.45;
    for(let x=-14;x<=14;x++)for(let z=-14;z<=14;z++){
      if(Math.sqrt(x*x+z*z)>radius||(x*7+z*3+layer)%4===0)continue;
      voxel(layer%2?rock:soil,x*.72,-.38-layer*.28,z*.72,.74,.34,.74);
    }
  }
  for(let i=0;i<34;i++){const a=i/34*Math.PI*2;voxel(rock,Math.cos(a)*12.1*.72,-.08,Math.sin(a)*12.1*.72,.48,.38,.48);}
  voxel(path,0,.14,0,4.1,.12,4.1);
  voxel(sand,0,.13,-5.2,3.6,.12,3.2);voxel(sand,0,.13,5.2,3.6,.12,3.2);
  voxel(sand,-5.3,.13,0,3.2,.12,3.6);voxel(sand,5.3,.13,0,3.2,.12,3.6);
  voxel(path,0,.13,-2.5,1.05,.13,3.1);voxel(path,0,.13,2.5,1.05,.13,3.1);
  voxel(path,-2.5,.13,0,3.1,.13,1.05);voxel(path,2.5,.13,0,3.1,.13,1.05);
  const cube=new THREE.BoxGeometry(1,1,1),dummy=new THREE.Object3D(),topSurfaceMeshes=[];
  for(const [material,items] of batches){
    const mesh=new THREE.InstancedMesh(cube,material,items.length);mesh.castShadow=true;mesh.receiveShadow=true;
    items.forEach((v,i)=>{dummy.position.set(v.x,v.y,v.z);dummy.scale.set(v.w,v.h,v.d);dummy.updateMatrix();mesh.setMatrixAt(i,dummy.matrix);});
    mesh.instanceMatrix.needsUpdate=true;root.add(mesh);
    if(material===grass||material===grass2){
      const tops=new THREE.InstancedMesh(new THREE.BoxGeometry(.74,.22,.74),material,topCells.length);
      topCells.forEach((v,i)=>{dummy.position.set(v.x,v.y-.11,v.z);dummy.updateMatrix();tops.setMatrixAt(i,dummy.matrix);});
      tops.instanceMatrix.needsUpdate=true;tops.visible=false;root.add(tops);topSurfaceMeshes.push(tops);
    }
  }
  const trees=[[-10,-5],[-11,3],[-8,9],[9,-9],[11,-3],[10,7],[-4,12],[4,-12],[-13,0],[13,2]];
  const treePositions=trees.map(([x,z],i)=>({x:x*.72,z:z*.72,scale:i%3===0?1.15:.9}));
  treePositions.forEach(t=>createTree(root,t.x,t.z,t.scale));
  const stones=mat(0x6e7771);
  for(const [x,z] of [[-8,-9],[8,-10],[-12,6],[12,8],[-5,13],[5,-13]]){
    const m=new THREE.Mesh(new THREE.BoxGeometry(.7,.48,.65),stones);m.position.set(x*.72,.22,z*.72);m.castShadow=true;root.add(m);
  }
  const initial=[['keep',0,0],['farm',-5.2,-5.2],['sawmill',5.2,-5.2],['mine',-5.2,5.2],['barracks',5.2,5.2]];
  const placed=[];
  for(const [id,x,z] of initial){const model=createBuilding(id);model.position.set(x,.11,z);root.add(model);placed.push({id,model,level:1,x,y:.11,z});}
  return {root,placed,surfaceMap,topSurfaceMeshes,treePositions};
}
