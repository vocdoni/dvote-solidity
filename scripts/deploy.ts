import { Wallet, providers, Contract, ContractFactory, utils, ContractTransaction } from "ethers"
import { keccak256 } from "web3-utils"
import { ensHashAddress, EnsPublicResolverContractMethods, EnsRegistryContractMethods, GenesisContractMethods, NamespaceContractMethods, ProcessContractMethods, ResultsContractMethods, TokenStorageProofContractMethods } from "../lib"
import { getConfig } from "./config"
import * as namehash from "eth-ens-namehash"
import * as readline from 'readline'

const { JsonRpcProvider } = providers

// Global ENS registry and resolver for official ENS deployments (mainnet, goerli)
const ENS_GLOBAL_REGISTRY = "0x00000000000C2E074eC69A0dFb2997BA6C7d2e1e"
const ENS_GLOBAL_PUBLIC_RESOLVER = "0x4B1488B7a6B320d2D721406204aBc3eeAa9AD329"
// By default creating a process is free
const DEFAULT_PROCESS_PRICE = utils.parseUnits("0", "ether")

const { abi: ENSRegistryAbi, bytecode: ENSRegistryBytecode } = require("../build/ens-registry.json")
const { abi: ENSPublicResolverAbi, bytecode: ENSPublicResolverBytecode } = require("../build/ens-resolver.json")
const { abi: VotingProcessAbi, bytecode: VotingProcessBytecode } = require("../build/processes.json")
const { abi: tokenStorageProofAbi, bytecode: tokenStorageProofBytecode } = require("../build/token-storage-proof.json")
const { abi: genesisAbi, bytecode: genesisByteCode } = require("../build/genesis.json")
const { abi: namespaceAbi, bytecode: namespaceByteCode } = require("../build/namespaces.json")
const { abi: resultsAbi, bytecode: resultsByteCode } = require("../build/results.json")

// SET UP

const config = getConfig()

const transactionOptions = {} as any
let rpcParams = undefined

// IMPORTANT INFORMATION
// On POA Network based chains there is not an official ENS deployment. The EntityResolver contract is used as the PublicResolver.
// On most of the Ethereum official networks (Mainnet, Goerli ...) there is an official ENS deployment. The official PublicResolver is used
// as the general resolver but the EntityResolver is used as a key-value for storing text beucause only the owner of a resolver can set text records,
// and unless you have the owner address of the PublicResolver there is not way to set the mentioned text record.

// Overriding the gas price for xDAI and Sokol networks
if (config.ethereum.networkId == "xdai") {
    transactionOptions.gasPrice = utils.parseUnits("1", "gwei")
    rpcParams = { chainId: config.ethereum.chainId, name: config.ethereum.networkId, ensAddress: config.contracts.xdai.ensRegistry }
}
else if (config.ethereum.networkId == "sokol") {
    transactionOptions.gasPrice = utils.parseUnits("1", "gwei")
    rpcParams = { chainId: config.ethereum.chainId, name: config.ethereum.networkId, ensAddress: config.contracts.sokol.ensRegistry }
}
else {
    rpcParams = { chainId: config.ethereum.chainId, name: config.ethereum.networkId, ensAddress: ENS_GLOBAL_REGISTRY }
}

const provider = new JsonRpcProvider(config.ethereum.web3Endpoint, rpcParams)
const wallet = config.wallet.privateKey ?
    new Wallet(config.wallet.privateKey).connect(provider) :
    Wallet.fromMnemonic(config.wallet.mnemonic, config.wallet.hdPath).connect(provider)

const ENS_DOMAIN_SUFFIX = config.vocdoni.environment == "prod" ?
    ".vocdoni.eth" :
    `.${config.vocdoni.environment}.vocdoni.eth`

// MAIN CODE

async function main() {
    if (config.ethereum.networkId == "mainnet") {
        console.log("\n⚠️  WARNING: YOU ARE USING ETHEREUM MAINNET\n")
    }
    await provider.detectNetwork()

    console.log("\nℹ️  Deployment summary:")
    console.log("- Vocdoni environment", config.vocdoni.environment)
    console.log("- Network ID", config.ethereum.networkId)
    console.log("- Chain ID", config.ethereum.chainId)
    console.log("- Web3 endpoint", config.ethereum.web3Endpoint)
    console.log("- Deploying from", wallet.address)
    if (!await confirmStep("\nDo you want to continue?")) process.exit(1)

    // Deploy
    const ensAddrs = await deployEnsContracts()
    const coreAddrs = await deployCoreContracts()

    const currentAddresses = {
        processes: await provider.resolveName("processes" + ENS_DOMAIN_SUFFIX)
    }

    await setEnsDomainNames({ ...ensAddrs, ...coreAddrs })
    await activateSuccessors({ processes: { old: currentAddresses.processes, new: coreAddrs.processes } })

    console.log("\nDone")
}

async function deployEnsContracts() {
    let ensRegistry: string, ensPublicResolver: string, entityResolver: string
    console.log()
    console.log("ENS contracts")

    // Deploy the ENS registry and resolver (if relevant)
    if (config.ethereum.networkId == "xdai" || config.ethereum.networkId == "sokol") {
        const ensRegistryFactory = new ContractFactory(ENSRegistryAbi, ENSRegistryBytecode, wallet)

        if (config.features.ensRegistry) {
            const ensRegistryContract = await ensRegistryFactory.deploy(transactionOptions)
            const ensRegistryInstance = await ensRegistryContract.deployed() as Contract & EnsRegistryContractMethods
            ensRegistry = ensRegistryInstance.address

            console.log("✅ ENS Registry deployed at", ensRegistry)
        }
        else {
            ensRegistry = config.contracts[config.ethereum.networkId].ensRegistry

            console.log("ℹ️  Using the existing ENS registry", ensRegistry)
        }

        if (config.features.ensResolver) {
            // ENS Public resolver
            const ensPublicResolverFactory = new ContractFactory(ENSPublicResolverAbi, ENSPublicResolverBytecode, wallet)
            const ensPublicResolverContract = await ensPublicResolverFactory.deploy(ensRegistry, transactionOptions)
            const ensPublicResolverInstance = await ensPublicResolverContract.deployed() as Contract & EnsPublicResolverContractMethods
            ensPublicResolver = ensPublicResolverInstance.address
            console.log("✅ ENS Public Resolver deployed at", ensPublicResolver)
        }
        else {
            ensPublicResolver = config.contracts[config.ethereum.networkId].ensResolver

            console.log("ℹ️  Using the existing ENS Public Resolver at", ensPublicResolver)
        }
    }
    else {
        // Mainnet / Goerli: Simply use the global contracts
        ensRegistry = ENS_GLOBAL_REGISTRY
        ensPublicResolver = ENS_GLOBAL_PUBLIC_RESOLVER
    }

    // If Goerli or Mainnet deploy the public resolver as the entity resolver. The entity resolver is just used as a key-value
    // while the public resolver is used as a global resolver.
    if (config.ethereum.networkId == "xdai" || config.ethereum.networkId == "sokol") {
        // Simply use the resolver already available
        entityResolver = ensPublicResolver

        console.log("ℹ️  Using the existing ensPublicResolver as entityResolver at", entityResolver)
    }
    else {
        // Mainnet / Goerli: Deploy if needed
        if (config.features.entityResolver) {
            // Entity resolver
            const entityResolverFactory = new ContractFactory(ENSPublicResolverAbi, ENSPublicResolverBytecode, wallet)
            const entityResolverContract = await entityResolverFactory.deploy(ensRegistry, transactionOptions)
            const entityResolverInstance = await entityResolverContract.deployed() as Contract & EnsPublicResolverContractMethods
            entityResolver = entityResolverInstance.address

            console.log("✅ Entity Resolver deployed at", entityResolver)
        }
        else {
            // Using the current domain address
            entityResolver = await provider.resolveName("entities" + ENS_DOMAIN_SUFFIX)

            console.log("ℹ️  Using the existing entityResolver at", entityResolver)
        }
    }

    return {
        ensRegistry,
        ensPublicResolver,
        entityResolver
    }
}

async function deployCoreContracts() {
    let processes: string, genesis: string, namespaces: string, results: string, erc20Proofs: string

    console.log()
    console.log("Core contract deployment")

    if (config.features.proofs.erc20) {
        console.warn("\n⚠️  IMPORTANT:\nBy deploying a new ERC20 storage proofs contract, the currently registered tokens may become unavailable.")
        if (!await confirmStep("Do you want to continue?")) process.exit(1)

        // ERC Storage Proof
        const tokenStorageProofFactory = new ContractFactory(tokenStorageProofAbi, tokenStorageProofBytecode, wallet)
        const tokenStorageProofContract = await tokenStorageProofFactory.deploy(transactionOptions)
        const tokenStorageProofInstance = await tokenStorageProofContract.deployed() as Contract & TokenStorageProofContractMethods
        erc20Proofs = tokenStorageProofInstance.address

        console.log("✅ ERC20 Token Storage Proof deployed at", erc20Proofs)
    }
    else {
        erc20Proofs = await provider.resolveName("erc20.proofs" + ENS_DOMAIN_SUFFIX)

        console.log("ℹ️  Using the existing ERC20 storage proofs at", erc20Proofs)
    }

    if (config.features.genesis) {
        console.warn("\n⚠️  IMPORTANT:\nBy deploying a new Genesis contract, the currently registered chains may become unavailable.")
        if (!await confirmStep("Do you want to continue?")) process.exit(1)

        const genesisFactory = new ContractFactory(genesisAbi, genesisByteCode, wallet)
        const genesisContract = await genesisFactory.deploy(transactionOptions)
        const genesisInstance = await genesisContract.deployed() as Contract & GenesisContractMethods
        genesis = genesisInstance.address

        console.log("✅ Genesis deployed at", genesis)
    }
    else {
        genesis = await provider.resolveName("genesis" + ENS_DOMAIN_SUFFIX)

        console.log("ℹ️  Using the existing genesis at", genesis)
    }

    if (config.features.namespaces) {
        console.warn("\n⚠️  IMPORTANT:\nBy deploying a new Namespaces contract, the currently registered namespace ID's may clash with the ones granted by the new instance.")
        if (!await confirmStep("Do you want to continue?")) process.exit(1)

        const namespacesFactory = new ContractFactory(namespaceAbi, namespaceByteCode, wallet)
        const namespacesContract = await namespacesFactory.deploy(transactionOptions)
        const namespacesInstance = await namespacesContract.deployed() as Contract & NamespaceContractMethods
        namespaces = namespacesInstance.address

        console.log("✅ Namespace deployed at", namespaces)
    }
    else {
        namespaces = await provider.resolveName("namespaces" + ENS_DOMAIN_SUFFIX)

        console.log("ℹ️  Using the existing namespaces at", namespaces)
    }

    let resultsInstance: Contract & ResultsContractMethods
    const resultsFactory = new ContractFactory(resultsAbi, resultsByteCode, wallet)
    if (config.features.results) {
        console.warn("\n⚠️  IMPORTANT:\nBy deploying a new Results contract, the currently registered Process results may become unavailable.")
        if (!await confirmStep("Do you want to continue?")) process.exit(1)

        const resultsContract = await resultsFactory.deploy(genesis, transactionOptions)
        resultsInstance = await resultsContract.deployed() as Contract & ResultsContractMethods
        results = resultsInstance.address

        console.log("✅ Results deployed at", results)
    }
    else {
        results = await provider.resolveName("results" + ENS_DOMAIN_SUFFIX)
        resultsInstance = resultsFactory.attach(results) as Contract & ResultsContractMethods

        console.log("ℹ️  Using the existing results at", results)
    }

    const dependentProcessContractchanged = config.features.results || config.features.proofs.erc20
    let currentProcessesContractAddress = await provider.resolveName("processes" + ENS_DOMAIN_SUFFIX)
    if (config.features.processes || dependentProcessContractchanged) {
        let predecessorContractAddress = currentProcessesContractAddress
        if (predecessorContractAddress == "" || predecessorContractAddress == "0x0") {
            predecessorContractAddress = "0x0000000000000000000000000000000000000000"
        }

        if (predecessorContractAddress == "0x0000000000000000000000000000000000000000") {
            console.warn("\n⚠️  IMPORTANT: You are about to deploy a root processes contract with no predecessor.")
        }
        else if (dependentProcessContractchanged) {
            console.warn("\n⚠️  IMPORTANT: A new processes instance will be deployed because a dependent contract has also been deployed.")
            console.warn("The new processes instance will have " + predecessorContractAddress + " as the predecessor.")
        }
        else {
            console.warn("\n⚠️  IMPORTANT: You are about to deploy a processes contract with " + predecessorContractAddress + " as the predecessor.")
        }
        if (!await confirmStep("Do you want to continue?")) process.exit(1)

        // Process
        const processFactory = new ContractFactory(VotingProcessAbi, VotingProcessBytecode, wallet)
        const processContract = await processFactory.deploy(predecessorContractAddress, namespaces, results, erc20Proofs, config.ethereum.chainId, DEFAULT_PROCESS_PRICE, transactionOptions)
        const processInstance = await processContract.deployed() as Contract & ProcessContractMethods
        processes = processInstance.address

        console.log("✅ Process deployed at", processInstance.address)
        console.log("  - Predecessor:", predecessorContractAddress)
        console.log("  - Namespaces:", namespaces)
        console.log("  - Namespace ID:", await processInstance.namespaceId())
        console.log("  - Results:", results)
        console.log("  - ERC20 Storage Proofs:", erc20Proofs)
    }
    else {
        processes = currentProcessesContractAddress
        console.log("ℹ️  Using the existing processes at", processes)
    }

    // After deploy: tell the results contract about the new processes instance if different
    if (processes != await resultsInstance.processesAddress()) {
        console.warn("\n⚠️  IMPORTANT:")
        console.log("The Process contract that will be notified when results are published is not set on the recently deployed instance.")
        if (await confirmStep("Do you want to update it? (recommended)")) {
            const tx = await resultsInstance.setProcessesAddress(processes)
            await tx.wait()
        }
    }

    return {
        processes,
        genesis,
        namespaces,
        results,
        proofs: {
            erc20Proofs
        }
    }
}

async function setEnsDomainNames(contractAddresses: { ensRegistry: string, ensPublicResolver: string, entityResolver: string, processes: string, genesis: string, namespaces: string, results: string, proofs: { erc20Proofs: string } }) {
    if (!config.features.setDomains) return console.log("Skipping domain registration")
    else if (provider.network.ensAddress == "0x0000000000000000000000000000000000000000"
        || !contractAddresses.ensRegistry) {
        console.log("NOTE: the deployed contracts will not be visible until their ENS records are updated")
        console.log("See https://app.ens.domains/search/vocdoni")
        return
    }

    const ensRegistryFactory = new ContractFactory(ENSRegistryAbi, ENSRegistryBytecode, wallet)
    const ensRegistryInstance = ensRegistryFactory.attach(contractAddresses.ensRegistry) as Contract & EnsRegistryContractMethods

    const ensResolverFactory = new ContractFactory(ENSPublicResolverAbi, ENSPublicResolverBytecode, wallet)
    const ensPublicResolverInstance = ensResolverFactory.attach(contractAddresses.ensPublicResolver) as Contract & EnsPublicResolverContractMethods

    const entityResolverInstance = config.ethereum.networkId != "xdai" && config.ethereum.networkId != "sokol" ?
        // use our own entity resolver
        ensResolverFactory.attach(contractAddresses.entityResolver) as Contract & EnsPublicResolverContractMethods :
        // reuse the global resolver  we deployed
        ensResolverFactory.attach(contractAddresses.ensPublicResolver) as Contract & EnsPublicResolverContractMethods

    console.log()
    console.log("Domain owner")

    const rootNode = namehash.hash("") // 0x0000000000000000000000000000000000000000000000000000000000000000

    let vocdoniEthNode: string
    // if sokol or xdai set registry owner and register .eth TLD and vocdoni.eth domain
    if (config.ethereum.networkId == "xdai" || config.ethereum.networkId == "sokol") {
        // Check that the root is registered correctly
        if ((await ensRegistryInstance.owner(rootNode)) != wallet.address) {
            const tx = await ensRegistryInstance.setOwner(rootNode, wallet.address)
            await tx.wait()
        }
        const rootOwner = await ensRegistryInstance.owner(rootNode)
        console.log("Root owner", rootOwner)
        const ethNode = await registerEnsNodeOwner("eth", "", rootNode, ensRegistryInstance)
        vocdoniEthNode = await registerEnsNodeOwner("vocdoni", "eth", ethNode, ensRegistryInstance)
    } else {
        // show vocdoni.eth owner 
        vocdoniEthNode = namehash.hash("vocdoni.eth")
        const rootOwner = await ensRegistryInstance.owner(rootNode)
        console.log("Root owner", rootOwner)
    }

    let entitiesVocdoniEthNode: string, processesVocdoniEthNode: string, genesisVocdoniEthNode: string, namespacesVocdoniEthNode: string, resultsVocdoniEthNode: string, proofsVocdoniEthNode: string, erc20ProofsVocdoniEthNode: string

    if (config.vocdoni.environment == "prod") {
        entitiesVocdoniEthNode = await registerEnsNodeOwner("entities", "vocdoni.eth", vocdoniEthNode, ensRegistryInstance)
        processesVocdoniEthNode = await registerEnsNodeOwner("processes", "vocdoni.eth", vocdoniEthNode, ensRegistryInstance)
        genesisVocdoniEthNode = await registerEnsNodeOwner("genesis", "vocdoni.eth", vocdoniEthNode, ensRegistryInstance)
        namespacesVocdoniEthNode = await registerEnsNodeOwner("namespaces", "vocdoni.eth", vocdoniEthNode, ensRegistryInstance)
        resultsVocdoniEthNode = await registerEnsNodeOwner("results", "vocdoni.eth", vocdoniEthNode, ensRegistryInstance)
        proofsVocdoniEthNode = await registerEnsNodeOwner("proofs", "vocdoni.eth", vocdoniEthNode, ensRegistryInstance)

        erc20ProofsVocdoniEthNode = await registerEnsNodeOwner("erc20", "proofs.vocdoni.eth", proofsVocdoniEthNode, ensRegistryInstance)
    }
    else {
        // "stg" or "dev"
        const envVocdoniEthNode = await registerEnsNodeOwner(config.vocdoni.environment, "vocdoni.eth", vocdoniEthNode, ensRegistryInstance)

        entitiesVocdoniEthNode = await registerEnsNodeOwner("entities", config.vocdoni.environment + ".vocdoni.eth", envVocdoniEthNode, ensRegistryInstance)
        processesVocdoniEthNode = await registerEnsNodeOwner("processes", config.vocdoni.environment + ".vocdoni.eth", envVocdoniEthNode, ensRegistryInstance)
        genesisVocdoniEthNode = await registerEnsNodeOwner("genesis", config.vocdoni.environment + ".vocdoni.eth", envVocdoniEthNode, ensRegistryInstance)
        namespacesVocdoniEthNode = await registerEnsNodeOwner("namespaces", config.vocdoni.environment + ".vocdoni.eth", envVocdoniEthNode, ensRegistryInstance)
        resultsVocdoniEthNode = await registerEnsNodeOwner("results", config.vocdoni.environment + ".vocdoni.eth", envVocdoniEthNode, ensRegistryInstance)
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
    if (ensPublicResolverInstance.address != await ensRegistryInstance.resolver(genesisVocdoniEthNode)) {
        tx = await ensRegistryInstance.setResolver(genesisVocdoniEthNode, ensPublicResolverInstance.address, transactionOptions)
        await tx.wait()
    }
    if (ensPublicResolverInstance.address != await ensRegistryInstance.resolver(namespacesVocdoniEthNode)) {
        tx = await ensRegistryInstance.setResolver(namespacesVocdoniEthNode, ensPublicResolverInstance.address, transactionOptions)
        await tx.wait()
    }
    if (ensPublicResolverInstance.address != await ensRegistryInstance.resolver(resultsVocdoniEthNode)) {
        tx = await ensRegistryInstance.setResolver(resultsVocdoniEthNode, ensPublicResolverInstance.address, transactionOptions)
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
    if (contractAddresses.entityResolver != await ensPublicResolverInstance["addr(bytes32)"](entitiesVocdoniEthNode)) {
        console.log("\n⚠️  WARNING: By updating 'entities" + ENS_DOMAIN_SUFFIX + "', the existing entities will become unreachable.")
        if (!await confirmStep("Do you REALLY want to continue?")) process.exit(1)

        tx = await ensPublicResolverInstance.functions["setAddr(bytes32,address)"](entitiesVocdoniEthNode, contractAddresses.entityResolver, transactionOptions)
        await tx.wait()
    }
    if (contractAddresses.processes != await ensPublicResolverInstance["addr(bytes32)"](processesVocdoniEthNode)) {
        tx = await ensPublicResolverInstance.functions["setAddr(bytes32,address)"](processesVocdoniEthNode, contractAddresses.processes, transactionOptions)
        await tx.wait()
    }
    if (contractAddresses.genesis != await ensPublicResolverInstance["addr(bytes32)"](genesisVocdoniEthNode)) {
        tx = await ensPublicResolverInstance.functions["setAddr(bytes32,address)"](genesisVocdoniEthNode, contractAddresses.genesis, transactionOptions)
        await tx.wait()
    }
    if (contractAddresses.namespaces != await ensPublicResolverInstance["addr(bytes32)"](namespacesVocdoniEthNode)) {
        tx = await ensPublicResolverInstance.functions["setAddr(bytes32,address)"](namespacesVocdoniEthNode, contractAddresses.namespaces, transactionOptions)
        await tx.wait()
    }
    if (contractAddresses.results != await ensPublicResolverInstance["addr(bytes32)"](resultsVocdoniEthNode)) {
        tx = await ensPublicResolverInstance.functions["setAddr(bytes32,address)"](resultsVocdoniEthNode, contractAddresses.results, transactionOptions)
        await tx.wait()
    }
    if (contractAddresses.proofs.erc20Proofs != await ensPublicResolverInstance["addr(bytes32)"](erc20ProofsVocdoniEthNode)) {
        tx = await ensPublicResolverInstance.functions["setAddr(bytes32,address)"](erc20ProofsVocdoniEthNode, contractAddresses.proofs.erc20Proofs, transactionOptions)
        await tx.wait()
    }

    console.log("'entities" + ENS_DOMAIN_SUFFIX + "' address", await ensPublicResolverInstance["addr(bytes32)"](entitiesVocdoniEthNode))
    console.log("'processes" + ENS_DOMAIN_SUFFIX + "' address", await ensPublicResolverInstance["addr(bytes32)"](processesVocdoniEthNode))
    console.log("'erc20.proofs" + ENS_DOMAIN_SUFFIX + "' address", await ensPublicResolverInstance["addr(bytes32)"](erc20ProofsVocdoniEthNode))
    console.log("'genesis" + ENS_DOMAIN_SUFFIX + "' address", await ensPublicResolverInstance["addr(bytes32)"](genesisVocdoniEthNode))
    console.log("'namespaces" + ENS_DOMAIN_SUFFIX + "' address", await ensPublicResolverInstance["addr(bytes32)"](namespacesVocdoniEthNode))
    console.log("'results" + ENS_DOMAIN_SUFFIX + "' address", await ensPublicResolverInstance["addr(bytes32)"](resultsVocdoniEthNode))

    console.log()
    console.log("Bootnode key")

    // set the bootnode URL on the entity of Vocdoni
    const BOOTNODES_KEY = "vnd.vocdoni.boot-nodes"
    const entityId = ensHashAddress(wallet.address)
    let uri = "https://bootnodes.vocdoni.net/gateways.json"
    if (config.vocdoni.environment != "prod") {
        uri = "https://bootnodes.vocdoni.net/gateways." + config.vocdoni.environment + ".json"
    }

    // Set the bootnode text field on the entity resolver
    if (uri != await entityResolverInstance.text(entityId, BOOTNODES_KEY)) {
        tx = await entityResolverInstance.setText(entityId, BOOTNODES_KEY, uri, transactionOptions)
        await tx.wait()
    }

    console.log("ENS Text of", entityId, BOOTNODES_KEY, "is", await entityResolverInstance.text(entityId, BOOTNODES_KEY))
}

/** Creates a (sub) domain within parentNode and returns the registered node hash */
async function registerEnsNodeOwner(name: string, parentDomain: string, parentNode: string, ensRegistryInstance: Contract & EnsRegistryContractMethods): Promise<string> {
    const suffixItems = parentDomain?.length ? parentDomain.split(".") : []
    const fullDomainName = [name].concat(suffixItems).join(".")
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
async function activateSuccessors({ processes }: { processes: { old: string, new: string } }) {
    console.log()
    console.log("Successor activation")

    if (!config.features.setDomains) {
        console.error("Cannot activate a processes contract successor if the ENS records will not be updated. Otherwise, the new contract would be unreachable and the current one would be locked.")
        return
    }
    else if (!processes.old || processes.old == "0x0" || processes.old == "0x0000000000000000000000000000000000000000") return
    else if (processes.old == processes.new) return console.log("No need to activate a successor processes contract (unchanged)")

    console.log("ℹ️  Activating the process contract successor from", processes.old)
    const predecessor = new Contract(processes.old, VotingProcessAbi, wallet) as Contract & ProcessContractMethods
    const tx = await predecessor.activateSuccessor(processes.new)
    await tx.wait()
}

// HELPERS

function confirmStep(question: string): Promise<boolean> {
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });

    return new Promise((resolve) => {
        rl.question(question + " (y/N) ", (answer) => {
            rl.close()
            resolve(answer == "y" || answer == "Y" || answer == "Yes" || answer == "yes")
        })
    })
}


main().catch(err => console.log(err))
