import {describe,expect,it} from "vitest";
import {settleIcons} from "./desktopCoordinates";

describe("settleIcons",()=>{
  const area={width:800,height:572};
  it("leaves a tidy layout untouched",()=>{
    const icons=[{id:"a",x:40,y:60},{id:"b",x:160,y:60}];
    expect(settleIcons(icons,area)).toBe(icons);
  });
  it("pulls clipped icons inside and separates overlapping ones",()=>{
    const icons=[{id:"calc",x:230,y:130},{id:"paint",x:240,y:140},{id:"games",x:1180,y:120},{id:"projects",x:1190,y:125}];
    const out=settleIcons(icons,area,[{x:250,y:230}]);
    expect(out[0]).toBe(icons[0]);
    for(const icon of out){expect(icon.x).toBeGreaterThanOrEqual(8);expect(icon.x).toBeLessThanOrEqual(800-96-8);expect(icon.y).toBeLessThanOrEqual(572-96-8);}
    const points=[...out,{x:250,y:230}];
    for(let i=0;i<points.length;i++)for(let j=i+1;j<points.length;j++)expect(Math.abs(points[i].x-points[j].x)>=76.8||Math.abs(points[i].y-points[j].y)>=76.8).toBe(true);
  });
});
