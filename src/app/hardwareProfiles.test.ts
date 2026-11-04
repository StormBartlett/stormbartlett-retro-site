import {describe,it,expect} from "vitest";
import {readFileSync,statSync} from "node:fs";
import {resolve} from "node:path";
import {deskObstacles,HARDWARE_PROFILES,hardwareProfile,keyboardStart,screenScale,framingDistance} from "./hardwareProfiles";
import {moveOnDesk,rotatedFootprint,type DeskBody} from "./deskPhysics";

describe("hardware collection",()=>{
  it("restores only valid hardware choices",()=>{
    expect(hardwareProfile("laptop").id).toBe("laptop");expect(hardwareProfile("rgb").id).toBe("rgb");
    for(const value of [null,undefined,"__proto__","../other",12,{}])expect(hardwareProfile(value).id).toBe("classic");
    expect(new Set(HARDWARE_PROFILES.map(p=>p.id)).size).toBe(3);
  });
  it("keeps the rounded Mac case available and swappable with the same screen fit",()=>{
    const bytes=readFileSync(resolve(process.cwd(),"public/models/studio-mac-rounded.glb"));
    expect(bytes.toString("utf8",0,4)).toBe("glTF");expect(statSync(resolve(process.cwd(),"public/models/studio-mac-rounded.glb")).size).toBeLessThan(2_000_000);
    const names=(file:string)=>{const data=readFileSync(resolve(process.cwd(),"public/models",file)),gltf=JSON.parse(data.toString("utf8",20,20+data.readUInt32LE(12)));return gltf.nodes.map((node:{name?:string})=>node.name??"") as string[];};
    expect(names("studio-mac.glb")).toContain("Angular Plus shell");expect(names("studio-mac-rounded.glb")).not.toContain("Angular Plus shell");
  });
  for(const profile of HARDWARE_PROFILES){
    it(`${profile.id}: desk devices start clear of each other and of the computer`,()=>{
      const keyboard=profile.keyboard?{x:keyboardStart(profile.id)[0],z:keyboardStart(profile.id)[2],...rotatedFootprint(2.48,1.01,-.025)}:null;
      const mouse={x:profile.mouse[0],z:profile.mouse[2],...rotatedFootprint(.444,.636,-.11)};
      const clear=(a:DeskBody,b:DeskBody)=>Math.abs(a.x-b.x)>a.halfX+b.halfX||Math.abs(a.z-b.z)>a.halfZ+b.halfZ;
      for(const fixed of deskObstacles(profile.id)){expect(clear(mouse,fixed)).toBe(true);if(keyboard)expect(clear(keyboard,fixed)).toBe(true);}
      if(keyboard)expect(clear(keyboard,mouse)).toBe(true);
      const [minX,maxX,minZ,maxZ]=profile.bounds;expect(mouse.x>=minX&&mouse.x<=maxX&&mouse.z>=minZ&&mouse.z<=maxZ).toBe(true);
    });
    it(`${profile.id}: a throw from anywhere in bounds cannot cross the computer`,()=>{
      const obstacles=deskObstacles(profile.id);
      for(const fixed of obstacles){
        const mouse:DeskBody={x:profile.mouse[0],z:profile.mouse[2],...rotatedFootprint(.444,.636,-.11)};
        moveOnDesk(mouse,fixed.x,fixed.z,obstacles);moveOnDesk(mouse,fixed.x-20,fixed.z-20,obstacles);
        for(const other of obstacles)expect(Math.abs(mouse.x-other.x)>=mouse.halfX+other.halfX||Math.abs(mouse.z-other.z)>=mouse.halfZ+other.halfZ).toBe(true);
      }
    });
    it(`${profile.id}: browser screen exactly matches its model aperture`,()=>{
      const s=profile.screen;expect(s.width/s.height).toBeCloseTo(s.cssWidth/s.cssHeight,8);
      expect(s.cssWidth*screenScale(profile)/40).toBeCloseTo(s.width,8);
      expect(s.cssHeight*screenScale(profile)/40).toBeCloseTo(s.height,8);
      for(const tuple of [s.position,s.rotation,profile.framing.target,profile.mouse])expect(tuple.length===3&&tuple.every(Number.isFinite)).toBe(true);
    });
    it(`${profile.id}: frames the complete setup on phones and desktops`,()=>{
      for(const aspect of [320/854,390/844,844/390,1280/800,1920/1080]){
        const d=framingDistance(profile,aspect,28),tan=Math.tan(28*Math.PI/360);
        expect(d*2*tan*aspect).toBeGreaterThanOrEqual(profile.framing.width);
        expect(d*2*tan).toBeGreaterThanOrEqual(profile.framing.height);expect(d).toBeLessThan(70);
      }
    });
    it(`${profile.id}: includes a valid self-contained, bounded glTF asset`,()=>{
      const path=resolve(process.cwd(),"public",profile.asset.slice(1));
      const bytes=readFileSync(path);expect(bytes.toString("utf8",0,4)).toBe("glTF");expect(bytes.readUInt32LE(4)).toBe(2);
      const length=bytes.readUInt32LE(12),gltf=JSON.parse(bytes.toString("utf8",20,20+length));
      expect(gltf.meshes.length).toBeGreaterThan(30);expect(statSync(path).size).toBeLessThan(2_000_000);
      expect((gltf.buffers??[]).every((b:{uri?:string})=>!b.uri)).toBe(true);
      expect((gltf.images??[]).every((image:{uri?:string})=>!image.uri)).toBe(true);
      if(profile.id==="laptop")expect(gltf.nodes.filter((node:{extras?:{key?:string}})=>node.extras?.key).length).toBeGreaterThan(40);
    });
  }
});
