PATH  := node_modules/.bin:$(PATH)
SHELL := /bin/bash
PROJECT_NAME=$(shell basename "$(PWD)")

.DEFAULT_GOAL := help
SOLC=./node_modules/.bin/solcjs
TSC=./node_modules/.bin/tsc
VOTING_CONTRACTS=$(wildcard contracts/*.sol)
ENS_CONTRACTS=$(wildcard contracts/vendor/registry/*.sol contracts/vendor/resolver/*.sol)

ENS_REGISTRY_ARTIFACT_NAME=contracts_vendor_registry_ENSRegistry_sol_ENSRegistry
ENS_RESOLVER_ARTIFACT_NAME=contracts_vendor_resolver_PublicResolver_sol_PublicResolver
PROCESSES_ARTIFACT_NAME=contracts_processes_sol_Processes
GENESIS_ARTIFACT_NAME=contracts_genesis_sol_Genesis
NAMESPACES_ARTIFACT_NAME=contracts_namespaces_sol_Namespaces
TOKEN_STORAGE_PROOF_ARTIFACT_NAME=contracts_token-storage-proof_sol_TokenStorageProof
TOKEN_STORAGE_PROOF_TEST_ARTIFACT_NAME=contracts_token-storage-proof-test_sol_TokenStorageProofTest

#-----------------------------------------------------------------------
# HELP
#-----------------------------------------------------------------------

## help: Display this message

.PHONY: help
help:
	@echo
	@echo " Available targets on "$(PROJECT_NAME)":"
	@echo
	@sed -n 's/^##//p' Makefile | column -t -s ':' |  sed -e 's/^/ /'
	@echo

#-----------------------------------------------------------------------
# RECIPES
#-----------------------------------------------------------------------

## all: Compile the contract artifacts and generate the TypeScript type definitions

all: node_modules js contract-output

## :

## init: Install the dependencies

init: node_modules

node_modules: package.json
	@echo Updating Node packages
	rm -f package-lock.json
	npm install || true
	if [ -d node_modules/web3-providers/node_modules/websocket ]; then \
	  rm -Rf node_modules/web3-providers/node_modules/websocket/.git ; \
	  rm -Rf node_modules/web3-providers-ws/node_modules/websocket/.git ; \
	fi
	@touch $@

js: build/index.js
contract-output: build/ens-registry.json build/ens-resolver.json build/processes.json build/genesis.json build/namespaces.json build/token-storage-proof.json build/token-storage-proof-test.json

build:
	@mkdir -p build
	@touch $@

build/index.js: build contract-output lib/index.ts
	@echo "Building JS/TS artifacts"
	cp lib/index.ts build
	$(TSC) --build tsconfig.json

build/ens-registry.json: build/solc/$(ENS_REGISTRY_ARTIFACT_NAME).abi build/solc/$(ENS_REGISTRY_ARTIFACT_NAME).bin
	@stat $^ > /dev/null
	@echo "Building $@"
	echo "{\"abi\":$$(cat build/solc/$(ENS_REGISTRY_ARTIFACT_NAME).abi),\"bytecode\":\"0x$$(cat build/solc/$(ENS_REGISTRY_ARTIFACT_NAME).bin)\"}" > $@

build/ens-resolver.json: build/solc/$(ENS_RESOLVER_ARTIFACT_NAME).abi build/solc/$(ENS_RESOLVER_ARTIFACT_NAME).bin
	@stat $^ > /dev/null
	@echo "Building $@"
	echo "{\"abi\":$$(cat build/solc/$(ENS_RESOLVER_ARTIFACT_NAME).abi),\"bytecode\":\"0x$$(cat build/solc/$(ENS_RESOLVER_ARTIFACT_NAME).bin)\"}" > $@

build/processes.json: build/solc/$(PROCESSES_ARTIFACT_NAME).abi build/solc/$(PROCESSES_ARTIFACT_NAME).bin
	@stat $^ > /dev/null
	@echo "Building $@"
	echo "{\"abi\":$$(cat build/solc/$(PROCESSES_ARTIFACT_NAME).abi),\"bytecode\":\"0x$$(cat build/solc/$(PROCESSES_ARTIFACT_NAME).bin)\"}" > $@

build/genesis.json: build/solc/$(GENESIS_ARTIFACT_NAME).abi build/solc/$(GENESIS_ARTIFACT_NAME).bin
	@stat $^ > /dev/null
	@echo "Building $@"
	echo "{\"abi\":$$(cat build/solc/$(GENESIS_ARTIFACT_NAME).abi),\"bytecode\":\"0x$$(cat build/solc/$(GENESIS_ARTIFACT_NAME).bin)\"}" > $@

build/namespaces.json: build/solc/$(NAMESPACES_ARTIFACT_NAME).abi build/solc/$(NAMESPACES_ARTIFACT_NAME).bin
	@stat $^ > /dev/null
	@echo "Building $@"
	echo "{\"abi\":$$(cat build/solc/$(NAMESPACES_ARTIFACT_NAME).abi),\"bytecode\":\"0x$$(cat build/solc/$(NAMESPACES_ARTIFACT_NAME).bin)\"}" > $@

build/token-storage-proof.json: build/solc/$(TOKEN_STORAGE_PROOF_ARTIFACT_NAME).abi build/solc/$(TOKEN_STORAGE_PROOF_ARTIFACT_NAME).bin
	@stat $^ > /dev/null
	@echo "Building $@"
	echo "{\"abi\":$$(cat build/solc/$(TOKEN_STORAGE_PROOF_ARTIFACT_NAME).abi),\"bytecode\":\"0x$$(cat build/solc/$(TOKEN_STORAGE_PROOF_ARTIFACT_NAME).bin)\"}" > $@

build/token-storage-proof-test.json: build/solc/$(TOKEN_STORAGE_PROOF_TEST_ARTIFACT_NAME).abi build/solc/$(TOKEN_STORAGE_PROOF_TEST_ARTIFACT_NAME).bin
	@stat $^ > /dev/null
	@echo "Building $@"
	echo "{\"abi\":$$(cat build/solc/$(TOKEN_STORAGE_PROOF_TEST_ARTIFACT_NAME).abi),\"bytecode\":\"0x$$(cat build/solc/$(TOKEN_STORAGE_PROOF_TEST_ARTIFACT_NAME).bin)\"}" > $@

build/solc/$(ENS_REGISTRY_ARTIFACT_NAME).abi: build/solc
build/solc/$(ENS_REGISTRY_ARTIFACT_NAME).bin: build/solc
build/solc/$(ENS_RESOLVER_ARTIFACT_NAME).abi: build/solc
build/solc/$(ENS_RESOLVER_ARTIFACT_NAME).bin: build/solc
build/solc/$(PROCESSES_ARTIFACT_NAME).abi: build/solc
build/solc/$(PROCESSES_ARTIFACT_NAME).bin: build/solc
build/solc/$(GENESIS_ARTIFACT_NAME).abi: build/solc
build/solc/$(GENESIS_ARTIFACT_NAME).bin: build/solc
build/solc/$(NAMESPACES_ARTIFACT_NAME).abi: build/solc
build/solc/$(NAMESPACES_ARTIFACT_NAME).bin: build/solc
build/solc/$(STORAGE_PROOF_ARTIFACT_NAME).abi: build/solc
build/solc/$(STORAGE_PROOF_ARTIFACT_NAME).bin: build/solc
build/solc/$(STORAGE_PROOF_TEST_ARTIFACT_NAME).abi: build/solc
build/solc/$(STORAGE_PROOF_TEST_ARTIFACT_NAME).bin: build/solc

# Link the contracts from node_modules
contracts/vendor: contracts/vendor/openzeppelin contracts/vendor/rlp/RLPReader.sol

contracts/vendor/openzeppelin: node_modules
	rm -f $@
	ln -s ../../node_modules/@openzeppelin/contracts $@

contracts/vendor/rlp/RLPReader.sol: node_modules
	rm -Rf $(shell dirname $@)
	mkdir -p $(shell dirname $@)
	cat node_modules/solidity-rlp/contracts/RLPReader.sol | sed "s/pragma solidity \^0.5.0;/pragma solidity >=0.6.0 <0.7.0;/" > $@

# Intermediate solidity compiled artifacts
build/solc: $(VOTING_CONTRACTS) $(ENS_CONTRACTS) contracts/vendor
	@echo "Building contracts"
	mkdir -p $@
	$(SOLC) --optimize --bin --abi -o $@ --base-path ${PWD} $(VOTING_CONTRACTS)
	$(SOLC) --optimize --bin --abi -o $@ --base-path ${PWD}/contracts/vendor $(ENS_CONTRACTS)
	@touch $@

## test: Compile and test the contracts

test: clean all
	npm run test

## clean: Cleanup the build folder

clean: 
	rm -Rf ./build
	rm -Rf ./contracts/vendor/openzeppelin
	rm -Rf ./contracts/vendor/rlp
