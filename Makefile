check:
	pnpm -r typecheck
	pnpm -r test
	pnpm -r lint

lint:
	pnpm -r lint

verify: check
	docker build -f deploy/thread.Dockerfile -t flotilla-thread:dev .
	docker compose -p flotilla-verify up -d --build --wait
	curl -fsS --retry 20 --retry-connrefused --retry-delay 1 localhost:8080/healthz
	docker compose -p flotilla-verify down -v
