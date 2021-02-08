import { existsSync } from "fs"

if (!existsSync(__dirname + "/.env")) {
    console.error("Please, create an .env file on the scripts path")
    process.exit(1)
}

console.log("Checking .env")
require("dotenv").config({ path: __dirname + "/.env" })

type Config = {
    /** The Web3 endpoint to use for deploying the contracts */
    jsonRpcEndpoint: string,
    /** The seed phrase to use for the wallet */
    mnemonic: string,
    /** The HD derivation path */
    hdPath: string,
    /** The Ethereum chain ID being used */
    chainId: number,
    /** The Ethereum network ID being used */
    networkId: "mainnet" | "goerli" | "xdai" | "sokol",
    /** The address of the ENS registry contract. If empty or 0x0, a new registry has to be deployed. */
    currentEnsRegistry: string,
    /** The current address of the processes contract. If empty, a parentless version has to be deployed. */
    processPredessorContractAddress: string,
    /** The Vocdoni environment determining the name of the ENS domains to set/update */
    environment: "dev" | "stg" | "prod"
}

const XDAI_ENS_REGISTRY_ADDRESS = "0x0000000000000000000000000000000000000000"
const SOKOL_ENS_REGISTRY_ADDRESS = "0x0000000000000000000000000000000000000000"

export function getConfig(): Config {
    const networkId: any = process.env.NETWORK_ID || "goerli"
    const environment: any = process.env.ENVIRONMENT || "dev"

    let currentEnsRegistry = "0x0000000000000000000000000000000000000000"
    switch (networkId) {
        case "xdai":
            currentEnsRegistry = XDAI_ENS_REGISTRY_ADDRESS
            break
        case "sokol":
            currentEnsRegistry = SOKOL_ENS_REGISTRY_ADDRESS
            break
        // otherwise ignore
    }

    return {
        jsonRpcEndpoint: process.env.ENDPOINT,
        mnemonic: process.env.MNEMONIC,
        hdPath: process.env.HD_PATH || "m/44'/60'/0'/0/0",
        chainId: process.env.CHAIN_ID ? parseInt(process.env.CHAIN_ID) : 100,
        networkId,
        currentEnsRegistry,
        processPredessorContractAddress: process.env.PROCESS_PREDECESSOR_CONTRACT_ADDRESS || "0x0000000000000000000000000000000000000000",
        environment
    }
}
