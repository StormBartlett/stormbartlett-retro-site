"use client";

import { Canvas, useFrame, useThree, type ThreeEvent } from "@react-three/fiber";
import { OrbitControls, useGLTF } from "@react-three/drei";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import * as React from "react";
import * as THREE from "three";
import { reportInteraction, RetroKeyboard, RetroMouse } from "./RetroHardware";
import type { DeskWorld } from "./deskPhysics";
import { readStoredSetting, useIsMobileViewport, useMediaQuery, writeStoredSetting } from "./FullscreenContext";
import { framingDistance, HARDWARE_PROFILES, HARDWARE_STORAGE_KEY, hardwareProfile, keyboardStart, type HardwareProfile } from "./hardwareProfiles";
import { addPixelDissolve, alignedDeskObstacles, disposeMergedGeometry, mergeStaticMeshes, seamlessCrtBezel, seatSideVents, addMouldedPlastic, DESK_COLORS, DESK_Y, FIXED_FRAMING, PORTRAIT_FRAMING, HARDWARE_FX, prepareFanRotors, quadMatrix3d, rigAlignment, screenFor, switchObstacle, transitionAmount, TRANSITION_MS, WARP_MS, type TransitionMode } from "./hardwareScene";
import { SwordPedestal, TimeWarpFX, type SwitchTransition, type SwordCue } from "./SwordPedestal";
import styles from "./HardwareGallery.module.css";

const CAMERA_FOV = 28;
const INITIAL_CAMERA: [number,number,number] = [1.2,1.3,9];
const INTRO_MS = 1700;
const PLAQUE_LABELS:Record<HardwareProfile["id"],string>={classic:"Mac",laptop:"Laptop",rgb:"RTX"};
type ControlsRef = React.RefObject<OrbitControlsImpl|null>;
type Transition = SwitchTransition;
type ScreenFx = {mode:TransitionMode;start:number;duration:number}|null;
/** User Timing marks for profiling cold load and switches; they cost nothing without an observer. */
const mark=(name:string)=>{try{performance.mark(`storm:${name}`);}catch{}};
mark("hardware-chunk");

export function preloadHardware() {
  const chosen=hardwareProfile(readStoredSetting(HARDWARE_STORAGE_KEY));
  const soft=readStoredSetting("storm-mac-soft-case-v1")==="1";
  // Only the computer the visitor will see first; the others queue once it is ready,
  // so they never compete with it for bandwidth or parse time.
  useGLTF.preload(chosen.id==="classic"&&soft?"/models/studio-mac-rounded.glb":chosen.asset);
}

// Start parsing the first model as soon as this code arrives, in parallel with Canvas setup.
if(typeof window!=="undefined"){try{preloadHardware();}catch{}}

function useSceneMotion(active:boolean) {
  const osReduced=useMediaQuery("(prefers-reduced-motion: reduce)");
  const [visible,setVisible]=React.useState(()=>!document.hidden);
  const [reduced,setReduced]=React.useState(()=>document.documentElement.dataset.reduceEffects==="true");
  React.useEffect(()=>{
    const visibility=()=>setVisible(!document.hidden);
    const observer=new MutationObserver(()=>setReduced(document.documentElement.dataset.reduceEffects==="true"));
    observer.observe(document.documentElement,{attributes:true,attributeFilter:["data-reduce-effects"]});
    document.addEventListener("visibilitychange",visibility);
    return()=>{observer.disconnect();document.removeEventListener("visibilitychange",visibility);};
  },[]);
  return {moving:active&&visible&&!osReduced&&!reduced,reduced:osReduced||reduced};
}

/** Local Blender assets, including clickable laptop keycaps. No network textures or fonts. */
function HardwareModel({ profile, onReady, onLoaded, onInteractionChange, enabled, reveal, spin }: { profile: HardwareProfile; onReady: (url:string) => void; onLoaded?: () => void; onInteractionChange: (active:boolean) => void; enabled:boolean; reveal:{value:number;outgoing?:{value:number}}; spin:boolean }) {
  const {scene:cached} = useGLTF(profile.asset);
  React.useEffect(()=>{onLoaded?.();},[onLoaded]);
  const {gl,camera,scene:world,invalidate} = useThree();
  const prepared=React.useMemo(()=>{
    const scene=cached.clone(true),materials=new Map<THREE.Material,THREE.Material>();
    scene.traverse(object=>{if(object instanceof THREE.Mesh){
      const copy=(source:THREE.Material)=>{
        if(!materials.has(source)){const owned=source.clone();addPixelDissolve(owned,reveal);materials.set(source,owned);}
        return materials.get(source)!;
      };
      object.material=Array.isArray(object.material)?object.material.map(copy):copy(object.material);
    }});
    // Ivory case and bezel get a moulded-plastic stipple; one tiny shared normal map.
    if(profile.id==="classic"){seamlessCrtBezel(scene);seatSideVents(scene);addMouldedPlastic(scene,/^ivory$/i);}
    const rotors=prepareFanRotors(scene);mergeStaticMeshes(scene);
    return {scene,materials,rotors};
  },[cached,reveal,profile.id]);
  const {scene,rotors}=prepared;
  React.useEffect(()=>()=>{prepared.materials.forEach(material=>material.dispose());disposeMergedGeometry(prepared.scene);},[prepared]);
  useFrame((_,delta)=>{
    if(spin)rotors.forEach((rotor,i)=>{rotor.rotation.z+=Math.min(delta,.08)*(i%2?-7:9);});
  });
  const press = React.useRef<{ object: THREE.Object3D; y: number; key: string; pointer: number; x: number; cy: number; capture: {releasePointerCapture(id:number):void} | null } | null>(null);
  const latestInteraction = React.useRef(onInteractionChange);
  React.useEffect(() => {latestInteraction.current=onInteractionChange;},[onInteractionChange]);
  React.useLayoutEffect(() => {
    scene.traverse(object => {
      if(object instanceof THREE.Mesh) {
        const materials=Array.isArray(object.material)?object.material:[object.material];
        object.castShadow=!/[ _]blade[ _]\d+$/.test(object.name)&&!materials.some(material=>material.transparent);
        object.receiveShadow=true;
        // Metal and glass catch the studio strips; matte plastics stay soft.
        for(const material of materials) if(material instanceof THREE.MeshStandardMaterial) material.envMapIntensity=material.metalness>.4||material.transparent||material.roughness<.25?1.45:.75;
      }
    });
    gl.shadowMap.needsUpdate=true;invalidate();
  },[scene,gl,invalidate]);
  React.useEffect(()=>{
    let cancelled=false;
    for(const material of prepared.materials.values())for(const value of Object.values(material)){
      if(value instanceof THREE.Texture)gl.initTexture(value);
    }
    // Prepare the actual cached materials against the studio's existing lights/environment.
    void gl.compileAsync(scene,camera,world).then(()=>{if(!cancelled)onReady(profile.asset);}).catch(()=>{if(!cancelled)onReady(profile.asset);});
    return()=>{cancelled=true;};
  },[gl,scene,camera,world,profile.asset,onReady]);
  React.useEffect(() => {
    const end = (event?: PointerEvent) => {
      const active=press.current;
      if(!active || (event && event.pointerId!==active.pointer)) return;
      active.object.position.y=active.y; press.current=null;
      try {active.capture?.releasePointerCapture(active.pointer);} catch {}
      reportInteraction(latestInteraction.current,false);
      if(event?.type==="pointerup" && Math.hypot(event.clientX-active.x,event.clientY-active.cy)<7) {
        window.dispatchEvent(new CustomEvent("storm-hardware-key",{detail:{key:active.key}}));
      }
      invalidate();
    };
    const blur=()=>end();
    window.addEventListener("pointerup",end);window.addEventListener("pointercancel",end);window.addEventListener("blur",blur);window.addEventListener("storm-hardware-cancel",blur);
    return()=>{end();window.removeEventListener("pointerup",end);window.removeEventListener("pointercancel",end);window.removeEventListener("blur",blur);window.removeEventListener("storm-hardware-cancel",blur);};
  },[invalidate]);
  const down=(event:ThreeEvent<PointerEvent>)=>{
    let hit:THREE.Object3D|null=event.object;
    while(hit && !hit.userData.key && !hit.userData.control) hit=hit.parent;
    if(!enabled || !hit || (event.pointerType==="mouse" && event.button!==0)) return;
    event.stopPropagation();event.nativeEvent.preventDefault();
    const key=hit.userData.control==="trackpad"?"Meta":hit.userData.key;
    if(press.current) return;
    const capture=event.target as unknown as {setPointerCapture(id:number):void;releasePointerCapture(id:number):void};
    try{capture.setPointerCapture(event.pointerId);}catch{}
    press.current={object:hit,y:hit.position.y,key,pointer:event.pointerId,x:event.clientX,cy:event.clientY,capture};
    hit.position.y-=.012;reportInteraction(latestInteraction.current,true);invalidate();
  };
  return <primitive object={scene} dispose={null} onPointerDown={enabled?down:undefined}/>;
}

type ScreenRect=ReturnType<typeof screenFor>;

function ScreenSlot({onSlot,onResized,tapRef,screen,reduced,fx,glass}: {onSlot:(slot:HTMLElement,mounted?:boolean)=>void;onResized:()=>void;tapRef:React.RefObject<(()=>void)|undefined>;screen:ScreenRect;reduced:boolean;fx:ScreenFx;glass:string}) {
  const slotRef=React.useRef<HTMLDivElement>(null!),frameRef=React.useRef<HTMLDivElement>(null!);
  // ScreenPin owns the frame's size from here on; this only covers the first paint.
  React.useLayoutEffect(()=>{const frame=frameRef.current;if(!frame.style.width){frame.style.width=`${screen.cssWidth}px`;frame.style.height=`${screen.cssHeight}px`;}onResized();},[]);// eslint-disable-line react-hooks/exhaustive-deps
  React.useLayoutEffect(()=>{const slot=slotRef.current;onSlot(slot);return()=>onSlot(slot,false);},[onSlot]);
  React.useEffect(()=>{
    const slot=slotRef.current;
    const click=(event:MouseEvent)=>{if(tapRef.current){event.preventDefault();event.stopPropagation();tapRef.current();}};
    slot.addEventListener("click",click,true);return()=>slot.removeEventListener("click",click,true);
  },[tapRef]);
  const duration=fx?.duration??TRANSITION_MS;
  return <div ref={frameRef} className="model-screen-html" data-glass={glass} data-world={[...screen.position,screen.width,screen.height].map(v=>v.toFixed(4)).join(",")} style={{position:"relative",pointerEvents:"auto",borderRadius:screen.radius,overflow:"hidden",transition:reduced?"none":`border-radius ${duration}ms ease`}}>
    <div ref={slotRef} className="embedded-screen model-screen" style={{width:"100%",height:"100%",position:"relative"}}/>
    <div aria-hidden className="model-screen-glass"/>
    {fx&&!reduced&&<div key={fx.start} aria-hidden className={`model-screen-fx model-screen-fx-${fx.mode}`} style={{animationDuration:`${fx.duration}ms`}}/>}
  </div>;
}

/**
 * Pins the live desktop onto the panel with one projective matrix3d per frame: its four
 * corners land exactly on the projected corners of the glass. There is no CSS perspective
 * context, which iOS Safari composited about 10 px away from the WebGL panel on the wider
 * screens while reporting a correct layout box. Position, size and pixel width ease with
 * the model blend, in step with the 3D rigs.
 */
function ScreenPin({screen,from,transition,pinRef,reduced,invalidateRef,onSettled}: {screen:ScreenRect;from:ScreenRect;transition:React.RefObject<Transition|null>;pinRef:React.RefObject<HTMLDivElement>;reduced:boolean;invalidateRef:React.RefObject<()=>void>;onSettled:()=>void}) {
  const {camera,size,invalidate}=useThree();
  React.useLayoutEffect(()=>{invalidateRef.current=invalidate;invalidate();},[invalidate,invalidateRef]);
  React.useEffect(()=>{invalidate();},[size,screen,invalidate]);
  const scratch=React.useMemo(()=>({center:new THREE.Vector3(),target:new THREE.Vector3(),corner:new THREE.Vector3(),euler:new THREE.Euler(),last:"",settled:0}),[]);
  useFrame(()=>{
    const pin=pinRef.current,frame=pin?.firstElementChild as HTMLElement|null;if(!pin||!frame)return;
    const change=transition.current,t=change?transitionAmount(performance.now(),change.start,reduced,change.duration):1,lerp=THREE.MathUtils.lerp;
    const {center,target,corner,euler}=scratch;
    center.set(...from.position).lerp(target.set(...screen.position),t);euler.set(...screen.rotation);
    const w=lerp(from.width,screen.width,t)/2,h=lerp(from.height,screen.height,t)/2;
    const cssWidth=Math.round(lerp(from.cssWidth,screen.cssWidth,t)*10)/10,cssHeight=Math.round(lerp(from.cssHeight,screen.cssHeight,t)*10)/10;
    camera.updateMatrixWorld();
    const quad=([[-w,h],[w,h],[w,-h],[-w,-h]] as const).map(([x,y])=>{
      corner.set(x,y,0).applyEuler(euler).add(center).project(camera);
      return [(corner.x+1)/2*size.width,(1-corner.y)/2*size.height] as [number,number];
    });
    const transform=quadMatrix3d(cssWidth,cssHeight,quad),key=`${cssWidth}x${cssHeight}${transform}`;
    if(key===scratch.last)return;
    scratch.last=key;frame.style.width=`${cssWidth}px`;frame.style.height=`${cssHeight}px`;pin.style.transform=transform;
    // The desktop re-clamps its windows once, at the final size.
    if(t>=1&&cssWidth!==scratch.settled){scratch.settled=cssWidth;queueMicrotask(onSettled);}
  });
  return null;
}

/**
 * Reflections from a tiny hand-built studio: warm overhead key, cool side fill, a narrow rim
 * strip and a dark floor card for contrast. One PMREM bake, no environment loaders in the bundle.
 */
function StudioEnvironment(){
  const {gl,scene,invalidate}=useThree();
  React.useLayoutEffect(()=>{
    const studio=new THREE.Scene(),geometry=new THREE.PlaneGeometry(1,1),materials:THREE.Material[]=[];
    const card=(color:string,intensity:number,position:[number,number,number],rotation:[number,number,number],scale:[number,number]):void=>{
      const material=new THREE.MeshBasicMaterial({color:new THREE.Color(color).multiplyScalar(intensity),side:THREE.DoubleSide,toneMapped:false});materials.push(material);
      const mesh=new THREE.Mesh(geometry,material);mesh.position.set(...position);mesh.rotation.set(...rotation);mesh.scale.set(scale[0],scale[1],1);studio.add(mesh);
    };
    card("#fff1dc",3,[0,5,0],[Math.PI/2,0,0],[10,5]);
    card("#dfe8ff",2,[-5,2,2],[0,Math.PI/2,0],[5,5]);
    card("#ffffff",1.8,[4,1,-3],[0,-Math.PI/2,0],[1.2,6]);
    card("#ffe6c4",1.1,[0,1.5,6],[0,Math.PI,0],[8,1.2]);
    card("#0b0c0e",1,[0,-3,0],[-Math.PI/2,0,0],[20,20]);
    const pmrem=new THREE.PMREMGenerator(gl),target=pmrem.fromScene(studio,0,.1,100,{size:128});
    const previous=scene.environment;scene.environment=target.texture;invalidate();
    return()=>{scene.environment=previous;target.dispose();pmrem.dispose();geometry.dispose();materials.forEach(material=>material.dispose());};
  },[gl,scene,invalidate]);
  return null;
}

let contactTexture:THREE.CanvasTexture|undefined;
/** Soft radial falloff shared by every rig's contact shadow. */
function contactShadowTexture(){
  if(contactTexture)return contactTexture;
  const canvas=document.createElement("canvas");canvas.width=canvas.height=64;
  const ctx=canvas.getContext("2d")!,gradient=ctx.createRadialGradient(32,32,0,32,32,32);
  gradient.addColorStop(0,"rgba(0,0,0,1)");gradient.addColorStop(.55,"rgba(0,0,0,.55)");gradient.addColorStop(1,"rgba(0,0,0,0)");
  ctx.fillStyle=gradient;ctx.fillRect(0,0,64,64);
  return contactTexture=new THREE.CanvasTexture(canvas);
}

/** Grounds each computer on the desk with a soft darkened footprint that fades with its reveal. */
function ContactShadow({profile,deskY,reveal}:{profile:HardwareProfile;deskY:number;reveal:{value:number}}){
  const material=React.useRef<THREE.MeshBasicMaterial>(null!);
  const footprint=React.useMemo(()=>{
    const bodies=alignedDeskObstacles(profile),box=new THREE.Box2();
    for(const body of bodies)box.expandByPoint(new THREE.Vector2(body.x-body.halfX,body.z-body.halfZ)).expandByPoint(new THREE.Vector2(body.x+body.halfX,body.z+body.halfZ));
    const center=box.getCenter(new THREE.Vector2()),size=box.getSize(new THREE.Vector2());
    return {x:center.x,z:center.y,w:size.x*1.45,d:size.y*1.6};
  },[profile]);
  useFrame(()=>{material.current.opacity=.42*reveal.value;});
  return <mesh position={[footprint.x,deskY+.004,footprint.z]} rotation={[-Math.PI/2,0,0]} scale={[footprint.w,footprint.d,1]} renderOrder={1}>
    <planeGeometry args={[1,1]}/><meshBasicMaterial ref={material} map={contactShadowTexture()} transparent depthWrite={false} opacity={0} toneMapped={false}/>
  </mesh>;
}

function StudioLighting(){
  return <>
    <hemisphereLight intensity={.8} groundColor="#aaa18a"/>
    <directionalLight castShadow position={[4,7,5]} intensity={2.2} color="#fff2dd" shadow-mapSize={[1024,1024]} shadow-bias={-.0003} shadow-camera-left={-5} shadow-camera-right={5} shadow-camera-top={5} shadow-camera-bottom={-5}/>
    <directionalLight position={[-4,3,-2]} intensity={1.2} color="#d9e5ff"/>
    <StudioEnvironment/>
  </>;
}

function ContextRecovery({onRestore,onRecover,active}:{onRestore:()=>void;onRecover:()=>void;active:boolean}) {
  const {gl,invalidate}=useThree();
  React.useEffect(()=>{
    let timer:ReturnType<typeof setTimeout>|undefined;
    const clear=()=>{clearTimeout(timer);timer=undefined;};
    const check=()=>{
      if(!active||document.hidden){clear();return;}
      if(gl.getContext().isContextLost()) {
        if(timer===undefined) timer=setTimeout(()=>{timer=undefined;if(gl.getContext().isContextLost())onRecover();},2500);
      } else invalidate();
    };
    const lost=(event:Event)=>{event.preventDefault();check();};
    const restored=()=>{clear();gl.shadowMap.needsUpdate=true;onRestore();invalidate();};
    gl.domElement.addEventListener("webglcontextlost",lost);
    gl.domElement.addEventListener("webglcontextrestored",restored);
    window.addEventListener("pageshow",check);document.addEventListener("visibilitychange",check);
    check();
    return()=>{clear();gl.domElement.removeEventListener("webglcontextlost",lost);gl.domElement.removeEventListener("webglcontextrestored",restored);window.removeEventListener("pageshow",check);document.removeEventListener("visibilitychange",check);};
  },[gl,invalidate,onRestore,onRecover,active]);
  return null;
}

function SceneFraming({controlsRef}: {controlsRef:ControlsRef}) {
  const {camera,size,invalidate}=useThree();
  const aspect=Math.round(size.width/Math.max(1,size.height)*10)/10;
  React.useEffect(()=>{
    // Portrait phones fit the pedestal-to-mouse span rather than the whole desk.
    const framing=aspect<1?PORTRAIT_FRAMING:FIXED_FRAMING;
    const distance=framingDistance({framing} as HardwareProfile,aspect,(camera as THREE.PerspectiveCamera).fov);
    const [x,y,z]=framing.target;
    camera.position.set(x+Math.sin(.16)*distance,y+distance*.22,z+Math.cos(.16)*distance);
    controlsRef.current?.target.set(x,y,z);controlsRef.current?.update();camera.lookAt(x,y,z);invalidate();
  },[camera,aspect,controlsRef,invalidate]);
  return null;
}

/**
 * Before the first reveal, compile every program the scene will need (desk, pedestal, peripherals,
 * shadow and warp-effect shaders), not just the GLB's. compileAsync uses parallel shader compile
 * where available, so the warp-in does not stall on its first frames.
 */
function SceneCompileGate({ready,onCompiled}:{ready:boolean;onCompiled:()=>void}) {
  const {gl,scene,camera}=useThree();
  const done=React.useRef(false),latest=React.useRef(onCompiled);
  React.useLayoutEffect(()=>{latest.current=onCompiled;},[onCompiled]);
  React.useEffect(()=>{
    if(!ready||done.current)return;
    done.current=true;
    const hidden:THREE.Object3D[]=[];
    scene.traverse(object=>{if(!object.visible&&object.name==="time-warp-fx"){hidden.push(object);object.visible=true;}});
    const finish=()=>{hidden.forEach(object=>{object.visible=false;});mark("scene-compiled");latest.current();};
    void gl.compileAsync(scene,camera).then(finish,finish);
  },[ready,gl,scene,camera]);
  return null;
}

/** Viewport size for screen-space dissolves; one write per rendered frame. */
function FxDriver({transition,reduced,intro,introDone}:{transition:React.RefObject<Transition|null>;reduced:boolean;intro:{value:number};introDone:boolean}) {
  const gl=useThree(state=>state.gl);
  useFrame(()=>{
    gl.getDrawingBufferSize(HARDWARE_FX.viewport.value);HARDWARE_FX.time.value=performance.now()/1000;
    const change=transition.current;
    // Desk and pedestal follow the first warp-in, then stay solid for every later switch.
    intro.value=introDone?1:change&&change.from===""?transitionAmount(performance.now(),change.start,reduced,change.duration):0;
  },-1);
  return null;
}

const BOOT_STEPS=["Starting renderer","Loading hardware","Warming shaders","Powering on"];
/** Pixel boot readout over the rain; real stages, not a fake timer. */
export function BootScreen({step,leaving=false}:{step:number;leaving?:boolean}) {
  return <div className={`boot-screen${leaving?" is-leaving":""}`} aria-hidden="true">
    <div className="boot-title">STORM OS</div>
    <div className="boot-bar"><span style={{width:`${Math.round((step+1)/BOOT_STEPS.length*100)}%`}}/></div>
    <div className="boot-step">{BOOT_STEPS[Math.min(step,BOOT_STEPS.length-1)]}<span className="boot-caret">_</span></div>
  </div>;
}

/**
 * Some WebKit views (notably in-app browsers) let the CSS3D layer drift from the WebGL
 * canvas after toolbar or visual-viewport changes. This compares the projected glass with
 * the live screen's DOM rect after each resize and corrects size or offset when they differ.
 */
function ScreenAlignmentGuard({overlayRef,screen,transition}:{overlayRef:React.RefObject<HTMLDivElement>;screen:ScreenRect;transition:React.RefObject<Transition|null>}) {
  const {camera,gl,size,setSize,invalidate}=useThree();
  const retry=React.useRef<ReturnType<typeof setTimeout>|undefined>(undefined);
  const checkRef=React.useRef<()=>void>(()=>{});
  const check=React.useCallback(()=>{
    const overlay=overlayRef.current,frame=overlay?.querySelector<HTMLElement>(".model-screen-html");
    if(!overlay||!frame)return;
    // A correction measured for the previous computer is wrong for the next one:
    // clear it while the screen moves, then measure again once it has settled.
    if(transition.current){overlay.style.transform="";clearTimeout(retry.current);retry.current=setTimeout(()=>requestAnimationFrame(()=>checkRef.current()),120);return;}
    const canvas=gl.domElement.getBoundingClientRect();
    if(canvas.width<2||canvas.height<2)return;
    if(Math.abs(canvas.width-size.width)>1||Math.abs(canvas.height-size.height)>1){setSize(canvas.width,canvas.height,canvas.top,canvas.left);invalidate();return;}
    camera.updateMatrixWorld();
    const [x,y,z]=screen.position,w=screen.width/2,h=screen.height/2,box={l:Infinity,r:-Infinity,t:Infinity,b:-Infinity};
    for(const [dx,dy] of [[-w,-h],[w,-h],[w,h],[-w,h]]){
      const p=new THREE.Vector3(x+dx,y+dy,z).project(camera);
      const px=canvas.left+(p.x+1)/2*canvas.width,py=canvas.top+(1-p.y)/2*canvas.height;
      box.l=Math.min(box.l,px);box.r=Math.max(box.r,px);box.t=Math.min(box.t,py);box.b=Math.max(box.b,py);
    }
    overlay.style.transform="";
    const actual=frame.getBoundingClientRect();
    if(actual.width<2)return;
    const k=(box.r-box.l)/actual.width,dx=box.l-actual.left*k+overlay.getBoundingClientRect().left*(k-1),dy=box.t-actual.top*k+overlay.getBoundingClientRect().top*(k-1);
    const drift=Math.max(Math.abs(box.l-actual.left),Math.abs(box.t-actual.top),Math.abs(box.r-actual.right),Math.abs(box.b-actual.bottom));
    overlay.dataset.alignDrift=drift.toFixed(2);
    if(drift>1.5)overlay.style.transform=`translate(${dx}px,${dy}px) scale(${k})`;
  },[overlayRef,gl,size,setSize,camera,screen,transition,invalidate]);
  React.useLayoutEffect(()=>{checkRef.current=check;},[check]);
  React.useEffect(()=>{
    let timer:ReturnType<typeof setTimeout>|undefined;
    const later=()=>{clearTimeout(timer);timer=setTimeout(()=>requestAnimationFrame(check),160);};
    later();
    const vv=window.visualViewport;
    window.addEventListener("resize",later);window.addEventListener("orientationchange",later);window.addEventListener("pageshow",later);
    vv?.addEventListener("resize",later);vv?.addEventListener("scroll",later);
    const frame=overlayRef.current?.querySelector(".model-screen-html");frame?.addEventListener("transitionend",later);
    return()=>{clearTimeout(timer);clearTimeout(retry.current);window.removeEventListener("resize",later);window.removeEventListener("orientationchange",later);window.removeEventListener("pageshow",later);vv?.removeEventListener("resize",later);vv?.removeEventListener("scroll",later);frame?.removeEventListener("transitionend",later);};
  },[check,overlayRef]);
  return null;
}

/** One level desk for every computer; only its finish blends during a switch. */
function SharedDesk({current,previous,transition,reduced,reveal}:{current:HardwareProfile;previous:HardwareProfile|null;transition:React.RefObject<Transition|null>;reduced:boolean;reveal:{value:number;outgoing:{value:number}}}) {
  const material=React.useRef<THREE.MeshStandardMaterial>(null!);
  // The desk materialises with the first computer, then stays.
  React.useLayoutEffect(()=>{addPixelDissolve(material.current,reveal);material.current.needsUpdate=true;},[reveal]);
  const colors=React.useMemo(()=>({from:new THREE.Color(DESK_COLORS[(previous??current).id]),to:new THREE.Color(DESK_COLORS[current.id])}),[current,previous]);
  useFrame(()=>{
    const change=transition.current,t=change?transitionAmount(performance.now(),change.start,reduced,change.duration):1;
    material.current.color.copy(colors.from).lerp(colors.to,t);
  });
  return <mesh receiveShadow position={[.45,DESK_Y-.05,.35]}><boxGeometry args={[9.6,.1,5.6]}/><meshStandardMaterial ref={material} color={DESK_COLORS[current.id]} roughness={.7}/></mesh>;
}

/** Retains loaded cases, but only active/transition peripherals need scene resources. */
function ComputerRig({profile,current,previous,transition,onReady,onBoot,interaction,moving,reduced}: {profile:HardwareProfile;current:string;previous:string|null;transition:React.RefObject<Transition|null>;onReady:(asset:string)=>void;onBoot?:(step:number)=>void;interaction:(active:boolean)=>void;moving:boolean;reduced:boolean}) {
  const root=React.useRef<THREE.Group>(null!);
  const {gl,invalidate}=useThree();
  const reveal=React.useMemo(()=>({value:0,outgoing:{value:0}}),[]);
  const warmPhase=React.useRef<"compile"|"upload"|"ready">("compile");
  const warmTimer=React.useRef<ReturnType<typeof setTimeout>|undefined>(undefined);
  // Boot progress goes through a ref so these callbacks never change identity:
  // a new identity would re-run the rig's shader warm-up and hide it again.
  const bootRef=React.useRef(onBoot);React.useLayoutEffect(()=>{bootRef.current=onBoot;},[onBoot]);
  const compiled=React.useCallback(()=>{
    if(warmPhase.current!=="compile")return;
    mark(`compiled:${profile.id}`);bootRef.current?.(3);warmPhase.current="upload";invalidate();
  },[invalidate,profile.id]);
  const loaded=React.useCallback(()=>bootRef.current?.(2),[]);
  React.useEffect(()=>()=>clearTimeout(warmTimer.current),[]);
  const alignment=React.useMemo(()=>rigAlignment(profile),[profile]);
  const physics=React.useMemo<DeskWorld>(()=>{
    const fixed=alignedDeskObstacles(profile);
    return new Map([...fixed,switchObstacle(profile)].map((body,i)=>[`fixed-${i}`,body]));
  },[profile]);
  const shown=profile.asset===current||profile.asset===previous;
  React.useLayoutEffect(()=>{
    if(!shown)return;
    // Peripherals and the desk dissolve with the case, using their owned materials.
    root.current.traverse(object=>{if(object instanceof THREE.Mesh){
      const materials=Array.isArray(object.material)?object.material:[object.material];
      for(const material of materials)if(material.customProgramCacheKey()!=="storm-pixel-dissolve-v3"){
        addPixelDissolve(material,reveal);material.needsUpdate=true;
      }
    }});
    gl.shadowMap.needsUpdate=true;
  },[shown,gl,reveal]);
  useFrame(()=>{
    if(warmPhase.current!=="ready"){
      root.current.visible=warmPhase.current==="upload";
      reveal.value=0;reveal.outgoing.value=0;
      if(warmPhase.current==="upload"&&warmTimer.current===undefined){
        const casters:THREE.Mesh[]=[];
        root.current.traverse(object=>{if(object instanceof THREE.Mesh&&object.castShadow){casters.push(object);object.castShadow=false;}});
        // Runs after this normal render uploads the hidden rig's buffers and textures.
        warmTimer.current=setTimeout(()=>{
          casters.forEach(mesh=>{mesh.castShadow=true;});warmPhase.current="ready";
          gl.shadowMap.needsUpdate=true;onReady(profile.asset);invalidate();
        },0);
      }
      return;
    }
    const change=transition.current;
    const t=change?transitionAmount(performance.now(),change.start,reduced,change.duration):1;
    reveal.value=change&&profile.asset===change.from?1-t:profile.asset===current?(change?t:1):0;
    reveal.outgoing.value=change&&profile.asset===change.from?1:0;
    root.current.visible=reveal.value>0;
    if(change)gl.shadowMap.needsUpdate=true;
  });
  const keyboard=keyboardStart(profile.id);keyboard[1]=alignment.deskY;
  const mouse:[number,number,number]=[profile.mouse[0],alignment.deskY,profile.mouse[2]];
  const screen=profile.screen.position;
  return <group ref={root} position={alignment.offset} scale={alignment.scale} visible={shown}>
    {shown&&<ContactShadow profile={profile} deskY={alignment.deskY} reveal={reveal}/>}
    <group position={screen} quaternion={alignment.rotation}>
      <group position={[-screen[0],-screen[1],-screen[2]]}>
        <HardwareModel profile={profile} onReady={compiled} onLoaded={loaded} onInteractionChange={interaction} reveal={reveal} enabled={warmPhase.current==="ready"&&profile.asset===current&&!transition.current} spin={moving&&profile.id==="rgb"&&shown}/>
      </group>
    </group>
    {shown&&<>
      {profile.keyboard&&<RetroKeyboard position={keyboard} tone={profile.id==="rgb"?"modern":"classic"} bounds={{minX:-2.5,maxX:3.3,minZ:-1.9,maxZ:2.3}} physics={physics} onInteractionChange={interaction}/>}
      <RetroMouse position={mouse} bounds={{minX:profile.bounds[0],maxX:profile.bounds[1],minZ:profile.bounds[2],maxZ:profile.bounds[3]}} tone={profile.id==="classic"?"classic":"modern"} physics={physics} onInteractionChange={interaction}/>
    </>}
  </group>;
}

/** Fans ask for at most 30fps; static rigs and hidden pages have no recurring timer. */
function SceneTicker({moving,spinning,transition,reduced,onComplete,version}: {moving:boolean;spinning:boolean;version:string;transition:React.RefObject<Transition|null>;reduced:boolean;onComplete:()=>void}) {
  const invalidate=useThree(state=>state.invalidate);
  const timer=React.useRef<ReturnType<typeof setTimeout>|undefined>(undefined);
  React.useEffect(()=>{
    clearTimeout(timer.current);timer.current=undefined;
    if(moving||transition.current)invalidate();
    return()=>clearTimeout(timer.current);
  },[moving,spinning,transition,invalidate,reduced,version]);
  useFrame(()=>{
    clearTimeout(timer.current);timer.current=undefined;
    const change=transition.current;
    if(change){
      if(transitionAmount(performance.now(),change.start,reduced,change.duration)>=1)onComplete();
      else {invalidate();return;}
    }
    if(moving&&spinning)timer.current=setTimeout(()=>invalidate(),1000/30);
  });
  return null;
}

class RigBoundary extends React.Component<{asset:string;onFailure:(asset:string)=>void;children:React.ReactNode},{failed:boolean}> {
  state={failed:false};
  static getDerivedStateFromError(){return {failed:true};}
  componentDidCatch(){this.props.onFailure(this.props.asset);}
  render(){return this.state.failed?null:this.props.children;}
}

export default function OldMac3D({onScreenSlot,onScreenTap,active=true}: {onScreenSlot:(slot:HTMLElement,mounted?:boolean)=>void;onScreenTap?:()=>void;active?:boolean}) {
  const isMobile=useIsMobileViewport();
  const [profiles]=React.useState(()=>HARDWARE_PROFILES.map(profile=>profile.id==="classic"&&readStoredSetting("storm-mac-soft-case-v1")==="1"?{...profile,asset:"/models/studio-mac-rounded.glb"}:profile));
  const [selected,setSelected]=React.useState(()=>hardwareProfile(readStoredSetting(HARDWARE_STORAGE_KEY)).id);
  const [current,setCurrent]=React.useState(()=>profiles.find(profile=>profile.id===selected)!);
  const [previous,setPrevious]=React.useState<HardwareProfile|null>(null);
  const [library,setLibrary]=React.useState(()=>[selected]);
  const [prepared,setPrepared]=React.useState<string[]>([]);
  const [failed,setFailed]=React.useState<string[]>([]);
  const [canvasVersion,setCanvasVersion]=React.useState(0);
  const [lightingVersion,setLightingVersion]=React.useState(0);
  const [contextFailed,setContextFailed]=React.useState(false);
  const recoveryAttempts=React.useRef(0);
  const controlsRef=React.useRef<OrbitControlsImpl|null>(null);
  const screenPinRef=React.useRef<HTMLDivElement>(null!),invalidateRef=React.useRef<()=>void>(()=>{});
  const screenResized=React.useCallback(()=>{invalidateRef.current();window.dispatchEvent(new Event("resize"));},[]);
  const eventSourceRef=React.useRef<HTMLDivElement>(null!);
  const screenOverlayRef=React.useRef<HTMLDivElement>(null!);
  const tapRef=React.useRef(onScreenTap);
  const transition=React.useRef<Transition|null>(null);
  const swordCue=React.useRef<SwordCue|null>(null);
  const pendingMode=React.useRef<TransitionMode>("scan");
  const [screenFx,setScreenFx]=React.useState<ScreenFx>(null);
  const [notice,setNotice]=React.useState("");
  const [pulling,setPulling]=React.useState(false);
  /** First load: rain and a boot readout, then the computer warps in once it is fully ready. */
  const [intro,setIntro]=React.useState<"loading"|"revealing"|"done">("loading");
  const [boot,setBoot]=React.useState(0);
  const introReveal=React.useMemo(()=>({value:0,outgoing:{value:0}}),[]);
  const bootStep=React.useCallback((step:number)=>setBoot(value=>Math.max(value,step)),[]);
  const {moving,reduced}=useSceneMotion(active);
  const nextProfile=profiles.find(profile=>profile.id===selected)!;
  React.useEffect(()=>{tapRef.current=onScreenTap;},[onScreenTap]);
  React.useEffect(()=>{if(!active)window.dispatchEvent(new Event("storm-hardware-cancel"));},[active]);
  const ready=React.useCallback((asset:string)=>{mark(`ready:${asset}`);setPrepared(value=>value.includes(asset)?value:[...value,asset]);},[]);
  const activeRef=React.useRef(active);React.useLayoutEffect(()=>{activeRef.current=active;},[active]);
  const interaction=React.useCallback((busy:boolean)=>{if(controlsRef.current)controlsRef.current.enabled=activeRef.current&&!busy;},[]);
  const select=React.useCallback((id:typeof selected)=>{
    setLibrary(value=>value.includes(id)?value:[...value,id]);
    setSelected(id);writeStoredSetting(HARDWARE_STORAGE_KEY,id);
  },[]);
  const index=profiles.findIndex(profile=>profile.id===selected);
  const available=profiles.filter(profile=>!failed.includes(profile.asset));
  const position=available.findIndex(profile=>profile.id===selected);
  const isLast=position===available.length-1;
  const following=available[position+1]??available[0]??current;
  const busy=selected!==current.id||!!previous||pulling||intro!=="done";
  const warm=()=>{useGLTF.preload(following.asset);setLibrary(value=>value.includes(following.id)?value:[...value,following.id]);};
  const forward=()=>{
    if(busy)return;
    if(isLast){swordCue.current={kind:"hum",start:performance.now()};setNotice("The sword hums.");return;}
    mark(`switch-click:${following.id}`);pendingMode.current="scan";setNotice("");select(following.id);
  };
  const pull=()=>{
    if(busy)return;
    if(!isLast||available.length<2){swordCue.current={kind:"rattle",start:performance.now()};setNotice("The sword will not budge.");return;}
    const first=available[0];
    mark(`switch-click:${first.id}`);swordCue.current={kind:"pull",start:performance.now()};setPulling(true);setNotice("");
    setLibrary(value=>value.includes(first.id)?value:[...value,first.id]);
    setTimeout(()=>{pendingMode.current="warp";select(first.id);},reduced?0:300);
  };
  const rigFailure=React.useCallback((asset:string)=>{
    setFailed(value=>value.includes(asset)?value:[...value,asset]);
    if(asset===current.asset)setContextFailed(true);
    else setSelected(current.id);
  },[current]);
  const complete=React.useCallback(()=>{mark("switch-end");transition.current=null;if(swordCue.current?.kind==="pull")swordCue.current=null;setPulling(false);setPrevious(null);setScreenFx(null);setIntro(value=>value==="revealing"?"done":value);},[]);
  const [sceneCompiled,setSceneCompiled]=React.useState(false);
  React.useEffect(()=>{
    if(intro!=="loading"||!prepared.includes(current.asset)||!sceneCompiled||transition.current)return;
    // Warp in from nothing: no outgoing rig, same blue effect as pulling the sword.
    const start=performance.now();HARDWARE_FX.mode.value=1;
    mark("intro-start");transition.current={from:"",to:current.asset,start,mode:"warp",duration:INTRO_MS};
    setScreenFx({mode:"warp",start,duration:INTRO_MS});setIntro("revealing");
  },[intro,prepared,current,sceneCompiled]);
  React.useEffect(()=>{
    if(nextProfile.asset===current.asset||!prepared.includes(nextProfile.asset)||transition.current)return;
    window.dispatchEvent(new Event("storm-hardware-cancel"));
    const mode=pendingMode.current,duration=mode==="warp"?WARP_MS:TRANSITION_MS,start=performance.now();
    pendingMode.current="scan";HARDWARE_FX.mode.value=mode==="warp"?1:0;
    mark("switch-start");transition.current={from:current.asset,to:nextProfile.asset,start,mode,duration};
    setPrevious(current);setCurrent(nextProfile);setScreenFx({mode,start,duration});
  },[nextProfile,current,prepared,previous]);
  React.useEffect(()=>{
    if(!active||!prepared.includes(current.asset)||library.some(id=>{const asset=profiles.find(profile=>profile.id===id)!.asset;return !prepared.includes(asset)&&!failed.includes(asset);}))return;
    const next=profiles.find(profile=>!library.includes(profile.id)&&!failed.includes(profile.asset));if(!next)return;
    const timer=setTimeout(()=>setLibrary(value=>value.includes(next.id)?value:[...value,next.id]),400);
    return()=>clearTimeout(timer);
  },[active,prepared,current,library,profiles,failed]);
  const restoreLighting=React.useCallback(()=>setLightingVersion(value=>value+1),[]);
  const recoverContext=React.useCallback(()=>{
    transition.current=null;swordCue.current=null;setPulling(false);setPrevious(null);setPrepared([]);setScreenFx(null);setIntro("loading");setBoot(0);
    if(recoveryAttempts.current++===0)setCanvasVersion(value=>value+1);else setContextFailed(true);
  },[]);
  const screen=React.useMemo(()=>screenFor(current),[current]);
  const fromScreen=React.useMemo(()=>previous?screenFor(previous):screen,[previous,screen]);
  if(contextFailed)throw new Error("The graphics context could not be restored.");
  return <div className={`r3f-wrap ${styles.stage}`} data-intro={intro} data-hardware={current.id} data-prepared-models={prepared.length} data-transition={previous?transition.current?.mode??"dissolve":"idle"}>
    <div ref={eventSourceRef} className={styles.canvas}>
      <Canvas key={canvasVersion} frameloop={active?"demand":"never"} shadows dpr={isMobile?[1,1.5]:[1,2]} eventSource={eventSourceRef} camera={{position:INITIAL_CAMERA,fov:CAMERA_FOV}} onCreated={state=>{mark("canvas-created");bootStep(1);if(location.search.includes("perf"))Object.assign(window,{__stormThree:state});state.gl.shadowMap.autoUpdate=false;state.gl.shadowMap.needsUpdate=true;}}>
        <StudioLighting key={lightingVersion}/>
        <ContextRecovery onRestore={restoreLighting} onRecover={recoverContext} active={active}/>
        {profiles.filter(profile=>library.includes(profile.id)).map(profile=><RigBoundary key={profile.asset} asset={profile.asset} onFailure={rigFailure}><React.Suspense fallback={null}>
          <ComputerRig profile={profile} current={current.asset} previous={previous?.asset??null} transition={transition} onReady={ready} onBoot={profile.asset===current.asset&&intro==="loading"?bootStep:undefined} interaction={interaction} moving={moving} reduced={reduced}/>
        </React.Suspense></RigBoundary>)}
        <SceneCompileGate ready={prepared.includes(current.asset)} onCompiled={()=>setSceneCompiled(true)}/>
        <FxDriver transition={transition} reduced={reduced} intro={introReveal} introDone={intro==="done"}/>
        <SwordPedestal portalRef={screenOverlayRef} index={index} label={PLAQUE_LABELS[profiles[index].id]} isLast={isLast} busy={busy} onForward={forward} onPull={pull} onWarm={warm}
          deskY={DESK_Y} oldDeskY={DESK_Y} scale={1} oldScale={1} transition={transition} cue={swordCue} reduced={reduced} reveal={introReveal}/>
        <TimeWarpFX transition={transition} cue={swordCue} reduced={reduced} deskY={DESK_Y} oldDeskY={DESK_Y}/>
        <SharedDesk current={current} previous={previous} transition={transition} reduced={reduced} reveal={introReveal}/>
        <pointLight position={[2.5,.4,.6]} color="#77f7dd" intensity={current.id==="rgb"?1.3:0} distance={2.4}/><pointLight position={[2,-.3,.5]} color="#be91ff" intensity={current.id==="rgb"?.8:0} distance={2}/>
        <ScreenPin screen={screen} from={fromScreen} transition={transition} pinRef={screenPinRef} reduced={reduced} invalidateRef={invalidateRef} onSettled={screenResized}/>
        <OrbitControls makeDefault ref={controlsRef} enabled={active} enableDamping dampingFactor={.09} enablePan={false} minDistance={1.5} maxDistance={70} minAzimuthAngle={-Math.PI/3} maxAzimuthAngle={Math.PI/3} minPolarAngle={Math.PI/4} maxPolarAngle={Math.PI/2.02}/>
        <SceneFraming controlsRef={controlsRef}/>
        <ScreenAlignmentGuard overlayRef={screenOverlayRef} screen={screen} transition={transition}/>
        <SceneTicker version={current.asset+intro} moving={moving} spinning={current.id==="rgb"||previous?.id==="rgb"} transition={transition} reduced={reduced} onComplete={complete}/>
      </Canvas>
    </div>
    <div ref={screenOverlayRef} className={styles.screenOverlay}>
      {/* Never keyed by hardware: the desktop's DOM host and all app state survive every change. */}
      <div ref={screenPinRef} className={styles.screenPin}>
        <ScreenSlot screen={screen} glass={current.id} reduced={reduced} fx={screenFx} onSlot={onScreenSlot} onResized={screenResized} tapRef={tapRef}/>
      </div>
    </div>
    {intro!=="done"&&<BootScreen step={boot} leaving={intro==="revealing"}/>}
    <span className={styles.status} role="status">{intro==="loading"?"Loading the 3D desk…":selected!==current.id?"Preparing computer…":notice||`${current.label}. Press the button on the sword's stone to switch computer.`}</span>
  </div>;
}
