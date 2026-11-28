check:
	pnpm -r typecheck
	pnpm -r test
	pnpm -r lint

lint:
	pnpm -r lint

verify: check
	docker build -f deploy/thread.Dockerfile -t flotilla-thread:dev .
	docker compose -p flotilla-verify up -d --build --wait
	curl -fsS --retry 20 --retry-all-errors --retry-connrefused --retry-delay 1 localhost:8080/healthz
	docker compose -p flotilla-verify down -v

computer-image:
	docker build -f deploy/computer.Dockerfile -t flotilla-computer:dev .

computer-isolated-image:
	docker build -f deploy/computer-isolated.Dockerfile -t flotilla-computer-isolated:dev .

eval-captain:
	@test -f scripts/eval-captain.mjs || (echo "eval-captain is added by captain-15" >&2; exit 1)
	node scripts/eval-captain.mjs

eval-vms:
	@test -f scripts/eval-vms.mjs || (echo "eval-vms is added by vms-12" >&2; exit 1)
	node scripts/eval-vms.mjs
