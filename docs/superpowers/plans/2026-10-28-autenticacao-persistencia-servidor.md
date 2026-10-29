# Autenticação e Persistência no Servidor — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or modular atomic commits to implement and verify this plan step-by-step.

**Goal:** Implementar backend centralizado com Node.js, SQLite, autenticação RBAC multi-usuário, auto-save e sincronização com Docker e PM2.

**Architecture:** Servidor Node.js 22/24 usando `node:sqlite` para persistência em disco; roteador de API nativo com IP Whitelist; RBAC com 4 níveis hierárquicos; sincronização transparente no cliente React via `apiClient` e hooks de persistência.

**Tech Stack:** Node.js 22+, SQLite nativo (`node:sqlite`), React 18, TypeScript 5, Vite 6, Vitest 3, Docker, Docker Compose, PM2.

**Spec:** `docs/superpowers/specs/2026-10-28-autenticacao-persistencia-servidor-design.md`

---

## Roteiro de Implementação

### Task 1: Banco de Dados SQLite, Autenticação e RBAC
- Criar `server/db.ts` com schema do SQLite, inicialização de usuário administrador padrão e migrações.
- Criar `server/auth.ts` com criação e validação de tokens JWT e hashing de senhas.
- Criar `server/ipFilter.ts` e testes unitários para controle de acesso corporativo.
- Definir tipos de autenticação em `src/types/auth.ts` e testes em `src/types/auth.test.ts`.

### Task 2: Rotas da API e Auto-Save
- Implementar `server/apiRouter.ts` com rotas de auth, users, drafts, reports e settings.
- Implementar testes automatizados em `server/apiRouter.test.ts` cobrindo hierarquia RBAC e auto-save.
- Configurar servidor central em `server/index.ts`.

### Task 3: Cliente HTTP e Hooks de Sincronização
- Implementar `src/utils/apiClient.ts` com injeção automática de Bearer token e tratamento de respostas HTTP.
- Atualizar hooks (`useTasks`, `useSavedReports`, `useMarkdownTemplates`, `useWhatsappBaias`, `useEscalaBases`, `useFeriados`) para sincronizar com a API.

### Task 4: Telas de Autenticação e Gestão de Usuários
- Criar componentes de login e autenticação em `src/components/auth/`.
- Criar painel de gestão de usuários em `src/components/users/UsersManagementHub.tsx` restrito a administradores.
- Integrar verificação de sessão e logout no `src/App.tsx` e `TopNavbar.tsx`.

### Task 5: Consolidação de Templates e Limpeza de Legados
- Centralizar modelos embutidos em `src/templates/reports/index.ts` e remover arquivos `.md` legados e utilitários obsoletos.

### Task 6: Infraestrutura Docker e Configuração de Proxy
- Configurar `Dockerfile`, `docker-compose.yml` e `ecosystem.config.cjs`.
- Atualizar `vite.config.ts` com proxy reverso `/api` apontando para o servidor de desenvolvimento.

### Task 7: Documentação e Validação Final
- Atualizar `README.md` com instruções de execução via Docker e credenciais padrão de primeiro acesso.
- Validar suíte de testes (`npm test`) e compilação de produção (`npm run build`).
