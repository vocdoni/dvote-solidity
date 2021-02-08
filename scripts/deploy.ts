import { Wallet, providers, Contract, ContractFactory, utils } from "ethers"
import { keccak256 } from "web3-utils"
import { ensHashAddress, EnsPublicResolverContractMethods, EnsRegistryContractMethods, NamespaceContractMethods, ProcessContractMethods, TokenStorageProofContractMethods } from "../lib"
import { getConfig } from "./config"
import namehash from "eth-ens-namehash"
const { JsonRpcProvider } = providers

const { abi: ENSRegistryAbi, bytecode: ENSRegistryBytecode } = require("../build/ens-registry.json")
const { abi: ENSPublicResolverAbi, bytecode: ENSPublicResolverBytecode } = require("../build/ens-public-resolver.json")
const { abi: VotingProcessAbi, bytecode: VotingProcessBytecode } = require("../build/processes.json")
const { abi: tokenStorageProofAbi, bytecode: tokenStorageProofBytecode } = require("../build/token-storage-proof.json")
const { abi: namespaceAbi, bytecode: namespaceByteCode } = require("../build/namespaces.json")

// SET UP

const config = getConfig()

const transactionOptions = {} as any
let rpcParams = undefined

// Overriding the gas price for xDAI and Sokol networks
if (config.networkId == "xdai" || config.networkId == "sokol") {
    transactionOptions.gasPrice = utils.parseUnits("1", "gwei")
    rpcParams = { chainId: config.chainId, name: config.networkId, ensAddress: "0x0000000000000000000000000000000000000000" }
}

const provider = new JsonRpcProvider(config.jsonRpcEndpoint, rpcParams)
const wallet = Wallet.fromMnemonic(config.mnemonic, config.hdPath).connect(provider)

// MAIN CODE

async function main() {
    await provider.detectNetwork()

    // Deploy
    console.log("Deploying from", wallet.address, "\n")

    const ensAddrs = await deployEnsContracts()
    const coreAddrs = await deployCoreContracts()

    await setEnsDomainNames({ ...ensAddrs, ...coreAddrs })
    await activateSuccessors({ ...ensAddrs, ...coreAddrs })

    console.log("\nDone")
}

async function deployEnsContracts() {
    let ensRegistryInstance: Contract & EnsRegistryContractMethods
    let ensPublicResolverInstance: Contract & EnsPublicResolverContractMethods

    if (config.networkId == "xdai" || config.networkId == "sokol") {
        // ENS Registry
        const ensRegistryFactory = new ContractFactory(ENSRegistryAbi, ENSRegistryBytecode, wallet)
        if (!config.currentEnsRegistry || config.currentEnsRegistry == "0x0000000000000000000000000000000000000000") {
            const ensRegistryContract = await ensRegistryFactory.deploy(transactionOptions)
            ensRegistryInstance = await ensRegistryContract.deployed() as Contract & EnsRegistryContractMethods
            console.log("ENS Registry deployed at", ensRegistryInstance.address)
        }
        else {
            ensRegistryInstance = ensRegistryFactory.attach(config.currentEnsRegistry) as Contract & EnsRegistryContractMethods
            console.log("Using the existing ENS registry", config.currentEnsRegistry)
        }

        // ENS Public resolver
        const ensPublicResolverFactory = new ContractFactory(ENSPublicResolverAbi, ENSPublicResolverBytecode, wallet)
        const ensPublicResolverContract = await ensPublicResolverFactory.deploy(ensRegistryInstance.address, transactionOptions)
        ensPublicResolverInstance = await ensPublicResolverContract.deployed() as Contract & EnsPublicResolverContractMethods
        console.log("ENS Public Resolver deployed at", ensPublicResolverInstance.address)
    } else {
        // ENS Public resolver
        const ensPublicResolverFactory = new ContractFactory(ENSPublicResolverAbi, ENSPublicResolverBytecode, wallet)
        const ensPublicResolverContract = await ensPublicResolverFactory.deploy("0x0000000000000000000000000000000000000000", transactionOptions)
        ensPublicResolverInstance = await ensPublicResolverContract.deployed() as Contract & EnsPublicResolverContractMethods
        console.log("ENS Public Resolver deployed at", ensPublicResolverInstance.address)
    }

    return {
        ensRegistry: ensRegistryInstance?.address || null,
        ensPublicResolver: ensPublicResolverInstance.address,
    }
}

async function deployCoreContracts() {
    console.log("\nIMPORTANT:\nMake sure that the process contract predecessor is the one you expect:\n" + config.processPredessorContractAddress + "\n")
    await new Promise(resolve => setTimeout(resolve, 10 * 1500))

    console.log()
    console.log("Base contract deployment")

    // ERC Storage Proof
    const tokenStorageProofFactory = new ContractFactory(tokenStorageProofAbi, tokenStorageProofBytecode, wallet)
    const tokenStorageProofContract = await tokenStorageProofFactory.deploy(transactionOptions)
    const tokenStorageProofInstance = await tokenStorageProofContract.deployed() as Contract & TokenStorageProofContractMethods
    console.log("ERC20 Token Storage Proof deployed at", tokenStorageProofInstance.address)

    // Namespace
    const namespaceFactory = new ContractFactory(namespaceAbi, namespaceByteCode, wallet)
    const namespaceContract = await namespaceFactory.deploy(transactionOptions)
    const namespaceInstance = await namespaceContract.deployed() as Contract & NamespaceContractMethods
    console.log("Namespace deployed at", namespaceInstance.address)

    // Process
    const processFactory = new ContractFactory(VotingProcessAbi, VotingProcessBytecode, wallet)
    const processContract = await processFactory.deploy(config.processPredessorContractAddress, namespaceInstance.address, tokenStorageProofInstance.address, transactionOptions)
    const processInstance = await processContract.deployed() as Contract & ProcessContractMethods
    console.log("Process deployed at", processInstance.address)
    console.log(" - Predecessor:", config.processPredessorContractAddress)
    console.log(" - Token Storage Proofs:", tokenStorageProofInstance.address)
    console.log(" - Namespace:", namespaceInstance.address)

    return {
        processes: processInstance.address,
        namespace: namespaceInstance.address,
        tokenStorageProof: tokenStorageProofInstance.address,
    }
}

async function setEnsDomainNames(contractAddresses: { ensRegistry: string, ensPublicResolver: string, processes: string, namespace: string, tokenStorageProof: string }) {
    // if (config.networkId != "xdai" && config.networkId != "sokol") {
    if (provider.network.ensAddress != "0x0000000000000000000000000000000000000000") {
        console.log("NOTE: the deployed contracts will not be visible until their ENS records are updated")
        console.log("See https://app.ens.domains/search/vocdoni")
        return
    }

    const ensRegistryFactory = new ContractFactory(ENSRegistryAbi, ENSRegistryBytecode, wallet)
    const ensRegistryInstance = ensRegistryFactory.attach(contractAddresses.ensRegistry) as Contract & EnsRegistryContractMethods

    const ensPublicResolverFactory = new ContractFactory(ENSPublicResolverAbi, ENSPublicResolverBytecode, wallet)
    const ensPublicResolverInstance = ensPublicResolverFactory.attach(contractAddresses.ensPublicResolver) as Contract & EnsPublicResolverContractMethods

    console.log()
    console.log("Domain owner")

    const rootNode = namehash.hash("") // 0x0000000000000000000000000000000000000000000000000000000000000000

    // Check that the root is registered correctly
    const rootOwner = await ensRegistryInstance.owner(rootNode)
    console.log("Root owner", rootOwner)

    const ethNode = await registerEnsNodeOwner("eth", "", rootNode, ensRegistryInstance)
    const vocdoniEthNode = await registerEnsNodeOwner("vocdoni", "eth", ethNode, ensRegistryInstance)

    let entitiesVocdoniEthNode: string, processesVocdoniEthNode: string, namespacesVocdoniEthNode: string, proofsVocdoniEthNode: string, erc20ProofsVocdoniEthNode: string

    if (config.environment == "prod") {
        await Promise.all([
            registerEnsNodeOwner("entities", "vocdoni.eth", vocdoniEthNode, ensRegistryInstance)
                .then(node => entitiesVocdoniEthNode = node),
            registerEnsNodeOwner("processes", "vocdoni.eth", vocdoniEthNode, ensRegistryInstance)
                .then(node => processesVocdoniEthNode = node),
            registerEnsNodeOwner("namespaces", "vocdoni.eth", vocdoniEthNode, ensRegistryInstance)
                .then(node => namespacesVocdoniEthNode = node),
            registerEnsNodeOwner("proofs", "vocdoni.eth", vocdoniEthNode, ensRegistryInstance)
                .then(node => proofsVocdoniEthNode = node),
        ])

        erc20ProofsVocdoniEthNode = await registerEnsNodeOwner("erc20", "proofs.vocdoni.eth", proofsVocdoniEthNode, ensRegistryInstance)
    }
    else {
        // "stg" or "dev"
        const envVocdoniEthNode = await registerEnsNodeOwner(config.environment, "vocdoni.eth", vocdoniEthNode, ensRegistryInstance)

        await Promise.all([
            registerEnsNodeOwner("entities", config.environment + ".vocdoni.eth", envVocdoniEthNode, ensRegistryInstance)
                .then(node => entitiesVocdoniEthNode = node),
            registerEnsNodeOwner("processes", config.environment + ".vocdoni.eth", envVocdoniEthNode, ensRegistryInstance)
                .then(node => processesVocdoniEthNode = node),
            registerEnsNodeOwner("namespaces", config.environment + ".vocdoni.eth", envVocdoniEthNode, ensRegistryInstance)
                .then(node => namespacesVocdoniEthNode = node),
            registerEnsNodeOwner("proofs", config.environment + ".vocdoni.eth", envVocdoniEthNode, ensRegistryInstance)
                .then(node => proofsVocdoniEthNode = node),
        ])

        erc20ProofsVocdoniEthNode = await registerEnsNodeOwner("erc20", "proofs." + config.environment + ".vocdoni.eth", proofsVocdoniEthNode, ensRegistryInstance)
    }

    console.log()
    console.log("Domain resolvers")

    // set the resolver
    await Promise.all([
        ensRegistryInstance.setResolver(entitiesVocdoniEthNode, ensPublicResolverInstance.address, transactionOptions)
            .then(tx => tx.wait()),
        ensRegistryInstance.setResolver(processesVocdoniEthNode, ensPublicResolverInstance.address, transactionOptions)
            .then(tx => tx.wait()),
        ensRegistryInstance.setResolver(namespacesVocdoniEthNode, ensPublicResolverInstance.address, transactionOptions)
            .then(tx => tx.wait()),
        ensRegistryInstance.setResolver(proofsVocdoniEthNode, ensPublicResolverInstance.address, transactionOptions)
            .then(tx => tx.wait()),
        ensRegistryInstance.setResolver(erc20ProofsVocdoniEthNode, ensPublicResolverInstance.address, transactionOptions)
            .then(tx => tx.wait()),
    ])

    console.log()
    console.log("Domain addresses")

    // set the addresses

    await Promise.all([
        ensPublicResolverInstance.functions["setAddr(bytes32,address)"](entitiesVocdoniEthNode, ensPublicResolverInstance.address, transactionOptions)
            .then(tx => tx.wait()),
        ensPublicResolverInstance.functions["setAddr(bytes32,address)"](processesVocdoniEthNode, contractAddresses.processes, transactionOptions)
            .then(tx => tx.wait()),
        ensPublicResolverInstance.functions["setAddr(bytes32,address)"](erc20ProofsVocdoniEthNode, contractAddresses.tokenStorageProof, transactionOptions)
            .then(tx => tx.wait()),
        ensPublicResolverInstance.functions["setAddr(bytes32,address)"](namespacesVocdoniEthNode, contractAddresses.namespace, transactionOptions)
            .then(tx => tx.wait()),
    ])

    if (config.environment == "prod") {
        console.log("'entities.vocdoni.eth' address", await ensPublicResolverInstance["addr(bytes32)"](entitiesVocdoniEthNode))
        console.log("'processes.vocdoni.eth' address", await ensPublicResolverInstance["addr(bytes32)"](processesVocdoniEthNode))
        console.log("'erc20.proofs.vocdoni.eth' address", await ensPublicResolverInstance["addr(bytes32)"](erc20ProofsVocdoniEthNode))
        console.log("'namespaces.vocdoni.eth' address", await ensPublicResolverInstance["addr(bytes32)"](namespacesVocdoniEthNode))
    } else {
        console.log("'entities.vocdoni.eth' address", await ensPublicResolverInstance["addr(bytes32)"](entitiesVocdoniEthNode))
        console.log("'processes.vocdoni.eth' address", await ensPublicResolverInstance["addr(bytes32)"](processesVocdoniEthNode))
        console.log("'erc20.proofs.vocdoni.eth' address", await ensPublicResolverInstance["addr(bytes32)"](erc20ProofsVocdoniEthNode))
        console.log("'namespaces.vocdoni.eth' address", await ensPublicResolverInstance["addr(bytes32)"](namespacesVocdoniEthNode))
    }

    console.log()
    console.log("Bootnode key")

    // set the bootnode URL on the entity of Vocdoni
    const BOOTNODES_KEY = "vnd.vocdoni.boot-nodes"
    const entityId = ensHashAddress(wallet.address)
    const tx = await ensPublicResolverInstance.setText(entityId, BOOTNODES_KEY, "https://bootnodes.vocdoni.net/gateways.json", transactionOptions)
    await tx.wait()

    console.log("ENS Text of", entityId, BOOTNODES_KEY, "is", await ensPublicResolverInstance.text(entityId, BOOTNODES_KEY))
}

/** Creates a (sub) domain within parentNode and returns the registered node hash */
async function registerEnsNodeOwner(name: string, parentDomain: string, parentNode: string, ensRegistryInstance: Contract & EnsRegistryContractMethods): Promise<string> {
    const parentParticles = parentDomain?.length ? parentDomain.split(".") : []
    const fullDomainName = [name].concat(parentParticles).join(".")

    // create <name>
    const nodeLabel = keccak256(name)
    var tx = await ensRegistryInstance.setSubnodeOwner(parentNode, nodeLabel, wallet.address, transactionOptions)
    await tx.wait()

    // check domain added succesfully
    const ensNode = namehash.hash(fullDomainName)
    const nodeOwner = await ensRegistryInstance.owner(ensNode)
    console.log(`'${fullDomainName}' owner`, nodeOwner)

    return ensNode
}

/** Connect to the old contract, deactivate it and activate the new one */
async function activateSuccessors(contractAddresses: { ensRegistry: string, ensPublicResolver: string, processes: string, namespace: string, tokenStorageProof: string }) {
    if (config.processPredessorContractAddress != "0x0000000000000000000000000000000000000000") {
        console.log("Activating the process contract successor from"), config.processPredessorContractAddress
        const predecessor = new Contract(config.processPredessorContractAddress, VotingProcessAbi, wallet) as Contract & ProcessContractMethods
        const tx = await predecessor.activateSuccessor(contractAddresses.processes)
        await tx.wait()
    }
}


main().catch(err => console.log(err))
