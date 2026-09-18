# Refatoração do motor

## Causas confirmadas

A versão anterior carregava 44 scripts pelo HTML e outros três dinamicamente. As regras redefiniam funções globais sucessivamente e 14 MutationObservers reconciliavam a interface. Dois módulos de patógeno escreviam textos diferentes no mesmo elemento da legenda: a alteração de um disparava o outro indefinidamente. Um segundo ciclo vinha de adicionar a classe `active` ao banner que o próprio observador monitorava.

O movimento estacionário também substituía temporariamente `organismAt`, ocultando a peça ativa até o final da jogada. Mortes com Ooteca e outros nascimentos nesse intervalo podiam ocupar a mesma casa da peça ocultada.

## Arquitetura

Uma ação entra pelo Controller e passa por `transition`. O motor clona o estado, resolve a ação e valida todas as posições antes de devolver o próximo estado. Erros descartam a cópia e preservam a partida anterior, incluindo o gerador aleatório. A interface lê esse resultado e se atualiza uma vez, sem MutationObservers e sem executar regras durante renderização.

A ocupação é consultada diretamente na lista de peças. Durante uma captura, o destino fica reservado até a transferência do atacante. Nascimentos conferem novamente a ocupação no momento da inserção. Terremotos usam uma distribuição simultânea com busca limitada a 64 casas, em vez de tentativas aleatórias sem limite.

As fases são movimento, escolha de parceiro e fim. Locomoção mantém o identificador da única peça que pode agir novamente. Avisos formam uma fila com confirmação pelo identificador; a mesma confirmação duplicada é inócua. A IA aguarda os avisos e calcula fora da interface, em Web Worker. O controlador encerra o worker em até dois segundos e escolhe uma ação legal de recuperação. Respostas antigas são descartadas por geração e revisão da partida.

A busca da IA tem limites próprios de tempo e nós. Reiniciar, carregar, abrir o menu e trocar o modo encerram o trabalho pendente. A fila de avisos, o estado do parceiro e todos os contadores fazem parte do save.

## Regras consolidadas

Foram trazidos para os módulos os 15 eventos, mutações positivas e negativas, movimento reversível de peões, reprodução estacionária e sexuada, ovos, Ooteca, Veneno, Coletor, descanso, imunidade, contágio por captura e por contato, mortalidade de 60–100%, prazo individual de doença, Conway e desempate técnico.

A alteração mais recente da branch main, `d89db11`, foi preservada: cada casa hostil atravessada tem seu próprio teste de sobrevivência; cavalos testam apenas a chegada, Voo ignora o risco e Carapaça tem risco de 34%. A chegada em casa hostil não provoca um segundo teste de permanência no fechamento daquela mesma rodada.

Os scripts antigos e suas sobreposições de CSS foram retirados do carregamento e do diretório raiz. As versões anteriores permanecem no histórico Git. O HTML agora carrega um módulo e uma folha de estilos.

## Saves

Os novos saves usam `xadrez-evolutivo-save-v2`. A chave antiga permanece preservada. Se não existir um save novo, Carregar tenta converter o antigo: posições, perfis, perdas de mutação, sementes, veneno, descanso, doenças e evento ativo. Ocupações duplicadas e arquivos inválidos são recusados antes da troca de estado. Na conversão antiga, uma ação parcialmente concluída volta à fase de movimento e um aviso informa essa condição. A antiga sequência aleatória não era serializada; a conversão inicia uma sequência determinística nova.

## Validação local

31 testes automatizados passaram, incluindo regressões dos ciclos de patógeno, Ooteca, reserva do destino de captura, reprodução parada, Locomoção, parceiro, veneno, descanso, sementes, terrenos hostis, terremoto em tabuleiro cheio, IA sem resposta, respostas duplicadas/atrasadas e saves. A interface também foi exercitada com jsdom por cliques reais nos seus elementos, cobrindo reprodução, avisos, salvar, carregar e reiniciar. O teste de renderização observa o DOM e confirma que as alterações cessam após a atualização.

Foram executadas 200 partidas com sementes distintas e políticas fácil, média, difícil e aleatória: 16.174 ações, 6.520 avisos confirmados e 289 doenças; população máxima de 64 peças. Os 15 eventos apareceram. 193 partidas terminaram; sete atingiram o teto de 600 ações ainda jogáveis. Esse teto limita o teste e não encerra partidas no produto. Nenhuma ação produziu estado inválido. A ação mais lenta nessa execução levou aproximadamente 77 ms, sem incluir a busca da IA.

Esses testes verificam os cenários descritos; não demonstram equivalência exaustiva com todas as combinações da cadeia antiga de sobrescritas. O histórico anterior permite investigar diferenças de regra e reverter a versão, se necessário.
