.PHONY: clean-port build-dev

clean-port:
	npx kill-port 3001
	npx	kill-port 5173

build-dev:
	bun run build
	bun	dev