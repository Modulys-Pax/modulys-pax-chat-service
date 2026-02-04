# modulys-pax-chat-service

Microserviço de **chat interno** do Modulys Pax. Expõe canais e mensagens; os dados ficam no banco do tenant. O cliente chama o **chat-service** diretamente (não passa pela admin-api).

## Fluxo

- Cliente → **chat-service** (header `x-tenant-id`) → chat-service valida tenant + módulo na admin-api (`/provisioning/tenant/:id/connection?module=internal_chat`) e obtém a connection string → consultas no banco do tenant.

## Pré-requisitos

- Tenant com módulo **internal_chat** habilitado.
- Migrations do módulo internal_chat aplicadas no banco do tenant (tabelas `chat_channels`, `chat_channel_members`, `chat_messages`).

## Variáveis de ambiente

Copie `.env.example` para `.env` e ajuste:

| Variável           | Descrição                          | Exemplo                          |
|--------------------|------------------------------------|----------------------------------|
| `SERVICE_PORT`     | Porta do serviço                   | `9001`                           |
| `ADMIN_API_URL`    | Base URL da admin-api              | `http://localhost:3000/api/admin` |
| `SERVICE_KEY`      | Chave para chamar a admin-api (igual à `SERVICE_KEY` da admin-api) | (valor secreto) |

## Execução

```bash
npm install
npm run dev
```

## API (consumida via admin-api)

- `GET /channels` – lista canais
- `POST /channels` – cria canal (body: name, created_by_employee_id, description?, is_private?)
- `GET /channels/:channelId` – detalhe do canal
- `GET /channels/:channelId/members` – membros
- `POST /channels/:channelId/members` – adiciona membro (body: employee_id, role?)
- `GET /channels/:channelId/messages` – mensagens (query: limit, offset)
- `POST /channels/:channelId/messages` – envia mensagem (body: employee_id, content)

O frontend do cliente chama o **chat-service** diretamente (ex.: `https://chat.seudominio.com`), enviando o header **`x-tenant-id`** em toda requisição. O chat-service valida com a admin-api se o tenant tem o módulo internal_chat habilitado ao obter a connection string.

## Repositório

Pode ser versionado em um repositório próprio (ex.: `modulys-pax-chat-service` no GitHub).
