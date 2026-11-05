"use client";

import { Canvas, useFrame, useThree, type ThreeEvent } from "@react-three/fiber";
import { Environment, Html, Lightformer, OrbitControls, useGLTF } from "@react-three/drei";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import * as React from "react";
import * as THREE from "three";
import { reportInteraction, RetroKeyboard, RetroMouse } from "./RetroHardware";
import type { DeskWorld } from "./deskPhysics";
import { readStoredSetting, useIsMobileViewport, useMediaQuery, writeStoredSetting } from "./FullscreenContext";
import { framingDistance, HARDWARE_PROFILES, HARDWARE_STORAGE_KEY, hardwareProfile, keyboardStart, screenScale, type HardwareProfile } from "./hardwareProfiles";
import { addPixelDissolve, alignedDeskObstacles, FIXED_FRAMING, FIXED_SCREEN, prepareFanRotors, rigAlignment, SWITCH_POSITION, switchObstacle, transitionAmount } from "./hardwareScene";
import styles from "./HardwareGallery.module.css";

const CAMERA_FOV = 28;
const INITIAL_CAMERA: [number,number,number] = [1.2,1.3,9];
type ControlsRef = React.RefObject<OrbitControlsImpl|null>;
type Transition = {from:string;to:string;start:number};

export function preloadHardware() {
  const chosen=hardwareProfile(readStoredSetting(HARDWARE_STORAGE_KEY));
  const soft=readStoredSetting("storm-mac-soft-case-v1")==="1";
  useGLTF.preload(chosen.id==="classic"&&soft?"/models/studio-mac-rounded.glb":chosen.asset);
  // The three self-contained assets total about 3 MB; loader cache also retains parsed scenes.
  HARDWARE_PROFILES.filter(profile=>profile.id!==chosen.id).forEach(profile=>useGLTF.preload(profile.id==="classic"&&soft?"/models/studio-mac-rounded.glb":profile.asset));
}

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
function HardwareModel({ profile, onReady, onInteractionChange, enabled, reveal, spin }: { profile: HardwareProfile; onReady: (url:string) => void; onInteractionChange: (active:boolean) => void; enabled:boolean; reveal:{value:number;outgoing?:{value:number}}; spin:boolean }) {
  const {scene:cached} = useGLTF(profile.asset);
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
    return {scene,materials,rotors:prepareFanRotors(scene)};
  },[cached,reveal]);
  const {scene,rotors}=prepared;
  React.useEffect(()=>()=>prepared.materials.forEach(material=>material.dispose()),[prepared]);
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
        for(const material of materials) if(material instanceof THREE.MeshStandardMaterial) material.envMapIntensity=.75;
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

function ScreenSlot({onSlot,onMounted,tapRef,profile}: {onSlot:(slot:HTMLElement,mounted?:boolean)=>void;onMounted:()=>void;tapRef:React.RefObject<(()=>void)|undefined>;profile:HardwareProfile}) {
  const slotRef=React.useRef<HTMLDivElement>(null!);
  React.useLayoutEffect(()=>{const slot=slotRef.current;onSlot(slot);return()=>onSlot(slot,false);},[onSlot]);
  React.useLayoutEffect(()=>{onMounted();},[onMounted,profile.screen.cssWidth,profile.screen.cssHeight]);
  React.useEffect(()=>{
    const slot=slotRef.current;
    const click=(event:MouseEvent)=>{if(tapRef.current){event.preventDefault();event.stopPropagation();tapRef.current();}};
    slot.addEventListener("click",click,true);return()=>slot.removeEventListener("click",click,true);
  },[tapRef]);
  const {cssWidth,cssHeight,radius}=profile.screen;
  return <div className="model-screen-html" style={{width:cssWidth,height:cssHeight,position:"relative",pointerEvents:"auto",borderRadius:radius,overflow:"hidden"}}>
    <div ref={slotRef} className="embedded-screen model-screen" style={{width:cssWidth,height:cssHeight,position:"relative"}}/>
  </div>;
}

function ScreenAnchor({profile,groupRef,portalRef,onSlot,tapRef}: {profile:HardwareProfile;groupRef:React.RefObject<THREE.Group|null>;portalRef:React.RefObject<HTMLDivElement>;onSlot:(slot:HTMLElement,mounted?:boolean)=>void;tapRef:React.RefObject<(()=>void)|undefined>}) {
  const invalidate=useThree(state=>state.invalidate);
  const requestFrame=React.useCallback(()=>{invalidate();window.dispatchEvent(new Event("resize"));},[invalidate]);
  // This slot is never keyed by hardware. Its DOM host and all app state survive every change.
  React.useLayoutEffect(()=>{invalidate();},[invalidate]);
  return <group ref={groupRef} position={profile.screen.position} rotation={profile.screen.rotation}>
    <Html transform center wrapperClass={styles.htmlPortal} portal={portalRef} scale={screenScale(profile)} zIndexRange={[100,0]}>
      <ScreenSlot profile={profile} onSlot={onSlot} onMounted={requestFrame} tapRef={tapRef}/>
    </Html>
  </group>;
}

function StudioLighting(){
  return <>
    <hemisphereLight intensity={.8} groundColor="#aaa18a"/>
    <directionalLight castShadow position={[4,7,5]} intensity={2.2} color="#fff2dd" shadow-mapSize={[1024,1024]} shadow-bias={-.0003} shadow-camera-left={-5} shadow-camera-right={5} shadow-camera-top={5} shadow-camera-bottom={-5}/>
    <directionalLight position={[-4,3,-2]} intensity={1.2} color="#d9e5ff"/>
    <Environment frames={1} resolution={128}>
      <Lightformer form="rect" intensity={3} position={[0,5,0]} rotation={[Math.PI/2,0,0]} scale={[10,5,1]}/>
      <Lightformer form="rect" intensity={2} position={[-5,2,2]} rotation={[0,Math.PI/2,0]} scale={[5,5,1]}/>
      <Lightformer form="rect" intensity={1.5} position={[4,1,-3]} rotation={[0,-Math.PI/2,0]} scale={[3,6,1]}/>
    </Environment>
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
    const profile={framing:FIXED_FRAMING} as HardwareProfile;
    const distance=framingDistance(profile,aspect,(camera as THREE.PerspectiveCamera).fov);
    const [x,y,z]=FIXED_FRAMING.target;
    camera.position.set(x+Math.sin(.16)*distance,y+distance*.22,z+Math.cos(.16)*distance);
    controlsRef.current?.target.set(x,y,z);controlsRef.current?.update();camera.lookAt(x,y,z);invalidate();
  },[camera,aspect,controlsRef,invalidate]);
  return null;
}

function DeskSwitch({index,onNext,onWarm,deskY,oldDeskY,transition,reduced,busy,portalRef}: {index:number;onNext:()=>void;onWarm:()=>void;deskY:number;oldDeskY:number;transition:React.RefObject<Transition|null>;reduced:boolean;busy:boolean;portalRef:React.RefObject<HTMLDivElement>}) {
  const label=React.useMemo(()=>{
    const canvas=document.createElement("canvas");canvas.width=256;canvas.height=128;
    const ctx=canvas.getContext("2d")!;
    ctx.fillStyle="#202820";ctx.fillRect(0,0,256,128);
    ctx.fillStyle="#efca7a";ctx.font="bold 37px monospace";ctx.textAlign="center";
    ctx.fillText(`SYS 0${index+1}`,128,51);
    ctx.font="22px monospace";ctx.fillStyle="#c1c8aa";ctx.fillText(["MAC","LAPTOP","RTX"][index],128,94);
    const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;texture.magFilter=THREE.NearestFilter;
    return texture;
  },[index]);
  React.useEffect(()=>()=>label.dispose(),[label]);
  const stem=Math.max(.08,SWITCH_POSITION[1]-.39-deskY);
  const pole=React.useRef<THREE.Mesh>(null!),foot=React.useRef<THREE.Mesh>(null!);
  useFrame(()=>{
    const change=transition.current,t=change?transitionAmount(performance.now(),change.start,reduced):1;
    const height=Math.max(.08,SWITCH_POSITION[1]-.39-THREE.MathUtils.lerp(oldDeskY,deskY,t));
    pole.current.scale.y=height;pole.current.position.y=-.39-height/2;foot.current.position.y=-.39-height;
  });
  return <group position={SWITCH_POSITION}>
    <mesh ref={pole} castShadow scale={[1,stem,1]} position={[0,-.39-stem/2,0]}><boxGeometry args={[.10,1,.10]}/><meshStandardMaterial color="#756e5e" roughness={.8}/></mesh>
    <mesh ref={foot} castShadow position={[0,-.39-stem,0]}><boxGeometry args={[.55,.06,.43]}/><meshStandardMaterial color="#aaa18a" roughness={.8}/></mesh>
    <mesh castShadow><boxGeometry args={[.65,.76,.20]}/><meshStandardMaterial color="#c8bfa3" roughness={.7}/></mesh>
    <mesh position={[0,.19,.105]}><planeGeometry args={[.53,.265]}/><meshBasicMaterial map={label}/></mesh>
    <mesh position={[0,-.15,.14]} castShadow onPointerOver={onWarm} onPointerDown={event=>event.stopPropagation()} onClick={event=>{event.stopPropagation();if(event.delta<7)onNext();}}>
      <boxGeometry args={[.36,.23,.13]}/><meshStandardMaterial color="#c65c3c" roughness={.6}/>
    </mesh>
    <mesh position={[.26,-.30,.108]}><circleGeometry args={[.021,8]}/><meshBasicMaterial color={busy?"#f8bd50":"#96cd75"}/></mesh>
    <Html transform center wrapperClass={styles.htmlPortal} portal={portalRef} position={[0,0,.215]} scale={.36} zIndexRange={[150,101]}>
      <button className={styles.switchHit} aria-label={`Switch computer. Current: ${HARDWARE_PROFILES[index].label}`} title="Switch computer" onFocus={onWarm} onPointerDown={event=>event.stopPropagation()} onClick={event=>{event.stopPropagation();onNext();}}>NEXT</button>
    </Html>
  </group>;
}

/** Retains loaded cases, but only active/transition peripherals need scene resources. */
function ComputerRig({profile,current,previous,transition,onReady,interaction,moving,reduced}: {profile:HardwareProfile;current:string;previous:string|null;transition:React.RefObject<Transition|null>;onReady:(asset:string)=>void;interaction:(active:boolean)=>void;moving:boolean;reduced:boolean}) {
  const root=React.useRef<THREE.Group>(null!);
  const {gl,invalidate}=useThree();
  const reveal=React.useMemo(()=>({value:0,outgoing:{value:0}}),[]);
  const warmPhase=React.useRef<"compile"|"upload"|"ready">("compile");
  const warmTimer=React.useRef<ReturnType<typeof setTimeout>|undefined>(undefined);
  const compiled=React.useCallback(()=>{warmPhase.current="upload";invalidate();},[invalidate]);
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
      for(const material of materials)if(material.customProgramCacheKey()!=="storm-pixel-dissolve-v2"){
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
    const t=change?transitionAmount(performance.now(),change.start,reduced):1;
    reveal.value=change&&profile.asset===change.from?1-t:profile.asset===current?(change?t:1):0;
    reveal.outgoing.value=change&&profile.asset===change.from?1:0;
    root.current.visible=reveal.value>0;
    if(change)gl.shadowMap.needsUpdate=true;
  });
  const keyboard=keyboardStart(profile.id);keyboard[1]=alignment.deskY;
  const mouse:[number,number,number]=[profile.mouse[0],alignment.deskY,profile.mouse[2]];
  const screen=profile.screen.position;
  return <group ref={root} position={alignment.offset} scale={alignment.scale} visible={shown}>
    <group position={screen} quaternion={alignment.rotation}>
      <group position={[-screen[0],-screen[1],-screen[2]]}>
        <HardwareModel profile={profile} onReady={compiled} onInteractionChange={interaction} reveal={reveal} enabled={warmPhase.current==="ready"&&profile.asset===current&&!transition.current} spin={moving&&profile.id==="rgb"&&shown}/>
      </group>
    </group>
    {shown&&<>
      <mesh receiveShadow position={[.4,alignment.deskY-.05,.2]}><boxGeometry args={[8.4,.1,5.4]}/><meshStandardMaterial color={profile.id==="rgb"?"#292f38":"#aaa18d"} roughness={.7}/></mesh>
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
      if(transitionAmount(performance.now(),change.start,reduced)>=1)onComplete();
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
  const screenRef=React.useRef<THREE.Group|null>(null);
  const eventSourceRef=React.useRef<HTMLDivElement>(null!);
  const screenOverlayRef=React.useRef<HTMLDivElement>(null!);
  const tapRef=React.useRef(onScreenTap);
  const transition=React.useRef<Transition|null>(null);
  const {moving,reduced}=useSceneMotion(active);
  const nextProfile=profiles.find(profile=>profile.id===selected)!;
  React.useEffect(()=>{tapRef.current=onScreenTap;},[onScreenTap]);
  React.useEffect(()=>{if(!active)window.dispatchEvent(new Event("storm-hardware-cancel"));},[active]);
  const ready=React.useCallback((asset:string)=>setPrepared(value=>value.includes(asset)?value:[...value,asset]),[]);
  const activeRef=React.useRef(active);React.useLayoutEffect(()=>{activeRef.current=active;},[active]);
  const interaction=React.useCallback((busy:boolean)=>{if(controlsRef.current)controlsRef.current.enabled=activeRef.current&&!busy;},[]);
  const select=React.useCallback((id:typeof selected)=>{
    setLibrary(value=>value.includes(id)?value:[...value,id]);
    setSelected(id);writeStoredSetting(HARDWARE_STORAGE_KEY,id);
  },[]);
  const index=profiles.findIndex(profile=>profile.id===selected);
  const available=profiles.filter(profile=>!failed.includes(profile.asset));
  const following=available[(available.findIndex(profile=>profile.id===selected)+1)%available.length]??current;
  const warm=()=>{useGLTF.preload(following.asset);setLibrary(value=>value.includes(following.id)?value:[...value,following.id]);};
  const cycle=()=>select(following.id);
  const rigFailure=React.useCallback((asset:string)=>{
    setFailed(value=>value.includes(asset)?value:[...value,asset]);
    if(asset===current.asset)setContextFailed(true);
    else setSelected(current.id);
  },[current]);
  const complete=React.useCallback(()=>{transition.current=null;setPrevious(null);},[]);
  React.useEffect(()=>{
    if(nextProfile.asset===current.asset||!prepared.includes(nextProfile.asset)||transition.current)return;
    window.dispatchEvent(new Event("storm-hardware-cancel"));
    transition.current={from:current.asset,to:nextProfile.asset,start:performance.now()};
    setPrevious(current);setCurrent(nextProfile);
  },[nextProfile,current,prepared,previous]);
  React.useEffect(()=>{
    if(!active||!prepared.includes(current.asset)||library.some(id=>{const asset=profiles.find(profile=>profile.id===id)!.asset;return !prepared.includes(asset)&&!failed.includes(asset);}))return;
    const next=profiles.find(profile=>!library.includes(profile.id)&&!failed.includes(profile.asset));if(!next)return;
    const timer=setTimeout(()=>setLibrary(value=>value.includes(next.id)?value:[...value,next.id]),400);
    return()=>clearTimeout(timer);
  },[active,prepared,current,library,profiles,failed]);
  const restoreLighting=React.useCallback(()=>setLightingVersion(value=>value+1),[]);
  const recoverContext=React.useCallback(()=>{
    transition.current=null;setPrevious(null);setPrepared([]);
    if(recoveryAttempts.current++===0)setCanvasVersion(value=>value+1);else setContextFailed(true);
  },[]);
  const fixedProfile=React.useMemo(()=>({...profiles[0],screen:FIXED_SCREEN}),[profiles]);
  if(contextFailed)throw new Error("The graphics context could not be restored.");
  return <div className={`r3f-wrap ${styles.stage}`} data-hardware={current.id} data-prepared-models={prepared.length} data-transition={previous?"dissolve":"idle"}>
    <div ref={eventSourceRef} className={styles.canvas}>
      <Canvas key={canvasVersion} frameloop={active?"demand":"never"} shadows dpr={isMobile?[1,1.5]:[1,2]} eventSource={eventSourceRef} camera={{position:INITIAL_CAMERA,fov:CAMERA_FOV}} onCreated={state=>{state.gl.shadowMap.autoUpdate=false;state.gl.shadowMap.needsUpdate=true;}}>
        <StudioLighting key={lightingVersion}/>
        <ContextRecovery onRestore={restoreLighting} onRecover={recoverContext} active={active}/>
        {profiles.filter(profile=>library.includes(profile.id)).map(profile=><RigBoundary key={profile.asset} asset={profile.asset} onFailure={rigFailure}><React.Suspense fallback={null}>
          <ComputerRig profile={profile} current={current.asset} previous={previous?.asset??null} transition={transition} onReady={ready} interaction={interaction} moving={moving} reduced={reduced}/>
        </React.Suspense></RigBoundary>)}
        <DeskSwitch portalRef={screenOverlayRef} index={index} onNext={cycle} onWarm={warm} deskY={rigAlignment(current).worldDeskY} oldDeskY={rigAlignment(previous??current).worldDeskY} transition={transition} reduced={reduced} busy={selected!==current.id||!!previous}/>
        <pointLight position={[2.5,.4,.6]} color="#77f7dd" intensity={current.id==="rgb"?1.3:0} distance={2.4}/><pointLight position={[2,-.3,.5]} color="#be91ff" intensity={current.id==="rgb"?.8:0} distance={2}/>
        <ScreenAnchor profile={fixedProfile} groupRef={screenRef} portalRef={screenOverlayRef} onSlot={onScreenSlot} tapRef={tapRef}/>
        <OrbitControls makeDefault ref={controlsRef} enabled={active} enableDamping dampingFactor={.09} enablePan={false} minDistance={1.5} maxDistance={70} minAzimuthAngle={-Math.PI/3} maxAzimuthAngle={Math.PI/3} minPolarAngle={Math.PI/4} maxPolarAngle={Math.PI/2.02}/>
        <SceneFraming controlsRef={controlsRef}/>
        <SceneTicker version={current.asset} moving={moving} spinning={current.id==="rgb"||previous?.id==="rgb"} transition={transition} reduced={reduced} onComplete={complete}/>
      </Canvas>
    </div>
    <div ref={screenOverlayRef} className={styles.screenOverlay}/>
    <span className={styles.status} role="status">{selected!==current.id?"Preparing computer…":`${current.label}. Use the red button to switch computer.`}</span>
  </div>;
}
