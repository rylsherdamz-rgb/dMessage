.PHONY: all build build-wasm clean test deploy

CONTRACTS = user_registry social_graph messages

all: build-wasm

build:
	@for c in $(CONTRACTS); do \
		echo "Building $$c..."; \
		$(MAKE) -s -C contracts/$$c build; \
	done

build-wasm:
	@for c in $(CONTRACTS); do \
		echo "Building $$c (WASM)..."; \
		cd contracts/$$c && cargo build --release --target wasm32-unknown-unknown 2>&1 | tail -1; \
	done
	@echo "\nWASM sizes:"; \
	for c in $(CONTRACTS); do \
		ls -lh contracts/$$c/target/wasm32-unknown-unknown/release/*.wasm | awk '{print $$5, $$9}'; \
	done

test:
	@for c in $(CONTRACTS); do \
		echo "Testing $$c..."; \
		$(MAKE) -s -C contracts/$$c test; \
	done

clean:
	@for c in $(CONTRACTS); do \
		cd contracts/$$c && cargo clean 2>/dev/null; \
	done
	@echo "Cleaned all contracts"

deploy:
	@echo "Ensure env vars are set: SOROBAN_RPC, SOROBAN_SECRET_KEY"
	@for c in $(CONTRACTS); do \
		echo "Deploying $$c..."; \
		soroban contract deploy \
			--wasm contracts/$$c/target/wasm32-unknown-unknown/release/$$c.wasm \
			--source $(SOROBAN_SECRET_KEY) \
			--rpc-url $(SOROBAN_RPC) \
			--network-passphrase "Test SDF Network ; September 2015"; \
	done
