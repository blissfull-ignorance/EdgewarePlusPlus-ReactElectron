import { useElectronAPI } from './useElectronAPI'

export function useNotification() {
  const api = useElectronAPI()

  function notify(title: string, body: string) {
    api?.showNotification(title, body)
  }

  return { notify }
}
