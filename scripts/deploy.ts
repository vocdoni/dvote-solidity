import { Wallet, providers, Contract, ContractFactory, ethers, utils as utils2 } from "ethers"
import { EnsPublicResolverContractMethods, EnsRegistryContractMethods, NamespaceContractMethods, ProcessContractMethods, TokenStorageProofContractMethods } from "../lib"

const utils = require('web3-utils');
const namehash = require('eth-ens-namehash');

require("dotenv").config({ path: __dirname + "/.env" })

const ENDPOINT = process.env.ENDPOINT
const MNEMONIC = process.env.MNEMONIC
const HD_PATH = process.env.HD_PATH || "m/44'/60'/0'/0/0"
const CHAIN_ID = process.env.CHAIN_ID ? parseInt(process.env.CHAIN_ID) : 100
const NETWORK_ID = process.env.NETWORK_ID || "xdai"

const { abi: ENSRegistryAbi, bytecode: ENSRegistryBytecode } = require("../build/ens-registry.json")
const { abi: ENSPublicResolverAbi, bytecode: ENSPublicResolverBytecode } = require("../build/ens-public-resolver.json")
const { abi: VotingProcessAbi, bytecode: VotingProcessBytecode } = require("../build/processes.json")
const { abi: tokenStorageProofAbi, bytecode: tokenStorageProofBytecode } = require("../build/token-storage-proof.json")
const { abi: namespaceAbi, bytecode: namespaceByteCode } = require("../build/namespaces.json")

// Overriding the gas price for xDAI and Sokol networks
/* const transactionOptions = { gasPrice: utils2.parseUnits("1", "gwei") } */
// Else
const transactionOptions = {}

async function deploy() {
    const provider = new providers.JsonRpcProvider(ENDPOINT, { chainId: CHAIN_ID, name: NETWORK_ID, ensAddress: "0x0000000000000000000000000000000000000000" })

    // From mnemonic
    const wallet = Wallet.fromMnemonic(MNEMONIC, HD_PATH).connect(provider)

    // Deploy
    console.log("Deploying from", wallet.address, "\n")

    // ENS Registry
    const ensRegistryFactory = new ContractFactory(ENSRegistryAbi, ENSRegistryBytecode, wallet)
    const ensRegistryContract = await ensRegistryFactory.deploy(transactionOptions)
    const ensRegistryInstance = await ensRegistryContract.deployed() as Contract & EnsRegistryContractMethods
    console.log("ENS Registry deployed at", ensRegistryInstance.address)

    // ENS Public resolver
    const ensPublicResolverFactory = new ContractFactory(ENSPublicResolverAbi, ENSPublicResolverBytecode, wallet)
    const ensPublicResolverContract = await ensPublicResolverFactory.deploy(ensRegistryContract.address, transactionOptions)
    const ensPublicResolverInstance = await ensPublicResolverContract.deployed() as Contract & EnsPublicResolverContractMethods
    console.log("ENS Public Resolver deployed at", ensPublicResolverInstance.address)

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
    const predecessorAddress = "0x0000000000000000000000000000000000000000"  // no predecessor
    const processFactory = new ContractFactory(VotingProcessAbi, VotingProcessBytecode, wallet)
    const processContract = await processFactory.deploy(predecessorAddress, namespaceInstance.address, tokenStorageProofInstance.address, transactionOptions)
    const processInstance = await processContract.deployed() as Contract & ProcessContractMethods
    console.log("Process deployed at", processInstance.address)
    console.log(" - Predecessor:", predecessorAddress)
    console.log(" - Token Storage Proofs:", tokenStorageProofInstance.address)
    console.log(" - Namespace:", namespaceInstance.address)
    console.log()


    // ENS DEPLOYMENT

    // create .eth TLD
    const rootNode = namehash.hash("") // 0x0000000000000000000000000000000000000000000000000000000000000000

    // check TLD added succesfully
    var rootOwner = await ensRegistryInstance.owner(rootNode)
    console.log("Root owner", rootOwner)

    // create .eth
    const ethLabel = utils.keccak256("eth")
    var tx = await ensRegistryInstance.setSubnodeOwner(rootNode, ethLabel, wallet.address, transactionOptions)
    await tx.wait()

    // check TLD added succesfully
    const ethNode = namehash.hash("eth")
    var ethOwner = await ensRegistryInstance.owner(ethNode)
    console.log("'eth' owner", ethOwner)

    // create vocdoni.eth
    const vocdoniLabel = utils.keccak256("vocdoni")
    tx = await ensRegistryInstance.setSubnodeOwner(ethNode, vocdoniLabel, wallet.address, transactionOptions)
    await tx.wait()

    // check vocdoni.eth added succesfully
    const vocdoniEthNode = namehash.hash("vocdoni.eth")
    var vocdoniEthOwner = await ensRegistryInstance.owner(vocdoniEthNode)
    console.log("'vocdoni.eth' owner", vocdoniEthOwner)

    // 1
    // create entities.vocdoni.eth
    const entitiesLabel = utils.keccak256("entities")
    tx = await ensRegistryInstance.setSubnodeOwner(vocdoniEthNode, entitiesLabel, wallet.address, transactionOptions)
    await tx.wait()

    // check TLD added succesfully
    const entitiesVocdoniEthNode = namehash.hash("entities.vocdoni.eth")
    var entitiesVocdoniEthOwner = await ensRegistryInstance.owner(entitiesVocdoniEthNode)
    console.log("'entities.vocdoni.eth' owner", entitiesVocdoniEthOwner)

    // 2
    // create processes.vocdoni.eth
    const processLabel = utils.keccak256("processes")
    tx = await ensRegistryInstance.setSubnodeOwner(vocdoniEthNode, processLabel, wallet.address, transactionOptions)
    await tx.wait()

    // check TLD added succesfully
    const processVocdoniEthNode = namehash.hash("processes.vocdoni.eth")
    var processVocdoniEthOwner = await ensRegistryInstance.owner(processVocdoniEthNode)
    console.log("'processes.vocdoni.eth' owner", processVocdoniEthOwner)

    // 3
    // create proofs.vocdoni.eth
    const proofsLabel = utils.keccak256("proofs")
    tx = await ensRegistryInstance.setSubnodeOwner(vocdoniEthNode, proofsLabel, wallet.address, transactionOptions)
    await tx.wait()

    // check TLD added succesfully
    const proofsVocdoniEthNode = namehash.hash("proofs.vocdoni.eth")
    var proofsVocdoniEthOwner = await ensRegistryInstance.owner(proofsVocdoniEthNode)
    console.log("'proofs.vocdoni.eth' owner", proofsVocdoniEthOwner)

    // 3.1
    // create erc20.proofs.vocdoni.eth
    const erc20Label = utils.keccak256("erc20")
    tx = await ensRegistryInstance.setSubnodeOwner(proofsVocdoniEthNode, erc20Label, wallet.address, transactionOptions)
    await tx.wait()

    // check TLD added succesfully
    const erc20ProofsVocdoniEthNode = namehash.hash("erc20.proofs.vocdoni.eth")
    var erc20ProofsVocdoniEthOwner = await ensRegistryInstance.owner(erc20ProofsVocdoniEthNode)
    console.log("'erc20.proofs.vocdoni.eth' owner", erc20ProofsVocdoniEthOwner)

    // 4
    // create namespaces.vocdoni.eth
    const namespacesLabel = utils.keccak256("namespaces")
    tx = await ensRegistryInstance.setSubnodeOwner(vocdoniEthNode, namespacesLabel, wallet.address, transactionOptions)
    await tx.wait()

    // check TLD added succesfully
    const namespacesVocdoniEthNode = namehash.hash("namespaces.vocdoni.eth")
    var namespacesVocdoniEthOwner = await ensRegistryInstance.owner(namespacesVocdoniEthNode)
    console.log("'namespaces.vocdoni.eth' owner", namespacesVocdoniEthOwner)

    // set the resolver
    tx = await ensRegistryInstance.setResolver(entitiesVocdoniEthNode, ensPublicResolverInstance.address, transactionOptions)
    await tx.wait()
    tx = await ensRegistryInstance.setResolver(processVocdoniEthNode, ensPublicResolverInstance.address, transactionOptions)
    await tx.wait()
    tx = await ensRegistryInstance.setResolver(proofsVocdoniEthNode, ensPublicResolverInstance.address, transactionOptions)
    await tx.wait()
    tx = await ensRegistryInstance.setResolver(erc20ProofsVocdoniEthNode, ensPublicResolverInstance.address, transactionOptions)
    await tx.wait()
    tx = await ensRegistryInstance.setResolver(namespacesVocdoniEthNode, ensPublicResolverInstance.address, transactionOptions)
    await tx.wait()

    console.log()

    // set the addresses
    tx = await ensPublicResolverInstance.functions["setAddr(bytes32,address)"](entitiesVocdoniEthNode, ensPublicResolverInstance.address, transactionOptions)
    await tx.wait()
    console.log("'entities.vocdoni.eth' address", await ensPublicResolverInstance["addr(bytes32)"](entitiesVocdoniEthNode))

    tx = await ensPublicResolverInstance.functions["setAddr(bytes32,address)"](processVocdoniEthNode, processInstance.address, transactionOptions)
    await tx.wait()
    console.log("'processes.vocdoni.eth' address", await ensPublicResolverInstance["addr(bytes32)"](processVocdoniEthNode))

    tx = await ensPublicResolverInstance.functions["setAddr(bytes32,address)"](erc20ProofsVocdoniEthNode, tokenStorageProofInstance.address, transactionOptions)
    await tx.wait()
    console.log("'erc20.proofs.vocdoni.eth' address", await ensPublicResolverInstance["addr(bytes32)"](erc20ProofsVocdoniEthNode))

    tx = await ensPublicResolverInstance.functions["setAddr(bytes32,address)"](namespacesVocdoniEthNode, namespaceInstance.address, transactionOptions)
    await tx.wait()
    console.log("'namespaces.vocdoni.eth' address", await ensPublicResolverInstance["addr(bytes32)"](namespacesVocdoniEthNode))

    // set the bootnode URL on the entity of Vocdoni
    const BOOTNODES_KEY = "vnd.vocdoni.boot-nodes"
    const entityId = utils2.keccak256(wallet.address)
    const tx11 = await ensPublicResolverInstance.setText(entityId, BOOTNODES_KEY, "https://bootnodes.vocdoni.net/gateways.json", transactionOptions)
    await tx11.wait()

    console.log("ENS Text of", entityId, BOOTNODES_KEY, "is", await ensPublicResolverInstance.text(entityId, BOOTNODES_KEY))

    // done
    console.log("\nDone")
}

deploy().catch(err => console.log(err))
