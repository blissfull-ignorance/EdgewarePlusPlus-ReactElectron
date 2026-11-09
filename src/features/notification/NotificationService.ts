/**
 * Service for sending OS-level desktop notifications via IPC.
 * Used by the popup engine to display system notifications based on pack content.
 */

export interface NotificationOptions {
  title: string;
  message: string;
  attachmentPath?: string;
}

/**
 * Send a desktop notification through the Electron main process.
 * Returns a promise that resolves when the notification is dispatched.
 */
export async function sendDesktopNotification(options: NotificationOptions): Promise<void> {
  await window.api.system.sendNotification(options.title, options.message, options.attachmentPath);
}
