import type { ReactNode } from "react";
import { create } from "zustand";
import { devtools } from "zustand/middleware";

export interface ToastItem {
  id: string;
  title: string;
  description?: string;
  color: string;
  icon?: ReactNode;
  loading?: boolean;
  duration: number;
}

export type ToastInput = Omit<ToastItem, "id" | "duration"> & { id?: string; duration?: number };

interface ToastState {
  toasts: ToastItem[];
  show: (toast: ToastInput) => string;
  update: (id: string, patch: Partial<Omit<ToastItem, "id">>) => void;
  close: (id: string) => void;
}

let toastCounter = 0;

export const useToastStore = create<ToastState>()(
  devtools(
    (set) => ({
      toasts: [],
      show: (toast) => {
        toastCounter += 1;
        const id = toast.id ?? `toast-${Date.now()}-${toastCounter}`;
        const item: ToastItem = { duration: 4000, ...toast, id };
        set((s) => ({ toasts: [...s.toasts.filter((t) => t.id !== id), item] }));
        return id;
      },
      update: (id, patch) =>
        set((s) => ({
          toasts: s.toasts.map((t) => (t.id === id ? { ...t, ...patch, id } : t)),
        })),
      close: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
    }),
    { name: "ToastStore" }
  )
);

export function showToast(toast: ToastInput): string {
  return useToastStore.getState().show(toast);
}

export function updateToast(id: string, patch: Partial<Omit<ToastItem, "id">>): void {
  useToastStore.getState().update(id, patch);
}

export function closeToast(id: string): void {
  useToastStore.getState().close(id);
}
