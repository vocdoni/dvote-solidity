import { ProcessContractMethods, ProcessEnvelopeType, ProcessMode, IProcessEnvelopeType, IProcessMode } from "../../lib/index"
import { Contract, ContractFactory } from "ethers"
import { getAccounts, TestAccount } from "../utils"

const { abi: votingProcessAbi, bytecode: votingProcessByteCode } = require("../../build/voting-process.json")

// DEFAULT VALUES
export const DEFAULT_CHAIN_ID = 0
export const DEFAULT_PROCESS_MODE = ProcessMode.make()
export const DEFAULT_ENVELOPE_TYPE = ProcessEnvelopeType.make()
export const DEFAULT_METADATA_CONTENT_HASHED_URI = "ipfs://1234,https://server/uri!0987654321"
export const DEFAULT_MERKLE_ROOT = "0x123456789"
export const DEFAULT_MERKLE_TREE_CONTENT_HASHED_URI = "ipfs://1234,https://server/uri!1234567812345678"
export const DEFAULT_START_BLOCK = 12341234
export const DEFAULT_BLOCK_COUNT = 500000
export const DEFAULT_QUESTION_COUNT = 5
export const DEFAULT_MAX_VOTE_OVERWRITES = 0
export const DEFAULT_MAX_VALUE = 5
export const DEFAULT_UNIQUE_VALUES = false
export const DEFAULT_MAX_TOTAL_COST = 0
export const DEFAULT_COST_EXPONENT = 10000
export const DEFAULT_NAMESPACE = 0
export const DEFAULT_PARAMS_SIGNATURE = "0x1111111111111111111111111111111111111111111111111111111111111111"

// BUILDER
export default class ProcessBuilder {
    accounts: TestAccount[]

    entityAccount: TestAccount
    metadata: string = DEFAULT_METADATA_CONTENT_HASHED_URI
    merkleRoot: string = DEFAULT_MERKLE_ROOT
    merkleTree: string = DEFAULT_MERKLE_TREE_CONTENT_HASHED_URI
    startBlock: number = DEFAULT_START_BLOCK
    blockCount: number = DEFAULT_BLOCK_COUNT
    chainId: number = DEFAULT_CHAIN_ID
    mode: IProcessMode = DEFAULT_PROCESS_MODE
    envelopeType: IProcessEnvelopeType = DEFAULT_ENVELOPE_TYPE
    questionCount: number = DEFAULT_QUESTION_COUNT
    maxVoteOverwrites: number = DEFAULT_MAX_VOTE_OVERWRITES
    maxValue: number = DEFAULT_MAX_VALUE
    uniqueValues: boolean = DEFAULT_UNIQUE_VALUES
    maxTotalCost: number = DEFAULT_MAX_TOTAL_COST
    costExponent: number = DEFAULT_COST_EXPONENT
    namespace: number = DEFAULT_NAMESPACE
    paramsSignature: string = DEFAULT_PARAMS_SIGNATURE


    constructor() {
        this.accounts = getAccounts()
        this.entityAccount = this.accounts[1]
    }

    async build(processCount: number = 1): Promise<Contract & ProcessContractMethods> {
        const deployAccount = this.accounts[0]
        const contractFactory = new ContractFactory(votingProcessAbi, votingProcessByteCode, deployAccount.wallet)
        let contractInstance = await contractFactory.deploy(this.chainId) as Contract & ProcessContractMethods

        contractInstance = contractInstance.connect(this.entityAccount.wallet) as Contract & ProcessContractMethods

        for (let i = 0; i < processCount; i++) {
            // let processId = await contractInstance.getProcessId(this.entityAccount.address, i)

            await contractInstance.create(
                [this.mode, this.envelopeType],
                [this.metadata, this.merkleRoot, this.merkleTree],
                this.startBlock,
                this.blockCount,
                [this.questionCount, this.maxVoteOverwrites, this.maxValue],
                this.uniqueValues,
                [this.maxTotalCost, this.costExponent],
                this.namespace,
                this.paramsSignature
            )
        }

        return contractInstance as Contract & ProcessContractMethods
    }

    // custom modifiers
    withEntityAccount(entityAccount: TestAccount) {
        if (!entityAccount) throw new Error("Empty entityAccount value")

        this.entityAccount = entityAccount
        return this
    }
    withMetadata(metadata: string) {
        if (!metadata) throw new Error("Empty metadata value")

        this.metadata = metadata
        return this
    }
    withChainId(chainId: number) {
        this.chainId = chainId
        return this
    }
    withMode(mode: IProcessMode) {
        this.mode = mode
        return this
    }
    withProcessEnvelopeType(envelopeType: IProcessEnvelopeType) {
        this.envelopeType = envelopeType
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
    withMaxValue(maxValue: number) {
        this.maxValue = maxValue
        return this
    }
    withUniqueValues(uniqueValues: boolean) {
        this.uniqueValues = uniqueValues
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
    withParamsSignature(paramsSignature: string) {
        this.paramsSignature = paramsSignature
        return this
    }

    // STATIC

    static createDefaultProcess(contractInstance: Contract & ProcessContractMethods) {
        return contractInstance.create(
            [DEFAULT_PROCESS_MODE, DEFAULT_ENVELOPE_TYPE],
            [DEFAULT_METADATA_CONTENT_HASHED_URI, DEFAULT_MERKLE_ROOT, DEFAULT_MERKLE_TREE_CONTENT_HASHED_URI],
            DEFAULT_START_BLOCK,
            DEFAULT_BLOCK_COUNT,
            [DEFAULT_QUESTION_COUNT, DEFAULT_MAX_VOTE_OVERWRITES, DEFAULT_MAX_VALUE],
            DEFAULT_UNIQUE_VALUES,
            [DEFAULT_MAX_TOTAL_COST, DEFAULT_COST_EXPONENT],
            DEFAULT_NAMESPACE,
            DEFAULT_PARAMS_SIGNATURE
        ).then(tx => tx.wait())
    }
}
