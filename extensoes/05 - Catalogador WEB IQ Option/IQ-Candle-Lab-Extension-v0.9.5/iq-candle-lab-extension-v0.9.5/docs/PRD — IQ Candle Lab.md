# PRD — IQ Candle Lab

**Sistema Local de Análise Estratégica em Tempo Real para IQ Option**  
**Versão:** 1.0  
**Status:** Documento oficial inicial do produto  
**Data:** 26/07/2026  
**Substitui:** PRD — Catalogador Web; PRD — Extensão Chrome para Captura de Velas da IQ Option; PRD — IQ Option Candle Collector.

---

## 1. Resumo executivo

O IQ Candle Lab será uma extensão para Google Chrome destinada a capturar, organizar e analisar localmente os dados de velas recebidos pela página da IQ Option.

O produto funcionará como um assistente estatístico e operacional. Enquanto o usuário estiver acompanhando um ativo na IQ Option, a extensão deverá:

- identificar o ativo e o timeframe em uso;
- capturar velas históricas e atualizações em tempo real;
- organizar as velas em estruturas temporais;
- formar quadrantes e outras janelas de análise;
- executar estratégias configuráveis;
- comparar o desempenho histórico das estratégias;
- identificar quais estratégias estão aplicáveis ao contexto atual;
- classificar as estratégias por relevância, confiança e desempenho;
- emitir alertas;
- apresentar uma página dedicada de análise;
- permitir que estratégias selecionadas sejam exibidas em um painel flutuante sobre a página da IQ Option.

Todos os dados e configurações da primeira versão permanecerão no navegador do usuário. Não haverá API, servidor, banco remoto, login ou sincronização em nuvem.

O sistema não executará operações, não clicará em botões da corretora e não enviará ordens de compra ou venda.

---

## 2. Visão do produto

### 2.1 Problema

O operador que utiliza estratégias baseadas em cores, sequências, quadrantes e contextos temporais precisa acompanhar simultaneamente:

- a formação das velas;
- a posição de cada vela no quadrante;
- o comportamento dos quadrantes anteriores;
- o desempenho recente da estratégia;
- o histórico do ativo;
- o horário;
- o mercado normal ou OTC;
- o contexto de timeframes superiores;
- a possibilidade de entrada;
- as regras de Gale;
- a qualidade estatística do sinal.

Esse acompanhamento manual aumenta o risco de erro, atraso, interpretação subjetiva e uso de estratégias fora do contexto em que elas apresentam melhor desempenho.

### 2.2 Solução

O IQ Candle Lab automatizará a coleta e a análise, mantendo a decisão e a execução inteiramente sob responsabilidade do usuário.

A extensão deverá transformar dados brutos de candles em informações compreensíveis:

```text
IQ Option
    ↓
Captura de mensagens
    ↓
Normalização de candles
    ↓
Armazenamento local
    ↓
Formação de períodos e quadrantes
    ↓
Cálculo de contextos
    ↓
Avaliação de estratégias
    ↓
Backtest e estatísticas
    ↓
Ranking contextual
    ↓
Alertas e interface
```

### 2.3 Proposta de valor

O produto deve responder, de forma rastreável, perguntas como:

- Quais estratégias estão válidas neste momento?
- Qual estratégia possui melhor desempenho neste ativo e horário?
- Quantas ocorrências sustentam o percentual exibido?
- A estratégia funciona melhor em mercado normal ou OTC?
- O desempenho recente está consistente com o histórico?
- O sinal está a favor ou contra o contexto predominante?
- Qual vela ou quadrante ativou a oportunidade?
- Houve Win, Win G1, Win G2, Loss ou invalidação?
- Qual estratégia deve ficar visível no painel flutuante?

---

## 3. Objetivos

### 3.1 Objetivo principal

Criar uma extensão local capaz de analisar continuamente o mercado exibido na IQ Option e auxiliar o usuário na identificação das estratégias com melhor aderência estatística ao contexto atual.

### 3.2 Objetivos específicos

1. Capturar candles sem leitura de pixels.
2. Identificar automaticamente ativo, mercado e timeframe.
3. Armazenar dados localmente com deduplicação.
4. Preservar candles históricos e em formação.
5. Organizar M1 em quadrantes de cinco velas.
6. Gerar períodos superiores a partir dos dados disponíveis.
7. Calcular contextos temporais automaticamente.
8. Executar estratégias nativas e personalizadas.
9. Fazer backtests locais.
10. Mostrar percentuais sempre acompanhados da amostra.
11. Classificar estratégias aplicáveis ao momento.
12. Exibir alertas antes da entrada.
13. Exibir estratégias selecionadas sobre a IQ Option.
14. Permitir auditoria de cada resultado.
15. Permitir exportação e importação do banco local.

---

## 4. Princípios do produto

### 4.1 Assistência, não automação operacional

O sistema poderá analisar, alertar e recomendar. Não poderá:

- abrir operação;
- clicar em Call ou Put;
- preencher valor;
- selecionar expiração;
- executar Gale;
- alterar configurações da conta;
- interagir com botões operacionais da IQ Option.

### 4.2 Dados locais por padrão

A versão inicial não possuirá:

- API;
- backend;
- Supabase;
- banco remoto;
- conta de usuário;
- login;
- sincronização em nuvem;
- telemetria obrigatória.

### 4.3 Rastreabilidade

Todo indicador deverá permitir acesso aos registros de origem.

Exemplo:

> 74,2% de acerto em 151 ocorrências.

O usuário deverá poder abrir essas 151 ocorrências.

### 4.4 Estatística sem promessa de resultado

O sistema não deverá usar termos como:

- garantia;
- certeza;
- entrada segura;
- lucro garantido;
- estratégia infalível.

Termos recomendados:

- desempenho histórico;
- taxa observada;
- confiança estatística;
- aderência ao contexto;
- oportunidade identificada;
- amostra insuficiente.

### 4.5 Separação entre dado bruto e dado derivado

Candles capturados são dados brutos.

Quadrantes, contextos, oportunidades, resultados, estatísticas e rankings são dados derivados e devem poder ser recalculados.

### 4.6 Estratégias configuráveis

Estratégias não devem depender exclusivamente de código fixo. O produto deverá possuir um modelo estruturado de estratégia.

### 4.7 Simplicidade visual

A interface deve priorizar:

- poucos gráficos;
- KPIs claros;
- tabelas compactas;
- filtros objetivos;
- detalhes sob demanda;
- alertas legíveis;
- ausência de poluição visual.

---

## 5. Escopo do MVP

### 5.1 Incluído

- Extensão Chrome Manifest V3.
- Captura de dados da IQ Option.
- Identificação automática de ativo.
- Separação entre mercado normal e OTC.
- Identificação do timeframe.
- Captura de histórico recebido pela página.
- Captura em tempo real.
- Persistência em IndexedDB.
- Deduplicação.
- Classificação de candles em verde, vermelho e doji.
- Quadrantes M1 com cinco velas.
- Janelas móveis configuráveis.
- Agregação local de M5, M15, M30, H1 e D1 quando houver dados suficientes.
- Contextos Mar, Maré, Onda e Marola.
- Estratégias nativas.
- Estratégias personalizadas.
- Ativação, desativação e duplicação de estratégias.
- Backtest local.
- Gale 0, Gale 1 e Gale 2.
- Ranking contextual.
- Alertas visuais e sonoros.
- Página dedicada da extensão.
- Painel flutuante sobre a IQ Option.
- Exportação e importação.
- Tela de diagnóstico.
- Logs locais.
- Configurações de retenção.

### 5.2 Fora do escopo inicial

- Operações automáticas.
- Robô de trade.
- API remota.
- Sincronização entre dispositivos.
- Aplicativo móvel.
- Integração com outras corretoras.
- Rede social.
- Marketplace de estratégias.
- Inteligência artificial generativa.
- Cobrança ou assinatura.
- Multiusuário.
- Copiar operações.
- Gestão financeira de banca.
- Cálculo de lucro garantido.
- Leitura de pixels como fonte principal.
- Suporte oficial da IQ Option.

---

## 6. Usuário-alvo

### 6.1 Usuário principal

Operador que utiliza a IQ Option no navegador e trabalha com estratégias baseadas em:

- cores de candles;
- quadrantes;
- maioria e minoria;
- sequências;
- padrões de repetição;
- padrões de inversão;
- horários;
- Gale;
- contexto de timeframes superiores.

### 6.2 Necessidades

- compreender rapidamente o cenário atual;
- reduzir erro manual;
- validar estratégias com histórico;
- comparar estratégias;
- evitar entradas fora de contexto;
- acompanhar oportunidades sem sair da plataforma;
- manter os dados sob controle local.

---

## 7. Conceitos e glossário

### 7.1 Candle

Registro temporal contendo, no mínimo:

- ativo;
- identificador do ativo;
- timeframe;
- início;
- fim;
- abertura;
- fechamento;
- máxima;
- mínima;
- status de fechamento;
- origem.

### 7.2 Cor do candle

Regra padrão:

- **Verde:** `close > open`.
- **Vermelho:** `close < open`.
- **Doji:** diferença absoluta entre abertura e fechamento menor ou igual à tolerância configurada.

A tolerância do doji deverá ser configurável.

Modos:

1. diferença absoluta;
2. percentual do preço;
3. percentual da amplitude;
4. desativado, considerando doji apenas quando `open == close`.

Configuração padrão do MVP:

- método: percentual da amplitude;
- tolerância: 5%;
- se a amplitude for zero, considerar doji.

### 7.3 Quadrante

Bloco fixo de cinco candles M1.

Quadrantes iniciam nos minutos:

```text
00, 05, 10, 15, 20, 25, 30, 35, 40, 45, 50 e 55
```

Posições:

```text
Q1, Q2, Q3, Q4 e Q5
```

Exemplo:

```text
10:00 = Q1
10:01 = Q2
10:02 = Q3
10:03 = Q4
10:04 = Q5
```

O quadrante é concluído somente após o fechamento de Q5.

### 7.4 Janela móvel

Sequência configurável de candles que não precisa respeitar o início fixo de um quadrante.

Exemplos:

- últimas 3 velas;
- últimas 5 velas;
- últimas 10 velas;
- últimos 2 quadrantes;
- últimos 30 minutos.

### 7.5 Oportunidade

Ocorrência em que todas as condições obrigatórias de uma estratégia são satisfeitas.

### 7.6 Sinal

Aviso gerado para uma oportunidade futura ou iminente.

### 7.7 Entrada

Direção e momento definidos pela estratégia.

Direções:

- Call/Alta/Verde;
- Put/Baixa/Vermelho;
- direção dinâmica por maioria;
- direção dinâmica por minoria;
- repetir referência;
- inverter referência.

### 7.8 Gale

Nova tentativa após uma entrada classificada como Loss.

Resultados:

- Win;
- Win G1;
- Win G2;
- Loss;
- Invalidada;
- Não avaliada;
- Em andamento.

### 7.9 Contextos

#### Mar

Contexto de longo prazo, inicialmente D1.

#### Maré

Contexto de horas, inicialmente H1.

#### Onda

Contexto intermediário, inicialmente M15 e M30.

#### Marola

Contexto de curto prazo, baseado em M1, quadrantes e janelas recentes.

### 7.10 Estratégia flutuante

Estratégia marcada pelo usuário para aparecer no painel sobre a página da IQ Option.

---

## 8. Decisões funcionais já aprovadas

1. O produto terá uma página dedicada de análise ampla.
2. Estratégias poderão ser marcadas como flutuantes.
3. Estratégias flutuantes aparecerão sobre a IQ Option.
4. Toda persistência inicial será local.
5. Não haverá API no MVP.
6. Os períodos superiores serão preferencialmente agregados a partir de candles menores capturados.
7. A extensão poderá acompanhar mais de um ativo armazenado, mas a análise em tempo real priorizará o ativo atualmente aberto.
8. Alertas serão emitidos em fases configuráveis.
9. A tolerância de doji será configurável.
10. Quadrantes continuarão como modelo visual e funcional, mas o motor também aceitará janelas móveis e múltiplos timeframes.

---

## 9. Arquitetura funcional

```text
┌─────────────────────────────────────┐
│ IQ Option                           │
│ WebSocket e estado da página        │
└──────────────────┬──────────────────┘
                   │
                   ▼
┌─────────────────────────────────────┐
│ Camada de Captura                   │
│ Mensagens, ativo, timeframe         │
└──────────────────┬──────────────────┘
                   │
                   ▼
┌─────────────────────────────────────┐
│ Normalização                        │
│ Schema, cor, tempo, deduplicação    │
└──────────────────┬──────────────────┘
                   │
                   ▼
┌─────────────────────────────────────┐
│ IndexedDB                           │
│ Dados brutos e configurações        │
└──────────────┬──────────────────────┘
               │
     ┌─────────┴─────────┐
     ▼                   ▼
┌──────────────┐   ┌─────────────────┐
│ Agregação    │   │ Motor Temporal  │
│ M5...D1      │   │ Quadrantes      │
└──────┬───────┘   │ Janelas móveis  │
       │           └────────┬────────┘
       └─────────┬──────────┘
                 ▼
┌─────────────────────────────────────┐
│ Motor de Contexto                   │
│ Mar, Maré, Onda, Marola             │
└──────────────────┬──────────────────┘
                   ▼
┌─────────────────────────────────────┐
│ Motor de Estratégias                │
│ Condições, entrada, doji e Gale     │
└──────────────────┬──────────────────┘
                   ▼
┌─────────────────────────────────────┐
│ Motor Estatístico e Backtest        │
│ Resultados, amostras, sequências    │
└──────────────────┬──────────────────┘
                   ▼
┌─────────────────────────────────────┐
│ Ranking e Alertas                   │
└──────────────┬──────────────────────┘
               │
       ┌───────┴────────┐
       ▼                ▼
┌───────────────┐  ┌──────────────────┐
│ Página        │  │ Painel flutuante │
│ dedicada      │  │ na IQ Option     │
└───────────────┘  └──────────────────┘
```

---

## 10. Arquitetura técnica recomendada

### 10.1 Plataforma

- Google Chrome.
- Manifest V3.
- TypeScript.
- React para interfaces.
- Vite para build.
- IndexedDB com camada tipada.
- Web Worker para backtests e recálculos pesados.
- Service Worker da extensão para coordenação.
- Content Script para integração visual com a página.
- Script injetado no contexto da página para observação de WebSocket quando necessário.

### 10.2 Componentes

#### Background Service Worker

Responsável por:

- ciclo de vida da extensão;
- mensagens entre abas;
- abertura da página dedicada;
- alarmes internos;
- controle de permissões;
- notificações;
- estado resumido.

#### Page Bridge

Responsável por:

- observar mensagens relevantes;
- encaminhar somente dados necessários;
- não modificar ordens;
- não alterar o WebSocket;
- não interferir no funcionamento da página.

#### Content Script

Responsável por:

- montar o painel flutuante;
- receber estado analisado;
- detectar compatibilidade da página;
- enviar comandos visuais;
- manter isolamento de CSS.

#### Analysis Worker

Responsável por:

- formação de períodos;
- contextos;
- execução de estratégias;
- backtests;
- agregações;
- ranking.

#### Página dedicada

Responsável por:

- dashboard;
- estratégias;
- análise;
- histórico;
- backtests;
- configurações;
- diagnóstico.

### 10.3 Restrição de acoplamento

A captura não deverá conhecer regras de estratégia.

O motor de estratégia não deverá depender diretamente do DOM da IQ Option.

A interface não deverá ser responsável por cálculos estatísticos.

---

## 11. Captura de dados

### 11.1 Fontes conhecidas

O coletor deverá reconhecer, quando disponíveis, eventos como:

- `quote-generated`;
- `underlying-list-changed`;
- `candles`;
- `candle-generated`.

O código deverá ser tolerante a pequenas variações de formato.

### 11.2 Regras de captura

1. Apenas observar mensagens.
2. Não substituir o WebSocket de forma destrutiva.
3. Não bloquear mensagens.
4. Não alterar payloads.
5. Não enviar comandos operacionais.
6. Não depender de um único nome de evento sem validação estrutural.
7. Registrar diagnóstico quando um formato não for reconhecido.
8. Evitar guardar mensagens irrelevantes.

### 11.3 Identificação do ativo

Prioridade:

1. mapeamento de `active_id`;
2. evento de lista de ativos;
3. estado estruturado da página;
4. fallback visual não invasivo somente para nome de exibição.

O identificador interno deverá diferenciar:

- EURUSD;
- EURUSD-OTC.

### 11.4 Identificação do timeframe

Prioridade:

1. timeframe informado no evento;
2. diferença entre timestamps;
3. estado estruturado da página;
4. configuração manual temporária.

### 11.5 Estado da captura

Estados:

- aguardando página compatível;
- inicializando;
- capturando;
- pausada;
- sem ativo;
- sem timeframe;
- formato incompatível;
- erro;
- recuperação.

---

## 12. Modelo de candle

```ts
type Candle = {
  id: string;
  activeId: number | string;
  symbol: string;
  marketType: "normal" | "otc" | "unknown";
  timeframeSec: number;
  from: number;
  to: number;
  open: number;
  close: number;
  high: number;
  low: number;
  volume?: number;
  bid?: number;
  ask?: number;
  closed: boolean;
  color: "green" | "red" | "doji";
  origin: "history" | "realtime" | "aggregated" | "imported";
  capturedAt: number;
  updatedAt: number;
  schemaVersion: number;
};
```

### 12.1 Chave única

```text
activeId + timeframeSec + from
```

### 12.2 Atualização

- Candle em formação pode ser atualizado.
- Candle fechado não deve ser alterado por atualização comum.
- Correções recebidas posteriormente podem substituir um candle fechado se:
  - a origem for considerada confiável;
  - os dados forem diferentes;
  - a alteração for registrada em log.

### 12.3 Integridade

Validar:

- `from < to`;
- `low <= open`;
- `low <= close`;
- `high >= open`;
- `high >= close`;
- números finitos;
- timeframe positivo;
- ativo identificado.

---

## 13. Persistência local

### 13.1 Tecnologia

IndexedDB.

### 13.2 Stores recomendadas

- `candles`;
- `assets`;
- `quadrants`;
- `aggregated_periods`;
- `strategies`;
- `strategy_versions`;
- `opportunities`;
- `results`;
- `contexts`;
- `backtest_runs`;
- `alerts`;
- `settings`;
- `diagnostics`;
- `migrations`;
- `imports`;
- `exports`.

### 13.3 Índices

Candles:

- por ativo;
- por timeframe;
- por início;
- por ativo + timeframe + início;
- por fechamento;
- por origem.

Oportunidades:

- por estratégia;
- por ativo;
- por horário;
- por resultado;
- por versão da estratégia.

### 13.4 Retenção

Configurações:

- ilimitado;
- últimos 30 dias;
- últimos 90 dias;
- últimos 180 dias;
- máximo por ativo;
- limpeza manual.

Padrão recomendado:

- M1: 90 dias;
- períodos agregados: 365 dias;
- estratégias e resultados: sem limpeza automática.

### 13.5 Exportação

Formatos:

- backup completo `.json`;
- candles `.json`;
- candles `.csv`;
- estratégias `.json`;
- resultados `.csv`.

### 13.6 Importação

A importação deverá:

- validar versão;
- mostrar resumo;
- detectar duplicidades;
- permitir mesclar;
- permitir substituir;
- criar backup antes de substituição.

---

## 14. Agregação de timeframes

### 14.1 Timeframes iniciais

- M1;
- M5;
- M15;
- M30;
- H1;
- D1.

### 14.2 Regra OHLC

Para um período agregado:

- open = abertura do primeiro candle;
- close = fechamento do último candle;
- high = maior máxima;
- low = menor mínima;
- volume = soma, quando disponível.

### 14.3 Completude

Um período agregado será:

- completo;
- parcial;
- incompleto por lacuna.

Estratégias poderão escolher se aceitam períodos parciais.

Padrão: não aceitar.

### 14.4 Fonte preferencial

1. candle nativo recebido;
2. candle agregado localmente;
3. dado importado.

Quando houver conflito, preservar a origem e escolher a fonte de maior prioridade para análise.

---

## 15. Motor de quadrantes

### 15.1 Formação

Cada candle M1 deve receber:

- identificador do quadrante;
- horário inicial;
- posição Q1 a Q5;
- status do quadrante.

### 15.2 Identificador

Exemplo:

```text
AUDCAD-OTC|2026-07-26T10:00:00|M1-Q5
```

### 15.3 Estado

- em formação;
- completo;
- incompleto;
- inválido.

### 15.4 Métricas

- sequência exata;
- quantidade verde;
- quantidade vermelha;
- quantidade doji;
- maioria;
- minoria;
- primeira cor;
- última cor;
- alternância;
- repetição;
- maior sequência;
- equilíbrio;
- amplitude total;
- direção líquida.

---

## 16. Contextos temporais

### 16.1 Regra geral

Contexto não deve ser preenchido manualmente.

Ele será calculado a partir dos dados.

### 16.2 Estados

- verde;
- vermelho;
- neutro;
- indefinido;
- amostra insuficiente.

### 16.3 Mar

Fonte inicial: D1.

Janela padrão:

- últimos 5 dias completos.

Métricas:

- dias verdes;
- dias vermelhos;
- dojis;
- predominância;
- sequência;
- mudança recente;
- força.

### 16.4 Maré

Fonte inicial: H1.

Janela padrão:

- últimas 7 horas completas.

### 16.5 Onda

Fontes:

- M15;
- M30.

Janela padrão:

- últimos 4 M30;
- últimos 8 M15.

### 16.6 Marola

Fontes:

- quadrante anterior;
- quadrante atual;
- últimas 5, 10 e 15 velas M1.

### 16.7 Força

Escala interna:

```text
0 a 100
```

Faixas:

- 0–39: fraco;
- 40–59: neutro;
- 60–79: moderado;
- 80–100: forte.

A fórmula deverá ser versionada e testável.

### 16.8 Uso em estratégias

Uma estratégia poderá:

- ignorar contexto;
- exigir estado;
- exigir força mínima;
- operar a favor;
- operar contra;
- usar contexto apenas no ranking;
- invalidar em conflito.

---

## 17. Modelo de estratégia

```ts
type Strategy = {
  id: string;
  name: string;
  description?: string;
  category: string;
  active: boolean;
  floating: boolean;
  native: boolean;
  version: number;
  marketScope: {
    normal: boolean;
    otc: boolean;
  };
  assets?: string[];
  timeframes: number[];
  schedule?: StrategySchedule;
  trigger: TriggerDefinition;
  conditions: ConditionGroup;
  entry: EntryDefinition;
  dojiPolicy: DojiPolicy;
  gale: GaleDefinition;
  contextFilters?: ContextFilter[];
  rankingWeights?: RankingWeights;
  alertPolicy: AlertPolicy;
  createdAt: number;
  updatedAt: number;
};
```

### 17.1 Estratégia estruturada

Não salvar regra apenas como descrição em texto.

### 17.2 Versionamento

Ao alterar uma estratégia com histórico:

- criar nova versão;
- preservar resultados anteriores;
- permitir recálculo;
- informar impacto.

### 17.3 Ações

- criar;
- editar;
- duplicar;
- ativar;
- desativar;
- arquivar;
- excluir quando sem dependências;
- marcar como flutuante;
- exportar;
- importar;
- restaurar padrão.

---

## 18. Construtor de estratégias

### 18.1 Estrutura

Etapas:

1. Identificação.
2. Mercado e ativos.
3. Timeframe e janela.
4. Gatilho.
5. Condições.
6. Entrada.
7. Doji.
8. Gale.
9. Contexto.
10. Alertas.
11. Validação.
12. Backtest.

### 18.2 Fontes de condição

- candle;
- posição;
- quadrante;
- quadrantes anteriores;
- janela móvel;
- timeframe superior;
- contexto;
- horário;
- dia da semana;
- mercado;
- ativo;
- desempenho recente;
- sequência de resultados.

### 18.3 Condições iniciais

- cor igual;
- cor diferente;
- quantidade de verdes;
- quantidade de vermelhos;
- quantidade de dojis;
- maioria verde;
- maioria vermelha;
- minoria verde;
- minoria vermelha;
- sequência exata;
- contém sequência;
- alternância;
- repetição;
- cor de posição;
- primeira vela;
- última vela;
- maior sequência consecutiva;
- quadrante completo;
- ausência de lacuna;
- contexto igual;
- força mínima;
- horário entre;
- dia da semana;
- ativo;
- normal ou OTC;
- quantidade mínima de ocorrências históricas;
- taxa mínima recente;
- quantidade máxima de losses consecutivos.

### 18.4 Operadores

- igual;
- diferente;
- maior;
- maior ou igual;
- menor;
- menor ou igual;
- contém;
- não contém;
- entre;
- pertence;
- não pertence.

### 18.5 Lógica

MVP:

- grupos `E`;
- grupos `OU`;
- um nível de agrupamento;
- negação simples.

Não criar editor de lógica ilimitado no MVP.

---

## 19. Entrada

### 19.1 Momento

- próxima vela;
- posição específica do quadrante atual;
- posição específica do próximo quadrante;
- próximo período;
- horário absoluto recorrente;
- deslocamento em minutos.

### 19.2 Direção

- verde;
- vermelho;
- maioria;
- minoria;
- repetir posição;
- inverter posição;
- repetir quadrante;
- inverter quadrante;
- direção do contexto;
- direção contrária ao contexto.

### 19.3 Validade

Uma oportunidade poderá expirar quando:

- horário de entrada passou;
- ativo mudou;
- timeframe mudou;
- condição deixou de ser verdadeira;
- candle ficou incompleto;
- houve doji invalidante;
- a aba foi desconectada;
- houve lacuna.

---

## 20. Doji

Políticas:

- invalidar gatilho;
- invalidar entrada;
- invalidar quadrante;
- ignorar no cálculo;
- permitir;
- contar como Loss;
- repetir avaliação na próxima vela;
- regra específica por etapa.

A política deverá ser configurável por estratégia.

---

## 21. Gale

### 21.1 Níveis

- sem Gale;
- G1;
- G2.

### 21.2 Para cada nível

- momento;
- direção;
- política de doji;
- condição adicional;
- limite de tempo;
- comportamento em lacuna.

### 21.3 Direção

- manter entrada;
- inverter entrada;
- fixa;
- maioria atual;
- minoria atual;
- referência configurada.

### 21.4 Resultado consolidado

Exemplo:

- entrada ganha: Win;
- entrada perde e G1 ganha: Win G1;
- entrada e G1 perdem e G2 ganha: Win G2;
- todas perdem: Loss.

---

## 22. Estratégias nativas

As estratégias nativas deverão ser tratadas como presets editáveis por duplicação.

O produto não deverá afirmar que qualquer preset é lucrativo.

### 22.1 Presets iniciais recomendados

#### A. Maioria do quadrante

- analisa quadrante completo;
- entra seguindo maioria ou regra configurada.

#### B. Minoria do quadrante

- analisa quadrante completo;
- entra seguindo minoria.

#### C. Repetição de posição

- usa a cor de uma posição do quadrante anterior;
- entra na mesma posição do quadrante seguinte.

#### D. Inversão de posição

- usa a cor de referência;
- entra na direção inversa.

#### E. Sequência exata

- ativa por padrão configurado, por exemplo `V-V-R-V-R`.

#### F. Alternância

- detecta alternância de cores.

#### G. Padrão de predominância

- detecta 4x1, 3x2 ou outras composições.

#### H. MHI configurável

- preset parametrizado;
- sem hardcode irreversível;
- regras explícitas na interface.

#### I. Padrão do Milhão configurável

- preset parametrizado;
- regras visíveis;
- nome tratado como identificação popular, não como promessa.

#### J. Contexto multi-timeframe

- combina M1 com M15, M30 ou H1.

### 22.2 Revisão dos presets

Antes de considerar um preset pronto, deverá existir:

- descrição clara;
- exemplo visual;
- condições explícitas;
- entrada explícita;
- regra de doji;
- Gale;
- teste unitário;
- backtest de validação.

---

## 23. Motor de oportunidades

### 23.1 Fluxo

A cada candle relevante:

1. atualizar candle;
2. confirmar fechamento;
3. atualizar quadrante;
4. atualizar períodos;
5. atualizar contextos;
6. localizar estratégias candidatas;
7. avaliar condições;
8. criar ou atualizar oportunidade;
9. agendar alertas;
10. avaliar resultados vencidos;
11. atualizar estatísticas;
12. atualizar ranking e interfaces.

### 23.2 Idempotência

A mesma oportunidade não pode ser criada duas vezes.

Chave sugerida:

```text
strategyVersionId + symbol + triggerTimestamp + entryTimestamp
```

### 23.3 Snapshot

Cada oportunidade deve guardar o contexto no momento do gatilho:

- candles usados;
- quadrante;
- períodos;
- contexto;
- regra;
- direção;
- horário;
- ranking;
- amostra histórica.

---

## 24. Backtest

### 24.1 Objetivo

Executar uma versão de estratégia sobre candles históricos locais.

### 24.2 Requisitos

- ordem cronológica;
- sem usar dados futuros;
- mesma lógica do realtime;
- resultados reproduzíveis;
- execução em Web Worker;
- progresso;
- cancelamento;
- logs;
- versão de algoritmo.

### 24.3 Filtros

- ativo;
- normal/OTC;
- timeframe;
- data inicial;
- data final;
- horário;
- dia da semana;
- contexto;
- versão da estratégia.

### 24.4 Métricas

- oportunidades;
- Win;
- Win G1;
- Win G2;
- Loss;
- invalidadas;
- taxa sem Gale;
- taxa com Gale;
- maior sequência de Wins;
- maior sequência de Losses;
- desempenho por hora;
- desempenho por dia;
- desempenho por ativo;
- desempenho por mercado;
- desempenho por contexto;
- amostra;
- intervalo de confiança;
- estabilidade por blocos temporais.

### 24.5 Transparência

Nunca exibir apenas a taxa total.

Exemplo:

```text
Taxa consolidada: 76,8%
Amostra: 401
Win direto: 58,1%
Win G1: 13,7%
Win G2: 5,0%
Loss: 23,2%
```

---

## 25. Estatística e confiança

### 25.1 Amostra mínima

Configuração padrão:

- abaixo de 20: insuficiente;
- 20 a 49: baixa;
- 50 a 149: moderada;
- 150 ou mais: elevada.

Essas faixas não representam garantia.

### 25.2 Recência

O ranking deverá considerar:

- histórico completo;
- janela recente;
- estabilidade;
- aderência ao contexto.

### 25.3 Penalidades

Penalizar:

- amostra pequena;
- dados incompletos;
- muitas lacunas;
- desempenho instável;
- longa sequência recente de Losses;
- conflito de contexto;
- estratégia recém-alterada;
- backtest desatualizado.

---

## 26. Ranking de estratégias

### 26.1 Objetivo

Ordenar estratégias aplicáveis ao cenário atual.

### 26.2 Componentes iniciais do score

- desempenho histórico no ativo;
- desempenho no horário;
- desempenho no mercado;
- desempenho no contexto;
- desempenho recente;
- tamanho da amostra;
- estabilidade;
- qualidade dos dados;
- proximidade do momento da entrada;
- conflito entre estratégias.

### 26.3 Escala

```text
0 a 100
```

### 26.4 Faixas visuais

- 0–39: baixa aderência;
- 40–59: atenção;
- 60–74: moderada;
- 75–89: alta;
- 90–100: muito alta.

Não usar a palavra “certeza”.

### 26.5 Explicabilidade

Ao abrir o score, mostrar:

```text
Score: 78

+ Histórico no ativo: 18/20
+ Horário: 14/20
+ Contexto: 17/20
+ Recência: 13/20
+ Amostra: 16/20
```

---

## 27. Alertas

### 27.1 Fases

1. Estratégia em observação.
2. Pré-alerta.
3. Oportunidade confirmada.
4. Entrada iminente.
5. Entrada agora.
6. Resultado.
7. Oportunidade cancelada.

### 27.2 Padrão recomendado

- pré-alerta: 30 segundos antes;
- alerta final: 5 segundos antes;
- entrada: no início da vela.

Os tempos serão configuráveis.

### 27.3 Canais

- visual na página dedicada;
- painel flutuante;
- som;
- notificação do Chrome;
- badge no ícone.

### 27.4 Controle de ruído

- cooldown;
- limite simultâneo;
- prioridade;
- silenciar estratégia;
- silenciar ativo;
- modo discreto;
- modo somente flutuantes.

---

## 28. Página dedicada

### 28.1 Navegação

- Visão Geral;
- Mercado Atual;
- Estratégias;
- Análise;
- Backtests;
- Histórico;
- Alertas;
- Dados;
- Diagnóstico;
- Configurações.

### 28.2 Visão Geral

KPIs:

- status da captura;
- ativo atual;
- timeframe atual;
- candles armazenados;
- último candle;
- estratégias ativas;
- oportunidades atuais;
- melhor estratégia aplicável;
- qualidade dos dados;
- armazenamento utilizado.

### 28.3 Mercado Atual

- candle em formação;
- últimas velas;
- quadrante atual;
- quadrante anterior;
- Mar;
- Maré;
- Onda;
- Marola;
- estratégias aplicáveis;
- contagem regressiva.

### 28.4 Estratégias

Tabela:

- nome;
- status;
- categoria;
- timeframe;
- normal/OTC;
- flutuante;
- último backtest;
- taxa;
- amostra;
- ações.

### 28.5 Análise

Filtros:

- ativo;
- mercado;
- estratégia;
- período;
- horário;
- resultado;
- contexto.

Conteúdo:

- ranking;
- KPIs;
- linha do tempo;
- resultados;
- estabilidade;
- ocorrências.

### 28.6 Histórico

Lista cronológica de:

- oportunidades;
- entradas;
- resultados;
- cancelamentos;
- alertas.

---

## 29. Painel flutuante

### 29.1 Objetivo

Permitir acompanhamento dentro da IQ Option sem alternar abas.

### 29.2 Exibição

Mostrar apenas estratégias marcadas como flutuantes.

### 29.3 Informações por card

- nome;
- estado;
- direção;
- horário;
- contagem regressiva;
- score;
- taxa histórica;
- amostra;
- contexto resumido;
- motivo de invalidação;
- resultado recente.

### 29.4 Estados

- aguardando;
- observando;
- pré-alerta;
- confirmado;
- entrada agora;
- em avaliação;
- Win;
- Win G1;
- Win G2;
- Loss;
- invalidada;
- sem dados.

### 29.5 Interação

- recolher;
- expandir;
- arrastar;
- fixar posição;
- silenciar;
- abrir análise;
- remover da flutuação.

### 29.6 Segurança visual

O painel não deverá cobrir:

- botões de operação;
- valor da operação;
- tempo de expiração;
- gráfico central de forma impeditiva.

Posição padrão:

- canto superior direito;
- deslocamento configurável.

### 29.7 Isolamento

Utilizar Shadow DOM ou estratégia equivalente para impedir conflito de CSS.

---

## 30. Diagnóstico

### 30.1 Informações

- extensão ativa;
- URL compatível;
- bridge instalado;
- mensagens observadas;
- eventos reconhecidos;
- ativo;
- timeframe;
- último candle;
- candles por timeframe;
- lacunas;
- uso de memória;
- uso do IndexedDB;
- erros recentes;
- versão do schema;
- versão da extensão.

### 30.2 Exportação de diagnóstico

Gerar arquivo sem informações sensíveis de conta.

Não exportar:

- credenciais;
- cookies;
- token de sessão;
- saldo;
- dados pessoais.

---

## 31. Configurações

### 31.1 Geral

- iniciar captura automaticamente;
- manter painel flutuante;
- idioma;
- formato de horário;
- tema;
- densidade visual.

### 31.2 Captura

- ativos permitidos;
- timeframes;
- retenção;
- modo diagnóstico;
- aceitar correção de candle fechado.

### 31.3 Doji

- método;
- tolerância;
- visualização.

### 31.4 Alertas

- som;
- volume;
- pré-alerta;
- alerta final;
- notificações;
- cooldown.

### 31.5 Ranking

- pesos;
- amostra mínima;
- janela recente;
- score mínimo para alertar.

### 31.6 Dados

- exportar;
- importar;
- limpar;
- reconstruir derivados;
- verificar integridade.

---

## 32. Requisitos não funcionais

### 32.1 Performance

- atualização visual normal em até 250 ms após evento relevante;
- processamento incremental;
- backtests fora da thread principal;
- tabelas virtualizadas;
- carregamento paginado;
- evitar reprocessar todo histórico a cada candle.

### 32.2 Resiliência

- sobreviver a recarregamento;
- recuperar estado;
- detectar desconexão;
- evitar corrupção;
- migrações versionadas;
- backup antes de importação destrutiva.

### 32.3 Segurança

- permissões mínimas;
- nenhuma coleta remota;
- nenhum segredo hardcoded;
- sanitização de importações;
- CSP compatível com Manifest V3;
- não executar código de estratégia fornecido como JavaScript livre.

### 32.4 Privacidade

Todos os dados do MVP permanecem no dispositivo.

### 32.5 Compatibilidade

Prioridade:

- Chrome desktop;
- resolução mínima 1280×720;
- zoom entre 80% e 125%.

---

## 33. Modelo de permissões

Permissões mínimas recomendadas:

- `storage`;
- `notifications`, somente se ativadas;
- acesso ao domínio da IQ Option;
- `alarms`, se necessário;
- `unlimitedStorage`, apenas se justificado.

Evitar:

- acesso a todos os sites;
- clipboard;
- downloads irrestritos;
- cookies;
- webRequest bloqueante.

---

## 34. Tratamento de falhas

### 34.1 Falta de dados

- marcar amostra insuficiente;
- não inventar contexto;
- não emitir alerta conclusivo;
- informar lacuna.

### 34.2 Mudança de formato

- entrar em modo diagnóstico;
- preservar dados existentes;
- informar captura incompatível;
- registrar amostra anonimizada da estrutura somente localmente.

### 34.3 Aba fechada

- parar realtime;
- manter dados;
- marcar oportunidades pendentes como interrompidas quando não puderem ser avaliadas.

### 34.4 Ativo alterado

- cancelar oportunidades dependentes do ativo anterior;
- trocar contexto;
- preservar histórico.

### 34.5 Timeframe alterado

- atualizar estado;
- evitar misturar candles;
- recalcular candidatos.

---

## 35. Estrutura de pastas recomendada

```text
src/
  background/
  bridge/
  content/
  popup/
  dashboard/
  workers/
  domain/
    candles/
    assets/
    timeframes/
    quadrants/
    contexts/
    strategies/
    opportunities/
    backtests/
    rankings/
    alerts/
  storage/
    db/
    repositories/
    migrations/
    backup/
  shared/
    types/
    validation/
    messaging/
    logging/
    time/
  tests/
    unit/
    integration/
    fixtures/
    replay/
docs/
  PRD/
    PRD — IQ Candle Lab.md
  legacy/
```

---

## 36. Estratégia de testes

### 36.1 Unitários

- cor;
- doji;
- agregação;
- quadrante;
- posição;
- contexto;
- operadores;
- estratégia;
- Gale;
- ranking;
- deduplicação.

### 36.2 Integração

- mensagem → candle;
- candle → IndexedDB;
- candle → quadrante;
- quadrante → oportunidade;
- oportunidade → resultado;
- resultado → estatística;
- ranking → painel.

### 36.3 Replay

Criar fixtures de mensagens reais anonimizadas.

O replay deverá reproduzir uma sessão para validar:

- captura;
- ordem;
- duplicidade;
- fechamento;
- mudança de ativo;
- lacunas;
- oportunidades.

### 36.4 Regressão

Toda correção em regra deverá receber fixture ou teste.

---

## 37. Critérios de aceitação do MVP

O MVP será considerado funcional quando:

1. A extensão reconhecer uma aba compatível.
2. O ativo atual for identificado.
3. O timeframe atual for identificado.
4. Candles históricos forem capturados.
5. Candles em formação forem atualizados sem duplicidade.
6. Candles fechados forem persistidos.
7. Quadrantes M1 forem formados corretamente.
8. Períodos M5, M15, M30 e H1 forem agregados.
9. Contextos forem calculados.
10. Uma estratégia estruturada puder ser criada.
11. Uma estratégia puder ser duplicada.
12. Uma estratégia puder ser marcada como flutuante.
13. O motor detectar uma oportunidade.
14. O sistema gerar pré-alerta e alerta.
15. O painel flutuante mostrar a oportunidade.
16. O sistema avaliar Win, Gale ou Loss.
17. O resultado aparecer no histórico.
18. Um backtest puder ser executado.
19. Percentual e amostra forem exibidos juntos.
20. Dados puderem ser exportados e restaurados.
21. Nenhuma operação automática for realizada.

---

## 38. Fases de desenvolvimento

### Fase 0 — Fundação

- repositório;
- Manifest V3;
- build;
- tipos;
- mensagens;
- logging;
- testes;
- IndexedDB;
- migrações.

### Fase 1 — Captura

- bridge;
- ativos;
- timeframe;
- histórico;
- realtime;
- deduplicação;
- diagnóstico.

### Fase 2 — Tempo e quadrantes

- classificação de cor;
- doji;
- quadrantes;
- janelas;
- agregação;
- lacunas.

### Fase 3 — Página dedicada

- dashboard;
- mercado atual;
- dados;
- diagnóstico;
- configurações.

### Fase 4 — Estratégias

- modelo;
- CRUD;
- versionamento;
- condições;
- entrada;
- doji;
- Gale.

### Fase 5 — Motor realtime

- oportunidades;
- estados;
- resultados;
- idempotência;
- snapshots.

### Fase 6 — Backtest

- worker;
- métricas;
- filtros;
- auditoria.

### Fase 7 — Contexto e ranking

- Mar;
- Maré;
- Onda;
- Marola;
- score;
- explicabilidade.

### Fase 8 — Alertas e flutuante

- cards;
- drag;
- sons;
- contagem regressiva;
- notificações.

### Fase 9 — Estratégias nativas

- presets;
- testes;
- exemplos;
- documentação.

### Fase 10 — Estabilização

- performance;
- migrações;
- backup;
- testes de longa duração;
- pacote de distribuição.

---

## 39. Roadmap posterior

- sincronização opcional;
- API local;
- mais corretoras;
- múltiplas abas;
- biblioteca compartilhada;
- relatórios avançados;
- simulação financeira opcional;
- replay visual;
- importação em massa;
- comparação automática de versões;
- otimização de parâmetros;
- detecção de mudança de regime;
- aplicativo desktop.

---

## 40. Riscos

### 40.1 Mudança interna da IQ Option

Mitigação:

- adaptadores;
- diagnóstico;
- validação estrutural;
- testes por replay.

### 40.2 Dados incompletos

Mitigação:

- lacunas explícitas;
- períodos incompletos;
- bloqueio de análise quando necessário.

### 40.3 Viés estatístico

Mitigação:

- amostra;
- recência;
- estabilidade;
- filtros;
- intervalos;
- transparência.

### 40.4 Excesso de alertas

Mitigação:

- score mínimo;
- cooldown;
- flutuantes;
- prioridade.

### 40.5 Crescimento do banco

Mitigação:

- retenção;
- compactação;
- agregados;
- exportação;
- limpeza.

### 40.6 Estratégias mal configuradas

Mitigação:

- validação;
- preview;
- exemplos;
- teste;
- backtest obrigatório antes da ativação opcional.

---

## 41. Decisões pendentes não bloqueadoras

Estas decisões podem ser refinadas durante a implementação sem impedir o início:

1. Nome comercial definitivo.
2. Identidade visual.
3. Pesos finais do ranking.
4. Tolerância padrão final de doji.
5. Lista definitiva de presets.
6. Tempo padrão dos alertas.
7. Política final de retenção.
8. Fórmula final da força de contexto.

Os componentes deverão ser configuráveis para evitar dependência de valores fixos.

---

## 42. Regra de governança do projeto

Este PRD passa a ser a fonte principal de verdade do produto.

Os PRDs anteriores deverão ser mantidos apenas em `docs/legacy` para consulta técnica.

Quando houver divergência:

1. prevalece este PRD;
2. depois, decisões registradas em ADRs;
3. por último, documentação legada.

Toda mudança estrutural deverá atualizar:

- versão do PRD;
- changelog;
- modelos afetados;
- critérios de aceitação;
- estratégia de migração.

---

## 43. Resultado esperado

Ao final do MVP, o usuário deverá conseguir abrir a IQ Option, manter a extensão capturando dados localmente, acompanhar o mercado em uma página dedicada, visualizar estratégias aplicáveis, receber alertas, manter estratégias específicas flutuando sobre a plataforma, executar backtests, auditar resultados e comparar desempenho histórico — sem que a extensão realize qualquer operação automática.

---

# Anexo A — Fluxo resumido de uma oportunidade

```text
Candle fecha
    ↓
Quadrante é atualizado
    ↓
Contextos são recalculados
    ↓
Estratégias candidatas são avaliadas
    ↓
Condições atendidas?
    ├─ Não → aguardar próximo evento
    └─ Sim
        ↓
Criar oportunidade
        ↓
Calcular ranking
        ↓
Emitir pré-alerta
        ↓
Validar novamente antes da entrada
        ├─ Inválida → cancelar e registrar motivo
        └─ Válida
            ↓
        Emitir alerta de entrada
            ↓
        Aguardar candle de resultado
            ↓
        Win?
            ├─ Sim → registrar Win
            └─ Não
                ↓
            Gale configurado?
                ├─ Não → registrar Loss
                └─ Sim → avaliar G1/G2
```

---

# Anexo B — Exemplo de estratégia estruturada

```json
{
  "name": "Maioria do quadrante anterior",
  "active": true,
  "floating": true,
  "marketScope": {
    "normal": true,
    "otc": true
  },
  "timeframes": [60],
  "trigger": {
    "type": "quadrant_completed",
    "offset": 0
  },
  "conditions": {
    "operator": "AND",
    "items": [
      {
        "field": "previousQuadrant.dojiCount",
        "operator": "equals",
        "value": 0
      },
      {
        "field": "previousQuadrant.majority",
        "operator": "in",
        "value": ["green", "red"]
      }
    ]
  },
  "entry": {
    "moment": "next_quadrant_q1",
    "direction": "previous_quadrant_majority"
  },
  "dojiPolicy": "invalidate_opportunity",
  "gale": {
    "maxLevel": 1,
    "g1": {
      "moment": "next_candle",
      "direction": "same"
    }
  },
  "alertPolicy": {
    "preAlertSeconds": 30,
    "finalAlertSeconds": 5,
    "sound": true
  }
}
```

---

# Anexo C — Changelog

## Versão 1.0 — 26/07/2026

- Unificação dos projetos anteriores.
- Remoção de API e backend do MVP.
- Definição de persistência exclusivamente local.
- Definição da página dedicada.
- Definição de estratégias flutuantes na IQ Option.
- Inclusão de quadrantes e janelas móveis.
- Inclusão de agregação multi-timeframe.
- Inclusão de contextos Mar, Maré, Onda e Marola.
- Inclusão de ranking explicável.
- Inclusão de backtest local.
- Inclusão de versionamento de estratégias.
- Proibição explícita de operação automática.
