PATH  := node_modules/.bin:$(PATH)
SHELL := /bin/bash

.DEFAULT_GOAL := help
SOLC=./node_modules/.bin/solcjs
TSC=./node_modules/.bin/tsc
CONTRACT_SOURCES=$(wildcard contracts/*.sol contracts/registry/*.sol contracts/resolver/*.sol)
ENS_REGISTRY_ARTIFACT_NAME=contracts_registry_ENSRegistry_sol_ENSRegistry
ENS_PUBLIC_RESOLVER_ARTIFACT_NAME=contracts_resolver_PublicResolver_sol_PublicResolver
PROCESS_ARTIFACT_NAME=contracts_processes_sol_Processes
NAMESPACE_ARTIFACT_NAME=contracts_namespaces_sol_Namespaces

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
package-lock.json:
	@touch $@

js-output: build/index.js
contract-output: build/ens-registry.json build/ens-public-resolver.json build/processes.json build/namespaces.json

build:
	@mkdir -p build
	@touch $@

build/index.js: build contract-output lib/index.ts
	@echo "Building JS/TS artifacts"
	cp lib/index.ts build
	$(TSC) --build tsconfig.json

build/ens-registry.json: build/solc/$(ENS_REGISTRY_ARTIFACT_NAME).abi build/solc/$(ENS_REGISTRY_ARTIFACT_NAME).bin
	@echo "Building $@"
	echo "{\"abi\":$$(cat build/solc/$(ENS_REGISTRY_ARTIFACT_NAME).abi),\"bytecode\":\"0x$$(cat build/solc/$(ENS_REGISTRY_ARTIFACT_NAME).bin)\"}" > $@

build/ens-public-resolver.json: build/solc/$(ENS_PUBLIC_RESOLVER_ARTIFACT_NAME).abi build/solc/$(ENS_PUBLIC_RESOLVER_ARTIFACT_NAME).bin
	@echo "Building $@"
	echo "{\"abi\":$$(cat build/solc/$(ENS_PUBLIC_RESOLVER_ARTIFACT_NAME).abi),\"bytecode\":\"0x$$(cat build/solc/$(ENS_PUBLIC_RESOLVER_ARTIFACT_NAME).bin)\"}" > $@

build/processes.json: build/solc/$(PROCESS_ARTIFACT_NAME).abi build/solc/$(PROCESS_ARTIFACT_NAME).bin
	@echo "Building $@"
	echo "{\"abi\":$$(cat build/solc/$(PROCESS_ARTIFACT_NAME).abi),\"bytecode\":\"0x$$(cat build/solc/$(PROCESS_ARTIFACT_NAME).bin)\"}" > $@

build/namespaces.json: build/solc/$(NAMESPACE_ARTIFACT_NAME).abi build/solc/$(NAMESPACE_ARTIFACT_NAME).bin
	@echo "Building $@"
	echo "{\"abi\":$$(cat build/solc/$(NAMESPACE_ARTIFACT_NAME).abi),\"bytecode\":\"0x$$(cat build/solc/$(NAMESPACE_ARTIFACT_NAME).bin)\"}" > $@

build/solc/$(ENS_REGISTRY_ARTIFACT_NAME).abi: build/solc
build/solc/$(ENS_REGISTRY_ARTIFACT_NAME).bin: build/solc
build/solc/$(ENS_PUBLIC_RESOLVER_ARTIFACT_NAME).abi: build/solc
build/solc/$(ENS_PUBLIC_RESOLVER_ARTIFACT_NAME).bin: build/solc
build/solc/$(PROCESS_ARTIFACT_NAME).abi: build/solc
build/solc/$(PROCESS_ARTIFACT_NAME).bin: build/solc
build/solc/$(NAMESPACE_ARTIFACT_NAME).abi: build/solc
build/solc/$(NAMESPACE_ARTIFACT_NAME).bin: build/solc

# Get openzeppelin contracts
contracts/openzeppelin: node_modules
	mkdir -p $@
	cp -a ./node_modules/@openzeppelin/contracts/* $@
	touch $@

# Intermediate solidity compiled artifacts
build/solc: $(CONTRACT_SOURCES) contracts/openzeppelin
	@echo "Building contracts"
	mkdir -p $@
	$(SOLC) --optimize --bin --abi -o $@ --base-path ${PWD}/contracts $(CONTRACT_SOURCES)
	@touch $@

test: clean all
	npm run test

clean: 
	rm -Rf ./build
	rm -Rf ./contracts/openzeppelin/*
