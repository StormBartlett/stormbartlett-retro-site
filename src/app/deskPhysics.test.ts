import {describe,expect,it} from "vitest";
import {fits,moveOnDesk,overlaps,rotatedFootprint,transferMomentum,type DeskBody} from "./deskPhysics";
const mouse = ():DeskBody => ({x:0,z:1,halfX:.22,halfZ:.31});
const keyboard:DeskBody = {x:2,z:1,halfX:1.22,halfZ:.5};
describe("desk collisions",()=>{
  it("stops fast throws and large pointer jumps at another device",()=>{
    const body=mouse(),p=moveOnDesk(body,50,1,[keyboard]);
    expect(p.x).toBeCloseTo(.558,5);expect(p.hitX).toBe(true);expect(p.z).toBe(1);
  });
  it("slides along an edge and can move away from it",()=>{
    const body=mouse();moveOnDesk(body,3,1.5,[keyboard]);
    expect(body.x).toBeCloseTo(.558,5);expect(body.z).toBeCloseTo(1.5,5);
    const p=moveOnDesk(body,-1,1.5,[keyboard]);expect(p.x).toBe(-1);expect(p.hitX).toBe(false);
  });
  it("cannot pass through a monitor when approaching on Z",()=>{
    const body={...mouse(),x:2,z:4};const p=moveOnDesk(body,2,-20,[keyboard]);
    expect(p.z).toBeCloseTo(1.812,5);expect(p.hitZ).toBe(true);
  });
  it("handles another obstacle while sliding",()=>{
    const body=mouse();const wall={x:0,z:3,halfX:4,halfZ:.2};
    const p=moveOnDesk(body,5,8,[keyboard,wall]);
    expect(p.z).toBeLessThanOrEqual(2.488);expect(Number.isFinite(p.x)).toBe(true);
  });
  it("keeps bodies that are not touching free and updates the shared body",()=>{
    const body=mouse(),p=moveOnDesk(body,-4,5,[body,keyboard]);expect(p).toEqual({x:-4,z:5,hitX:false,hitZ:false,pushed:[]});expect(body.x).toBe(-4);
  });
  it("cannot be walked through a face by tiny jitter followed by a throw",()=>{
    const body=mouse();moveOnDesk(body,50,1,[keyboard]);const face=body.x;
    for(let i=0;i<20;i++)moveOnDesk(body,body.x+5e-9,1,[keyboard]);
    expect(body.x).toBeLessThanOrEqual(face);
    const p=moveOnDesk(body,50,1,[keyboard]);expect(p.x).toBeLessThanOrEqual(face);expect(p.hitX).toBe(true);
  });
  it("never ends up inside an obstacle across a long mix of jitter, drags and throws",()=>{
    let seed=70419;const random=()=>(seed=(seed*1664525+1013904223)>>>0)/4294967296;
    const obstacle:DeskBody={x:0,z:0,halfX:1.16,halfZ:.85},body=mouse();body.x=3;body.z=2.3;
    for(let step=0;step<200_000;step++){
      const reach=[5e-9,1e-4,.05,8][Math.floor(random()*4)];
      moveOnDesk(body,body.x+(random()-.5)*reach,body.z+(random()-.5)*reach,[obstacle]);
      const inside=Math.abs(body.x-obstacle.x)<body.halfX+obstacle.halfX&&Math.abs(body.z-obstacle.z)<body.halfZ+obstacle.halfZ;
      if(inside)throw new Error(`entered the obstacle at step ${step}`);
      if(Math.abs(body.x)>6||Math.abs(body.z)>6){body.x=3;body.z=2.3;}
    }
  });
  it("stops at the first body when a throw crosses several",()=>{
    const body=mouse(),near={x:2,z:1,halfX:.1,halfZ:1},far={x:5,z:1,halfX:.1,halfZ:1};
    expect(moveOnDesk(body,20,1,[far,near]).x).toBeCloseTo(1.678,5);
  });
  it("accounts for rotated device footprints",()=>{
    expect(rotatedFootprint(2,1,Math.PI/2)).toEqual({halfX:.5000000000000001,halfZ:1});
    const p=rotatedFootprint(2,1,-.3);expect(p.halfX).toBeGreaterThan(1);expect(p.halfZ).toBeGreaterThan(.5);
  });
});

describe("pushing devices and the desk edge",()=>{
  const desk={minX:-4,maxX:5,minZ:-2,maxZ:3};
  it("keeps the whole footprint on the desk",()=>{
    const body={...mouse(),bounds:desk},p=moveOnDesk(body,40,40,[]);
    expect(p.x).toBeCloseTo(5-.22,9);expect(p.z).toBeCloseTo(3-.31,9);expect(p.hitX).toBe(true);expect(p.hitZ).toBe(true);
  });
  it("shoves a movable keyboard along instead of stopping at it",()=>{
    const body={...mouse(),bounds:desk},board:DeskBody={...keyboard,movable:true,bounds:desk};
    const p=moveOnDesk(body,1.5,1,[board]);
    expect(p.x).toBeCloseTo(1.5,6);expect(p.hitX).toBe(false);expect(p.pushed).toEqual([{body:board,axis:"x"}]);
    expect(board.x-body.x).toBeCloseTo(board.halfX+body.halfX+.002,6);
  });
  it("stops both when the pushed device reaches a fixed wall",()=>{
    const body={...mouse(),bounds:desk},board:DeskBody={...keyboard,movable:true,bounds:desk},wall={x:4,z:1,halfX:.2,halfZ:2};
    const p=moveOnDesk(body,30,1,[board,wall]);
    expect(p.hitX).toBe(true);expect(board.x).toBeCloseTo(4-.2-1.22-.002,6);expect(overlaps(body,board)).toBe(false);
  });
  it("gives the pushed device momentum and a spin from an off-centre hit",()=>{
    const body={...mouse(),z:1.4},board:DeskBody={...keyboard,movable:true};
    transferMomentum(body,3,0,[{body:board,axis:"x"}]);
    expect(board.vx).toBeCloseTo(2.7,9);expect(board.spin).toBeGreaterThan(0);
  });
  it("never overlaps across a long mix of drags and pushes",()=>{
    let seed=9157;const random=()=>(seed=(seed*1664525+1013904223)>>>0)/4294967296;
    const fixed:DeskBody={x:0,z:-.5,halfX:1.16,halfZ:.85},body:DeskBody={...mouse(),x:3,z:2,bounds:desk},board:DeskBody={...keyboard,x:0,z:1.6,movable:true,bounds:desk};
    const all=[fixed,body,board];
    for(let step=0;step<50_000;step++){
      const reach=[1e-4,.05,.6,8][Math.floor(random()*4)];
      const mover=random()<.8?body:board;
      moveOnDesk(mover,mover.x+(random()-.5)*reach,mover.z+(random()-.5)*reach,all);
      for(const [a,b] of [[fixed,body],[fixed,board],[body,board]])if(overlaps(a,b))throw new Error(`overlap at step ${step}`);
      if(!fits(body,[])||!fits(board,[]))throw new Error(`left the desk at step ${step}`);
    }
  });
});

describe("corner slip",()=>{
  it("side-steps a corner it only clips, then carries on",()=>{
    const body:DeskBody={x:0,z:.5,halfX:.5,halfZ:.5},post={x:2,z:-.2,halfX:.3,halfZ:.3};
    // Overlaps the post's span on Z by .1: it slides round the front of it.
    const p=moveOnDesk(body,4,.5,[post]);
    expect(p.x).toBeCloseTo(4,6);expect(p.z).toBeCloseTo(.602,6);expect(overlaps(body,post)).toBe(false);
  });
  it("still stops at a face it hits square on",()=>{
    const body:DeskBody={x:0,z:0,halfX:.5,halfZ:.5},wall={x:2,z:0,halfX:.3,halfZ:2};
    expect(moveOnDesk(body,4,0,[wall]).hitX).toBe(true);
  });
});
