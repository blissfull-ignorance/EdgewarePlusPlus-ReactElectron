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

export interface PopupShellProps {
  opacity?: number;
  onClose?: () => void;
  clicksToClose?: number;
  clickthroughEnabled?: boolean;
  timeoutMs?: number;
  buttonless?: boolean;
  children?: React.ReactNode;
}

export function PopupShell({
  opacity = 1,
  onClose,
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

  const handleClose = useCallback(() => {
    closeHandlerRef.current?.();
  }, []);

  useEffect(() => {
    setCurrentOpacity(opacity);
  }, [opacity]);

  useEffect(() => {
    setRemainingClicks(clicksToClose);
  }, [clicksToClose]);

  useEffect(() => {
    if (timeoutMs <= 0) return;

    const fadeDuration = Math.min(1000, timeoutMs);
    const visibleDuration = timeoutMs - fadeDuration;

    if (visibleDuration <= 0) {
      setIsFadingOut(true);
      const step = 16;
      const steps = fadeDuration / step;
      const delta = currentOpacity / steps;
      fadeIntervalRef.current = setInterval(() => {
        setCurrentOpacity((prev) => {
          const next = Math.max(0, prev - delta);
          if (next <= 0) {
            clearInterval(fadeIntervalRef.current!);
            handleClose();
          }
          return next;
        });
      }, step);
      return;
    }

    const fadeTimeout = setTimeout(() => {
      setIsFadingOut(true);
      const step = 16;
      const steps = fadeDuration / step;
      const delta = currentOpacity / steps;
      fadeIntervalRef.current = setInterval(() => {
        setCurrentOpacity((prev) => {
          const next = Math.max(0, prev - delta);
          if (next <= 0) {
            clearInterval(fadeIntervalRef.current!);
            handleClose();
          }
          return next;
        });
      }, step);
    }, visibleDuration);

    return () => {
      clearTimeout(fadeTimeout);
    };
  }, [timeoutMs, currentOpacity, handleClose]);

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
          handleClose();
        }
      } else {
        handleClose();
      }

      e.stopPropagation();
    },
    [clicksToClose, remainingClicks, clickthroughEnabled, handleClose]
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
              handleClose();
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
