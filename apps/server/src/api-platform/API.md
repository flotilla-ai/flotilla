# Flotilla public API

Base URL: `https://<your-flotilla-host>/api/v1`. Every request sends `Authorization: Bearer flt_...`.

## Keys and principals

Keys are minted only in the Flotilla app (a signed-in browser session); an API key cannot mint another key. A key may carry an optional `expiresAt`. There is no rotate verb: mint a new key, switch, then revoke the old one. A key acts as the human who minted it, or as a service user created with it (`serviceUser: { name }`); to replace a service key, mint with `serviceUser: { id }` so the new key keeps the same service user and its resources. `GET /api/v1/principal` returns `{ kind, userId, authorId, via, keyId }`; `authorId` is always the human who minted the key.

GET /api/v1/principal
POST /api/v1/api-keys
GET /api/v1/api-keys
DELETE /api/v1/api-keys/:id

## Conventions

- Creates accept `requestId` in the body (or an `Idempotency-Key` header). A retry with the same `requestId` replays the first response with `Idempotent-Replayed: true`; reusing it for a different request returns `flotilla/Conflict`. Keys expire after 24 hours.
- Unbounded lists return `{ items, cursor }`; pass `?cursor=<cursor>&limit=<n>` (max 200) until `cursor` is `null`. Bounded lists return `{ items }`.
- Errors are `{ error, code }` with `code` one of `flotilla/ValidationFailed` (400), `flotilla/Unauthorized` (401), `flotilla/PaidFeatureUnavailable` (402), `flotilla/Forbidden` (403), `flotilla/NotFound` (404), `flotilla/Conflict`, `flotilla/RequestInProgress`, `flotilla/CrewRefused` (409), `flotilla/PayloadTooLarge` (413), `flotilla/RateLimited` (429, with `Retry-After`), `flotilla/Internal` (500), `flotilla/BillingAuthorityUnavailable` (503).
- Streams: `GET /api/v1/threads/:id/stream?frames=public` is Server-Sent Events. The first frame carries `retry: 2000`; each frame has `id: <seq>` and `event:` one of `status`, `run`, `turn`, `tool_call`, `assistant`, `transcript`. Reconnect with `Last-Event-ID` to resume.

GET /api/v1/threads/:id/stream

## Common flows

Start a thread and follow it:

```sh
curl -fsS -X POST "$FLOTILLA/api/v1/threads" -H "authorization: Bearer $FLOTILLA_KEY" \
  -H 'content-type: application/json' -d '{"title":"Fix flaky test","prompt":"...","requestId":"fix-1"}'
curl -N "$FLOTILLA/api/v1/threads/$THREAD/stream?frames=public" -H "authorization: Bearer $FLOTILLA_KEY"
```

POST /api/v1/threads
GET /api/v1/threads
GET /api/v1/threads/:id
GET /api/v1/threads/:id/messages
POST /api/v1/threads/:id/message
POST /api/v1/threads/:id/stop

Upload a file, then attach it by `fileId`:

```sh
grant=$(curl -fsS -X POST "$FLOTILLA/api/v1/files" -H "authorization: Bearer $FLOTILLA_KEY" \
  -H 'content-type: application/json' -d "{\"name\":\"log.txt\",\"contentType\":\"text/plain\",\"size\":$(stat -c%s log.txt)}")
curl -fsS -X PUT "$(echo "$grant" | jq -r .uploadUrl)" -H 'content-type: text/plain' --data-binary @log.txt
```

The upload URL is presigned (no bearer needed), single-use and valid for 15 minutes.

POST /api/v1/files
GET /api/v1/files
GET /api/v1/files/:id
PUT /api/v1/uploads/:id

Trigger an automation from another system:

POST /api/v1/webhooks/automations/:secret

Projects:

GET /api/v1/projects
POST /api/v1/projects

## Migrating from /tasks

Clients written against a `/tasks` API keep working: every `/api/v1/tasks/...` request is answered with `308` to the same path under `/api/v1/threads/...` (method and body preserved), plus `Deprecation: true` and a `Link: rel="successor-version"` header. Rename `tasks` to `threads` in your client, send `requestId` on creates, switch list loops to `cursor`, and branch on `code` instead of HTTP text.
