PATH  := node_modules/.bin:$(PATH)
SHELL := /bin/bash
PROJECT_NAME=$(shell basename "$(PWD)")

.DEFAULT_GOAL := help
SOLC := ./node_modules/.bin/solcjs
TSC := ./node_modules/.bin/tsc

TS_SOURCES := $(wildcard lib/*.ts)
# JS_TARGETS = $(patsubst lib/%.ts, build/%.js, $(TS_SOURCES))
VOTING_CONTRACTS = $(wildcard contracts/*.sol)
TEST_CONTRACTS = $(wildcard contracts/test/*.sol)
ENS_CONTRACTS = $(wildcard contracts/vendor/registry/*.sol contracts/vendor/resolver/*.sol)

# Declare new contract artifacts on `build/solc` here
ARTIFACT_BASE_NAMES = \
		      contracts_vendor_registry_ENSRegistry_sol_ENSRegistry \
		      contracts_vendor_resolver_PublicResolver_sol_PublicResolver \
		      contracts_genesis_sol_Genesis \
		      contracts_namespaces_sol_Namespaces \
		      contracts_processes_sol_Processes \
		      contracts_results_sol_Results \
		      contracts_token-storage-proof_sol_TokenStorageProof \
		      contracts_test_trie-proof_sol_TrieProofTest \
			  contracts_erc20Info_sol_ERC20Info

SOLC_ABI_ARTIFACTS := $(patsubst %, build/solc/%.abi, $(ARTIFACT_BASE_NAMES))
SOLC_BIN_ARTIFACTS := $(patsubst %, build/solc/%.bin, $(ARTIFACT_BASE_NAMES))
SOLC_ARTIFACT_PREFIXES := $(patsubst %, build/solc/%, $(ARTIFACT_BASE_NAMES))

# Add new contract entries here
ENS_REGISTRY_ARTIFACT_PREFIX = $(filter %_sol_ENSRegistry, $(SOLC_ARTIFACT_PREFIXES))
ENS_RESOLVER_ARTIFACT_PREFIX = $(filter %_sol_PublicResolver, $(SOLC_ARTIFACT_PREFIXES))
GENESIS_ARTIFACT_PREFIX = $(filter %_sol_Genesis, $(SOLC_ARTIFACT_PREFIXES))
NAMESPACES_ARTIFACT_PREFIX = $(filter %_sol_Namespaces, $(SOLC_ARTIFACT_PREFIXES))
PROCESSES_ARTIFACT_PREFIX = $(filter %_sol_Processes, $(SOLC_ARTIFACT_PREFIXES))
RESULTS_ARTIFACT_PREFIX = $(filter %_sol_Results, $(SOLC_ARTIFACT_PREFIXES))
TOKEN_STORAGE_PROOF_ARTIFACT_PREFIX = $(filter %_sol_TokenStorageProof, $(SOLC_ARTIFACT_PREFIXES))
TRIE_PROOF_TEST_ARTIFACT_PREFIX = $(filter %_sol_TrieProofTest, $(SOLC_ARTIFACT_PREFIXES))
ERC20INFO_ARTIFACT_PREFIX = $(filter %_sol_ERC20Info, $(SOLC_ARTIFACT_PREFIXES))

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

all: node_modules javascript contract-objects

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


# Add new contract target files here
contract-objects: \
	build/ens-registry.json \
	build/ens-resolver.json \
	build/processes.json \
	build/results.json \
	build/genesis.json \
	build/namespaces.json \
	build/token-storage-proof.json \
	build/test/trie-proof.json \
	build/erc20Info.json

build:
	@mkdir -p build
	@mkdir -p build/test
	@touch $@

javascript: build/index.js
build/index.js: build contract-objects $(TS_SOURCES)
	@echo "Building JS/TS artifacts"
	cp $(TS_SOURCES) build
	$(TSC) --build tsconfig.json

# Contract artifacts

build/ens-registry.json: $(ENS_REGISTRY_ARTIFACT_PREFIX).abi $(ENS_REGISTRY_ARTIFACT_PREFIX).bin
	@stat $^ > /dev/null
	@echo "Building $@"
	echo "{\"abi\":$$(cat $(ENS_REGISTRY_ARTIFACT_PREFIX).abi),\"bytecode\":\"0x$$(cat $(ENS_REGISTRY_ARTIFACT_PREFIX).bin)\"}" > $@

build/ens-resolver.json: $(ENS_RESOLVER_ARTIFACT_PREFIX).abi $(ENS_RESOLVER_ARTIFACT_PREFIX).bin
	@stat $^ > /dev/null
	@echo "Building $@"
	echo "{\"abi\":$$(cat $(ENS_RESOLVER_ARTIFACT_PREFIX).abi),\"bytecode\":\"0x$$(cat $(ENS_RESOLVER_ARTIFACT_PREFIX).bin)\"}" > $@

build/processes.json: $(PROCESSES_ARTIFACT_PREFIX).abi $(PROCESSES_ARTIFACT_PREFIX).bin
	@stat $^ > /dev/null
	@echo "Building $@"
	echo "{\"abi\":$$(cat $(PROCESSES_ARTIFACT_PREFIX).abi),\"bytecode\":\"0x$$(cat $(PROCESSES_ARTIFACT_PREFIX).bin)\"}" > $@

build/results.json: $(RESULTS_ARTIFACT_PREFIX).abi $(RESULTS_ARTIFACT_PREFIX).bin
	@stat $^ > /dev/null
	@echo "Building $@"
	echo "{\"abi\":$$(cat $(RESULTS_ARTIFACT_PREFIX).abi),\"bytecode\":\"0x$$(cat $(RESULTS_ARTIFACT_PREFIX).bin)\"}" > $@

build/genesis.json: $(GENESIS_ARTIFACT_PREFIX).abi $(GENESIS_ARTIFACT_PREFIX).bin
	@stat $^ > /dev/null
	@echo "Building $@"
	echo "{\"abi\":$$(cat $(GENESIS_ARTIFACT_PREFIX).abi),\"bytecode\":\"0x$$(cat $(GENESIS_ARTIFACT_PREFIX).bin)\"}" > $@

build/namespaces.json: $(NAMESPACES_ARTIFACT_PREFIX).abi $(NAMESPACES_ARTIFACT_PREFIX).bin
	@stat $^ > /dev/null
	@echo "Building $@"
	echo "{\"abi\":$$(cat $(NAMESPACES_ARTIFACT_PREFIX).abi),\"bytecode\":\"0x$$(cat $(NAMESPACES_ARTIFACT_PREFIX).bin)\"}" > $@

build/token-storage-proof.json: $(TOKEN_STORAGE_PROOF_ARTIFACT_PREFIX).abi $(TOKEN_STORAGE_PROOF_ARTIFACT_PREFIX).bin
	@stat $^ > /dev/null
	@echo "Building $@"
	echo "{\"abi\":$$(cat $(TOKEN_STORAGE_PROOF_ARTIFACT_PREFIX).abi),\"bytecode\":\"0x$$(cat $(TOKEN_STORAGE_PROOF_ARTIFACT_PREFIX).bin)\"}" > $@

build/test/trie-proof.json: $(TRIE_PROOF_TEST_ARTIFACT_PREFIX).abi $(TRIE_PROOF_TEST_ARTIFACT_PREFIX).bin
	@stat $^ > /dev/null
	@echo "Building $@"
	echo "{\"abi\":$$(cat $(TRIE_PROOF_TEST_ARTIFACT_PREFIX).abi),\"bytecode\":\"0x$$(cat $(TRIE_PROOF_TEST_ARTIFACT_PREFIX).bin)\"}" > $@

build/erc20Info.json: $(ERC20INFO_ARTIFACT_PREFIX).abi $(ERC20INFO_ARTIFACT_PREFIX).bin
	@stat $^ > /dev/null
	@echo "Building $@"
	echo "{\"abi\":$$(cat $(ERC20INFO_ARTIFACT_PREFIX).abi),\"bytecode\":\"0x$$(cat $(ERC20INFO_ARTIFACT_PREFIX).bin)\"}" > $@

$(SOLC_ABI_ARTIFACTS): build/solc
$(SOLC_BIN_ARTIFACTS): build/solc

# Link the contracts from node_modules
contracts/vendor: contracts/vendor/openzeppelin

contracts/vendor/openzeppelin: node_modules
	rm -f $@
	ln -s ../../node_modules/@openzeppelin/contracts $@

# Intermediate solidity compiled artifacts
build/solc: $(VOTING_CONTRACTS) $(TEST_CONTRACTS) $(ENS_CONTRACTS) contracts/vendor
	@echo "Building contracts"
	mkdir -p $@
	$(SOLC) --optimize --bin --abi -o $@ --base-path ${PWD} $(VOTING_CONTRACTS)
	$(SOLC) --optimize --bin --abi -o $@ --base-path ${PWD} $(TEST_CONTRACTS)
	$(SOLC) --optimize --bin --abi -o $@ --base-path ${PWD}/contracts/vendor $(ENS_CONTRACTS)
	@touch $@

## test: Compile and test the contracts

test: clean all
	npm run test

## clean: Cleanup the build folder

clean: 
	rm -Rf ./build
	rm -Rf ./contracts/vendor/openzeppelin
