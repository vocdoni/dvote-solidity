import { existsSync, readFileSync } from "fs"
import * as YAML from 'yaml'
import * as assert from "assert"

const CONFIG_PATH = __dirname + "/config.yaml"

type Config = {
    vocdoni: {
        /** The Vocdoni environment determining the name of the ENS domains to set/update */
        environment: "dev" | "stg" | "prod"
    },
    features: {
        ensRegistry: boolean
        ensResolver: boolean
        processes: boolean
        namespaces: boolean
        proofs: {
            erc20: boolean
        },

        setDomains: boolean
    },
    contracts: {
        current: {
            /** The address of the ENS registry contract. If empty or 0x0, a new registry has to be deployed. */
            ensRegistry?: string
            /** The address of the ENS public resolver contract. If empty or 0x0, a new one has to be deployed. */
            ensPublicResolver: string
            /** The current address of the processes contract. If empty, a version without a predecessor has to be deployed. */
            processes: string
            /** The current address of the namespaces contract. If set, the current version will be kept and the process contract will be deployed with this address */
            namespaces: string
            proofs: {
                /** The current address of the ERC20 storage proof contract. If set, the current version will be kept and the process contract will be deployed with this address */
                erc20: string
            }
        }
    },
    ethereum: {
        /** The Ethereum network ID being used */
        networkId: "mainnet" | "goerli" | "xdai" | "sokol"
        /** The Ethereum chain ID being used */
        chainId: number
        /** The Web3 endpoint to use for deploying the contracts */
        endpoint: string
    },
    wallet: {
        /** privateKey to be used (if set). Otherwise, the mnemonic and hdPath are used */
        privateKey?: string
        /** The seed phrase to use for the wallet */
        mnemonic: string
        /** The HD derivation path */
        hdPath: string
    }
}

export function getConfig(): Config {
    if (!existsSync(CONFIG_PATH)) {
        console.error("Please, create a config.yaml file on the scripts path")
        process.exit(1)
    }

    console.log("Checking config.yaml")
    const config: Config = YAML.parse(readFileSync(CONFIG_PATH).toString())

    assert(typeof config == "object", "The config file appears to be invalid")
    assert(typeof config.vocdoni == "object", "config.vocdoni should be an object")
    assert(typeof config.features == "object", "config.features should be an object")
    assert(typeof config.contracts == "object", "config.contracts should be an object")
    assert(typeof config.ethereum == "object", "config.ethereum should be an object")
    assert(typeof config.wallet == "object", "config.wallet should be an object")

    assert(typeof config.vocdoni.environment == "string", "config.yaml > vocdoni.environment should be a string")
    assert(typeof config.features.ensRegistry == "boolean", "config.yaml > features.ensRegistry should be a boolean")
    assert(typeof config.features.ensResolver == "boolean", "config.yaml > features.ensResolver should be a boolean")
    assert(typeof config.features.processes == "boolean", "config.yaml > features.processes should be a boolean")
    assert(typeof config.features.namespaces == "boolean", "config.yaml > features.namespaces should be a boolean")
    assert(typeof config.features.proofs == "object", "config.yaml > features.proofs should be an object")
    assert(typeof config.features.proofs.erc20 == "boolean", "config.yaml > features.proofs.erc20 should be a boolean")

    assert(typeof config.contracts.current == "object", "config.yaml > contracts.current should be an object")
    assert(typeof config.contracts.current.ensRegistry == "string", "config.yaml > contracts.current.ensRegistry should be a string")
    assert(typeof config.contracts.current.ensPublicResolver == "string", "config.yaml > contracts.current.ensPublicResolver should be a string")
    assert(typeof config.contracts.current.processes == "string", "config.yaml > contracts.current.processes should be a string")
    assert(typeof config.contracts.current.namespaces == "string", "config.yaml > contracts.current.namespaces should be a string")
    assert(typeof config.contracts.current.proofs == "object", "config.yaml > contracts.current.proofs should be an object")
    assert(typeof config.contracts.current.proofs.erc20 == "string", "config.yaml > contracts.current.proofs.erc20 should be a string")

    assert(typeof config.ethereum.networkId == "string", "config.yaml > ethereum.networkId should be an string")
    assert(typeof config.ethereum.chainId == "number", "config.yaml > ethereum.chainId should be an number")
    assert(typeof config.ethereum.endpoint == "string", "config.yaml > ethereum.endpoint should be an string")

    assert(typeof config.wallet.privateKey == "string", "config.yaml > wallet.privateKey should be an string")
    assert(typeof config.wallet.mnemonic == "string", "config.yaml > wallet.mnemonic should be an string")
    assert(typeof config.wallet.hdPath == "string", "config.yaml > wallet.hdPath should be an string")

    return config
}
