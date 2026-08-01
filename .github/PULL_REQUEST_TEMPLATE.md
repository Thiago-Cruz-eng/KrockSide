## [Título]

### Resumo

[O que muda e por quê, em uma ou duas frases.]

### Contexto

[Onde a mudança afeta: contrato, autenticação, transporte, lobby, tabuleiro, testes.]

### Mudanças

1. [Mudança 1]
2. [Mudança 2]

### Evidências

[Saída de `npm run test:ci`, print da tela, log do hub — o que comprove que funciona.]

### Checklist

1. [ ] `npx tsc --noEmit` limpo
2. [ ] `npm run test:ci` verde
3. [ ] `npm run build` sem erro
4. [ ] Constituição respeitada — Princípios I (autoridade do servidor) e II (contrato explícito)
5. [ ] Nenhuma atualização otimista de tabuleiro e nenhuma regra de xadrez no cliente
6. [ ] Rota/método/evento usado **existe** no backend (conferido na skill `contrato-do-backend`)
7. [ ] Se mudou rota: `src/mocks/handlers.ts` e `tests-e2e/` atualizados no mesmo commit
8. [ ] Se mudou contrato: `BACKEND_CHANGES.md` atualizado
9. [ ] Se mudou regra de domínio: `.agents/skills/{skill}/SKILL.md` atualizada
10. [ ] Débito novo ou resolvido: `docs/debito-tecnico.md` atualizado
11. [ ] Seletor de teste estável (`data-testid`/`role`/`label`/`alt`), nenhuma classe CSS
12. [ ] Acessibilidade: `label htmlFor`, `role="alert"` em erro, `<button>` em ação, `alt` em imagem
13. [ ] Nenhum `any`/`as any` novo; nenhum token em log, URL ou DOM

### Notas

[Pontos de atenção para quem revisa, se houver.]
