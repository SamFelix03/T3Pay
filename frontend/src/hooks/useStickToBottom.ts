"use client";

import { useCallback, useEffect, useRef } from "react";

const NEAR_BOTTOM_THRESHOLD_PX = 64;

export function useStickToBottom<T extends HTMLElement = HTMLDivElement>() {
  const viewportRef = useRef<T>(null);
  const stickToBottomRef = useRef(true);

  const isNearBottom = useCallback(() => {
    const el = viewportRef.current;
    if (!el) return true;
    const distance = el.scrollHeight - el.scrollTop - el.clientHeight;
    return distance <= NEAR_BOTTOM_THRESHOLD_PX;
  }, []);

  const scrollToBottom = useCallback((behavior: ScrollBehavior = "auto") => {
    const el = viewportRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior });
  }, []);

  const followOutput = useCallback(
    (behavior: ScrollBehavior = "auto") => {
      if (!stickToBottomRef.current) return;
      requestAnimationFrame(() => scrollToBottom(behavior));
    },
    [scrollToBottom]
  );

  const enableStickToBottom = useCallback(
    (behavior: ScrollBehavior = "auto") => {
      stickToBottomRef.current = true;
      requestAnimationFrame(() => scrollToBottom(behavior));
    },
    [scrollToBottom]
  );

  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;
    const onScroll = () => {
      stickToBottomRef.current = isNearBottom();
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, [isNearBottom]);

  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;
    const content = el.firstElementChild;
    if (!content) return;
    const observer = new ResizeObserver(() => followOutput());
    observer.observe(content);
    return () => observer.disconnect();
  }, [followOutput]);

  return { viewportRef, followOutput, enableStickToBottom };
}
