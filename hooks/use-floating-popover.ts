import { useLayoutEffect, type RefObject } from "react";

// A native top-layer popover stays above the modal's scrolling content.
export function useFloatingPopover(
  open: boolean,
  anchor: RefObject<HTMLElement | null>,
  panel: RefObject<HTMLElement | null>,
) {
  useLayoutEffect(() => {
    const element = panel.current;
    if (!open || !element || !anchor.current) return;
    function position() {
      if (!element || !anchor.current) return;
      const rect = anchor.current.getBoundingClientRect();
      const viewport = window.visualViewport;
      const top = viewport?.offsetTop ?? 0;
      const left = viewport?.offsetLeft ?? 0;
      const height = viewport?.height ?? window.innerHeight;
      const width = viewport?.width ?? window.innerWidth;
      const below = Math.max(0, top + height - rect.bottom - 13);
      const above = Math.max(0, rect.top - top - 13);
      const upwards = below < 240 && above > below;
      element.style.width = `${Math.min(rect.width, width - 16)}px`;
      element.style.maxHeight = `${Math.min(290, upwards ? above : below)}px`;
      element.style.left = `${Math.max(left + 8, Math.min(rect.left, left + width - element.offsetWidth - 8))}px`;
      element.style.top = `${upwards ? rect.top - element.offsetHeight - 5 : rect.bottom + 5}px`;
    }
    element.showPopover();
    position();
    window.addEventListener("resize", position);
    window.addEventListener("scroll", position, true);
    window.visualViewport?.addEventListener("resize", position);
    window.visualViewport?.addEventListener("scroll", position);
    const observer = new ResizeObserver(position);
    observer.observe(anchor.current);
    observer.observe(element);
    return () => {
      if (element.matches(":popover-open")) element.hidePopover();
      observer.disconnect();
      window.removeEventListener("resize", position);
      window.removeEventListener("scroll", position, true);
      window.visualViewport?.removeEventListener("resize", position);
      window.visualViewport?.removeEventListener("scroll", position);
    };
  }, [open, anchor, panel]);
}
