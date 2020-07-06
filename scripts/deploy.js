const ethers = require('ethers');
const { Wallet, providers } = ethers
require("dotenv").config()

const GATEWAY_URL = process.env.GATEWAY_URL
const MNEMONIC = process.env.MNEMONIC
const PATH = "m/44'/60'/0'/0/0"
const NETWORK_ID = "goerli"

const { abi: entityResolverAbi, bytecode: entityResolverByteCode } = require("../build/entity-resolver.json")
const { abi: processAbi, bytecode: processByteCode } = require("../build/process.json")
const { abi: namespaceAbi, bytecode: namespaceByteCode } = require("../build/namespace.json")

async function deploy() {
    const provider = new providers.JsonRpcProvider(GATEWAY_URL, NETWORK_ID)
    const wallet = Wallet.fromMnemonic(MNEMONIC, PATH).connect(provider)

    // Deploy
    console.log("Deploying from", wallet.address, "\n")
    const resolverFactory = new ethers.ContractFactory(entityResolverAbi, entityResolverByteCode, wallet)
    const namespaceFactory = new ethers.ContractFactory(namespaceAbi, namespaceByteCode, wallet)
    const processFactory = new ethers.ContractFactory(processAbi, processByteCode, wallet)

    const resolverInstance1 = await resolverFactory.deploy()
    console.log("Entity resolver deployed at", resolverInstance1.address)

    await new Promise(res => setTimeout(res, 5000))

    const namespaceInstance1 = await namespaceFactory.deploy()
    console.log("Namespace deployed at", namespaceInstance1.address)
    // const namespaceAddress = "0xbc30627B7Abca16dFC9E3c7e86Af34F8A4e36621"

    await new Promise(res => setTimeout(res, 20000))

    const nullPredecessorAddress = "0x0000000000000000000000000000000000000000"  // no predecessor
    const processInstance1 = await processFactory.deploy(nullPredecessorAddress, namespaceInstance1.address)
    console.log("Process deployed at", processInstance1.address)
    console.log(" - Predecessor:", nullPredecessorAddress)
    console.log(" - Namespace:", namespaceInstance1.address)

    await new Promise(res => setTimeout(res, 15000))

    // Attach
    // const resolverAddress = "0xb4C1Db693B73bF52AAE58742Dda87Ab4a663fa3d"
    // const namespaceAddress = "0xd404C7162aF285ee7845f54cd45438E5F0a81Cda"
    // const processAddress = "0x43aC75219DF0968820f47801554305D25C0378df"
    const resolverAddress = resolverInstance1.address
    const namespaceAddress = namespaceInstance1.address
    const processAddress = processInstance1.address
    const resolverInstance2 = new ethers.Contract(resolverAddress, entityResolverAbi, wallet)
    const namespaceInstance2 = new ethers.Contract(namespaceAddress, namespaceAbi, wallet)
    const processInstance2 = new ethers.Contract(processAddress, processAbi, wallet)

    // Use
    const address = await wallet.getAddress()
    const entityId = await resolverInstance2.getEntityId(address)
    console.log("ENTITY ID", entityId)

    const namespace0 = await namespaceInstance2.getNamespace(0)
    console.log("NAMESPACE 0", namespace0)

    const processId = await processInstance2.getProcessId(address, 0, 0)
    console.log("PROCESS ID", processId)
}

deploy().catch(err => console.error(err))
