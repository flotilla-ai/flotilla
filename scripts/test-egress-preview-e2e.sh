#!/usr/bin/env bash
set -euo pipefail
project=flotilla-egress-e2e
thread_id=thr_preview_fixture
thread_net=flt-$thread_id
public_net=flt-fixture-public
private_net=flt-fixture-private
cleanup() {
  docker compose -p "$project" down -v >/dev/null 2>&1 || true
  docker rm -f flt-FLO-PV01 flt-egress-fixture >/dev/null 2>&1 || true
  docker network rm "$thread_net" "$public_net" "$private_net" >/dev/null 2>&1 || true
}
cleanup
trap cleanup EXIT
docker compose -p "$project" up -d --build >/dev/null
for i in $(seq 1 90); do curl -fsS localhost:8080/healthz >/dev/null 2>&1 && break; sleep 1; done
curl -fsS localhost:8080/healthz >/dev/null
password=$(python3 -c 'import secrets;print(secrets.token_urlsafe(18))')
setup_token=$(docker logs "${project}-server-1" 2>&1 | sed -n 's/.*first-run setup token: //p' | tail -1)
curl -fsS -X POST localhost:8080/api/v1/auth/setup -H 'content-type: application/json' -d "{\"email\":\"egress-e2e@example.com\",\"password\":\"$password\",\"token\":\"$setup_token\"}" >/dev/null
curl -fsS -c /tmp/flotilla-ui-cookies -X POST localhost:8080/api/v1/auth/login -H 'content-type: application/json' -d '{"email":"egress-e2e@example.com","password":"'"$password"'"}' >/tmp/flotilla-egress-login.json
csrf=$(python3 -c 'import json;print(json.load(open("/tmp/flotilla-egress-login.json"))["csrfToken"])')
db() { docker exec "${project}-postgres-1" psql -U postgres -d flotilla -tAqc "$1"; }
owner=$(db "select id from users where email='egress-e2e@example.com'")
db "insert into threads (id,code,project_id,role,owner_id,title,status,engine,budget,spent) values ('$thread_id','FLO-PV01',null,'thread','$owner','preview fixture','idle','{}','{}','{}')"
preview=$(curl -fsS -b /tmp/flotilla-ui-cookies -X POST localhost:8080/api/v1/threads/$thread_id/preview-token -H 'content-type: application/json' -H "x-flotilla-csrf: $csrf" -d '{"port":3000}')
one=$(python3 -c 'import json,sys;print(json.loads(sys.argv[1])["token"])' "$preview")
share=$(python3 -c 'import json,sys;print(json.loads(sys.argv[1])["shareToken"])' "$preview")

docker network create --internal --subnet 10.211.0.0/24 "$thread_net" >/dev/null
docker network create --internal --subnet 11.0.0.0/24 "$public_net" >/dev/null
docker network create --internal --subnet 10.212.0.0/24 "$private_net" >/dev/null
docker network connect --alias gate --alias flotilla-tools "$thread_net" "${project}-gate-1"
docker network connect "$public_net" "${project}-gate-1"
docker network connect "$private_net" "${project}-gate-1"
server_js='require("http").createServer((q,r)=>{r.end("fixture-ok")}).listen(8088,"0.0.0.0")'
docker run -d --name flt-egress-fixture --network "$public_net" --network-alias fixture.public.test --network-alias denied.public.test flotilla-thread:dev node -e "$server_js" >/dev/null
docker network connect --alias fixture.private.test "$private_net" flt-egress-fixture
preview_js='require("http").createServer((q,r)=>{r.end("preview-ok")}).listen(3000,"0.0.0.0")'
docker run -d --name flt-FLO-PV01 --network "$thread_net" flotilla-thread:dev node -e "$preview_js" >/dev/null

gate_token=$(docker exec "${project}-server-1" cat /run/flotilla-gate/token)
gate_ip=$(docker inspect -f '{{with index .NetworkSettings.Networks "'$thread_net'"}}{{.IPAddress}}{{end}}' "${project}-gate-1")
allow='["fixture.public.test","fixture.private.test"]'
docker exec -e GT="$gate_token" -e ALLOW="$allow" -e GIP="$gate_ip" -e NET="$thread_net" "${project}-server-1" node -e 'fetch(`http://gate:3129/networks/${process.env.NET}`,{method:"PUT",headers:{authorization:`Bearer ${process.env.GT}`,"content-type":"application/json"},body:JSON.stringify({allow:JSON.parse(process.env.ALLOW),gateIp:process.env.GIP})}).then(r=>process.exit(r.status===204?0:1))'
proxy_env=(--network "$thread_net" -e HTTP_PROXY=http://gate:3128 -e HTTPS_PROXY=http://gate:3128)
public_out=$(docker run --rm "${proxy_env[@]}" flotilla-thread:dev wget -qO- --timeout=5 -e use_proxy=yes -e http_proxy=http://gate:3128 -e https_proxy=http://gate:3128 http://fixture.public.test:8088/ 2>/dev/null || true)
private_out=$(docker run --rm "${proxy_env[@]}" flotilla-thread:dev wget -qO- --timeout=5 -e use_proxy=yes -e http_proxy=http://gate:3128 -e https_proxy=http://gate:3128 http://fixture.private.test:8088/ 2>/dev/null || true)
denied_out=$(docker run --rm "${proxy_env[@]}" flotilla-thread:dev wget -qO- --timeout=5 -e use_proxy=yes -e http_proxy=http://gate:3128 -e https_proxy=http://gate:3128 http://denied.public.test:8088/ 2>/dev/null || true)
printf 'egress public=%s private_len=%s denied_len=%s\n' "$public_out" "${#private_out}" "${#denied_out}"
[ "$public_out" = fixture-ok ]
[ -z "$private_out" ]
[ -z "$denied_out" ]

sleep 1
bearer_code=$(curl -sS -o /tmp/preview-body -w '%{http_code}' -c /tmp/preview-cookies -L "http://localhost:8081/p/FLO-PV01/3000/?token=$one")
no_token_code=$(curl -sS -o /dev/null -w '%{http_code}' "http://localhost:8081/p/FLO-PV01/3000/")
ui_cookie_code=$(curl -sS -o /dev/null -w '%{http_code}' -b /tmp/flotilla-ui-cookies "http://localhost:8081/p/FLO-PV01/3000/")
share_code=$(curl -sS -o /dev/null -w '%{http_code}' "http://localhost:8081/p/FLO-PV01/3000/?share=$share")
gate_no_token=$(docker exec "${project}-server-1" node -e 'const n=require("net").connect(3128,"gate",()=>n.write("CONNECT flt-FLO-PV01:3000 HTTP/1.1\r\nHost: flt-FLO-PV01:3000\r\n\r\n"));n.once("data",d=>{console.log(d.toString().split(" ")[1]);n.end()});setTimeout(()=>process.exit(1),3000)' | tail -1 || true)
printf 'preview bearer=%s no_token=%s ui_cookie=%s share=%s gate_no_token=%s\n' "$bearer_code" "$no_token_code" "$ui_cookie_code" "$share_code" "$gate_no_token"
[ "$bearer_code" = 200 ]
[ "$no_token_code" = 401 ]
[ "$ui_cookie_code" = 401 ]
[ "$share_code" = 200 ]
[ "$gate_no_token" = 403 ]
grep -q preview-ok /tmp/preview-body
echo 'egress preview e2e passed'
