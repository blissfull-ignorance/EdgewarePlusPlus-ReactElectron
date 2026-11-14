/**
 * @file PopupShell — Base popup frame component.
 *
 * Renders a transparent, borderless frame that sits behind popup content.
 * Handles all the visual details: opacity control, click-through pass-through,
 * fade-out timeouts, multi-click close countdowns, and optional close button.
 *
 * Meant to be used as the root container for every spawned popup window's content.
 */
import { useState, useEffect, useCallback, useRef } from "react";
import { Text } from "@mantine/core";
import { useCloseLabel } from "../../hooks/useCloseLabel";
import { useSettingsStore } from "../../stores/settingsStore";

/**
 * The OS popup route (`#/popup/<type>/<mediaId>/<popupId>`) carries the id
 * main knows this window by. In-app overlays do not run on that route, so
 * they get null and never show window-only affordances like the drag strip.
 */
function popupIdFromHash(): string | null {
  const hash = window.location.hash;
  if (!hash.startsWith("#/popup/")) return null;
  const seg = hash.slice("#/popup/".length).split("?")[0].split("/")[2];
  if (!seg) return null;
  try {
    return decodeURIComponent(seg);
  } catch {
    return seg;
  }
}

export interface PopupShellProps {
  opacity?: number;
  onClose?: () => void;
  /**
   * Called instead of onClose when the closing click is made with Alt held:
   * the media behind the popup is blacklisted (moved out of the pack) as it
   * closes. Only provided for popups that show a pack media file.
   */
  onBlacklist?: () => void;
  clicksToClose?: number;
  clickthroughEnabled?: boolean;
  timeoutMs?: number;
  buttonless?: boolean;
  children?: React.ReactNode;
}

export function PopupShell({
  opacity = 1,
  onClose,
  onBlacklist,
  clicksToClose = 0,
  clickthroughEnabled = false,
  timeoutMs = 0,
  buttonless = false,
  children,
}: PopupShellProps) {
  const [currentOpacity, setCurrentOpacity] = useState(opacity);
  const [remainingClicks, setRemainingClicks] = useState(clicksToClose);
  const [isFadingOut, setIsFadingOut] = useState(false);
  const closeHandlerRef = useRef(onClose);
  const fadeIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Pack-defined close-button label (e.g. "I Submit <3"); falls back to "Close"
  // when no pack/IPC is available (browser-layer tests, before selection).
  const closeLabel = useCloseLabel();

  closeHandlerRef.current = onClose;

  // The auto-close fade re-runs its effect on every opacity step; the close
  // itself must land exactly once.
  const closedRef = useRef(false);
  const handleClose = useCallback(() => {
    if (closedRef.current) return;
    closedRef.current = true;
    if (fadeIntervalRef.current) {
      clearInterval(fadeIntervalRef.current);
      fadeIntervalRef.current = null;
    }
    closeHandlerRef.current?.();
  }, []);

  const blacklistRef = useRef(onBlacklist);
  blacklistRef.current = onBlacklist;

  /** Closing interaction with Alt held blacklists the media when supported. */
  const finishClose = useCallback((altKey: boolean) => {
    if (altKey && blacklistRef.current) blacklistRef.current();
    else closeHandlerRef.current?.();
  }, []);

  useEffect(() => {
    setCurrentOpacity(opacity);
  }, [opacity]);

  useEffect(() => {
    setRemainingClicks(clicksToClose);
  }, [clicksToClose]);

  // The auto-close chain arms exactly once per timeoutMs. It must not depend
  // on the opacity it animates: re-running per fade step stacked timers.
  const opacityRef = useRef(currentOpacity);
  opacityRef.current = currentOpacity;

  useEffect(() => {
    if (timeoutMs <= 0) return;

    const fadeDuration = Math.min(1000, timeoutMs);
    const visibleDuration = timeoutMs - fadeDuration;
    const step = 16;
    const steps = Math.max(1, fadeDuration / step);

    let interval: ReturnType<typeof setInterval> | null = null;
    let cancelled = false;

    const beginFade = () => {
      if (cancelled || interval) return;
      setIsFadingOut(true);
      const delta = (opacityRef.current || 1) / steps;
      interval = setInterval(() => {
        setCurrentOpacity((prev) => {
          const next = Math.max(0, prev - delta);
          if (next <= 0) {
            if (interval) {
              clearInterval(interval);
              interval = null;
            }
            handleClose();
          }
          return next;
        });
      }, step);
    };

    let timeout: ReturnType<typeof setTimeout> | null = null;
    if (visibleDuration <= 0) {
      beginFade();
    } else {
      timeout = setTimeout(beginFade, visibleDuration);
    }

    return () => {
      cancelled = true;
      if (timeout) clearTimeout(timeout);
      if (interval) clearInterval(interval);
    };
  }, [timeoutMs, handleClose]);

  useEffect(() => {
    return () => {
      if (fadeIntervalRef.current) {
        clearInterval(fadeIntervalRef.current);
      }
    };
  }, []);

  const handleContainerClick = useCallback(
    (e: React.MouseEvent) => {
      if (clickthroughEnabled) return;

      if (clicksToClose > 0) {
        const newRemaining = remainingClicks - 1;
        setRemainingClicks(newRemaining);
        if (newRemaining <= 0) {
          finishClose(e.altKey);
        }
      } else {
        finishClose(e.altKey);
      }

      e.stopPropagation();
    },
    [clicksToClose, remainingClicks, clickthroughEnabled, finishClose]
  );

  // Upper-edge drag (setting: Draggable Popups). The renderer reports the
  // pointer delta accumulated since the grab; main moves the window from
  // where the drag began.
  const [popupRouteId] = useState(popupIdFromHash);
  const dragSetting = useSettingsStore((s) => s.popupDraggable);
  const dragEnabled = dragSetting === 1 && popupRouteId !== null && !clickthroughEnabled;
  const dragOriginRef = useRef<{ x: number; y: number } | null>(null);

  const onDragPointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!popupRouteId) return;
      e.currentTarget.setPointerCapture(e.pointerId);
      dragOriginRef.current = { x: e.clientX, y: e.clientY };
      void window.api?.popup.dragBegin(popupRouteId).catch(() => undefined);
    },
    [popupRouteId]
  );

  const onDragPointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      const origin = dragOriginRef.current;
      if (!origin || !popupRouteId) return;
      void window.api?.popup.dragMove(popupRouteId, e.clientX - origin.x, e.clientY - origin.y).catch(() => undefined);
    },
    [popupRouteId]
  );

  const onDragPointerUp = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      dragOriginRef.current = null;
      if (e.currentTarget.hasPointerCapture(e.pointerId)) {
        e.currentTarget.releasePointerCapture(e.pointerId);
      }
      if (popupRouteId) void window.api?.popup.dragEnd(popupRouteId).catch(() => undefined);
    },
    [popupRouteId]
  );

  return (
    <div
      data-testid="popup-shell"
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        width: "100%",
        height: "100%",
        backgroundColor: "transparent",
        border: "none",
        opacity: currentOpacity,
        pointerEvents: clickthroughEnabled ? "none" : "auto",
        overflow: "hidden",
        transition: isFadingOut ? "opacity 0.1s linear" : undefined,
      }}
      onClick={handleContainerClick}
    >
      {dragEnabled ? (
        <div
          data-testid="popup-drag-strip"
          aria-label="Drag popup"
          onPointerDown={onDragPointerDown}
          onPointerMove={onDragPointerMove}
          onPointerUp={onDragPointerUp}
          onPointerCancel={onDragPointerUp}
          onClick={(e) => e.stopPropagation()}
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            height: 16,
            zIndex: 20,
            cursor: "grab",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "linear-gradient(to bottom, rgba(0,0,0,0.35), rgba(0,0,0,0))",
            touchAction: "none",
          }}
        >
          <div
            style={{
              width: 34,
              height: 4,
              borderRadius: 999,
              backgroundColor: "rgba(255,255,255,0.75)",
            }}
          />
        </div>
      ) : null}
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {children}

        {clicksToClose > 0 && remainingClicks > 0 && !buttonless && (
          <Text
            data-testid="clicks-remaining"
            size="lg"
            c="white"
            ta="center"
            style={{
              position: "absolute",
              bottom: 16,
              left: 0,
              right: 0,
              userSelect: "none",
            }}
          >
            {remainingClicks} click{remainingClicks !== 1 ? "s" : ""} to close
          </Text>
        )}

        {!buttonless && clicksToClose === 0 && (
          <div
            data-testid="close-button"
            onClick={(e) => {
              e.stopPropagation();
              finishClose(e.altKey);
            }}
            style={{
              position: "absolute",
              bottom: 10,
              right: 12,
              padding: "5px 14px",
              borderRadius: 999,
              backgroundColor: "rgba(0, 0, 0, 0.62)",
              color: "white",
              fontSize: 13,
              fontWeight: 600,
              letterSpacing: 0.2,
              display: "inline-flex",
              alignItems: "center",
              pointerEvents: clickthroughEnabled ? "none" : "auto",
              cursor: clickthroughEnabled ? "default" : "pointer",
              zIndex: 10,
              userSelect: "none",
            }}
          >
            {closeLabel}
          </div>
        )}
      </div>
    </div>
  );
}
