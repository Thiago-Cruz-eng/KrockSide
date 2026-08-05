# Implementation Plan: [FEATURE]

**Branch**: `[###-feature-name]` | **Date**: [DATE] | **Spec**: [link]
**Input**: Feature specification from `/specs/[###-feature-name]/spec.md`

**Note**: This template is filled in by the `/speckit-plan` command. See `.specify/templates/plan-template.md` for the execution workflow.

## Summary

[Extract from feature spec: primary requirement + technical approach from research]

## Technical Context

<!--
  ACTION REQUIRED: Replace the content in this section with the technical details
  for the project. The structure here is presented in advisory capacity to guide
  the iteration process.
-->

**Language/Version**: [e.g., Python 3.11, Swift 5.9, Rust 1.75 or NEEDS CLARIFICATION]  
**Primary Dependencies**: [e.g., FastAPI, UIKit, LLVM or NEEDS CLARIFICATION]  
**Storage**: [if applicable, e.g., PostgreSQL, CoreData, files or N/A]  
**Testing**: [e.g., pytest, XCTest, cargo test or NEEDS CLARIFICATION]  
**Target Platform**: [e.g., Linux server, iOS 15+, WASM or NEEDS CLARIFICATION]
**Project Type**: [e.g., library/cli/web-service/mobile-app/compiler/desktop-app or NEEDS CLARIFICATION]  
**Performance Goals**: [domain-specific, e.g., 1000 req/s, 10k lines/sec, 60 fps or NEEDS CLARIFICATION]  
**Constraints**: [domain-specific, e.g., <200ms p95, <100MB memory, offline-capable or NEEDS CLARIFICATION]  
**Scale/Scope**: [domain-specific, e.g., 10k users, 1M LOC, 50 screens or NEEDS CLARIFICATION]

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Princípio | Status | Observação |
|-----------|--------|-----------|
| I — Autoridade do servidor | ✅/❌ | Sem atualização otimista; estado de jogo vem de `snapshot`/evento; nenhuma regra de xadrez no cliente; cor do jogador vem de `JoinRoom`/`PlayerJoined`, nunca de claim de JWT |
| II — Contrato explícito | ✅/❌ | DTO em `src/types/`; `invoke<T>`/`post<T>` tipados; rota/método confirmado como existente no backend; mudança em `BACKEND_CHANGES.md`; mock atualizado junto |
| III — Camadas | ✅/❌ | `components → hooks → service → types`; componente sem `axios`/`signalr`; token só em `src/service/Api.ts` |
| IV — Tipagem estrita | ✅/❌ | Sem `any`/`as any`/`@ts-ignore`; cast de payload só na borda; `npx tsc --noEmit` limpo |
| V — Três níveis de teste | ✅/❌ | Teste antes do código; caminho de recusa do servidor coberto com a `message` real; seletor estável; `test:ci` + `build` verdes |
| VI — Credencial protegida | ✅/❌ | Token/refresh/senha fora de URL, log e DOM; storage por `userId`; exceção só no `accessTokenFactory` do hub |
| VII — Acessibilidade e idioma | ✅/❌ | `label htmlFor`, `role="alert"`, `<button>`, `alt`; UI em português, código em inglês |

> **Gate II — esclarecimento obrigatório quando a feature toca o backend:**
> Se a feature consome rota, método de hub ou campo de DTO, o plano DEVE listar cada um e afirmar
> se **existe hoje** no backend (conferido na skill `contrato-do-backend` e em
> `docs/FRONTEND_CHANGES.md` de `../Hibrygame`). Item que não existe precisa de entrada em
> `BACKEND_CHANGES.md` antes da implementação. Plano que não listar não passa o gate.

## Project Structure

### Documentation (this feature)

```text
specs/[###-feature]/
├── plan.md              # This file (/speckit-plan command output)
├── research.md          # Phase 0 output (/speckit-plan command)
├── data-model.md        # Phase 1 output (/speckit-plan command)
├── quickstart.md        # Phase 1 output (/speckit-plan command)
├── contracts/           # Phase 1 output (/speckit-plan command)
└── tasks.md             # Phase 2 output (/speckit-tasks command - NOT created by /speckit-plan)
```

### Source Code (repository root)
<!--
  ACTION REQUIRED: Replace the placeholder tree below with the concrete layout
  for this feature. Delete unused options and expand the chosen structure with
  real paths (e.g., apps/admin, packages/something). The delivered plan must
  not include Option labels.
-->

```text
# Estrutura real deste repositório — liste apenas os caminhos que a feature toca.
src/
├── components/    App, Login, ChessLobby, ChessBoard, ChessSquare (+ {Nome}.test.tsx ao lado)
├── hooks/         useAuth, useHubConnection (contexto + provider), useChessGame
├── service/       Api.ts (axios + storage de token), userApi.ts (chamadas REST)
├── types/         auth.ts, chess.ts (DTOs do backend + helpers de coordenada)
├── mocks/         MSW v1: handlers.ts, server.ts, browser.ts
├── test-utils/    hub.tsx — createFakeHub + HubTestProvider
├── integration/   testes de fluxo com MSW
├── styles/        um CSS por componente
└── utils/
tests-e2e/         especificações Playwright
public/            imagens das peças ({color}-{type}.png)
```

Fluxo de camadas obrigatório: `components → hooks → service → types`. Componente não importa
`axios` nem `@microsoft/signalr`; `src/service/Api.ts` é o único dono do storage de token.

**Structure Decision**: [Document the selected structure and reference the real
directories captured above]

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| [e.g., 4th project] | [current need] | [why 3 projects insufficient] |
| [e.g., Repository pattern] | [specific problem] | [why direct DB access insufficient] |
