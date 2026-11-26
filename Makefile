check:
	pnpm -r typecheck
	pnpm -r test
	pnpm -r lint

verify: check
	docker compose up -d --build --wait
	curl -fsS --retry 20 --retry-connrefused --retry-delay 1 localhost:8080/healthz
	docker compose down -v
