#!/usr/bin/env bash
set -euo pipefail
project=flotilla-captain-e2e
cleanup() {
  docker compose -p "$project" down -v >/dev/null 2>&1 || true
  docker network ls -q --filter 'name=flt-thr' | xargs -r docker network rm >/dev/null 2>&1 || true
}
cleanup
trap cleanup EXIT
docker compose -p "$project" up -d --build >/dev/null
for i in $(seq 1 90); do curl -fsS localhost:8080/healthz >/dev/null 2>&1 && break; sleep 1; done
curl -fsS localhost:8080/healthz >/dev/null
setup_token=$(docker logs "${project}-server-1" 2>&1 | sed -n 's/.*first-run setup token: //p' | tail -1)
test -n "$setup_token"
password=$(python3 -c 'import secrets;print(secrets.token_urlsafe(18))')
curl -fsS -X POST localhost:8080/api/v1/auth/setup -H 'content-type: application/json' -d "{\"email\":\"captain-e2e@example.com\",\"password\":\"$password\",\"token\":\"$setup_token\"}" >/dev/null
curl -fsS -c /tmp/flotilla-captain-cookies -X POST localhost:8080/api/v1/auth/login -H 'content-type: application/json' -d '{"email":"captain-e2e@example.com","password":"'"$password"'"}' >/tmp/flotilla-captain-login.json
csrf=$(python3 -c 'import json;print(json.load(open("/tmp/flotilla-captain-login.json"))["csrfToken"])')
curl -fsS -b /tmp/flotilla-captain-cookies -X POST localhost:8080/api/v1/captains -H 'content-type: application/json' -H "x-flotilla-csrf: $csrf" -d '{"title":"captain e2e","purpose":"start crew","engine":{"adapter":"fake"},"budget":{"maxUsd":20000,"maxTokens":null,"maxWallSec":null,"scope":"captain-subtree","onHit":"pause-and-ask","warnAt":0.8}}' >/tmp/flotilla-captain.json
captain=$(python3 -c 'import json;print(json.load(open("/tmp/flotilla-captain.json"))["id"])')
db() { docker exec "${project}-postgres-1" psql -U postgres -d flotilla -tAqc "$1"; }
for i in $(seq 1 60); do
  crew=$(db "select count(*) from threads where crew_of='$captain'" 2>/dev/null || echo 0)
  denied=$(db "select count(*) from events where thread_id='$captain' and kind='kernel.denied'" 2>/dev/null || echo 0)
  wakes=$(db "select count(*) from events where thread_id='$captain' and kind='user.message' and payload::text like '%Wake reasons:%'" 2>/dev/null || echo 0)
  if [ "$crew" -ge 5 ] && [ "$denied" -ge 1 ] && [ "$wakes" -ge 1 ]; then break; fi
  sleep 1
done
sleep 6
crew=$(db "select count(*) from threads where crew_of='$captain'")
denied=$(db "select count(*) from events where thread_id='$captain' and kind='kernel.denied'")
wakes=$(db "select count(*) from events where thread_id='$captain' and kind='user.message' and payload::text like '%Wake reasons:%'")
needs=$(db "select coalesce(jsonb_array_length(needs_you),0) from threads where id='$captain'")
digest=$(db "select coalesce(digest_md,'') from captains where thread_id='$captain'" | tr '\n' ' ')
paused=$(db "select count(*) from threads where crew_of='$captain' and status='paused'")
printf 'crew=%s denied=%s wakes=%s needs_you=%s paused=%s\n' "$crew" "$denied" "$wakes" "$needs" "$paused"
[ "$crew" = 5 ]
[ "$denied" -ge 1 ]
[ "$wakes" = 1 ]
[ "$needs" -ge 1 ]
[ "$paused" -ge 1 ]
case "$digest" in *'Budget cap reached'*) ;; *) echo 'digest missing budget approval' >&2; exit 1;; esac
echo 'captain relay e2e passed'
