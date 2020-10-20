import { Wallet, providers, Contract, ContractFactory, ethers, utils as utils2 } from "ethers"
import { EnsPublicResolverContractMethods, EnsRegistryContractMethods, NamespaceContractMethods, ProcessContractMethods } from "../lib"

const utils = require('web3-utils');
const namehash = require('eth-ens-namehash');

require("dotenv").config()

const ENDPOINT = process.env.ENDPOINT
const MNEMONIC = process.env.MNEMONIC

const PATH = "m/44'/60'/0'/0/0"
const CHAIN_ID = 100
const NETWORK_ID = "xdai"

const { abi: ENSRegistryAbi, bytecode: ENSRegistryBytecode } = require("../build/ens-registry.json")
const { abi: ENSPublicResolverAbi, bytecode: ENSPublicResolverBytecode } = require("../build/ens-public-resolver.json")
const { abi: VotingProcessAbi, bytecode: VotingProcessBytecode } = require("../build/voting-process.json")
const { abi: namespaceAbi, bytecode: namespaceByteCode } = require("../build/namespace.json")

// Overriding the gas price for xDAI and Sokol networks
const transactionOptions = { gasPrice: utils2.parseUnits("1", "gwei") }

async function deploy() {
    const provider = new providers.JsonRpcProvider(ENDPOINT, { chainId: CHAIN_ID, name: NETWORK_ID, ensAddress: "0x0000000000000000000000000000000000000000" })
    const wallet = Wallet.fromMnemonic(MNEMONIC, PATH).connect(provider)

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

    // Namespace
    const namespaceFactory = new ContractFactory(namespaceAbi, namespaceByteCode, wallet)
    const namespaceContract = await namespaceFactory.deploy(transactionOptions)
    const namespaceInstance = await namespaceContract.deployed() as Contract & ProcessContractMethods
    console.log("Namespace deployed at", namespaceInstance.address)

    // Process
    const predecessorAddress = "0x0000000000000000000000000000000000000000"  // no predecessor
    const processFactory = new ContractFactory(VotingProcessAbi, VotingProcessBytecode, wallet)
    const processContract = await processFactory.deploy(predecessorAddress, namespaceInstance.address, transactionOptions)
    const processInstance = await processContract.deployed() as Contract & NamespaceContractMethods
    console.log("Process deployed at", processInstance.address)
    console.log(" - Predecessor:", predecessorAddress)
    console.log(" - Namespace:", processInstance.address)
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
    var tx2 = await ensRegistryInstance.setSubnodeOwner(ethNode, vocdoniLabel, wallet.address, transactionOptions)
    await tx2.wait()

    // check vocdonni.eth added succesfully
    const vocdoniEthNode = namehash.hash("vocdoni.eth")
    var vocdoniEthOwner = await ensRegistryInstance.owner(vocdoniEthNode)
    console.log("'vocdoni.eth' owner", vocdoniEthOwner)

    // 1
    // create entities.vocdoni.eth
    const entitiesLabel = utils.keccak256("entities")
    var tx3 = await ensRegistryInstance.setSubnodeOwner(vocdoniEthNode, entitiesLabel, wallet.address, transactionOptions)
    await tx3.wait()

    // check TLD added succesfully
    const entitiesVocdoniEthNode = namehash.hash("entities.vocdoni.eth")
    var entitiesVocdoniEthOwner = await ensRegistryInstance.owner(entitiesVocdoniEthNode)
    console.log("'entities.vocdoni.eth' owner", entitiesVocdoniEthOwner)

    // 2
    // create processes.vocdoni.eth
    const processLabel = utils.keccak256("processes")
    var tx4 = await ensRegistryInstance.setSubnodeOwner(vocdoniEthNode, processLabel, wallet.address, transactionOptions)
    await tx4.wait()

    // check TLD added succesfully
    const processVocdoniEthNode = namehash.hash("processes.vocdoni.eth")
    var processVocdoniEthOwner = await ensRegistryInstance.owner(processVocdoniEthNode)
    console.log("'processes.vocdoni.eth' owner", processVocdoniEthOwner)

    // 3
    // create namespaces.vocdoni.eth
    const namespacesLabel = utils.keccak256("namespaces")
    var tx4 = await ensRegistryInstance.setSubnodeOwner(vocdoniEthNode, namespacesLabel, wallet.address, transactionOptions)
    await tx4.wait()

    // check TLD added succesfully
    const namespacesVocdoniEthNode = namehash.hash("namespaces.vocdoni.eth")
    var namespacesVocdoniEthOwner = await ensRegistryInstance.owner(namespacesVocdoniEthNode)
    console.log("'namespaces.vocdoni.eth' owner", namespacesVocdoniEthOwner)

    // set resolver
    var tx5 = await ensRegistryInstance.setResolver(entitiesVocdoniEthNode, ensPublicResolverInstance.address, transactionOptions)
    await tx5.wait()
    var tx6 = await ensRegistryInstance.setResolver(processVocdoniEthNode, processInstance.address, transactionOptions)
    await tx6.wait()
    var tx7 = await ensRegistryInstance.setResolver(namespacesVocdoniEthNode, namespaceInstance.address, transactionOptions)
    await tx7.wait()

    console.log()

    // set resolver voting process addr
    // console.log("Resolver", await ensRegistryInstance.resolver(processVocdoniEthNode))
    var tx8 = await ensPublicResolverInstance.functions["setAddr(bytes32,address)"](processVocdoniEthNode, processInstance.address, transactionOptions)
    await tx8.wait()
    console.log("'entities.vocdoni.eth' address", await ensPublicResolverInstance.addr(processVocdoniEthNode))

    var tx9 = await ensPublicResolverInstance.functions["setAddr(bytes32,address)"](entitiesVocdoniEthNode, ensPublicResolverInstance.address, transactionOptions)
    await tx9.wait()
    console.log("'processes.vocdoni.eth' address", await ensPublicResolverInstance.addr(entitiesVocdoniEthNode))

    // set the bootnode URL on the entity of Vocdoni
    const BOOTNODES_KEY = "vnd.vocdoni.boot-nodes"
    const entityId = utils2.keccak256(wallet.address)
    const tx10 = await ensPublicResolverInstance.setText(entityId, BOOTNODES_KEY, "https://bootnodes.vocdoni.net/gateways.json", transactionOptions)
    await tx10.wait()

    console.log("ENS Text of", entityId, BOOTNODES_KEY, "is", await ensPublicResolverInstance.text(entityId, BOOTNODES_KEY))

    // done
    console.log("\nDone")
}

deploy().catch(err => console.log(err))
