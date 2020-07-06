PATH  := node_modules/.bin:$(PATH)
SHELL := /bin/bash

.DEFAULT_GOAL := help
SOLC=./node_modules/.bin/solcjs
TSC=./node_modules/.bin/tsc
CONTRACT_SOURCES=$(wildcard contracts/*.sol contracts/*/*.sol)
ENTITY_RESOLVER_ARTIFACT_NAME=contracts_entity-resolver_sol_EntityResolver
PROCESS_ARTIFACT_NAME=contracts_process_sol_ProcessBeta7
NAMESPACE_ARTIFACT_NAME=contracts_namespace_sol_Namespace
OUTPUT_FILES=build/index.js build/entity-resolver.json build/process.json build/namespace.json

###############################################################################
## HELP
###############################################################################

.PHONY: help
help:
	@echo "Available targets:"
	@echo
	@echo "  $$ make         Runs 'make help' by default"
	@echo "  $$ make help    Shows this text"
	@echo
	@echo "  $$ make all     Compile the smart contracts and types into 'build'"
	@echo "  $$ make test    Compile and test the contracts"
	@echo "  $$ make clean   Cleanup the build folder"
	@echo

###############################################################################
## RECIPES
###############################################################################

all: node_modules js-output contract-output

node_modules: package.json package-lock.json
	@echo Updating Node packages
	npm install || true
	if [ -d node_modules/web3-providers/node_modules/websocket ]; then \
	  rm -Rf node_modules/web3-providers/node_modules/websocket/.git ; \
	  rm -Rf node_modules/web3-providers-ws/node_modules/websocket/.git ; \
	fi
	@touch $@

js-output: build/index.js
contract-output: build/entity-resolver.json build/process.json build/namespace.json

build:
	@mkdir -p build
	@touch $@

build/index.js: build build/entity-resolver.json build/process.json build/namespace.json lib/index.ts
	@echo "Building JS/TS artifacts"
	cp lib/index.ts build
	$(TSC) --build tsconfig.json

build/entity-resolver.json: build/solc/$(ENTITY_RESOLVER_ARTIFACT_NAME).abi build/solc/$(ENTITY_RESOLVER_ARTIFACT_NAME).bin
	@echo "Building $@"
	echo "{\"abi\":$$(cat build/solc/$(ENTITY_RESOLVER_ARTIFACT_NAME).abi),\"bytecode\":\"0x$$(cat build/solc/$(ENTITY_RESOLVER_ARTIFACT_NAME).bin)\"}" > $@

build/process.json: build/solc/$(PROCESS_ARTIFACT_NAME).abi build/solc/$(PROCESS_ARTIFACT_NAME).bin
	@echo "Building $@"
	echo "{\"abi\":$$(cat build/solc/$(PROCESS_ARTIFACT_NAME).abi),\"bytecode\":\"0x$$(cat build/solc/$(PROCESS_ARTIFACT_NAME).bin)\"}" > $@

build/namespace.json: build/solc/$(NAMESPACE_ARTIFACT_NAME).abi build/solc/$(NAMESPACE_ARTIFACT_NAME).bin
	@echo "Building $@"
	echo "{\"abi\":$$(cat build/solc/$(NAMESPACE_ARTIFACT_NAME).abi),\"bytecode\":\"0x$$(cat build/solc/$(NAMESPACE_ARTIFACT_NAME).bin)\"}" > $@

build/solc/$(ENTITY_RESOLVER_ARTIFACT_NAME).abi: build/solc
build/solc/$(ENTITY_RESOLVER_ARTIFACT_NAME).bin: build/solc
build/solc/$(PROCESS_ARTIFACT_NAME).abi: build/solc
build/solc/$(PROCESS_ARTIFACT_NAME).bin: build/solc
build/solc/$(NAMESPACE_ARTIFACT_NAME).abi: build/solc
build/solc/$(NAMESPACE_ARTIFACT_NAME).bin: build/solc

# Intermediate solidity compiled artifacts
build/solc: $(CONTRACT_SOURCES)
	@echo "Building contracts"
	mkdir -p $@
	$(SOLC) --optimize --bin --abi -o $@ $(CONTRACT_SOURCES)
	@touch $@

test: clean all
	npm run test

clean: 
	rm -Rf ./build
