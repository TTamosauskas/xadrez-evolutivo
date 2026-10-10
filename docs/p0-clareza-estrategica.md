# P0 v2.0 — Clareza estratégica (revisão)

## O que mudou

- **P0-A:** os marcadores de ação e Vivificar continuam intactos. Destinos de risco recebem um contorno complementar (pontilhado/dash) e um rótulo acessível. O painel da criatura ganha uma leitura da capacidade de agir, energia e requisitos reprodutivos básicos.
- **P0-B:** passar o mouse ou focar um destino legal apresenta custo básico e consequências condicionais; alternativas especiais aparecem no próprio diálogo de escolha. Em dispositivos de toque, movimentos identificados como perigosos pedem confirmação explícita.
- **P0-C:** perdas confirmadas e tentativas de reprodução infrutíferas podem gerar um resumo causal compacto. Os toasts de mutação, incluindo **SAIBA MAIS**, a fila e as explicações **Na vida / No jogo**, permanecem iguais.

## Garantias técnicas

A inspeção chama exclusivamente funções de leitura. O fluxo de visualização **não** invoca `transition()` nem `simulate()`, preservando os sorteios, o gerador aleatório, as posições e o estado da partida. O motor continua sendo a fonte de verdade. O novo callback `onTransition` recebe somente resultados já concluídos pelo controlador.

Os textos distinguem o custo básico do saldo líquido posterior e o risco-base dos resultados modificados por características ou eventos. O prognóstico de uma jogada nunca representa uma amostra secreta do próximo sorteio.

## Casos para revisar no navegador

1. Selecionar uma criatura, inspecionar destinos normais e verificar se as marcações de movimento e ataque continuam equivalentes às anteriores.
2. Selecionar uma casa hostil, observar o contorno e a descrição de risco; repetir com adaptações defensivas.
3. Inspecionar trajetos longos, Voo, Carapaça, teias, Ataxia e casas letais.
4. Abrir Vivificar com várias opções, conferir os resumos sem disparar ações.
5. Em aparelho de toque, selecionar destino perigoso, cancelar e depois confirmar.
6. Usar teclado para navegar pelos destinos e ler seus riscos.
7. Produzir uma morte ambiental ou reprodução infrutífera e verificar o resumo causal; abrir a explicação de mutação por um toast e confirmar que o fluxo antigo continua.
8. Continuar uma partida salva, reiniciar um ciclo, jogar contra a IA e percorrer a Arena.

## Testes

O arquivo `tests/strategic-insights.test.js` cobre pureza e preservação de RNG, riscos seguros/hostis/letais, custos básicos, apresentação, acessibilidade e recapitulação causal. Permanecem os testes do motor, da interface, da IA e dos toasts.

Comandos de verificação:

```sh
npm ci
npm test
npm run simulate
npm run build
```

## Escopo e limites conscientes

Esta fase entrega uma camada explicativa, sem alterar regras, resultados aleatórios, genes, IA ou a progressão da campanha. Para algumas habilidades especiais, a prévia permanece descritiva: a composição quantitativa de todas as interações genéticas pertence a uma evolução posterior, exigindo formalização específica de cada habilidade.

A expressão "custo básico" significa o valor da regra de energia pertinente; recuperação metabólica, efeitos passivos e eventos posteriores podem produzir saldo líquido distinto. Riscos compostos são descritos em vez de apresentados como porcentagens supostamente exatas.

A branch é preparada para revisão em PR rascunho. A integração à `main` depende da aprovação após validação.
