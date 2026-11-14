import { useEffect } from "react";
import { Notification, Portal } from "@mantine/core";
import { useToastStore, type ToastItem } from "./toastStore";

function Toast({ toast }: { toast: ToastItem }) {
  const close = useToastStore((s) => s.close);

  useEffect(() => {
    if (!toast.duration || toast.loading) return;
    const timer = setTimeout(() => close(toast.id), toast.duration);
    return () => clearTimeout(timer);
  }, [toast.id, toast.duration, toast.loading, close]);

  return (
    <Notification
      title={toast.title}
      icon={toast.icon}
      color={toast.color}
      loading={toast.loading}
      withBorder
      radius="md"
      onClose={() => close(toast.id)}
      style={{ width: 340, maxWidth: "calc(100vw - 32px)" }}
      styles={{ root: { backgroundColor: "var(--mantine-color-dark-6)" } }}
    >
      {toast.description}
    </Notification>
  );
}

export function ToastStack() {
  const toasts = useToastStore((s) => s.toasts);

  if (toasts.length === 0) return null;

  return (
    <Portal>
      <div
        data-testid="toast-stack"
        style={{
          position: "fixed",
          // Below the 60px app header (zIndex 1200): a toast at the window
          // top would sit behind the bar and be unreadable.
          top: 76,
          right: 16,
          zIndex: 1000,
          display: "flex",
          flexDirection: "column",
          gap: 10,
          pointerEvents: "none",
        }}
      >
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className="ewpp-toast"
            style={{ pointerEvents: "auto" }}
          >
            <Toast toast={toast} />
          </div>
        ))}
      </div>
    </Portal>
  );
}
