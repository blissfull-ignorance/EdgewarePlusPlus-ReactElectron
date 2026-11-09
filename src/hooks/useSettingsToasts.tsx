import { useEffect, useRef } from "react";
import { IconAlertCircle, IconCircleCheck } from "@tabler/icons-react";
import { useSettingsStore, type SaveStatus } from "../stores/settingsStore";
import { showToast } from "../features/notifications/toastStore";

export function useSettingsToasts() {
  const saveStatus = useSettingsStore((s) => s.saveStatus);
  const saveErrorMessage = useSettingsStore((s) => s.saveErrorMessage);
  const previous = useRef<SaveStatus>(saveStatus);

  useEffect(() => {
    const from = previous.current;
    previous.current = saveStatus;
    if (from !== "saving") return;

    if (saveStatus === "saved") {
      showToast({
        id: "settings-saved",
        title: "Settings saved",
        color: "teal",
        icon: <IconCircleCheck size={18} />,
        duration: 2500,
      });
    } else if (saveStatus === "error") {
      showToast({
        id: "settings-save-error",
        title: "Couldn't save settings",
        description: saveErrorMessage ?? undefined,
        color: "red",
        icon: <IconAlertCircle size={18} />,
        duration: 6000,
      });
    }
  }, [saveStatus, saveErrorMessage]);
}
