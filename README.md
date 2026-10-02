# NutriConcurso

App de estudo para concursos públicos na área de **Nutrição**. O usuário pergunta
sobre PNAE, PNAN, SUS, RDC 216/2004, UAN, Fator de Correção, Nutrição Clínica,
Materno-Infantil, Esportiva e Saúde Coletiva, ou pede questões de FGV, Vunesp,
Cebraspe, IBFC e FCC.

O app não tem modelo próprio: ele conversa com a
[NutriConcurso Bot API](https://github.com/alunoadsnoite/nutriconcurso-bot).

## Como funciona

1. Suba a API (ver o README dela).
2. No app, abra **Configurações** e informe o endereço do servidor.
3. Toque em **Testar conexão**. O app chama `/health` e diz se o servidor está
   no ar e se ele tem `OPENAI_API_KEY`.
4. Salve e volte para a conversa.

O botão **Nova conversa** limpa as mensagens na tela e avisa o servidor para
descartar o histórico daquele usuário.

### Endereço da API

O padrão é `http://10.0.2.2:8000`, que é o alias do host visto de dentro do
emulador Android.

- **Emulador Android:** o padrão já funciona.
- **Aparelho físico:** use o IP da rede local, por exemplo
  `http://192.168.0.10:8000`, e inicie a API escutando em todas as interfaces
  (`uvicorn app.main:app --host 0.0.0.0`). Celular e computador precisam estar
  na mesma rede.
- **Produção:** aponte para o domínio onde a API está hospedada.

## Estrutura

```
src/
├── app/                    # rotas (Expo Router)
│   ├── _layout.tsx         # Stack, StatusBar, tema
│   ├── index.tsx           # conversa
│   └── settings.tsx        # endereço, chave e teste de conexão
├── components/             # MessageBubble, ChatInput
├── constants/theme.ts      # tokens de cor (contraste WCAG AA nos dois temas)
├── hooks/                  # useChat, useTheme
├── lib/api.ts              # cliente HTTP e tradução de erros
├── stores/settingsStore.ts # endereço, chave e userId persistidos
└── types/api.ts            # contratos espelhados da API
```

## Comandos

```bash
npm install
npm run lint
npm run typecheck
npx expo start
```

Não há runner de testes configurado. Para qualquer alteração, rode pelo menos
`npm run lint` e `npm run typecheck`.

### Build do APK

O projeto é **managed workflow**: `android/` não é versionada, então gere a
pasta nativa antes de qualquer comando Gradle.

```bash
npx expo export --platform android   # valida o bundle de todas as rotas
npx expo prebuild -p android

# JDK 17 é obrigatório: o AGP 8.1.1 do SDK 50 falha com JDK 21 (jlink)
JAVA_HOME=/caminho/para/jdk17 ./android/gradlew assembleRelease
```

O APK release fica em `android/app/build/outputs/apk/release/app-release.apk`.
Use `assembleRelease` para instalar no aparelho: o APK **debug** não embute o
bundle JS e depende do Metro em `localhost:8081`.

## Segurança

A chave de API digitada em Configurações é guardada no aparelho e viaja dentro
do APK — quem tiver o arquivo consegue extraí-la. Use apenas com servidor de
teste. As implicações e o que falta para produção estão detalhadas no README da
API.

As respostas do tutor são material de estudo, não autorização. Legislação muda
e o modelo erra: confira a fonte oficial antes de usar em prova.

## Licença

GPL-3.0-or-later
