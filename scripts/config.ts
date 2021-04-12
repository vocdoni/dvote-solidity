import { existsSync, readFileSync } from "fs"
import * as YAML from 'yaml'
import * as yup from "yup"

const CONFIG_PATH = __dirname + "/config.yaml"

export function getConfig(): Config {
    if (!existsSync(CONFIG_PATH)) {
        console.error("Please, create a config.yaml file on the scripts folder")
        process.exit(1)
    }

    console.log("Checking", CONFIG_PATH)
    const configBody: Config = YAML.parse(readFileSync(CONFIG_PATH).toString())

    if (!configSchema.isValidSync(configBody)) {
        try {
            configSchema.validateSync(configBody)
        }
        catch (err) {
            console.error("Config validation error", err)
            process.exit(1)
        }
    }

    return configSchema.validateSync(configBody)
}

const configSchema = yup.object({
    vocdoni: yup.object({
        /** The Vocdoni environment that the deploy should target (this affects the ENS domains used) */
        environment: yup.string().oneOf(["prod", "stg", "dev"]).required()
    }),
    features: yup.object({
        /** Deploy the ENS registry contract, mainly intended for xdai/sokol */
        ensRegistry: yup.boolean().required(),
        /** Deploy the ENS public resolver contract, mainly intended for xdai/sokol */
        ensResolver: yup.boolean().required(),
        /** Deploy an entity resolver contract instance (may be shared with the ensResolver on xdai) */
        entityResolver: yup.boolean().required(),
        /** Deploy the processes contract by forking the current one (may be forced to true if proofs.xx is active) */
        processes: yup.boolean().required(),
        /** Deploy the genesis contract, to define the details of all Vocdoni chains */
        genesis: yup.boolean().required(),
        /** Deploy the namespaces contract */
        namespaces: yup.boolean().required(),
        /** Deploy the results contract */
        results: yup.boolean().required(),
        proofs: yup.object({
            /** Deploy the ERC20 storage proofs contract */
            erc20: yup.boolean().required(),
        }),
        /** Ensure that all domains point to the last deployed version */
        setDomains: yup.boolean().required(),
    }),
    contracts: yup.object({
        xdai: yup.object({
            /** The address of the ENS registry contract. If empty or 0x0, a new registry has to be deployed. */
            ensRegistry: yup.string().optional().nullable(),
            /** The address of the ENS public resolver contract. If empty or 0x0, a new one has to be deployed. */
            ensResolver: yup.string().optional().nullable(),
        }),
        sokol: yup.object({
            /** The address of the ENS registry contract. If empty or 0x0, a new registry has to be deployed. */
            ensRegistry: yup.string().optional().nullable(),
            /** The address of the ENS public resolver contract. If empty or 0x0, a new one has to be deployed. */
            ensResolver: yup.string().optional().nullable(),
        }),
        // mainnet, goerli, ropsten, etc use the official ENS contracts
    }),
    ethereum: yup.object({
        /** The Ethereum network ID being used */
        networkId: yup.string().oneOf(["mainnet", "goerli", "xdai", "sokol", "rinkeby", "unknown"]).required(),
        /** The Ethereum chain ID being used */
        chainId: yup.number().min(0).required(),
        /** The Web3 endpoint to use for deploying the contracts */
        web3Endpoint: yup.string().required()
    }),
    wallet: yup.object({
        /** privateKey to be used (if set). Otherwise, the mnemonic and hdPath are used */
        privateKey: yup.string().optional().nullable(),
        /** The seed phrase to use for the wallet */
        mnemonic: yup.string().optional().nullable(),
        /** The HD derivation path */
        hdPath: yup.string().optional().nullable()
    })
})

export type Config = ReturnType<typeof configSchema.validateSync>
