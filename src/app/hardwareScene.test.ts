import {describe,it,expect} from "vitest";
import * as THREE from "three";
import {HARDWARE_PROFILES,keyboardStart} from "./hardwareProfiles";
import {rotatedFootprint} from "./deskPhysics";
import {alignedDeskObstacles,roundedRect,seamlessCrtBezel,seatSideVents,quadMatrix3d,DESK_Y,FIXED_SCREEN,mergeStaticMeshes,prepareFanRotors,rigAlignment,SCREEN_SCALE,screenFor,SWITCH_POSITION,switchObstacle,transitionAmount,TRANSITION_MS,WARP_MS} from "./hardwareScene";
import {cueActive,swordPose} from "./SwordPedestal";

describe("fixed hardware stage",()=>{
  for(const profile of HARDWARE_PROFILES)it(`${profile.id} stands on the shared level desk with the desktop on its own panel`,()=>{
    const pose=rigAlignment(profile);
    expect(pose.worldDeskY).toBe(DESK_Y);
    expect(pose.offset.y+pose.deskY*pose.scale).toBeCloseTo(DESK_Y,10);
    const screen=screenFor(profile);
    const center=new THREE.Vector3(...profile.screen.position).multiplyScalar(pose.scale).add(pose.offset);
    expect(center.distanceTo(new THREE.Vector3(...screen.position))).toBeLessThan(1e-8);
    expect(screen.position[0]).toBeCloseTo(0,10);expect(screen.position[2]).toBeCloseTo(FIXED_SCREEN.position[2],10);
    expect(screen.height).toBeCloseTo(profile.screen.height*pose.scale,10);
    // The live desktop fills the panel: no letterbox bars, no stretched pixels.
    expect(profile.screen.width*pose.scale).toBeCloseTo(screen.width,8);
    expect(screen.cssHeight).toBe(FIXED_SCREEN.cssHeight);
    expect(Math.abs(screen.cssWidth/screen.cssHeight-profile.screen.width/profile.screen.height)).toBeLessThan(.002);
    expect(screen.width/screen.cssWidth*40/screen.zoom).toBeCloseTo(SCREEN_SCALE,3);
    // The pedestal stays left of the panel (plus bezel), never in front of it.
    expect(SWITCH_POSITION[0]+.34).toBeLessThan(screen.position[0]-screen.width/2-.03);
    const normal=new THREE.Vector3(0,0,1).applyEuler(new THREE.Euler(...profile.screen.rotation)).applyQuaternion(pose.rotation);
    expect(normal.distanceTo(new THREE.Vector3(0,0,1))).toBeLessThan(1e-8);
    const button=switchObstacle(profile);
    expect(button.x*pose.scale+pose.offset.x).toBeCloseTo(SWITCH_POSITION[0]);
    expect(button.z*pose.scale+pose.offset.z).toBeCloseTo(SWITCH_POSITION[2]);
    // Pedestal and peripherals stand on the shared slab (x .45 ± 4.8, z .35 ± 2.8).
    const world=(x:number,z:number)=>[pose.offset.x+x*pose.scale,pose.offset.z+z*pose.scale];
    for(const [x,z] of [[profile.mouse[0],profile.mouse[2]],[keyboardStart(profile.id)[0],keyboardStart(profile.id)[2]]].map(([x,z])=>world(x,z)).concat([[SWITCH_POSITION[0],SWITCH_POSITION[2]]])){
      expect(Math.abs(x-.45)).toBeLessThan(4.8-.4);expect(Math.abs(z-.35)).toBeLessThan(2.8-.4);
    }
  });

  for(const profile of HARDWARE_PROFILES)it(`${profile.id} keeps initial peripherals clear of the aligned chassis and left switch`,()=>{
    const keyboard=keyboardStart(profile.id);
    const devices=[{x:profile.mouse[0],z:profile.mouse[2],...rotatedFootprint(.444,.636,-.11)},...(profile.keyboard?[{x:keyboard[0],z:keyboard[2],...rotatedFootprint(2.48,1.01,-.025)}]:[])];
    for(const body of devices)for(const fixed of [...alignedDeskObstacles(profile),switchObstacle(profile)]){
      expect(Math.abs(body.x-fixed.x)>body.halfX+fixed.halfX||Math.abs(body.z-fixed.z)>body.halfZ+fixed.halfZ).toBe(true);
    }
  });

  it("rotates blades around the fan hub without rotating the housing or disturbing world positions",()=>{
    const scene=new THREE.Group(),fan=new THREE.Group();fan.rotation.y=Math.PI/2;scene.add(fan);
    const blade=new THREE.Mesh(new THREE.BoxGeometry(),new THREE.MeshBasicMaterial());blade.name="RTX_GPU_fan_0_blade_0";blade.position.set(.1,0,.02);fan.add(blade);
    const housing=new THREE.Group();housing.name="RTX GPU fan 0 housing";fan.add(housing);
    scene.updateMatrixWorld(true);const before=blade.getWorldPosition(new THREE.Vector3());
    const rotors=prepareFanRotors(scene);expect(rotors).toHaveLength(1);
    scene.updateMatrixWorld(true);expect(blade.getWorldPosition(new THREE.Vector3()).distanceTo(before)).toBeLessThan(1e-8);
    rotors[0].rotation.z=Math.PI/2;scene.updateMatrixWorld(true);
    expect(blade.getWorldPosition(new THREE.Vector3()).distanceTo(before)).toBeGreaterThan(.1);
    expect(housing.parent).toBe(fan);expect(fan.rotation.y).toBe(Math.PI/2);
    blade.geometry.dispose();(blade.material as THREE.Material).dispose();
  });

  it("keeps the Mac's 4:3 desktop and widens the others to their panels",()=>{
    expect(HARDWARE_PROFILES.map(profile=>screenFor(profile).cssWidth)).toEqual([800,960,1067]);
    expect(screenFor(HARDWARE_PROFILES[0]).radius).toBeGreaterThan(FIXED_SCREEN.radius);
    // Newer machines get bigger panels than the compact Mac, in release order.
    const widths=HARDWARE_PROFILES.map(profile=>screenFor(profile).width);
    expect(widths[0]).toBeLessThan(widths[1]);expect(widths[1]).toBeLessThan(widths[2]);
    expect(screenFor(HARDWARE_PROFILES[0]).zoom).toBeCloseTo(1,10);
  });

  it("merges static meshes per material but leaves keys, controls and rotors separate",()=>{
    const root=new THREE.Group(),shared=new THREE.MeshStandardMaterial(),other=new THREE.MeshStandardMaterial();
    const box=()=>new THREE.BoxGeometry(.1,.1,.1);
    for(let i=0;i<4;i++){const mesh=new THREE.Mesh(box(),shared);mesh.position.set(i,0,0);root.add(mesh);}
    const odd=new THREE.Mesh(box(),other);root.add(odd);
    const key=new THREE.Mesh(box(),shared);key.userData.key="a";root.add(key);
    const fan=new THREE.Group();fan.name="fan";root.add(fan);
    for(let i=0;i<3;i++){const blade=new THREE.Mesh(box(),shared);blade.name=`fan_blade_${i}`;blade.position.set(0,i,0);fan.add(blade);}
    const rotors=prepareFanRotors(root);
    root.updateMatrixWorld(true);const before=new THREE.Box3().setFromObject(root);
    expect(mergeStaticMeshes(root)).toBe(3);
    const meshes:THREE.Mesh[]=[];root.traverse(object=>{if(object instanceof THREE.Mesh)meshes.push(object);});
    // 4 shared statics -> 1, odd material, the key, and 3 blades -> 1 per rotor.
    expect(meshes).toHaveLength(4);
    expect(meshes).toContain(key);expect(meshes).toContain(odd);
    expect(rotors[0].children).toHaveLength(1);expect(rotors[0].children[0].name).toMatch(/blade_\d+$/);
    root.updateMatrixWorld(true);const after=new THREE.Box3().setFromObject(root);
    expect(after.min.distanceTo(before.min)+after.max.distanceTo(before.max)).toBeLessThan(1e-6);
  });

  it("rebuilds the Mac bezel so no gap shows between its aperture and the rounded glass seal",()=>{
    const ring=(name:string,halfX:number,halfY:number,radius:number,thick:number,depth:number,material:THREE.Material)=>{
      const shape=roundedRect(new THREE.Shape(),halfX,halfY,radius) as THREE.Shape;
      shape.holes.push(roundedRect(new THREE.Path(),halfX-thick,halfY-thick,Math.max(.005,radius-thick),true));
      const mesh=new THREE.Mesh(new THREE.ExtrudeGeometry(shape,{depth,bevelEnabled:false,curveSegments:8}).translate(0,0,-depth/2),material);mesh.name=name;return mesh;
    };
    const ivory=new THREE.MeshStandardMaterial({name:"ivory"}),edge=new THREE.MeshStandardMaterial({name:"edge"}),rubber=new THREE.MeshStandardMaterial({name:"rubber"});
    const root=new THREE.Group(),shell=new THREE.Mesh(new THREE.BoxGeometry(.1,.1,.1),ivory);
    // Same proportions as the Blender build: square-cornered aperture around a rounded seal.
    const bezel=ring("Deep_CRT_bezel",.92,.72,.065,.09,.16,edge);bezel.position.set(0,.43,.205);
    const seal=ring("Black_glass_seal",.84,.64,.09,.025,.025,rubber);seal.position.set(0,.43,.286);
    root.add(shell,bezel,seal);root.updateMatrixWorld(true);
    const gap=new THREE.Vector3(.815,.43+.615,1),down=new THREE.Vector3(0,0,-1);
    const first=()=>new THREE.Raycaster(gap,down).intersectObjects([bezel,seal])[0]?.object;
    expect(first()).toBeUndefined();
    expect(seamlessCrtBezel(root)).toBe(true);root.updateMatrixWorld(true);
    expect(first()).toBe(bezel);expect(bezel.material).toBe(ivory);
    // The aperture still clears the glass: the screen's center is open.
    expect(new THREE.Raycaster(new THREE.Vector3(0,.43,1),down).intersectObject(bezel)).toHaveLength(0);
  });

  it("seats the Mac's side vents flush on both tapered walls",()=>{
    const root=new THREE.Group(),ink=new THREE.MeshStandardMaterial();
    // A case whose walls lean in toward the back, like the Mac's shell.
    const wall=(side:number)=>{const m=new THREE.Mesh(new THREE.PlaneGeometry(2,2),ink);m.position.set(side*1.1,.6,-.5);m.rotation.y=side*(Math.PI/2+.066);m.name="Angular Plus shell";return m;};
    root.add(wall(-1),wall(1));
    const vents=[-1,1].map(side=>{const v=new THREE.Mesh(new THREE.BoxGeometry(.011,.027,.11),ink);v.name="Side ventilation";v.position.set(side*1.09,.6,-.5);root.add(v);return v;});
    expect(seatSideVents(root)).toBe(2);
    for(const vent of vents){
      const side=Math.sign(vent.position.x),wallMesh=root.children[side<0?0:1] as THREE.Mesh;
      // Both ends of the slot stand the same small distance off the wall.
      const plane=new THREE.Plane().setFromNormalAndCoplanarPoint(new THREE.Vector3(0,0,1).applyQuaternion(wallMesh.quaternion),wallMesh.position);
      const ends=[-.055,.055].map(z=>new THREE.Vector3(side*.0055,0,z).applyMatrix4(vent.matrixWorld));
      const gaps=ends.map(p=>Math.abs(plane.distanceToPoint(p)));
      expect(Math.abs(gaps[0]-gaps[1])).toBeLessThan(1e-6);expect(gaps[0]).toBeCloseTo(.002,4);
    }
    // Mirror-image placement on the two sides.
    expect(vents[0].position.x).toBeCloseTo(-vents[1].position.x,6);expect(vents[0].position.z).toBeCloseTo(vents[1].position.z,6);
  });

  it("pins an element's corners exactly onto a projected quad",()=>{
    const quad:[number,number][]=[[69.2,302],[237.6,298.5],[240.1,404.2],[70.4,401.3]];
    const css=quadMatrix3d(1067,600,quad);
    const v=css.slice(9,-1).split(",").map(Number),m=new THREE.Matrix4().fromArray(v);
    const corners=[[0,0],[1067,0],[1067,600],[0,600]];
    corners.forEach(([x,y],i)=>{const p=new THREE.Vector4(x,y,0,1).applyMatrix4(m);expect(p.x/p.w).toBeCloseTo(quad[i][0],4);expect(p.y/p.w).toBeCloseTo(quad[i][1],4);});
    // A plain rectangle stays affine.
    expect(quadMatrix3d(100,50,[[10,20],[60,20],[60,45],[10,45]])).toBe("matrix3d(0.5,0,0,0,0,0.5,0,0,0,0,1,0,10,20,0,1)");
  });

  it("only lifts the sword for a pull, and settles it back by the end of the warp",()=>{
    const pull={kind:"pull" as const,start:0};
    expect(swordPose(0,pull,null,false).lift).toBe(0);
    expect(swordPose(400,pull,null,false).lift).toBeGreaterThan(.5);
    const warp={from:"a",to:"b",start:300,mode:"warp" as const,duration:WARP_MS};
    expect(swordPose(300+WARP_MS,pull,warp,false).lift).toBeCloseTo(0);
    expect(swordPose(100,{kind:"rattle",start:0},null,false).lift).toBeLessThan(.03);
    expect(swordPose(100,{kind:"hum",start:0},null,true)).toEqual({lift:0,shake:0,hum:0});
    expect(cueActive(5000,{kind:"hum",start:0})).toBe(false);expect(cueActive(5000,pull)).toBe(true);
  });

  it("bounds interrupted transitions and skips animation for reduced motion",()=>{
    expect(transitionAmount(0,10,false)).toBe(0);
    expect(transitionAmount(10+TRANSITION_MS/2,10,false)).toBe(.5);
    expect(transitionAmount(10+TRANSITION_MS*5,10,false)).toBe(1);
    expect(transitionAmount(10,10,true)).toBe(1);
    expect(transitionAmount(10+WARP_MS/2,10,false,WARP_MS)).toBe(.5);
  });
});
