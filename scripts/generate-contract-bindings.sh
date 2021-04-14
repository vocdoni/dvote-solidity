#!/bin/bash

which abigen || { echo "abigen binary not found or not in PATH" ; exit 1; }
echo abigen version: "$(abigen --version)"

make clean || exit 1
make all || exit 1

abigen --bin=./build/solc/contracts_processes_sol_Processes.bin --abi=./build/solc/contracts_processes_sol_Processes.abi --pkg=Processes --out=processes.go || exit 1
abigen --bin=./build/solc/contracts_namespaces_sol_Namespaces.bin --abi=./build/solc/contracts_namespaces_sol_Namespaces.abi --pkg=Namespaces --out=namespaces.go || exit 1
abigen --bin=./build/solc/contracts_genesis_sol_Genesis.bin --abi=./build/solc/contracts_genesis_sol_Genesis.abi --pkg=Genesis --out=genesis.go || exit 1
abigen --bin=./build/solc/contracts_results_sol_Results.bin --abi=./build/solc/contracts_results_sol_Results.abi --pkg=Results --out=results.go || exit 1
abigen --bin=./build/solc/contracts_token-storage-proof_sol_TokenStorageProof.bin --abi=./build/solc/contracts_token-storage-proof_sol_TokenStorageProof.abi --pkg=TokenStorageProof --out=tokenStorageProof.go || exit 1
abigen --bin=./build/solc/contracts_vendor_registry_ENSRegistry_sol_ENSRegistry.bin --abi=./build/solc/contracts_vendor_registry_ENSRegistry_sol_ENSRegistry.abi --pkg=EnsRegistryWithFallback --out=ensRegistryWithFallback.go || exit 1
abigen --bin=./build/solc/contracts_vendor_resolver_PublicResolver_sol_PublicResolver.bin --abi=./build/solc/contracts_vendor_resolver_PublicResolver_sol_PublicResolver.abi --pkg=EntityResolver --out=entityResolver.go || exit 1

for i in *.go; do
    sed -i '/package /c\package contracts' $i
done

echo DONE !
