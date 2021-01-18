import { ProcessContractMethods, ProcessEnvelopeType, ProcessMode, IProcessEnvelopeType, IProcessMode, NamespaceContractMethods, ProcessContractParameters, IProcessCensusOrigin, ProcessCensusOrigin } from "../../lib/index"
import { Contract, ContractFactory } from "ethers"
import { getAccounts, TestAccount } from "../utils"
import NamespaceBuilder from "./namespace"
import TokenStorageProofBuilder from "./token-storage-proof"
import { assert } from "console"

import { abi as processAbi, bytecode as processByteCode } from "../../build/processes.json"
import { abi as namespaceAbi, bytecode as namespaceByteCode } from "../../build/namespaces.json"
// import { abi as tokenStorageProofAbi, bytecode as tokenStorageProofByteCode } from "../../build/token-storage-proof.json"

// DEFAULT VALUES
export const DEFAULT_PREDECESSOR_INSTANCE_ADDRESS = "0x0000000000000000000000000000000000000000"
export const DEFAULT_NAMESPACE = 0
export const DEFAULT_CHAIN_ID = "vochain"
export const DEFAULT_PROCESS_MODE = ProcessMode.make()
export const DEFAULT_ENVELOPE_TYPE = ProcessEnvelopeType.make()
export const DEFAULT_CENSUS_ORIGIN = ProcessCensusOrigin.OFF_CHAIN_TREE
export const DEFAULT_METADATA_CONTENT_HASHED_URI = "ipfs://1234,https://server/uri!0987654321"
export const DEFAULT_CENSUS_ROOT = "0x123456789"
export const DEFAULT_CENSUS_TREE_CONTENT_HASHED_URI = "ipfs://1234,https://server/uri!1234567812345678"
export const DEFAULT_START_BLOCK = 12341234
export const DEFAULT_BLOCK_COUNT = 500000
export const DEFAULT_QUESTION_COUNT = 5
export const DEFAULT_MAX_VOTE_OVERWRITES = 0
export const DEFAULT_MAX_COUNT = 4
export const DEFAULT_MAX_VALUE = 5
export const DEFAULT_MAX_TOTAL_COST = 0
export const DEFAULT_COST_EXPONENT = 10000
export const DEFAULT_EVM_BLOCK_HEIGHT = 1000
export const DEFAULT_PARAMS_SIGNATURE = "0x1111111111111111111111111111111111111111111111111111111111111111"
export const DEFAULT_RESULTS_TALLY = [[0, 1], [2, 3], [4, 5], [6, 7], [8, 9]]
export const DEFAULT_RESULTS_HEIGHT = 10

// BUILDER
export default class ProcessBuilder {
    accounts: TestAccount[]

    entityAccount: TestAccount
    predecessorInstanceAddress: string = DEFAULT_PREDECESSOR_INSTANCE_ADDRESS
    enabled: boolean = true
    metadata: string = DEFAULT_METADATA_CONTENT_HASHED_URI
    censusRoot: string = DEFAULT_CENSUS_ROOT
    censusTree: string = DEFAULT_CENSUS_TREE_CONTENT_HASHED_URI
    startBlock: number = DEFAULT_START_BLOCK
    blockCount: number = DEFAULT_BLOCK_COUNT
    mode: IProcessMode = DEFAULT_PROCESS_MODE
    envelopeType: IProcessEnvelopeType = DEFAULT_ENVELOPE_TYPE
    censusOrigin: IProcessCensusOrigin = DEFAULT_CENSUS_ORIGIN
    questionCount: number = DEFAULT_QUESTION_COUNT
    maxVoteOverwrites: number = DEFAULT_MAX_VOTE_OVERWRITES
    maxCount: number = DEFAULT_MAX_COUNT
    maxValue: number = DEFAULT_MAX_VALUE
    maxTotalCost: number = DEFAULT_MAX_TOTAL_COST
    costExponent: number = DEFAULT_COST_EXPONENT
    namespace: number = DEFAULT_NAMESPACE
    namespaceAddress: string
    tokenStorageProofAddress: string
    oracleAddress: string
    paramsSignature: string = DEFAULT_PARAMS_SIGNATURE

    constructor() {
        this.accounts = getAccounts()
        this.entityAccount = this.accounts[1]
    }

    async build(processCount: number = 1): Promise<Contract & ProcessContractMethods> {
        if (this.predecessorInstanceAddress != DEFAULT_PREDECESSOR_INSTANCE_ADDRESS && processCount > 0) throw new Error("Unable to create " + processCount + " processes without a null parent, since the contract is inactive. Call .build(0) instead.")

        const deployAccount = this.accounts[0]

        // Namespace deploy dependency
        let namespaceAddress = this.namespaceAddress
        if (!namespaceAddress) { // deploy a new one
            if (this.oracleAddress) {
                const namespaceInstance = await new NamespaceBuilder().withNamespace(this.namespace).withOracles([this.oracleAddress]).build()
                namespaceAddress = namespaceInstance.address

                assert(await namespaceInstance.isOracle(this.namespace, this.oracleAddress), "Not an oracle on the new namespace contract")
            }
            else {
                const namespaceInstance = await new NamespaceBuilder().build()
                namespaceAddress = namespaceInstance.address
            }
        }
        else if (this.oracleAddress) { // attach to it and add the oracle
            const namespaceInstance = new Contract(namespaceAddress, namespaceAbi, deployAccount.wallet) as Contract & NamespaceContractMethods
            const tx = await namespaceInstance.setNamespace(this.namespace, "dummy", "dummy-2", [], [this.oracleAddress])
            await tx.wait()

            assert(await namespaceInstance.isOracle(this.namespace, this.oracleAddress), "Not an oracle to the attached instance")
        }

        // Storage Proof deploy dependency
        let tokenStorageProofAddress = this.tokenStorageProofAddress
        if (!tokenStorageProofAddress) {
            const tokenStorageProofInstance = await new TokenStorageProofBuilder().build()
            tokenStorageProofAddress = tokenStorageProofInstance.address
        }

        // Process itself
        const contractFactory = new ContractFactory(processAbi, processByteCode, deployAccount.wallet)

        let contractInstance = await contractFactory.deploy(this.predecessorInstanceAddress, namespaceAddress, tokenStorageProofAddress) as Contract & ProcessContractMethods

        contractInstance = contractInstance.connect(this.entityAccount.wallet) as Contract & ProcessContractMethods

        for (let i = 0; i < processCount; i++) {
            const params = ProcessContractParameters.fromParams({
                mode: this.mode,
                envelopeType: this.envelopeType,
                censusOrigin: this.censusOrigin,
                metadata: this.metadata,
                censusRoot: this.censusRoot,
                censusUri: this.censusTree,
                startBlock: this.startBlock,
                blockCount: this.blockCount,
                questionCount: this.questionCount,
                maxCount: this.maxCount,
                maxValue: this.maxValue,
                maxVoteOverwrites: this.maxVoteOverwrites,
                maxTotalCost: this.maxTotalCost,
                costExponent: this.costExponent,
                namespace: this.namespace,
                paramsSignature: this.paramsSignature
            }).toContractParams()
            await contractInstance.newProcess(...params)
        }

        return contractInstance as Contract & ProcessContractMethods
    }

    // custom modifiers
    withEntityAccount(entityAccount: TestAccount) {
        if (!entityAccount) throw new Error("Empty entityAccount")

        this.entityAccount = entityAccount
        return this
    }
    withPredecessor(predecessorInstanceAddress: string) {
        if (!predecessorInstanceAddress) throw new Error("Empty predecessorInstanceAddress")

        this.predecessorInstanceAddress = predecessorInstanceAddress
        return this
    }
    disabled() {
        this.enabled = false
        return this
    }
    withMetadata(metadata: string) {
        if (!metadata) throw new Error("Empty metadata value")

        this.metadata = metadata
        return this
    }
    withMode(mode: IProcessMode) {
        this.mode = mode
        return this
    }
    withEnvelopeType(envelopeType: IProcessEnvelopeType) {
        this.envelopeType = envelopeType
        return this
    }
    withCensusOrigin(censusOrigin: IProcessCensusOrigin) {
        this.censusOrigin = censusOrigin
        return this
    }
    withStartBlock(startBlock: number) {
        this.startBlock = startBlock
        return this
    }
    withBlockCount(blockCount: number) {
        this.blockCount = blockCount
        return this
    }
    withQuestionCount(questionCount: number) {
        this.questionCount = questionCount
        return this
    }
    withMaxVoteOverwrites(maxVoteOverwrites: number) {
        this.maxVoteOverwrites = maxVoteOverwrites
        return this
    }
    withMaxCount(maxCount: number) {
        this.maxCount = maxCount
        return this
    }
    withMaxValue(maxValue: number) {
        this.maxValue = maxValue
        return this
    }
    withMaxTotalCost(maxTotalCost: number) {
        this.maxTotalCost = maxTotalCost
        return this
    }
    withCostExponent(costExponent: number) {
        this.costExponent = costExponent
        return this
    }
    withNamespace(namespace: number) {
        this.namespace = namespace
        return this
    }
    withTokenStorageProof(tokenStorageProofAddress: string) {
        this.tokenStorageProofAddress = tokenStorageProofAddress
        return this
    }
    withNamespaceInstance(namespaceAddress: string) {
        this.namespaceAddress = namespaceAddress
        return this
    }
    withOracle(oracleAddress: string) {
        this.oracleAddress = oracleAddress
        return this
    }
    withParamsSignature(paramsSignature: string) {
        this.paramsSignature = paramsSignature
        return this
    }

    // STATIC

    static createDefaultProcess(contractInstance: Contract & ProcessContractMethods) {
        const params = ProcessContractParameters.fromParams({
            mode: DEFAULT_PROCESS_MODE,
            envelopeType: DEFAULT_ENVELOPE_TYPE,
            censusOrigin: DEFAULT_CENSUS_ORIGIN,
            metadata: DEFAULT_METADATA_CONTENT_HASHED_URI,
            censusRoot: DEFAULT_CENSUS_ROOT,
            censusUri: DEFAULT_CENSUS_TREE_CONTENT_HASHED_URI,
            startBlock: DEFAULT_START_BLOCK,
            blockCount: DEFAULT_BLOCK_COUNT,
            questionCount: DEFAULT_QUESTION_COUNT,
            maxCount: DEFAULT_MAX_COUNT,
            maxValue: DEFAULT_MAX_VALUE,
            maxVoteOverwrites: DEFAULT_MAX_VOTE_OVERWRITES,
            maxTotalCost: DEFAULT_MAX_TOTAL_COST,
            costExponent: DEFAULT_COST_EXPONENT,
            namespace: DEFAULT_NAMESPACE,
            paramsSignature: DEFAULT_PARAMS_SIGNATURE
        }).toContractParams()
        return contractInstance.newProcess(...params).then(tx => tx.wait())
    }
}
