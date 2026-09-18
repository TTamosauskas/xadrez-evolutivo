# Xadrez Evolutivo

Jogo de xadrez, reprodução e seleção natural, em português. Aplicação estática em módulos ES, sem dependências de produção.

## Executar

Use Node.js 24 ou superior para os testes e o build:

```sh
npm ci
npm test
npm run simulate
npm run build
python3 -m http.server 8000 --directory dist
```

Abra http://localhost:8000. O site precisa de HTTP(S) para carregar módulos e o Web Worker; abrir index.html diretamente por file:// não é suportado.

O GitHub Actions testa o motor e a interface, simula 50 partidas e publica somente os arquivos de produção em GitHub Pages.

## Organização

- `src/engine.js`: comandos atômicos e ordem de resolução do turno.
- `src/state.js`: estado serializável, aleatoriedade reproduzível e invariantes.
- `src/moves.js`, `reproduction.js`, `disease.js`, `environment.js`: regras de domínio.
- `src/controller.js`: único dono da partida e do ciclo de vida da IA.
- `src/ai.js`, `ai-worker.js`: busca limitada em Web Worker, com recuperação por tempo limite.
- `src/view.js`: leitura do estado e apresentação; sem escrita nas regras.
- `src/app.js`: eventos da interface.
- `src/storage.js`: gravação, validação e conversão de saves antigos.

Veja [a arquitetura e a validação da refatoração](docs/refatoracao.md).
