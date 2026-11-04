"use client";
import {useEffect,useRef,type FocusEvent} from "react";
import styles from "./Arcade.module.css";

/**
 * Pause only when focus really leaves the game. A click on an unfocusable part of the game
 * reports no destination (Safari does this for every button), so that keeps the game running
 * and hands the keyboard back to its board.
 */
export function handleGameBlur(event:FocusEvent<HTMLElement>,pause:()=>void,board:()=>HTMLElement|null|undefined) {
  const shell=event.currentTarget,next=event.relatedTarget as Node|null;
  if(next?!shell.contains(next):!shell.matches(":hover")){pause();return;}
  if(!next)requestAnimationFrame(()=>{if(document.activeElement===document.body)board()?.focus({preventScroll:true});});
}

export default function ArcadeMenu({title,controls=[],action,label="Resume",restart}: {title:string;controls?:string[];action:()=>void;label?:string;restart?:()=>void}) {
  const menu=useRef<HTMLDivElement>(null);
  // A game paused because the visitor went elsewhere must not pull focus back from there.
  useEffect(()=>{
    const frame=requestAnimationFrame(()=>{
      const dialog=menu.current,shell=dialog?.closest(`.${styles.shell}`),active=document.activeElement;
      if(!shell)return;
      if(shell.contains(active)||((!active||active===document.body)&&shell.matches(":hover")))dialog?.querySelector("button")?.focus({preventScroll:true});
    });
    return()=>cancelAnimationFrame(frame);
  },[]);
  return <div className={styles.overlay}><div ref={menu} className={styles.dialog} role="dialog" aria-label={title} onKeyDown={event=>{
    if(event.key!=="Tab")return;
    const buttons=Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>("button"));
    if(event.shiftKey&&document.activeElement===buttons[0]){event.preventDefault();buttons.at(-1)?.focus();}
    else if(!event.shiftKey&&document.activeElement===buttons.at(-1)){event.preventDefault();buttons[0]?.focus();}
  }}><h2>{title}</h2>{controls.length>0&&<ul>{controls.map(line=><li key={line}>{line}</li>)}</ul>}<button onClick={action}>{label}</button>{restart&&<button className={styles.secondary} onClick={restart}>Restart</button>}</div></div>;
}
