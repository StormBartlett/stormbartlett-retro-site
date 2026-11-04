import {describe,it,expect} from "vitest";
import {readFileSync,statSync} from "node:fs";
import {resolve} from "node:path";
import {HARDWARE_PROFILES,hardwareProfile,screenScale,framingDistance} from "./hardwareProfiles";

describe("hardware collection",()=>{
  it("restores only valid hardware choices",()=>{
    expect(hardwareProfile("laptop").id).toBe("laptop");expect(hardwareProfile("rgb").id).toBe("rgb");
    for(const value of [null,undefined,"__proto__","../other",12,{}])expect(hardwareProfile(value).id).toBe("classic");
    expect(new Set(HARDWARE_PROFILES.map(p=>p.id)).size).toBe(3);
  });
  for(const profile of HARDWARE_PROFILES){
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
