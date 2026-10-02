# Instruções para agentes

## Contexto do projeto

- App móvel Expo/React Native com TypeScript, cliente da
  [NutriConcurso Bot API](https://github.com/alunoadsnoite/nutriconcurso-bot)
  (`com.nutriconcurso.app`). O app não tem modelo próprio: tudo vem da API.
- Domínio: concursos públicos na área de Nutrição no Brasil (PNAE, PNAN, SUS,
  RDC 216/2004, UAN, Fator de Correção, Nutrição Clínica, Materno-Infantil,
  Esportiva, Saúde Coletiva).
- O app é offline-first **na interface**, mas a resposta depende da rede. Sem
  servidor, a única coisa que funciona é Configurações e o teste de conexão.
- Respostas do modelo podem estar erradas. A UI deve manter o aviso de que são
  material de estudo, não cite a resposta como fonte oficial.

## Comandos

```bash
npm install
npm run lint
npm run typecheck
npx expo start
npx expo export --platform android   # valida o bundle de todas as rotas
npx expo prebuild -p android
JAVA_HOME=/caminho/para/jdk17 ./android/gradlew assembleRelease
```

Não há runner de testes configurado. Para qualquer alteração, rode pelo menos
`npm run lint` e `npm run typecheck`.

O projeto é **managed workflow**: `android/` e `ios/` não são versionadas.
Qualquer comando Gradle exige `npx expo prebuild -p android` antes. **JDK 17 é
obrigatório** — o AGP 8.1.1 do SDK 50 quebra com JDK 21 (jlink).

Use `assembleRelease` para instalar no aparelho; o APK debug não embute o bundle
JS e depende do Metro em `localhost:8081`.

## Organização

- `src/app/`: rotas Expo Router. `_layout.tsx` monta o Stack e o StatusBar.
- `src/components/`: `MessageBubble` (memoizado), `SourceBadges` e `ChatInput`.
- `src/lib/api.ts`: **única** camada de rede. Toda chamada HTTP passa por aqui.
- `src/stores/settingsStore.ts`: endereço da API, chave e `userId`, persistidos
  em `nutriconcurso-settings`.
- `src/hooks/`: `useChat` (estado da conversa) e `useTheme`.
- `src/types/api.ts`: contratos espelhados da API. Se a API mudar, atualize aqui
  junto — o typecheck é a única garantia de que os dois lados batem.
- `src/lib/api.ts`: `normalizeSources`/`normalizeSource` convertem o que vem do
  RAG para a UI. `metadata.page` é `jsonb` e pode chegar como número **ou**
  texto, dependendo de quem inseriu o documento — a coerção para `number` mora
  ali e não deve ser replicada nos componentes.

## Convenções

- Aliases `@/...` para `src/` (ver `tsconfig.json` e `babel.config.js`).
- `StyleSheet` e os tokens de `src/constants/theme.ts`. As cores já têm
  contraste WCAG AA nos dois temas: não introduza cor nova sem conferir.
- `accessibilityLabel`, `accessibilityHint` e `accessibilityState` em todo
  controle interativo. Alvos de toque com `minHeight` de 48.
- `MessageBubble` é `memo` de propósito: a lista re-renderiza inteira a cada
  mensagem nova.
- O `userId` no store amarra as mensagens numa mesma conversa no servidor.
  Apagar os dados do app gera um id novo e o histórico recomeça.

## Armadilhas conhecidas

- **`android/` no `.gitignore` precisa estar ancorado** (`/android/`). Sem a
  barra inicial, o padrão também esconderia qualquer pasta versionada com o
  mesmo nome.
- **`expo-system-ui` é `~2.9.4`** nesta versão do SDK 50; `~9.x` não existe e
  o `npm install` falha com `ETARGET`.
- **O endereço padrão `10.0.2.2` só funciona no emulador Android.** Em aparelho
  físico o usuário precisa trocar para o IP da rede local nas Configurações.
- **A chave de API não é segredo no app** — ela viaja dentro do APK. Não a
  apresente como proteção real, e não adicionei `API_KEY` de produção aqui.
- **A chave do Supabase nunca entra no app.** A busca acontece na API. Se
  aparecer `SUPABASE_*` em `src/`, é bug.
- **Não mostre badge de fonte sem o aviso de "sem documento".** Resposta sem
  fundamento precisa dizer isso; veja `ungrounded` em `MessageBubble`.
- **`gradlew` roda de dentro de `android/`**, não da raiz do projeto.
