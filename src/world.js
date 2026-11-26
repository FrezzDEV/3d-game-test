import * as THREE from 'three';
import {createTree} from './buildings.js';

const mat=color=>new THREE.MeshStandardMaterial({color,roughness:1,flatShading:true});

function addVoxelIsland(scene,options){
  const group=new THREE.Group();
  group.name=options.name;
  group.position.set(options.x,options.baseY,options.z);
  group.userData={
    baseY:options.baseY,
    phase:options.phase,
    amplitude:options.amplitude,
    speed:options.speed
  };
  const grass=mat(options.grass||0x70b95d);
  const grassLight=mat(options.grassLight||0x80c96a);
  const soil=mat(0x8a6948);
  const rock=mat(0x6e7771);
  const cube=new THREE.BoxGeometry(.74,.74,.74);
  const cells=[];
  const size=options.size||4;
  for(let x=-size;x<=size;x++){
    for(let z=-size;z<=size;z++){
      const distance=Math.sqrt(x*x+z*z);
      if(distance>size+.35)continue;
      cells.push({x:x*.72,y:0,z:z*.72,material:distance>size-.8?grassLight:grass});
    }
  }
  for(let layer=0;layer<3;layer++){
    const radius=size-layer*1.35;
    for(let x=-size;x<=size;x++){
      for(let z=-size;z<=size;z++){
        if(Math.sqrt(x*x+z*z)>radius)continue;
        if((x*5+z*3+layer)%4===0)continue;
        cells.push({x:x*.72,y:-.45-layer*.42,z:z*.72,material:layer===2?rock:soil});
      }
    }
  }
  const byMaterial=new Map();
  cells.forEach(cell=>{
    if(!byMaterial.has(cell.material))byMaterial.set(cell.material,[]);
    byMaterial.get(cell.material).push(cell);
  });
  const dummy=new THREE.Object3D();
  byMaterial.forEach((items,material)=>{
    const mesh=new THREE.InstancedMesh(cube,material,items.length);
    mesh.castShadow=true;
    mesh.receiveShadow=true;
    items.forEach((cell,index)=>{
      dummy.position.set(cell.x,cell.y,cell.z);
      dummy.updateMatrix();
      mesh.setMatrixAt(index,dummy.matrix);
    });
    mesh.instanceMatrix.needsUpdate=true;
    group.add(mesh);
  });
  if(options.trees){
    options.trees.forEach(tree=>createTree(group,tree.x*.72,.44,tree.scale||.75));
  }
  scene.add(group);
  return group;
}

export function createIsland(scene){
  const root=new THREE.Group();
  root.name='Main Floating Island';
  root.userData={baseY:0,phase:.4,amplitude:.28,speed:1.1};
  scene.add(root);

  const grass=mat(0x70b95d);
  const grass2=mat(0x80c96a);
  const soil=mat(0x8a6948);
  const rock=mat(0x6e7771);
  const sand=mat(0xcdb879);
  const path=mat(0xd6c28d);
  const batches=new Map();
  function voxel(material,x,y,z,w,h,d){
    if(!batches.has(material))batches.set(material,[]);
    batches.get(material).push({x,y,z,w,h,d});
  }

  const surfaceMap=new Map();
  const topCells=[];
  const size=18;
  for(let x=-size;x<=size;x++){
    for(let z=-size;z<=size;z++){
      const distance=Math.sqrt(x*x+z*z);
      if(distance>17.2||(Math.abs(x)>16.5&&Math.abs(z)>16.5))continue;
      const edge=distance>15.2;
      const y=edge?-.03:0;
      const topY=y+.11;
      voxel(edge?grass2:grass,x*.72,y,z*.72,.74,.22,.74);
      surfaceMap.set(x+','+z,topY);
      topCells.push({x:x*.72,y:topY-.11,z:z*.72});
      if(edge&&(x+z)%3===0)voxel(soil,x*.72,-.22,z*.72,.74,.24,.74);
    }
  }
  for(let layer=0;layer<7;layer++){
    const radius=12.5-layer*1.45;
    for(let x=-14;x<=14;x++){
      for(let z=-14;z<=14;z++){
        if(Math.sqrt(x*x+z*z)>radius||(x*7+z*3+layer)%4===0)continue;
        voxel(layer%2?rock:soil,x*.72,-.38-layer*.28,z*.72,.74,.34,.74);
      }
    }
  }
  for(let i=0;i<34;i++){
    const angle=i/34*Math.PI*2;
    voxel(rock,Math.cos(angle)*12.1*.72,-.08,Math.sin(angle)*12.1*.72,.48,.38,.48);
  }

  voxel(path,0,.14,0,4.1,.12,4.1);
  voxel(sand,0,.13,-5.2,3.6,.12,3.2);
  voxel(sand,0,.13,5.2,3.6,.12,3.2);
  voxel(sand,-5.3,.13,0,3.2,.12,3.6);
  voxel(sand,5.3,.13,0,3.2,.12,3.6);
  voxel(path,0,.13,-2.5,1.05,.13,3.1);
  voxel(path,0,.13,2.5,1.05,.13,3.1);
  voxel(path,-2.5,.13,0,3.1,.13,1.05);
  voxel(path,2.5,.13,0,3.1,.13,1.05);

  const cube=new THREE.BoxGeometry(1,1,1);
  const dummy=new THREE.Object3D();
  for(const [material,items] of batches){
    const mesh=new THREE.InstancedMesh(cube,material,items.length);
    mesh.castShadow=true;
    mesh.receiveShadow=true;
    items.forEach((cell,index)=>{
      dummy.position.set(cell.x,cell.y,cell.z);
      dummy.scale.set(cell.w,cell.h,cell.d);
      dummy.updateMatrix();
      mesh.setMatrixAt(index,dummy.matrix);
    });
    mesh.instanceMatrix.needsUpdate=true;
    root.add(mesh);
  }

  // Invisible top-cell instances are used only for accurate placement raycasts.
  const topSurfaceMeshes=[];
  const topMesh=new THREE.InstancedMesh(
    new THREE.BoxGeometry(.74,.22,.74),
    new THREE.MeshBasicMaterial({color:0xffffff,side:THREE.DoubleSide}),
    topCells.length
  );
  topCells.forEach((cell,index)=>{
    dummy.position.set(cell.x,cell.y,cell.z);
    dummy.updateMatrix();
    topMesh.setMatrixAt(index,dummy.matrix);
  });
  topMesh.instanceMatrix.needsUpdate=true;
  topMesh.visible=false;
  root.add(topMesh);
  topSurfaceMeshes.push(topMesh);

  const trees=[
    [-12,-8],[-12,0],[-12,8],
    [12,-8],[12,0],[12,8],
    [-5,13],[5,13],[-5,-13],[5,-13]
  ];
  const treePositions=trees.map(([x,z],index)=>({
    x:x*.72,
    z:z*.72,
    scale:index%3===0?1.15:.9,
    collisionRadius:1.65
  }));
  treePositions.forEach(tree=>createTree(root,tree.x,tree.z,tree.scale));

  const obstaclePositions=[];
  const stones=[
    [-9,-1],[9,-1],[-9,9],[9,9],[-14,-4],[14,-4]
  ];
  const stoneMaterial=mat(0x6e7771);
  stones.forEach(([x,z])=>{
    const mesh=new THREE.Mesh(new THREE.BoxGeometry(.7,.48,.65),stoneMaterial);
    mesh.position.set(x*.72,.22,z*.72);
    mesh.castShadow=true;
    root.add(mesh);
    obstaclePositions.push({x:x*.72,z:z*.72,radius:.58});
  });

  const islandGroups=[root];
  islandGroups.push(addVoxelIsland(scene,{
    name:'Floating Island East',
    x:19,z:-10,baseY:-1.6,phase:2.2,amplitude:.46,speed:.82,size:4,
    grass:0x78b95f,grassLight:0x91c96c,
    trees:[{x:-1,scale:.7},{x:2,scale:.62}]
  }));
  islandGroups.push(addVoxelIsland(scene,{
    name:'Floating Island West',
    x:-19,z:-9,baseY:-2.1,phase:4.4,amplitude:.34,speed:1.28,size:3,
    grass:0x71ad65,grassLight:0x8bc477,
    trees:[{x:1,scale:.62}]
  }));
  islandGroups.push(addVoxelIsland(scene,{
    name:'Floating Island North',
    x:0,z:20,baseY:-1.2,phase:5.7,amplitude:.52,speed:.94,size:4,
    grass:0x79b866,grassLight:0x9acb76,
    trees:[{x:-2,scale:.65},{x:2,scale:.72}]
  }));

  return {root,surfaceMap,topSurfaceMeshes,treePositions,obstaclePositions,islandGroups};
}
