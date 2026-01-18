.PHONY: clean-port

clean-port:
	npx kill-port 3001
	npx	kill-port 5173