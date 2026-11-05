import {describe,it,expect} from "vitest";
import * as THREE from "three";
import {HARDWARE_PROFILES,keyboardStart} from "./hardwareProfiles";
import {rotatedFootprint} from "./deskPhysics";
import {alignedDeskObstacles,FIXED_SCREEN,prepareFanRotors,rigAlignment,SWITCH_POSITION,switchObstacle,transitionAmount,TRANSITION_MS} from "./hardwareScene";

describe("fixed hardware stage",()=>{
  for(const profile of HARDWARE_PROFILES)it(`${profile.id} fits around the same OS aperture without changing its aspect`,()=>{
    const pose=rigAlignment(profile);
    const center=new THREE.Vector3(...profile.screen.position).multiplyScalar(pose.scale).add(pose.offset);
    expect(center.distanceTo(new THREE.Vector3(...FIXED_SCREEN.position))).toBeLessThan(1e-8);
    expect(profile.screen.height*pose.scale).toBeCloseTo(FIXED_SCREEN.height,8);
    expect(profile.screen.width*pose.scale).toBeGreaterThanOrEqual(FIXED_SCREEN.width);
    const normal=new THREE.Vector3(0,0,1).applyEuler(new THREE.Euler(...profile.screen.rotation)).applyQuaternion(pose.rotation);
    expect(normal.distanceTo(new THREE.Vector3(0,0,1))).toBeLessThan(1e-8);
    const button=switchObstacle(profile);
    expect(button.x*pose.scale+pose.offset.x).toBeCloseTo(SWITCH_POSITION[0]);
    expect(button.z*pose.scale+pose.offset.z).toBeCloseTo(SWITCH_POSITION[2]);
    expect(pose.worldDeskY).toBeLessThan(SWITCH_POSITION[1]-.39);
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

  it("bounds interrupted transitions and skips animation for reduced motion",()=>{
    expect(transitionAmount(0,10,false)).toBe(0);
    expect(transitionAmount(10+TRANSITION_MS/2,10,false)).toBe(.5);
    expect(transitionAmount(10+TRANSITION_MS*5,10,false)).toBe(1);
    expect(transitionAmount(10,10,true)).toBe(1);
  });
});
