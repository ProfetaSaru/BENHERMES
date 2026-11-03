# Autenticação e Persistência no Servidor — Design Spec

**Data:** 28/10/2026  
**Status:** aprovado  
**Base:** Evolução da arquitetura SPA isolada para multi-usuário com persistência centralizada.

---

## 1. Objetivo

1. **Persistência Centralizada e Isolamento**: Permitir que usuários acessem seus relatórios, rascunhos e configurações de qualquer dispositivo em rede, mantendo histórico seguro e sem depender unicamente do armazenamento efêmero do navegador (`localStorage`).
2. **Controle de Acesso Baseado em Papéis (RBAC)**:
   - `admin`: Controle total, gestão de usuários, senhas, configurações globais e acesso irrestrito a todos os relatórios.
   - `gerente`: Visualização e auditoria de todos os relatórios gerados por todas as equipes e supervisores.
   - `supervisor`: Gestão e visualização dos relatórios gerados pelos operadores sob sua supervisão.
   - `operador`: Criação de relatórios, salvamento automático de rascunhos e visualização dos seus próprios relatórios.
3. **Autenticação Segura**:
   - Sessões autenticadas via JWT com cookies HTTP-only e suporte a Bearer token.
   - Hashing seguro de senhas utilizando PBKDF2/bcrypt nativo.
   - Whitelist de IP corporativo/VPN para proteção adicional na rede interna.
4. **Auto-Save e Sincronização Transparente**:
   - Sincronização periódica com debounce de rascunhos em tempo real.
   - Histórico de relatórios salvos com filtros por data, autor e status.
5. **Pronto para Produção e Docker**:
   - Deploy facilitado via Docker, Docker Compose e PM2 com Node 22+.
   - Banco de dados embutido SQLite nativo (`node:sqlite`) com WAL mode, sem dependência de drivers nativos compilados em C++.

---

## 2. Modelo de Dados (SQLite)

### Tabelas Principais

```sql
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  display_name TEXT NOT NULL,
  role TEXT NOT NULL CHECK(role IN ('admin', 'gerente', 'supervisor', 'operador')),
  supervisor_id TEXT REFERENCES users(id),
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS reports (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  title TEXT NOT NULL,
  template_id TEXT NOT NULL,
  template_title TEXT NOT NULL,
  template_category TEXT NOT NULL,
  is_expandable INTEGER NOT NULL DEFAULT 0,
  field_values_json TEXT NOT NULL,
  tasks_json TEXT NOT NULL,
  report_text TEXT NOT NULL,
  task_count INTEGER NOT NULL DEFAULT 0,
  period_summary TEXT NOT NULL DEFAULT '',
  note TEXT,
  display_date TEXT NOT NULL,
  display_time TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS user_drafts (
  user_id TEXT PRIMARY KEY REFERENCES users(id),
  active_template_id TEXT NOT NULL,
  tasks_json TEXT NOT NULL,
  fields_json TEXT NOT NULL,
  active_report_ids_json TEXT NOT NULL,
  custom_templates_json TEXT NOT NULL DEFAULT '[]',
  theme TEXT NOT NULL DEFAULT 'light',
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS app_settings (
  key TEXT PRIMARY KEY,
  value_json TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
```

---

## 3. Endpoints da API

- `POST /api/auth/login`: Autentica usuário e retorna token JWT + cookie seguro.
- `POST /api/auth/logout`: Revoga sessão e limpa cookie.
- `GET /api/auth/me`: Retorna perfil do usuário logado e permissões.
- `PUT /api/auth/password`: Permite que qualquer usuário autenticado altere sua própria senha.
- `GET /api/users` & `POST /api/users`: Listagem e criação de usuários (restrito a `admin`).
- `PUT /api/users/:id` & `DELETE /api/users/:id`: Edição e desativação de usuários (restrito a `admin`).
- `GET /api/reports`: Consulta de relatórios respeitando a hierarquia RBAC.
- `POST /api/reports`: Criação manual de relatório.
- `PUT /api/reports/:id/auto-save`: Salvamento automático com debounce de relatórios.
- `DELETE /api/reports/:id`: Exclusão de relatório pelo autor ou admin.
- `GET /api/drafts` & `PUT /api/drafts`: Leitura e sincronização de rascunhos de tela por usuário.
- `GET /api/health`: Healthcheck para monitoramento e Docker container.

---

## 4. Segurança e Infraestrutura

1. **IP Filter Middleware**: Validação de IPs autorizados em formato IPv4 e IPv6 (/48).
2. **Docker Multi-Stage**: Imagem Alpine minimalista servindo tanto os arquivos estáticos compilados do Vite quanto o servidor Node.js na porta 3000.
3. **Persistência de Dados**: Volume montado em `/app/data` para garantir durabilidade do arquivo `benhermes.db`.
