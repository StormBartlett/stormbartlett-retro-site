"use client";

import { Canvas, useFrame, useThree, type RootState, type ThreeEvent } from "@react-three/fiber";
import { Environment, Html, Lightformer, OrbitControls, useGLTF } from "@react-three/drei";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import * as React from "react";
import * as THREE from "three";
import { reportInteraction, RetroKeyboard, RetroMouse } from "./RetroHardware";
import type { DeskWorld } from "./deskPhysics";
import { readStoredSetting, useIsMobileViewport, writeStoredSetting } from "./FullscreenContext";
import { deskObstacles, framingDistance, HARDWARE_PROFILES, HARDWARE_STORAGE_KEY, hardwareProfile, keyboardStart, screenScale, type HardwareProfile } from "./hardwareProfiles";
import styles from "./HardwareGallery.module.css";

const CAMERA_FOV = 28;
const VIEW_RESET_MS = 650;
const INITIAL_CAMERA: [number, number, number] = [1.2, 1.3, 9];
type ControlsRef = React.RefObject<OrbitControlsImpl | null>;
type CameraAnim = { startMs: number; fromPos: THREE.Vector3; toPos: THREE.Vector3; fromTarget: THREE.Vector3; toTarget: THREE.Vector3 };

function CameraAnimator({ controlsRef, animRef }: { controlsRef: ControlsRef; animRef: React.RefObject<CameraAnim | null> }) {
  const {camera, invalidate} = useThree();
  const target = React.useMemo(() => new THREE.Vector3(), []);
  useFrame(() => {
    const anim = animRef.current;
    if (!anim) return;
    const t = Math.min(1, Math.max(0, (performance.now() - anim.startMs) / VIEW_RESET_MS));
    const k = t*t*(3-2*t);
    camera.position.lerpVectors(anim.fromPos, anim.toPos, k);
    target.lerpVectors(anim.fromTarget, anim.toTarget, k);
    if(controlsRef.current) { controlsRef.current.target.copy(target); controlsRef.current.update(); }
    else camera.lookAt(target);
    if(t >= 1) animRef.current = null;
    invalidate();
  });
  return null;
}

/** Local Blender assets, including clickable laptop keycaps. No network textures or fonts. */
function HardwareModel({ profile, onReady, onInteractionChange }: { profile: HardwareProfile; onReady: (url:string) => void; onInteractionChange: (active:boolean) => void }) {
  const {scene} = useGLTF(profile.asset);
  const {invalidate} = useThree();
  const press = React.useRef<{ object: THREE.Object3D; y: number; key: string; pointer: number; x: number; cy: number; capture: {releasePointerCapture(id:number):void} | null } | null>(null);
  const latestInteraction = React.useRef(onInteractionChange);
  React.useEffect(() => {latestInteraction.current=onInteractionChange;},[onInteractionChange]);
  React.useLayoutEffect(() => {
    scene.traverse(object => {
      if(object instanceof THREE.Mesh) {
        const materials=Array.isArray(object.material)?object.material:[object.material];
        object.castShadow=!materials.some(material=>material.transparent);
        object.receiveShadow=true;
        for(const material of materials) if(material instanceof THREE.MeshStandardMaterial) material.envMapIntensity=.75;
      }
    });
    onReady(profile.asset); invalidate();
  },[scene, profile.asset, onReady, invalidate]);
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
    window.addEventListener("pointerup",end);window.addEventListener("pointercancel",end);window.addEventListener("blur",blur);
    return()=>{end();window.removeEventListener("pointerup",end);window.removeEventListener("pointercancel",end);window.removeEventListener("blur",blur);};
  },[invalidate]);
  const down=(event:ThreeEvent<PointerEvent>)=>{
    let hit:THREE.Object3D|null=event.object;
    while(hit && !hit.userData.key && !hit.userData.control) hit=hit.parent;
    if(!hit || (event.pointerType==="mouse" && event.button!==0)) return;
    event.stopPropagation();event.nativeEvent.preventDefault();
    const key=hit.userData.control==="trackpad"?"Meta":hit.userData.key;
    if(press.current) return;
    const capture=event.target as unknown as {setPointerCapture(id:number):void;releasePointerCapture(id:number):void};
    try{capture.setPointerCapture(event.pointerId);}catch{}
    press.current={object:hit,y:hit.position.y,key,pointer:event.pointerId,x:event.clientX,cy:event.clientY,capture};
    hit.position.y-=.012;reportInteraction(latestInteraction.current,true);invalidate();
  };
  return <primitive object={scene} onPointerDown={down}/>;
}

function ScreenSlot({onSlot,onMounted,tapRef,profile}: {onSlot:(slot:HTMLElement)=>void;onMounted:()=>void;tapRef:React.RefObject<(()=>void)|undefined>;profile:HardwareProfile}) {
  const slotRef=React.useRef<HTMLDivElement>(null!);
  React.useLayoutEffect(()=>{onSlot(slotRef.current);onMounted();},[onSlot,onMounted]);
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

function ScreenAnchor({profile,groupRef,portalRef,onSlot,tapRef}: {profile:HardwareProfile;groupRef:React.RefObject<THREE.Group|null>;portalRef:React.RefObject<HTMLDivElement>;onSlot:(slot:HTMLElement)=>void;tapRef:React.RefObject<(()=>void)|undefined>}) {
  const invalidate=useThree(state=>state.invalidate);
  const requestFrame=React.useCallback(()=>invalidate(),[invalidate]);
  // This slot is never keyed by hardware. Its DOM host and all app state survive every change.
  React.useLayoutEffect(()=>{invalidate();window.dispatchEvent(new Event("resize"));},[profile.id,invalidate]);
  return <group ref={groupRef} position={profile.screen.position} rotation={profile.screen.rotation}>
    <Html transform center portal={portalRef} scale={screenScale(profile)} zIndexRange={[100,0]}>
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

function SceneFraming({profile,controlsRef,version}: {profile:HardwareProfile;controlsRef:ControlsRef;version:number}) {
  const {camera,size,invalidate}=useThree();
  React.useEffect(()=>{
    const distance=framingDistance(profile,size.width/size.height,(camera as THREE.PerspectiveCamera).fov);
    const [x,y,z]=profile.framing.target;
    const angle=profile.id==="rgb"?.34:profile.id==="laptop"?.11:.16;
    camera.position.set(x+Math.sin(angle)*distance,y+distance*.22,z+Math.cos(angle)*distance);
    controlsRef.current?.target.set(x,y,z);controlsRef.current?.update();camera.lookAt(x,y,z);invalidate();
  },[camera,size.width,size.height,profile,controlsRef,invalidate,version]);
  return null;
}

export default function OldMac3D({onScreenSlot,onScreenTap}: {onScreenSlot:(slot:HTMLElement)=>void;onScreenTap?:()=>void}) {
  const isMobile=useIsMobileViewport();
  const [baseProfile,setProfile]=React.useState(()=>hardwareProfile(readStoredSetting(HARDWARE_STORAGE_KEY)));
  const [softCase,setSoftCase]=React.useState(()=>readStoredSetting("storm-mac-soft-case-v1")==="1");
  const profile=React.useMemo(()=>baseProfile.id==="classic"&&softCase?{...baseProfile,asset:"/models/studio-mac-rounded.glb"}:baseProfile,[baseProfile,softCase]);
  const physics=React.useMemo<DeskWorld>(()=>new Map(deskObstacles(profile.id).map((body,i)=>[`fixed-${i}`,body])),[profile.id]);
  const [deskVersion,setDeskVersion]=React.useState(0);
  const [loadedAsset,setLoadedAsset]=React.useState("");
  const screenRef=React.useRef<THREE.Group|null>(null);
  const controlsRef=React.useRef<OrbitControlsImpl|null>(null);
  const animRef=React.useRef<CameraAnim|null>(null);
  const getStateRef=React.useRef<(()=>RootState)|null>(null);
  const eventSourceRef=React.useRef<HTMLDivElement>(null!);
  const screenOverlayRef=React.useRef<HTMLDivElement>(null!);
  const tapRef=React.useRef(onScreenTap);
  React.useEffect(()=>{tapRef.current=onScreenTap;},[onScreenTap]);
  const ready=React.useCallback((url:string)=>setLoadedAsset(url),[]);
  const interaction=React.useCallback((active:boolean)=>{animRef.current=null;if(controlsRef.current)controlsRef.current.enabled=!active;},[]);
  const select=React.useCallback((id:string)=>{
    const next=hardwareProfile(id);setProfile(next);writeStoredSetting(HARDWARE_STORAGE_KEY,next.id);animRef.current=null;
  },[]);
  const index=HARDWARE_PROFILES.findIndex(item=>item.id===profile.id);
  const cycle=(step:number)=>select(HARDWARE_PROFILES[(index+step+HARDWARE_PROFILES.length)%HARDWARE_PROFILES.length].id);
  const reset=()=>{animRef.current=null;setDeskVersion(version=>version+1);};
  const zoomToScreen=()=>{
    const state=getStateRef.current?.(),screen=screenRef.current;
    if(!state || !screen)return;
    screen.updateWorldMatrix(true,false);
    const target=screen.getWorldPosition(new THREE.Vector3());
    const normal=new THREE.Vector3(0,0,1).applyQuaternion(screen.getWorldQuaternion(new THREE.Quaternion()));
    const tangent=Math.tan((state.camera as THREE.PerspectiveCamera).fov*Math.PI/360);
    const distance=Math.max(profile.screen.height/(2*tangent),profile.screen.width/(2*tangent*(state.size.width/state.size.height)))*1.10;
    animRef.current={startMs:performance.now(),fromPos:state.camera.position.clone(),toPos:target.clone().addScaledVector(normal,distance),fromTarget:controlsRef.current?.target.clone()??target.clone(),toTarget:target};state.invalidate();
  };
  const bounds={minX:profile.bounds[0],maxX:profile.bounds[1],minZ:profile.bounds[2],maxZ:profile.bounds[3]};
  return <div className={`r3f-wrap ${styles.stage}`} data-hardware={profile.id}>
    <div ref={eventSourceRef} className={styles.canvas}>
      <Canvas frameloop="demand" shadows dpr={isMobile?[1,1.5]:[1,2]} eventSource={eventSourceRef} camera={{position:INITIAL_CAMERA,fov:CAMERA_FOV}} onCreated={state=>{getStateRef.current=state.get;}}>
        <StudioLighting/>
        {/* Rebind mesh hit testing per rig; the live screen below stays mounted. */}
        <React.Suspense fallback={null}>
          <HardwareModel key={profile.asset} profile={profile} onReady={ready} onInteractionChange={interaction}/>
        </React.Suspense>
        <mesh receiveShadow position={[.4,-1.59,.2]}>
          <boxGeometry args={[8.4,.10,5.4]}/><meshStandardMaterial color={profile.id==="rgb"?"#292f38":"#aaa18d"} roughness={.7}/>
        </mesh>
        {profile.keyboard&&<RetroKeyboard key={`${profile.id}-keyboard-${deskVersion}`} position={keyboardStart(profile.id)} tone={profile.id==="rgb"?"modern":"classic"} bounds={{minX:-2.5,maxX:3.3,minZ:-1.9,maxZ:2.3}} physics={physics} onInteractionChange={interaction}/>}
        <RetroMouse key={`${profile.id}-mouse-${deskVersion}`} position={profile.mouse} bounds={bounds} tone={profile.id==="classic"?"classic":"modern"} physics={physics} onInteractionChange={interaction}/>
        {profile.id==="rgb"&&<><pointLight position={[2.5,.4,.6]} color="#77f7dd" intensity={1.3} distance={2.4}/><pointLight position={[2,-.3,.5]} color="#be91ff" intensity={.8} distance={2}/></>}
        <ScreenAnchor profile={profile} groupRef={screenRef} portalRef={screenOverlayRef} onSlot={onScreenSlot} tapRef={tapRef}/>
        <OrbitControls makeDefault ref={controlsRef} enableDamping dampingFactor={.09} enablePan={false} minDistance={1.5} maxDistance={70} minAzimuthAngle={-Math.PI/3} maxAzimuthAngle={Math.PI/3} minPolarAngle={Math.PI/4} maxPolarAngle={Math.PI/2.02} onStart={()=>{animRef.current=null;}}/>
        {/* The case toggle swaps the model only, so it keeps the current camera view. */}
        <SceneFraming profile={baseProfile} controlsRef={controlsRef} version={deskVersion}/>
        <CameraAnimator controlsRef={controlsRef} animRef={animRef}/>
      </Canvas>
    </div>
    <div ref={screenOverlayRef} className={styles.screenOverlay}/>
    <section className={styles.selector} aria-label="Choose your computer">
      <div className={styles.eyebrow}><span>COMPUTER</span><span>0{index+1} / 03</span></div>
      <div className={styles.heading}><button onClick={()=>cycle(-1)} aria-label="Previous computer">‹</button><div><h1>{profile.label}</h1></div><button onClick={()=>cycle(1)} aria-label="Next computer">›</button></div>
      <div className={styles.tabs} role="group" aria-label="Computer models" onKeyDown={event=>{if(event.key==="ArrowRight"){event.preventDefault();cycle(1);}if(event.key==="ArrowLeft"){event.preventDefault();cycle(-1);}}}>
        {HARDWARE_PROFILES.map((item,i)=><button key={item.id} aria-pressed={profile.id===item.id} onClick={()=>select(item.id)}><span aria-hidden="true">0{i+1}</span>{item.id==="classic"?"Mac":item.id==="laptop"?"Laptop":"RTX PC"}</button>)}
      </div>
      <div className={styles.actions}><button onClick={zoomToScreen}>View screen ↗</button><button onClick={reset}>Reset desk</button>{profile.id==="classic"&&<button aria-pressed={softCase} onClick={()=>setSoftCase(value=>{writeStoredSetting("storm-mac-soft-case-v1",value?"0":"1");return !value;})}>{softCase?"Case: rounded":"Case: angular"}</button>}<span role="status">{loadedAsset===profile.asset?"":"Loading…"}</span></div>
    </section>
    <p className={styles.hint}>{profile.id==="laptop"?"Click keys to type · Trackpad to search":"Drag peripherals · Click keys to type"}</p>
  </div>;
}
