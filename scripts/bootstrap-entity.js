const ethers = require('ethers');
const { Wallet, Contract, providers } = ethers
require("dotenv").config()

const GATEWAY_URL = process.env.GATEWAY_URL
const MNEMONIC = process.env.MNEMONIC
const PATH = "m/44'/60'/0'/0/0"
const NETWORK_ID = "goerli"
const entitiesDomain = "entities.dev.vocdoni.eth"

const { abi: entityResolverAbi } = require("../build/entity-resolver.json")

async function setEntity() {
    const provider = new providers.JsonRpcProvider(GATEWAY_URL, NETWORK_ID)
    const wallet = Wallet.fromMnemonic(MNEMONIC, PATH).connect(provider)

    console.log("Using the account", wallet.address, "\n")

    // Attach
    console.log("Resolving domain")
    const resolverAddress = await provider.resolveName(entitiesDomain)
    console.log("Attaching to", resolverAddress)
    const resolverInstance = new Contract(resolverAddress, entityResolverAbi, wallet)

    // Use
    const entityNode = await ensHashAddress(wallet.address)

    const tx = await resolverInstance.setText(entityNode, "vnd.vocdoni.boot-nodes", "https://bootnodes.vocdoni.net/gateways.json")
    await tx.wait()

    const value = await resolverInstance.text(entityNode, "vnd.vocdoni.boot-nodes")
    console.log("Bootnodes of", entityNode, "set to", value)
}

setEntity().catch(err => console.error(err))
