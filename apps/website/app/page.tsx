/**
 * from Paper
 * https://app.paper.design/file/01KN3QGZ2REZDFZ3FZCNWXEANN?node=F18-0
 * on Apr 4, 2026
 */
"use client";

import { useEffect, useRef, useState } from "react";
import { motion } from "motion/react";

import { ClaudeSpinner } from "./claude-spinner";

const NetworkPanel = ({ fixed }: { fixed: boolean }) => (
  <div className="[font-synthesis:none] flex flex-col bg-white antialiased border-t border-[#E5E5E5]">
    <div className="flex items-center justify-between relative pt-2.75 pr-3 pb-3.5 pl-3.75 h-10.75">
      <div className="left-4.75 top-3.75 w-52.75 h-7 rounded-lg absolute bg-white filter-[grayscale(100%)]" />
      <div className="flex left-0 top-0 items-center gap-1 relative p-0">
        <svg
          width="1em"
          height="1em"
          viewBox="0 0 24 24"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          style={{ flexShrink: "0" }}
        >
          <path
            fillRule="evenodd"
            clipRule="evenodd"
            d="M11.132 4.432C11.482 4.099 11.773 4 12 4C12.227 4 12.518 4.099 12.868 4.432C13.222 4.769 13.587 5.304 13.915 6.042C14.476 7.305 14.873 9.033 14.974 11H9.026C9.127 9.033 9.524 7.305 10.085 6.042C10.413 5.304 10.778 4.769 11.132 4.432ZM7.023 11C7.126 8.796 7.568 6.782 8.258 5.23C8.318 5.094 8.381 4.961 8.446 4.831C6.095 5.999 4.4 8.289 4.062 11H7.023ZM4.062 13H7.023C7.126 15.204 7.568 17.218 8.258 18.77C8.318 18.906 8.381 19.039 8.446 19.169C6.095 18.001 4.4 15.711 4.062 13ZM2 12C2 6.477 6.477 2 12 2C17.523 2 22 6.477 22 12C22 17.523 17.523 22 12 22C6.477 22 2 17.523 2 12ZM19.938 11C19.6 8.289 17.905 5.999 15.554 4.831C15.619 4.961 15.682 5.094 15.742 5.23C16.432 6.782 16.874 8.796 16.977 11H19.938ZM16.977 13H19.938C19.6 15.711 17.905 18.001 15.554 19.169C15.619 19.039 15.682 18.906 15.742 18.77C16.432 17.218 16.874 15.204 16.977 13ZM14.974 13C14.873 14.966 14.476 16.695 13.915 17.958C13.587 18.696 13.222 19.231 12.868 19.568C12.518 19.901 12.227 20 12 20C11.773 20 11.482 19.901 11.132 19.568C10.778 19.231 10.413 18.696 10.085 17.958C9.524 16.695 9.127 14.966 9.026 13H14.974Z"
            fill="#949494"
          />
        </svg>
        <div className="[letter-spacing:-0.125px] w-max text-[color(display-p3_0.332_0.332_0.332)] font-['OpenRunde-Medium','Open_Runde',system-ui,sans-serif] font-medium shrink-0 text-xs/4.5">
          Debug Log
        </div>
      </div>
      <svg
        version="1.1"
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 15.847 15.496"
        width="15.847"
        height="15.496"
        style={{
          left: "0px",
          top: "0px",
          width: "9px",
          height: "auto",
          position: "relative",
          flexShrink: "0",
        }}
      >
        <g>
          <path
            d="M0.253 15.243C0.594 15.575 1.161 15.575 1.493 15.243L7.743 8.993L13.993 15.243C14.325 15.575 14.901 15.585 15.233 15.243C15.565 14.901 15.565 14.345 15.233 14.012L8.983 7.753L15.233 1.503C15.565 1.171 15.575 0.604 15.233 0.272C14.891-0.07 14.325-0.07 13.993 0.272L7.743 6.522L1.493 0.272C1.161-0.07 0.585-0.079 0.253 0.272C-0.079 0.614-0.079 1.171 0.253 1.503L6.503 7.753L0.253 14.012C-0.079 14.345-0.089 14.911 0.253 15.243Z"
            fill="#939393D9"
          />
        </g>
      </svg>
    </div>
    <div className="flex flex-col relative pt-0.5 pr-2.25 pb-2.5 pl-3.75 gap-3.25 h-15.5">
      <div className="left-4.75 top-4 w-19.5 h-6.25 rounded-lg absolute bg-[#FBFBFB] filter-[grayscale(100%)]" />
      <motion.div
        className="left-0 top-4.5 w-68.5 h-4.5 absolute"
        style={{
          backgroundImage:
            "linear-gradient(in oklab 90deg, oklab(92.4% 0.044 0.024 / 0%) 2.47%, oklab(92.4% 0.044 0.024) 12.64%, oklab(92.4% 0.044 0.024 / 0%) 100%)",
        }}
        animate={{ opacity: fixed ? 0 : 1 }}
        transition={{ duration: 0.3 }}
      />
      <div className="flex items-center justify-between relative">
        <div className="flex items-center gap-1">
          <div className="rounded-full bg-[#E7E7E7] shrink-0 size-2" />
          <div className="w-15.25 h-2 rounded-full bg-[#E7E7E7] shrink-0" />
        </div>
        <div className="w-4 h-2 rounded-full bg-[#E7E7E7] shrink-0" />
      </div>
      <div className="flex items-center justify-between relative">
        <div className="flex items-center gap-1">
          <motion.div
            className="rounded-full shrink-0 size-2"
            animate={{ backgroundColor: fixed ? "#E7E7E7" : "#FF6C58" }}
            transition={{ duration: 0.3 }}
          />
          <motion.div
            className="w-27.5 h-2 rounded-full shrink-0"
            animate={{ backgroundColor: fixed ? "#E7E7E7" : "#FF9F8E" }}
            transition={{ duration: 0.3 }}
          />
        </div>
        <motion.div
          className="w-7.25 h-2 rounded-full shrink-0"
          animate={{ backgroundColor: fixed ? "#E7E7E7" : "#FFB1A2" }}
          transition={{ duration: 0.3 }}
        />
      </div>
      <div className="flex items-center justify-between relative">
        <div className="flex items-center gap-1">
          <div className="rounded-full bg-[#F1F1F1] shrink-0 size-2" />
          <div className="w-7.75 h-2 rounded-full bg-[#F1F1F1] shrink-0" />
        </div>
        <div className="w-4 h-2 rounded-full bg-[#F1F1F1] shrink-0" />
      </div>
    </div>
  </div>
);

interface AnimationConfig {
  codingDuration: number;
  slideDelay: number;
  diffDuration: number;
  cursorAppearDelay: number;
  cursorMoveDelay: number;
  cursorClickDelay: number;
  focusDelay: number;
  cursorAlertDelay: number;
  fixingDelay: number;
  fixDiffDelay: number;
  reloadDelay: number;
  reloadDuration: number;
  resetDelay: number;
  loopDelay: number;
  terminalScrollDuration: number;
  cursorMoveDuration: number;
  cursorEntranceStiffness: number;
  cursorEntranceDamping: number;
  cursorEntranceMass: number;
  browserSpringStiffness: number;
  browserSpringDamping: number;
  browserSpringMass: number;
  terminalSpringStiffness: number;
  terminalSpringDamping: number;
  terminalSpringMass: number;
  clickDuration: number;
  labelDuration: number;
  colorTransitionDuration: number;
}

const DEFAULT_CONFIG: AnimationConfig = {
  codingDuration: 1150,
  slideDelay: 700,
  diffDuration: 2100,
  cursorAppearDelay: 0,
  cursorMoveDelay: 1250,
  cursorClickDelay: 550,
  focusDelay: 50,
  cursorAlertDelay: 800,
  fixingDelay: 1400,
  fixDiffDelay: 1800,
  reloadDelay: 600,
  reloadDuration: 800,
  resetDelay: 2000,
  loopDelay: 400,
  terminalScrollDuration: 600,
  cursorMoveDuration: 400,
  cursorEntranceStiffness: 500,
  cursorEntranceDamping: 20,
  cursorEntranceMass: 400,
  browserSpringStiffness: 250,
  browserSpringDamping: 22,
  browserSpringMass: 600,
  terminalSpringStiffness: 120,
  terminalSpringDamping: 20,
  terminalSpringMass: 800,
  clickDuration: 100,
  labelDuration: 150,
  colorTransitionDuration: 300,
};

type AnimationPhase = "coding" | "diff" | "expect";
type CursorLabelState = "expect" | "security" | "alert" | "fixed";

function useAnimationPhase(config: AnimationConfig, onComplete: () => void) {
  const [phase, setPhase] = useState<AnimationPhase>("coding");
  const [slid, setSlid] = useState(false);
  const [focused, setFocused] = useState(false);
  const [cursorVisible, setCursorVisible] = useState(false);
  const [cursorOnBrowser, setCursorOnBrowser] = useState(false);
  const [clicking, setClicking] = useState(false);
  const [labelVisible, setLabelVisible] = useState(false);
  const [cursorLabel, setCursorLabel] = useState<CursorLabelState>("security");
  const [cursorOnTerminal] = useState(false);
  const [clickingTerminal] = useState(false);
  const [terminalFocused, setTerminalFocused] = useState(false);
  const [fixing, setFixing] = useState(false);
  const [fixDiff, setFixDiff] = useState(false);
  const [reloading, setReloading] = useState(false);
  const [reloadDone, setReloadDone] = useState(false);
  const [looping, setLooping] = useState(false);

  const onCompleteRef = useRef(onComplete);
  useEffect(() => {
    onCompleteRef.current = onComplete;
  });

  useEffect(() => {
    const c = config;

    const expectTime = c.codingDuration + c.diffDuration;
    const cursorAppearTime = expectTime + c.cursorAppearDelay;
    const cursorMoveTime = cursorAppearTime + c.cursorMoveDelay;
    const clickTime = cursorMoveTime + c.cursorClickDelay;
    const focusTime = clickTime + c.focusDelay;
    const alertTime = focusTime + c.cursorAlertDelay;

    const diffTimer = setTimeout(() => setPhase("diff"), c.codingDuration);
    const slideTimer = setTimeout(() => setSlid(true), c.codingDuration + c.slideDelay);
    const expectTimer = setTimeout(() => setPhase("expect"), expectTime);
    const cursorTimer = setTimeout(() => setCursorVisible(true), cursorAppearTime);
    const cursorMoveTimer = setTimeout(() => setCursorOnBrowser(true), cursorMoveTime);
    const clickTimer = setTimeout(() => setClicking(true), clickTime);
    const clickEndTimer = setTimeout(() => setClicking(false), clickTime + 100);
    const labelShowTimer = setTimeout(() => setLabelVisible(true), clickTime);
    const focusTimer = setTimeout(() => setFocused(true), focusTime);
    const alertTimer = setTimeout(() => setCursorLabel("alert"), alertTime);
    const fixingTime = alertTime + c.fixingDelay;
    const fixingTimer = setTimeout(() => {
      setFixing(true);
      setTerminalFocused(true);
      setFocused(false);
    }, fixingTime);
    const fixDiffTime = fixingTime + c.fixDiffDelay;
    const fixDiffTimer = setTimeout(() => {
      setFixDiff(true);
      setCursorLabel("fixed");
    }, fixDiffTime);
    const reloadTime = fixDiffTime + c.reloadDelay;
    const reloadTimer = setTimeout(() => setReloading(true), reloadTime);
    const reloadDoneTime = reloadTime + c.reloadDuration;
    const reloadDoneTimer = setTimeout(() => setReloadDone(true), reloadDoneTime);
    const resetTime = reloadDoneTime + c.resetDelay;
    const resetTimer = setTimeout(() => {
      setCursorVisible(false);
      setLabelVisible(false);
      setLooping(true);
      setSlid(false);
      setFocused(false);
      setTerminalFocused(false);
    }, resetTime);
    const loopTime = resetTime + c.loopDelay;
    const loopTimer = setTimeout(() => onCompleteRef.current(), loopTime);
    return () => {
      clearTimeout(diffTimer);
      clearTimeout(slideTimer);
      clearTimeout(expectTimer);
      clearTimeout(cursorTimer);
      clearTimeout(cursorMoveTimer);
      clearTimeout(clickTimer);
      clearTimeout(clickEndTimer);
      clearTimeout(labelShowTimer);
      clearTimeout(focusTimer);
      clearTimeout(alertTimer);
      clearTimeout(fixingTimer);
      clearTimeout(fixDiffTimer);
      clearTimeout(reloadTimer);
      clearTimeout(reloadDoneTimer);
      clearTimeout(resetTimer);
      clearTimeout(loopTimer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return {
    phase,
    slid,
    focused,
    cursorVisible,
    cursorOnBrowser,
    cursorOnTerminal,
    clicking,
    clickingTerminal,
    labelVisible,
    cursorLabel,
    terminalFocused,
    fixing,
    fixDiff,
    reloading,
    reloadDone,
    looping,
  };
}

function TerminalContent({
  phase,
  fixing,
  fixDiff,
  looping,
  config,
  cycle,
}: {
  phase: AnimationPhase;
  fixing: boolean;
  fixDiff: boolean;
  looping: boolean;
  config: AnimationConfig;
  cycle: number;
}) {
  const showDiff = phase === "diff" || phase === "expect";
  const showExpect = phase === "expect";

  const scrollY = looping
    ? -420
    : fixDiff
      ? -270
      : fixing
        ? -190
        : showExpect
          ? -150
          : showDiff
            ? -40
            : 0;

  return (
    <motion.div
      className="flex flex-col items-start w-full text-xs/4 gap-1"
      initial={cycle > 0 ? { y: 120 } : false}
      animate={{ y: scrollY }}
      transition={{ duration: config.terminalScrollDuration / 1000, ease: [0.25, 0.1, 0.25, 1] }}
    >
      <div className="h-7 shrink-0" />
      <div className="flex items-start shrink-0 gap-2.5">
        <svg
          width="217"
          height="144"
          viewBox="0 0 217 144"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          style={{ width: "41px", height: "auto", flexShrink: "0" }}
        >
          <path
            d="M216.06 57.69H188.18V0H27.88V57.69H0V86.85H27.44V114.73H41.28V143.89H55.57V114.73H68.52V143.45H82.36V115.17H133.42V143.89H147.71V115.17H160.66V143.45H174.06V115.17H187.91V86.85H216.02V57.69H216.06Z"
            fill="#F76038"
          />
          <path d="M55.63 29.61H68.58V57.69H55.63V29.61Z" fill="#FFFFFF" />
          <path d="M147.76 29.83H160.71V57.69H147.76V29.83Z" fill="#FFFFFF" />
        </svg>
      </div>
      <div className="h-2.5 shrink-0" />
      <div>
        <div className="flex items-center w-49 h-7 shrink-0 rounded-xs px-2.5 bg-white [box-shadow:#69696920_0px_0px_0px_0.5px]">
          <div className="[letter-spacing:-0.125px] inline-block font-['JetBrains_Mono',system-ui,sans-serif] shrink-0 text-[12.5px]/4.5">
            <span className="text-[#A07800] bg-[#FDF6E3] rounded-[3px] px-1 py-0.5">
              /debug-agent
            </span>
            <span className="text-[#323232]"> login returns 401</span>
          </div>
        </div>
        <div className="h-2.25 shrink-0" />
        {!showDiff && <ClaudeSpinner message="hypothesizing..." />}
        {showDiff && (
          <div className="flex items-center shrink-0 gap-1.25">
            <div className="inline-block [white-space-collapse:preserve] w-max text-[color(display-p3_0.249_0.701_0.193)] font-['BerkeleyMono-Regular','Berkeley_Mono',system-ui,sans-serif] shrink-0 text-[12.5px]/4.5">
              ⏺
            </div>
            <div className="[letter-spacing:-0.125px] inline-block [white-space-collapse:preserve] w-max text-[#1F1F1F] font-['JetBrains_Mono',system-ui,sans-serif] font-semibold shrink-0 text-[12.5px]/4.5">
              instrument
            </div>
            <div className="[letter-spacing:-0.125px] [white-space-collapse:preserve] inline-block w-max text-[#1F1F1F] font-['JetBrains_Mono',system-ui,sans-serif] shrink-0 text-[12.5px]/4.5">
              (auth.ts)
            </div>
          </div>
        )}
      </div>
      {showDiff && (
        <>
          <div className="h-0.5 shrink-0" />
          <div className="flex flex-col w-full rounded-[3px] pt-1.25 pb-1.5 bg-[#D7F2D3] px-2">
            <div className="flex items-center gap-1.75">
              <div className="[letter-spacing:-0.125px] [white-space-collapse:preserve] inline-block w-max text-[color(display-p3_0.040_0.361_0)] font-['JetBrains_Mono',system-ui,sans-serif] shrink-0 text-[12.5px]/4.5">
                42 +
              </div>
              <div className="w-32 h-3.25 rounded-xs bg-[#B1E4AC] shrink-0" />
            </div>
            <div className="flex items-center gap-1.75">
              <div className="[letter-spacing:-0.125px] [white-space-collapse:preserve] inline-block w-max text-[color(display-p3_0.040_0.361_0)] font-['JetBrains_Mono',system-ui,sans-serif] shrink-0 text-[12.5px]/4.5">
                43 +
              </div>
              <div className="w-18 h-3.25 rounded-xs bg-[#B1E4AC] shrink-0" />
            </div>
          </div>
        </>
      )}
      {showExpect && (
        <>
          <div className="flex pl-0.5 items-start gap-1.25 mt-4">
            <div className="inline-block text-[#0074F9] font-['BerkeleyMono-Regular','Berkeley_Mono',system-ui,sans-serif] shrink-0 text-[12.5px]/4.5">
              ⏺
            </div>
            <div className="flex flex-col">
              <div className="text-[#1F1F1F] font-['JetBrains_Mono',system-ui,sans-serif] font-semibold shrink-0 text-[12.5px]/4.5">
                logs instrumented,
              </div>
              <div className="font-['JetBrains_Mono',system-ui,sans-serif] font-semibold shrink-0 text-[12.5px]/4.5">
                <span className="text-[#1F1F1F]">analyzing </span>
                <span className="text-[#1A6DE0]">runtime evidence</span>
              </div>
            </div>
          </div>
        </>
      )}
      {fixing && (
        <div className="mt-4">
          <div className={`flex items-start shrink-0 gap-2.5 ${fixDiff ? "" : "mb-2.5"}`}>
            <svg
              width="217"
              height="144"
              viewBox="0 0 217 144"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              style={{ width: "41px", height: "auto", flexShrink: "0" }}
            >
              <path
                d="M216.06 57.69H188.18V0H27.88V57.69H0V86.85H27.44V114.73H41.28V143.89H55.57V114.73H68.52V143.45H82.36V115.17H133.42V143.89H147.71V115.17H160.66V143.45H174.06V115.17H187.91V86.85H216.02V57.69H216.06Z"
                fill="#F76038"
              />
              <path d="M55.63 29.61H68.58V57.69H55.63V29.61Z" fill="#FFFFFF" />
              <path d="M147.76 29.83H160.71V57.69H147.76V29.83Z" fill="#FFFFFF" />
            </svg>
          </div>
          {!fixDiff && <ClaudeSpinner message="fixing with log proof..." />}
        </div>
      )}
      {fixDiff && (
        <>
          <div className="h-0.5 shrink-0" />
          <div className="flex items-center shrink-0 gap-1.25">
            <div className="inline-block [white-space-collapse:preserve] w-max text-[color(display-p3_0.249_0.701_0.193)] font-['BerkeleyMono-Regular','Berkeley_Mono',system-ui,sans-serif] shrink-0 text-[12.5px]/4.5">
              ⏺
            </div>
            <div className="[letter-spacing:-0.125px] inline-block [white-space-collapse:preserve] w-max text-[#1F1F1F] font-['JetBrains_Mono',system-ui,sans-serif] font-semibold shrink-0 text-[12.5px]/4.5">
              fix
            </div>
            <div className="[letter-spacing:-0.125px] [white-space-collapse:preserve] inline-block w-max text-[#1F1F1F] font-['JetBrains_Mono',system-ui,sans-serif] shrink-0 text-[12.5px]/4.5">
              (auth.ts)
            </div>
          </div>
          <div className="flex flex-col w-full rounded-[3px] pt-1.25 pb-1.5 bg-[#D7F2D3] px-2">
            <div className="flex items-center gap-1.75">
              <div className="[letter-spacing:-0.125px] [white-space-collapse:preserve] inline-block w-max text-[color(display-p3_0.040_0.361_0)] font-['JetBrains_Mono',system-ui,sans-serif] shrink-0 text-[12.5px]/4.5">
                62 +
              </div>
              <div className="w-28 h-3.25 rounded-xs bg-[#B1E4AC] shrink-0" />
            </div>
            <div className="flex items-center gap-1.75">
              <div className="[letter-spacing:-0.125px] [white-space-collapse:preserve] inline-block w-max text-[color(display-p3_0.040_0.361_0)] font-['JetBrains_Mono',system-ui,sans-serif] shrink-0 text-[12.5px]/4.5">
                63 +
              </div>
              <div className="w-20 h-3.25 rounded-xs bg-[#B1E4AC] shrink-0" />
            </div>
            <div className="flex items-center gap-1.75">
              <div className="[letter-spacing:-0.125px] [white-space-collapse:preserve] inline-block w-max text-[color(display-p3_0.040_0.361_0)] font-['JetBrains_Mono',system-ui,sans-serif] shrink-0 text-[12.5px]/4.5">
                64 +
              </div>
              <div className="w-14 h-3.25 rounded-xs bg-[#B1E4AC] shrink-0" />
            </div>
          </div>
        </>
      )}
    </motion.div>
  );
}

function TerminalIllustration() {
  const [cycle, setCycle] = useState(0);
  const nextCycle = () => setCycle((previous) => previous + 1);

  const config: AnimationConfig = DEFAULT_CONFIG;

  return <TerminalAnimationView key={cycle} config={config} cycle={cycle} onComplete={nextCycle} />;
}

function TerminalAnimationView({
  config,
  cycle,
  onComplete,
}: {
  config: AnimationConfig;
  cycle: number;
  onComplete: () => void;
}) {
  const { phase, focused, terminalFocused, fixing, fixDiff, reloading, looping } =
    useAnimationPhase(config, onComplete);

  return (
    <div className="flex flex-col items-center justify-center gap-4 text-xs/4 mt-11.5 p-3 pb-14">
      <div className="relative shrink-0 overflow-visible flex items-center justify-center">
        <motion.div
          className="flex flex-col items-center w-112.75 h-64 relative z-10 rounded-2xl pt-4.5 pr-5 pb-6.5 pl-5 overflow-clip bg-white [box-shadow:#69696920_0px_0px_0px_0.5px,#C4C4C430_0px_2px_6px]"
          animate={{ scale: terminalFocused ? 1.02 : 1 }}
          transition={{
            type: "spring",
            stiffness: config.terminalSpringStiffness,
            damping: config.terminalSpringDamping,
            mass: config.terminalSpringMass / 1000,
          }}
        >
          <TerminalContent
            cycle={cycle}
            phase={phase}
            fixing={fixing}
            fixDiff={fixDiff}
            looping={looping}
            config={config}
          />
          <motion.div
            className="absolute bottom-0 left-0 right-0 z-20"
            initial={{ y: "100%", opacity: 1 }}
            animate={{
              y: (focused || fixing) && !reloading ? "0%" : "100%",
              opacity: reloading ? 0 : 1,
            }}
            transition={{
              y: { type: "spring", stiffness: 400, damping: 30 },
              opacity: { duration: 0.15, ease: "easeOut" },
            }}
          >
            <NetworkPanel fixed={fixDiff} />
          </motion.div>
        </motion.div>
      </div>
    </div>
  );
}

export default function HomePage() {
  const [copied, setCopied] = useState(false);
  const [openFaqs, setOpenFaqs] = useState<Set<number>>(new Set());
  const commandRef = useRef<HTMLDivElement>(null);

  const handleCopy = async () => {
    await navigator.clipboard.writeText("npx debug-agent@latest init");
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const handleSelectCommand = () => {
    if (!commandRef.current) return;
    const selection = window.getSelection();
    if (!selection) return;
    const range = document.createRange();
    range.selectNodeContents(commandRef.current);
    selection.removeAllRanges();
    selection.addRange(range);
  };
  return (
    <div className="[font-synthesis:none] overflow-x-clip antialiased min-h-screen bg-[color(display-p3_0.981_0.981_0.981)] flex flex-col items-center">
      <div className="w-full pt-6 pb-4 flex flex-col items-center relative">
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              "linear-gradient(to right, transparent 0%, rgba(255,255,255,0.5) 15%, rgba(255,255,255,0.5) 85%, transparent 100%)",
          }}
        />
        <div className="w-112.75 relative flex items-center justify-center">
          <div className="scale-[1.15]">
            <TerminalIllustration />
          </div>
        </div>
        <div
          className="absolute bottom-0 left-1/2 -translate-x-1/2 h-px w-112.75"
          style={{
            background:
              "linear-gradient(to right, transparent 0%, rgba(0,0,0,0.06) 25%, rgba(0,0,0,0.06) 75%, transparent 100%)",
          }}
        />
      </div>
      <div className="relative w-112.75 pb-20">
        <div className="flex flex-col gap-2.5 mt-13">
          <div className="w-112.75 tracking-[-0.03em] [white-space-collapse:preserve] font-['OpenRunde-Semibold','Open_Runde',system-ui,sans-serif] font-semibold text-[23px]/9.5 text-[color(display-p3_0.248_0.248_0.248)]">
            Debug with runtime evidence
          </div>
          <div className="[letter-spacing:0em] w-102 [white-space-collapse:preserve] font-['OpenRunde-Medium','Open_Runde',system-ui,sans-serif] font-medium text-[15px]/5.75 text-[#707070]">
            Debug Agent is a skill that teaches AI coding agents to debug with actual runtime log
            evidence. Works with Claude Code, Codex, Cursor, and more.
          </div>
        </div>
        <div className="flex flex-col gap-2.75 mt-6">
          <div
            onClick={handleSelectCommand}
            className="[font-synthesis:none] items-center flex justify-between w-112.75 rounded-xl overflow-clip py-3.25 pr-3.5 pl-5 cursor-text bg-[color(display-p3_1_1_1)] [box-shadow:0px_0px_0px_1px_#0000000f,0px_1px_2px_-1px_#0000000f,0px_2px_4px_0px_#0000000a] antialiased"
          >
            <div className="items-start flex min-w-0 gap-1">
              <div className="shrink-0 w-3.75 text-[#9A9A9A] font-['OpenRunde-Medium','Open_Runde',system-ui,sans-serif] font-medium text-[15.5px]/5.75">
                $
              </div>
              <div className="min-w-0 relative overflow-clip">
                <div
                  ref={commandRef}
                  className="w-max text-[color(display-p3_0.254_0.254_0.254)] font-['OpenRunde-Medium','Open_Runde',system-ui,sans-serif] font-medium text-[15.5px]/5.75"
                >
                  npx debug-agent@latest init
                </div>
              </div>
            </div>
            <button
              onClick={(event) => {
                event.stopPropagation();
                handleCopy();
              }}
              className="cursor-pointer shrink-0 content-center group"
              aria-label="Copy command"
            >
              {copied && (
                <svg
                  width="12"
                  height="12"
                  viewBox="0 0 12 12"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                  style={{ width: "20px", height: "20px" }}
                >
                  <path
                    fillRule="evenodd"
                    clipRule="evenodd"
                    d="M10.28 3.22a.75.75 0 0 1 0 1.06l-5 5a.75.75 0 0 1-1.06 0l-2.5-2.5a.75.75 0 1 1 1.06-1.06L4.75 7.69l4.47-4.47a.75.75 0 0 1 1.06 0Z"
                    fill="#059669"
                  />
                </svg>
              )}
              {!copied && (
                <svg
                  width="12"
                  height="12"
                  viewBox="0 0 12 12"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                  color="#0A0A0A"
                  style={{
                    flexShrink: "0",
                    verticalAlign: "middle",
                    width: "20px",
                    height: "20px",
                    overflow: "clip",
                  }}
                >
                  <path
                    fillRule="evenodd"
                    clipRule="evenodd"
                    d="M3.25 2.25C3.25 1.698 3.698 1.25 4.25 1.25H9.25C10.079 1.25 10.75 1.922 10.75 2.75V7.75C10.75 8.302 10.302 8.75 9.75 8.75C9.474 8.75 9.25 8.526 9.25 8.25C9.25 7.974 9.474 7.75 9.75 7.75V2.75C9.75 2.474 9.526 2.25 9.25 2.25H4.25C4.25 2.526 4.026 2.75 3.75 2.75C3.474 2.75 3.25 2.526 3.25 2.25ZM1.25 4.75C1.25 3.922 1.922 3.25 2.75 3.25H7.25C8.078 3.25 8.75 3.922 8.75 4.75V9.25C8.75 10.079 8.078 10.75 7.25 10.75H2.75C1.922 10.75 1.25 10.079 1.25 9.25V4.75ZM2.75 4.25C2.474 4.25 2.25 4.474 2.25 4.75V9.25C2.25 9.526 2.474 9.75 2.75 9.75H7.25C7.526 9.75 7.75 9.526 7.75 9.25V4.75C7.75 4.474 7.526 4.25 7.25 4.25H2.75Z"
                    fill="#CDCDCD"
                  />
                </svg>
              )}
            </button>
          </div>
        </div>
        <div className="[font-synthesis:none] flex w-107.25 h-fit flex-col gap-4.25 antialiased mt-14">
          <div className="mb-0 left-0 top-0 w-107.25 [white-space-collapse:preserve] relative text-[#3F3F3F] font-['OpenRunde-Semibold','Open_Runde',system-ui,sans-serif] font-semibold text-[17px]/5.75">
            How it works
          </div>
          <div className="flex flex-col gap-2.75">
            <div className="flex items-start gap-2">
              <div className="[white-space-collapse:preserve] h-5.75 relative w-3.75 text-[#8E8E8E] font-['OpenRunde-Medium','Open_Runde',system-ui,sans-serif] font-medium shrink-0 text-[15px]/5.75">
                1.
              </div>
              <div className="[white-space-collapse:preserve] w-82.75 left-0 top-0 relative text-[#474747] font-['OpenRunde-Medium','Open_Runde',system-ui,sans-serif] font-medium shrink-0 text-[15px]/5.75">
                Run /debug inside Claude Code, Codex, and more
              </div>
            </div>
            <div className="flex items-start gap-2 w-107.25">
              <div className="[white-space-collapse:preserve] h-5.75 relative w-3.75 text-[#8E8E8E] font-['OpenRunde-Medium','Open_Runde',system-ui,sans-serif] font-medium shrink-0 text-[15px]/5.75">
                2.
              </div>
              <div className="[white-space-collapse:preserve] w-82.75 relative text-[#474747] font-['OpenRunde-Medium','Open_Runde',system-ui,sans-serif] font-medium shrink-0 text-[15px]/5.75">
                Generates hypotheses and instruments your code with lightweight NDJSON logs
              </div>
            </div>
            <div className="flex items-start gap-2">
              <div className="[white-space-collapse:preserve] h-5.75 relative w-3.75 text-[#8E8E8E] font-['OpenRunde-Medium','Open_Runde',system-ui,sans-serif] font-medium shrink-0 text-[15px]/5.75">
                3.
              </div>
              <div className="[white-space-collapse:preserve] w-82.75 relative text-[#474747] font-['OpenRunde-Medium','Open_Runde',system-ui,sans-serif] font-medium shrink-0 text-[15px]/5.75">
                Asks you to reproduce the bug, then analyzes logs to confirm or reject hypotheses
              </div>
            </div>
            <div className="flex items-start gap-2">
              <div className="[white-space-collapse:preserve] h-5.75 relative w-3.75 text-[#8E8E8E] font-['OpenRunde-Medium','Open_Runde',system-ui,sans-serif] font-medium shrink-0 text-[15px]/5.75">
                4.
              </div>
              <div className="[white-space-collapse:preserve] w-82.75 relative text-[#474747] font-['OpenRunde-Medium','Open_Runde',system-ui,sans-serif] font-medium shrink-0 text-[15px]/5.75">
                Fixes only with 100% confidence backed by log evidence, then verifies
              </div>
            </div>
          </div>
        </div>
        <a
          href="https://github.com/millionco/debug-agent"
          target="_blank"
          rel="noopener noreferrer"
          className="group [font-synthesis:none] items-center flex justify-between mt-8 w-fit rounded-full overflow-clip gap-2.5 px-5 py-2.5 bg-white [box-shadow:#0000000F_0px_0px_0px_1px,#0000000F_0px_1px_2px_-1px,#0000000A_0px_2px_4px] antialiased transition-shadow hover:[box-shadow:#00000014_0px_0px_0px_1px,#00000014_0px_1px_2px_-1px,#0000000F_0px_2px_4px]"
        >
          <div className="items-center flex gap-1.25">
            <svg
              width="12"
              height="12"
              viewBox="0 0 12 12"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              style={{
                flexShrink: "0",
                verticalAlign: "middle",
                width: "15px",
                height: "15px",
                overflow: "clip",
              }}
            >
              <defs>
                <clipPath id="_starclip">
                  <rect width="12" height="12" fill="#fff" />
                </clipPath>
              </defs>
              <g clipPath="url(#_starclip)">
                <path
                  className="fill-[#C0C0C0] transition-colors group-hover:fill-[#FFC200]"
                  fillRule="evenodd"
                  clipRule="evenodd"
                  d="M6.884 1.195C6.513 0.468 5.474 0.468 5.103 1.195L3.94 3.474L1.414 3.875C0.608 4.004 0.287 4.992 0.864 5.57L2.671 7.38L2.273 9.906C2.145 10.713 2.986 11.323 3.714 10.953L5.994 9.793L8.273 10.953C9.001 11.323 9.842 10.713 9.715 9.906L9.316 7.38L11.124 5.57C11.701 4.992 11.379 4.004 10.573 3.875L8.047 3.474L6.884 1.195Z"
                />
              </g>
            </svg>
            <div className="shrink-0 [letter-spacing:-0.14px] w-max text-[#323232] font-['OpenRunde-Medium','Open_Runde',system-ui,sans-serif] font-medium text-[15px]/4.5">
              GitHub
            </div>
          </div>
        </a>
        <div className="flex flex-col w-107.25 mt-14">
          <div className="[letter-spacing:0em] font-['OpenRunde-Semibold','Open_Runde',system-ui,sans-serif] font-semibold text-[17px]/5.75 text-[color(display-p3_0.248_0.248_0.248)] mb-2.75">
            FAQ
          </div>
          <div className="h-[0.5px] self-stretch shrink-0 bg-[#DDDDDD] mb-2.75" />
          {[
            {
              question: "What is Debug Agent?",
              answer:
                "A skill that teaches AI coding agents to debug systematically using runtime log evidence instead of guessing from code alone. It hooks into your existing agent (Claude Code, Codex, Cursor) and runs entirely on your machine.",
            },
            {
              question: "How is this different from how agents normally debug?",
              answer:
                "Most agents jump to fixes by guessing from code alone, claiming 100% confidence but often failing. Debug Agent forces an evidence-based workflow: hypothesize, instrument with logs, reproduce, analyze runtime data, then fix only with proof.",
            },
            {
              question: "What languages does it support?",
              answer:
                "JavaScript/TypeScript use a zero-dependency HTTP fetch to send logs. Python, Go, Rust, Java, C/C++, Ruby and other languages write NDJSON lines directly to a log file using standard file I/O.",
            },
            {
              question: "Does it add dependencies to my project?",
              answer:
                "No. The logging server runs as a separate process via npx. Instrumentation uses a single fetch() call in JS/TS or native file I/O in other languages. Nothing is installed into your project.",
            },
            {
              question: "Is there a hosted or enterprise version?",
              answer: "Coming soon. Email aiden@million.dev if you have questions or ideas.",
            },
          ].map((faq, index) => (
            <div key={index} className="group/faq pb-2.75">
              <div
                className="flex justify-between items-start transition-colors group-hover/faq:text-[#1E1E1E] pt-2.75 cursor-pointer"
                onClick={() =>
                  setOpenFaqs((previous) => {
                    const next = new Set(previous);
                    if (next.has(index)) {
                      next.delete(index);
                    } else {
                      next.add(index);
                    }
                    return next;
                  })
                }
              >
                <div
                  className={`[letter-spacing:0em] font-['OpenRunde-Medium','Open_Runde',system-ui,sans-serif] font-medium text-[14px]/5.75 transition-colors group-hover/faq:text-[#1E1E1E] ${openFaqs.has(index) ? "text-[#1E1E1E]" : "text-[#5A5A5A]"}`}
                >
                  {faq.question}
                </div>
                <svg
                  width="12"
                  height="12"
                  viewBox="0 0 12 12"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                  style={{ width: "20px", height: "auto", flexShrink: "0" }}
                  className={`group-hover/faq:text-[#1E1E1E] transition-all duration-200 ${openFaqs.has(index) ? "text-[#1E1E1E] rotate-45" : "text-[#5A5A5A]"}`}
                >
                  <path
                    fillRule="evenodd"
                    clipRule="evenodd"
                    d="M6.5 3C6.5 2.724 6.276 2.5 6 2.5C5.724 2.5 5.5 2.724 5.5 3V5.5H3C2.724 5.5 2.5 5.724 2.5 6C2.5 6.276 2.724 6.5 3 6.5H5.5V9C5.5 9.276 5.724 9.5 6 9.5C6.276 9.5 6.5 9.276 6.5 9V6.5H9C9.276 6.5 9.5 6.276 9.5 6C9.5 5.724 9.276 5.5 9 5.5H6.5V3Z"
                    fill="currentColor"
                  />
                </svg>
              </div>
              <div
                className={`grid transition-[grid-template-rows,opacity] duration-200 ${openFaqs.has(index) ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"}`}
              >
                <div className="overflow-hidden">
                  {typeof faq.answer === "string" && (
                    <div className="[letter-spacing:0em] font-['OpenRunde-Medium','Open_Runde',system-ui,sans-serif] font-medium text-[14px]/5.5 text-[#858585] whitespace-pre-line mt-1.5">
                      {faq.answer}
                    </div>
                  )}
                  {typeof faq.answer !== "string" && faq.answer}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
