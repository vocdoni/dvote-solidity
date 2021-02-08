import { Wallet, providers, Contract, ContractFactory, utils, ContractTransaction } from "ethers"
import { keccak256 } from "web3-utils"
import { ensHashAddress, EnsPublicResolverContractMethods, EnsRegistryContractMethods, NamespaceContractMethods, ProcessContractMethods, TokenStorageProofContractMethods } from "../lib"
import { getConfig } from "./config"
import * as namehash from "eth-ens-namehash"
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
if (config.ethereum.networkId == "xdai" || config.ethereum.networkId == "sokol") {
    transactionOptions.gasPrice = utils.parseUnits("1", "gwei")
    rpcParams = { chainId: config.ethereum.chainId, name: config.ethereum.networkId, ensAddress: "0x0000000000000000000000000000000000000000" }
}

const provider = new JsonRpcProvider(config.ethereum.endpoint, rpcParams)
const wallet = config.wallet.privateKey ?
    new Wallet(config.wallet.privateKey).connect(provider) :
    Wallet.fromMnemonic(config.wallet.mnemonic, config.wallet.hdPath).connect(provider)

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
    let ensRegistry: string, ensPublicResolver: string

    const ensRegistryFactory = new ContractFactory(ENSRegistryAbi, ENSRegistryBytecode, wallet)

    if (config.features.ensRegistry) {
        const ensRegistryContract = await ensRegistryFactory.deploy(transactionOptions)
        const ensRegistryInstance = await ensRegistryContract.deployed() as Contract & EnsRegistryContractMethods
        ensRegistry = ensRegistryInstance.address

        console.log("ENS Registry deployed at", ensRegistry)
    }
    else {
        ensRegistry = config.contracts.current.ensRegistry

        console.log("Using the existing ENS registry", ensRegistry)
    }

    if (config.features.ensResolver) {
        // ENS Public resolver
        const ensPublicResolverFactory = new ContractFactory(ENSPublicResolverAbi, ENSPublicResolverBytecode, wallet)
        const ensPublicResolverContract = await ensPublicResolverFactory.deploy("0x0000000000000000000000000000000000000000", transactionOptions)
        const ensPublicResolverInstance = await ensPublicResolverContract.deployed() as Contract & EnsPublicResolverContractMethods
        ensPublicResolver = ensPublicResolverInstance.address

        console.log("ENS Public Resolver deployed at", ensPublicResolver)
    }
    else {
        ensPublicResolver = config.contracts.current.ensPublicResolver
        console.log("Using the existing ENS Public Resolver at", ensPublicResolver)
    }

    return {
        ensRegistry,
        ensPublicResolver
    }
}

async function deployCoreContracts() {
    let processes: string, namespaces: string, erc20Proofs: string

    console.log()
    console.log("Core contract deployment")

    if (config.features.proofs.erc20) {
        // ERC Storage Proof
        const tokenStorageProofFactory = new ContractFactory(tokenStorageProofAbi, tokenStorageProofBytecode, wallet)
        const tokenStorageProofContract = await tokenStorageProofFactory.deploy(transactionOptions)
        const tokenStorageProofInstance = await tokenStorageProofContract.deployed() as Contract & TokenStorageProofContractMethods
        erc20Proofs = tokenStorageProofInstance.address
        console.log("ERC20 Token Storage Proof deployed at", erc20Proofs)
    }
    else {
        erc20Proofs = config.contracts.current.proofs.erc20

        console.log("Using the existing ERC20 storage proofs at", erc20Proofs)
    }

    if (config.features.namespaces) {
        // Namespace
        const namespaceFactory = new ContractFactory(namespaceAbi, namespaceByteCode, wallet)
        const namespaceContract = await namespaceFactory.deploy(transactionOptions)
        const namespaceInstance = await namespaceContract.deployed() as Contract & NamespaceContractMethods
        namespaces = namespaceInstance.address
        console.log("Namespace deployed at", namespaces)
    }
    else {
        namespaces = config.contracts.current.namespaces

        console.log("Using the existing namespaces at", namespaces)
    }

    if (config.features.processes) {
        console.log("\nIMPORTANT:\nMake sure that the process contract predecessor is the one you expect:\n" + config.contracts.current.processes + "\n")
        await new Promise(resolve => setTimeout(resolve, 10 * 1500))

        // Process
        const processFactory = new ContractFactory(VotingProcessAbi, VotingProcessBytecode, wallet)
        const processContract = await processFactory.deploy(config.contracts.current.processes, namespaces, erc20Proofs, config.ethereum.chainId, transactionOptions)
        const processInstance = await processContract.deployed() as Contract & ProcessContractMethods
        console.log("Process deployed at", processInstance.address)
        console.log(" - Predecessor:", config.contracts.current.processes)
        console.log(" - ERC20 Storage Proofs:", erc20Proofs)
        console.log(" - Namespace:", namespaces)
    }
    else {
        processes = config.contracts.current.processes

        console.log("Using the existing processes at", processes)
    }

    return {
        processes,
        namespaces,
        proofs: {
            erc20Proofs
        }
    }
}

async function setEnsDomainNames(contractAddresses: { ensRegistry: string, ensPublicResolver: string, processes: string, namespaces: string, proofs: { erc20Proofs: string } }) {
    if (!config.features.setDomains) return
    else if (provider.network.ensAddress != "0x0000000000000000000000000000000000000000"
        || !contractAddresses.ensRegistry) {
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
    if ((await ensRegistryInstance.owner(rootNode)) != wallet.address) {
        const tx = await ensRegistryInstance.setOwner(rootNode, wallet.address)
        await tx.wait()
    }
    const rootOwner = await ensRegistryInstance.owner(rootNode)
    console.log("Root owner", rootOwner)

    const ethNode = await registerEnsNodeOwner("eth", "", rootNode, ensRegistryInstance)
    const vocdoniEthNode = await registerEnsNodeOwner("vocdoni", "eth", ethNode, ensRegistryInstance)

    let entitiesVocdoniEthNode: string, processesVocdoniEthNode: string, namespacesVocdoniEthNode: string, proofsVocdoniEthNode: string, erc20ProofsVocdoniEthNode: string

    if (config.vocdoni.environment == "prod") {
        entitiesVocdoniEthNode = await registerEnsNodeOwner("entities", "vocdoni.eth", vocdoniEthNode, ensRegistryInstance)
        processesVocdoniEthNode = await registerEnsNodeOwner("processes", "vocdoni.eth", vocdoniEthNode, ensRegistryInstance)
        namespacesVocdoniEthNode = await registerEnsNodeOwner("namespaces", "vocdoni.eth", vocdoniEthNode, ensRegistryInstance)
        proofsVocdoniEthNode = await registerEnsNodeOwner("proofs", "vocdoni.eth", vocdoniEthNode, ensRegistryInstance)

        erc20ProofsVocdoniEthNode = await registerEnsNodeOwner("erc20", "proofs.vocdoni.eth", proofsVocdoniEthNode, ensRegistryInstance)
    }
    else {
        // "stg" or "dev"
        const envVocdoniEthNode = await registerEnsNodeOwner(config.vocdoni.environment, "vocdoni.eth", vocdoniEthNode, ensRegistryInstance)

        entitiesVocdoniEthNode = await registerEnsNodeOwner("entities", config.vocdoni.environment + ".vocdoni.eth", envVocdoniEthNode, ensRegistryInstance)
        processesVocdoniEthNode = await registerEnsNodeOwner("processes", config.vocdoni.environment + ".vocdoni.eth", envVocdoniEthNode, ensRegistryInstance)
        namespacesVocdoniEthNode = await registerEnsNodeOwner("namespaces", config.vocdoni.environment + ".vocdoni.eth", envVocdoniEthNode, ensRegistryInstance)
        proofsVocdoniEthNode = await registerEnsNodeOwner("proofs", config.vocdoni.environment + ".vocdoni.eth", envVocdoniEthNode, ensRegistryInstance)

        erc20ProofsVocdoniEthNode = await registerEnsNodeOwner("erc20", "proofs." + config.vocdoni.environment + ".vocdoni.eth", proofsVocdoniEthNode, ensRegistryInstance)
    }

    console.log()
    console.log("Domain resolvers")

    let tx: ContractTransaction

    // set the resolvers
    if (ensPublicResolverInstance.address != await ensRegistryInstance.resolver(entitiesVocdoniEthNode)) {
        tx = await ensRegistryInstance.setResolver(entitiesVocdoniEthNode, ensPublicResolverInstance.address, transactionOptions)
        await tx.wait()
    }
    if (ensPublicResolverInstance.address != await ensRegistryInstance.resolver(processesVocdoniEthNode)) {
        tx = await ensRegistryInstance.setResolver(processesVocdoniEthNode, ensPublicResolverInstance.address, transactionOptions)
        await tx.wait()
    }
    if (ensPublicResolverInstance.address != await ensRegistryInstance.resolver(namespacesVocdoniEthNode)) {
        tx = await ensRegistryInstance.setResolver(namespacesVocdoniEthNode, ensPublicResolverInstance.address, transactionOptions)
        await tx.wait()
    }
    if (ensPublicResolverInstance.address != await ensRegistryInstance.resolver(proofsVocdoniEthNode)) {
        tx = await ensRegistryInstance.setResolver(proofsVocdoniEthNode, ensPublicResolverInstance.address, transactionOptions)
        await tx.wait()
    }
    if (ensPublicResolverInstance.address != await ensRegistryInstance.resolver(erc20ProofsVocdoniEthNode)) {
        tx = await ensRegistryInstance.setResolver(erc20ProofsVocdoniEthNode, ensPublicResolverInstance.address, transactionOptions)
        await tx.wait()
    }

    console.log()
    console.log("Domain addresses")

    // set the addresses
    if (ensPublicResolverInstance.address != await ensPublicResolverInstance["addr(bytes32)"](entitiesVocdoniEthNode)) {
        tx = await ensPublicResolverInstance.functions["setAddr(bytes32,address)"](entitiesVocdoniEthNode, contractAddresses.ensPublicResolver, transactionOptions)
        await tx.wait()
    }
    if (contractAddresses.processes != await ensPublicResolverInstance["addr(bytes32)"](processesVocdoniEthNode)) {
        tx = await ensPublicResolverInstance.functions["setAddr(bytes32,address)"](processesVocdoniEthNode, contractAddresses.processes, transactionOptions)
        await tx.wait()
    }
    if (contractAddresses.namespaces != await ensPublicResolverInstance["addr(bytes32)"](namespacesVocdoniEthNode)) {
        tx = await ensPublicResolverInstance.functions["setAddr(bytes32,address)"](namespacesVocdoniEthNode, contractAddresses.namespaces, transactionOptions)
        await tx.wait()
    }
    if (contractAddresses.proofs.erc20Proofs != await ensPublicResolverInstance["addr(bytes32)"](erc20ProofsVocdoniEthNode)) {
        tx = await ensPublicResolverInstance.functions["setAddr(bytes32,address)"](erc20ProofsVocdoniEthNode, contractAddresses.proofs.erc20Proofs, transactionOptions)
        await tx.wait()
    }

    if (config.vocdoni.environment == "prod") {
        console.log("'entities.vocdoni.eth' address", await ensPublicResolverInstance["addr(bytes32)"](entitiesVocdoniEthNode))
        console.log("'processes.vocdoni.eth' address", await ensPublicResolverInstance["addr(bytes32)"](processesVocdoniEthNode))
        console.log("'erc20.proofs.vocdoni.eth' address", await ensPublicResolverInstance["addr(bytes32)"](erc20ProofsVocdoniEthNode))
        console.log("'namespaces.vocdoni.eth' address", await ensPublicResolverInstance["addr(bytes32)"](namespacesVocdoniEthNode))
    } else {
        const e = config.vocdoni.environment
        console.log("'entities." + e + ".vocdoni.eth' address", await ensPublicResolverInstance["addr(bytes32)"](entitiesVocdoniEthNode))
        console.log("'processes." + e + ".vocdoni.eth' address", await ensPublicResolverInstance["addr(bytes32)"](processesVocdoniEthNode))
        console.log("'erc20.proofs." + e + ".vocdoni.eth' address", await ensPublicResolverInstance["addr(bytes32)"](erc20ProofsVocdoniEthNode))
        console.log("'namespaces." + e + ".vocdoni.eth' address", await ensPublicResolverInstance["addr(bytes32)"](namespacesVocdoniEthNode))
    }

    console.log()
    console.log("Bootnode key")

    // set the bootnode URL on the entity of Vocdoni
    const BOOTNODES_KEY = "vnd.vocdoni.boot-nodes"
    const entityId = ensHashAddress(wallet.address)
    tx = await ensPublicResolverInstance.setText(entityId, BOOTNODES_KEY, "https://bootnodes.vocdoni.net/gateways.json", transactionOptions)
    await tx.wait()

    console.log("ENS Text of", entityId, BOOTNODES_KEY, "is", await ensPublicResolverInstance.text(entityId, BOOTNODES_KEY))
}

/** Creates a (sub) domain within parentNode and returns the registered node hash */
async function registerEnsNodeOwner(name: string, parentDomain: string, parentNode: string, ensRegistryInstance: Contract & EnsRegistryContractMethods): Promise<string> {
    const parentParticles = parentDomain?.length ? parentDomain.split(".") : []
    const fullDomainName = [name].concat(parentParticles).join(".")
    const ensNode = namehash.hash(fullDomainName)

    if (wallet.address == await ensRegistryInstance.owner(ensNode)) return ensNode

    // create <name>
    const nodeLabel = keccak256(name)
    var tx = await ensRegistryInstance.setSubnodeOwner(parentNode, nodeLabel, wallet.address, transactionOptions)
    await tx.wait()

    // check domain registered succesfully
    const nodeOwner = await ensRegistryInstance.owner(ensNode)
    console.log(`'${fullDomainName}' owner`, nodeOwner)

    return ensNode
}

/** Connect to the old contract, deactivate it and activate the new one */
async function activateSuccessors(contractAddresses: { ensRegistry: string, ensPublicResolver: string, processes: string, namespaces: string, proofs: { erc20Proofs: string } }) {
    if (config.features.processes && config.contracts.current.processes != "0x0000000000000000000000000000000000000000") {
        console.log("Activating the process contract successor from"), config.contracts.current.processes
        const predecessor = new Contract(config.contracts.current.processes, VotingProcessAbi, wallet) as Contract & ProcessContractMethods
        const tx = await predecessor.activateSuccessor(contractAddresses.processes)
        await tx.wait()
    }
}


main().catch(err => console.log(err))
