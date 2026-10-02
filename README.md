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
   no ar, se ele tem `OPENAI_API_KEY` e se a base de legislação está ligada.
4. Salve e volte para a conversa.

O botão **Nova conversa** limpa as mensagens na tela e avisa o servidor para
descartar o histórico daquele usuário.

### Resposta chegando por partes

A resposta aparece palavra por palavra, enquanto o modelo ainda escreve. Se o
`/health` responder `streaming: false`, ou se a API antiga não tiver a rota, o
app cai sozinho para a chamada normal e continua funcionando — a resposta só
aparece inteira de uma vez.

A conexão no meio da queda não some com o que já havia chegado: o texto parcial
fica na tela e o aluno pode reler o que deu.

### Conversa que continua de onde parou

O histórico fica no servidor, não no aparelho. Ao abrir o app, ele pergunta o
que já foi dito e reconstrói a tela. Se a rede falhar nessa busca, o app abre
vazio mesmo assim — perder o histórico anterior é ruim, mas não poder perguntar
nada é pior.

Como o histórico é por `userId`, trocar o identificador nas Configurações começa
uma conversa diferente, e o mesmo `userId` em outro aparelho mostra a mesma
conversa.

### Perguntas sugeridas

Depois da resposta, aparecem alguns chips com continuação natural, como
"E para creche?". Tocar num chip já envia a pergunta. Se a API não mandar
sugestões, os chips simplesmente não aparecem.

### Fontes citadas

Se a API tiver a base vetorial configurada, cada resposta do tutor vem com os
badges dos documentos que fundamentaram ela. Tocar num badge abre o documento e
a página.

Dentro do texto, cada citação aparece como um selo numerado no meio da frase.
O número é o do documento daquela badge, e o app esconde o `[[fonte:1]]` bruto que
a API usa para marcar. Se o servidor mandar um número que não bate com o
documento, o selo não aparece em vez de apontar para o lugar errado.

Quando a API responde **sem** documento de apoio (base desligada, ou nada
acima do limiar de similaridade), a bolha mostra um aviso em vez das badges.
Isso é proposital: sem ele o estudante lê memória do modelo como se fosse
norma.

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
├── components/             # MessageBubble, SourceBadges, ChatInput, SuggestionChips
├── constants/theme.ts      # tokens de cor (contraste WCAG AA nos dois temas)
├── hooks/                  # useChat, useTheme
├── lib/
│   ├── api.ts              # cliente HTTP, streaming por XHR e tradução de erros
│   ├── citations.ts        # separa o texto das citações para o selo na tela
│   └── sse.ts              # leitor de Server-Sent Events
├── stores/settingsStore.ts # endereço, chave e userId persistidos
└── types/api.ts            # contratos espelhados da API

tests/
├── sse.test.ts             # o parser sobrevive ao corte no meio do evento?
├── citations.test.ts       # o texto volta inteiro, sem marcador e sem lei comida?
└── contrato-stream.test.ts # o stream gravado da API é lido do jeito certo?
```

## Comandos

```bash
npm install
npm run check        # typecheck + lint + teste
npx expo start
```

Antes de abrir PR, rode `npm run check`. São três coisas porque elas pegam
falhas diferentes: `typecheck` pega contrato quebrado com a API, `lint` pega
erro de React e `test` pega o parser de stream quebrado — que é o tipo de defeito
que não dá erro nenhum, só deixa de aparecer texto na tela.

Os testes cobrem `src/lib` puro, sem `react-native` no meio. Montar ambiente de
render para testar interface custaria mais do que rendeu; o defeito morre mesmo
no parser de SSE e no de citações, que são máquina de estados e quebram em
silêncio quando um pedaço chega na fronteira errada.

`tests/fixtures/stream-exemplo.txt` é a saída real da rota de streaming da API,
gerada por `python -m scripts.gerar_fixture_stream` no repositório do backend. É
o que amarra os dois repositórios: se lá o formato mudar e ninguém regerar, este
teste falha em vez do app quebrar em silêncio em produção.

### Build do APK

O projeto é **managed workflow**: `android/` não é versionada, então gere a
pasta nativa antes de qualquer comando Gradle.

```bash
npx expo export --platform android   # valida o bundle de todas as rotas
npx expo prebuild -p android

# JDK 17 é obrigatório. Com JDK 21 o build morre em JdkImageTransform: o
# AGP 8.1.x chama o `jlink` do JDK para montar a imagem de módulos da
# plataforma Android 34, e o jlink do 21 rejeita o `core-for-system-modules.jar`
# daquela plataforma. Não é problema do AGP nem do Gradle: é o jlink.
JAVA_HOME=/caminho/para/jdk17 ./android/gradlew assembleRelease
```

### Ajustes que o `prebuild` sobrescreve

`android/` não é versionada, então `npx expo prebuild` recria `build.gradle` do
zero a cada uso. Duas coisas precisam ser refeitas depois dele:

**1. Fixar a versão do AGP.** O `build.gradle` gerado vem com
`classpath('com.android.tools.build:gradle')`, **sem versão**. O Gradle então
resolve o AGP mais recente a cada build, e o `expo-modules-core` do SDK 50
quebra em `components.release` assim que uma versão nova sai — o primeiro build
depois de uma release do Android Studio quebra sem ninguém ter tocado em nada.

No `android/build.gradle`, troque a linha do `classpath`:

```groovy
// antes
classpath('com.android.tools.build:gradle')

// depois
classpath('com.android.tools.build:gradle:8.1.4')
```

**2. Apontar o SDK.** Sem `ANDROID_HOME` no ambiente o build morre em
`SDK location not found`:

```bash
printf 'sdk.dir=%s\n' "$HOME/Android/Sdk" > android/local.properties
```

O APK release fica em `android/app/build/outputs/apk/release/app-release.apk`.
Use `assembleRelease` para instalar no aparelho: o APK **debug** não embute o
bundle JS e depende do Metro em `localhost:8081`.

## Segurança

A chave de API digitada em Configurações é guardada no aparelho e viaja dentro
do APK — quem tiver o arquivo consegue extraí-la. Use apenas com servidor de
teste. As implicações e o que falta para produção estão detalhadas no README da
API.

As respostas do tutor são material de estudo, não autorização. Legislação muda,
o modelo erra, e os badges mostram o que foi **recuperado**, não o que foi
**usado**: ele pode citar `[2]` sem ter lido o bloco 2. Confira na fonte oficial
antes de usar em prova.

## Licença

GPL-3.0-or-later
