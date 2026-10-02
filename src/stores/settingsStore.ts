/**
 * Configuração local do app: endereço da API, chave e identidade do usuário.
 *
 * O `userId` é o que amarra as mensagens numa mesma conversa no servidor, então
 * ele precisa ser estável entre abas do app. É gerado uma vez e persistido.
 */

import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

/**
 * `10.0.2.2` é o alias do host visto de dentro do emulador Android, então é
 * o único padrão que funciona sem configurar nada. Em aparelho físico use o IP
 * da rede local (ex: `http://192.168.0.10:8000`) — ver o README.
 */
export const DEFAULT_API_URL = "http://10.0.2.2:8000";

interface SettingsState {
  apiUrl: string;
  apiKey: string;
  userId: string;
  hydrated: boolean;
  setApiUrl: (value: string) => void;
  setApiKey: (value: string) => void;
  setHydrated: () => void;
}

function createUserId(): string {
  const random = Math.random().toString(36).slice(2, 10);
  return `aluno-${Date.now().toString(36)}-${random}`;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      apiUrl: DEFAULT_API_URL,
      apiKey: "",
      userId: createUserId(),
      hydrated: false,
      setApiUrl: (apiUrl) => set({ apiUrl: apiUrl.trim() }),
      setApiKey: (apiKey) => set({ apiKey: apiKey.trim() }),
      setHydrated: () => set({ hydrated: true }),
    }),
    {
      name: "nutriconcurso-settings",
      storage: createJSONStorage(() => AsyncStorage),
      partialize: ({ apiUrl, apiKey, userId }) => ({ apiUrl, apiKey, userId }),
      onRehydrateStorage: () => (state) => {
        state?.setHydrated();
      },
    }
  )
);
