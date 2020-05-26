import { VotingProcessContractMethods } from "../../lib/index"
import { Contract, ContractFactory } from "ethers"
import { getAccounts, TestAccount } from "../utils"

const { abi: votingProcessAbi, bytecode: votingProcessByteCode } = require("../../build/voting-process.json")

// DEFAULT VALUES
export const DEFAULT_ENVELOPE_TYPE = 0
export const DEFAULT_PROCESS_MODE = 0
export const DEFAULT_METADATA_CONTENT_HASHED_URI = "ipfs://1234,https://server/uri!0987654321"
export const DEFAULT_MERKLE_ROOT = "0x123456789"
export const DEFAULT_MERKLE_TREE_CONTENT_HASHED_URI = "ipfs://1234,https://server/uri!1234567812345678"
export const DEFAULT_START_BLOCK = 12341234
export const DEFAULT_NUMBER_OF_BLOCKS = 500000
export const DEFAULT_PROCESS_MODES = [0, 1, 3]
export const DEFAULT_ENVELOPE_TYPES = [0, 1, 4, 6, 8, 10, 12, 14]
export const DEFAULT_QUESTION_COUNT = 10

// BUILDER
export default class VotingProcessBuilder {
    accounts: TestAccount[]

    entityAccount: TestAccount
    metadata: string = DEFAULT_METADATA_CONTENT_HASHED_URI
    merkleRoot: string = DEFAULT_MERKLE_ROOT
    merkleTree: string = DEFAULT_MERKLE_TREE_CONTENT_HASHED_URI
    startBlock: number = DEFAULT_START_BLOCK
    numberOfBlocks: number = DEFAULT_NUMBER_OF_BLOCKS
    chainId: number = 0
    enabledModes: number[] = DEFAULT_PROCESS_MODES
    enabledEnvelopeTypes: number[] = DEFAULT_ENVELOPE_TYPES
    questionCount: number = DEFAULT_QUESTION_COUNT

    constructor() {
        this.accounts = getAccounts()
        this.entityAccount = this.accounts[1]
    }

    async build(votingProcessessCount: number = 1): Promise<Contract & VotingProcessContractMethods> {
        const contractFactory = new ContractFactory(votingProcessAbi, votingProcessByteCode, this.entityAccount.wallet)
        const contractInstance = await contractFactory.deploy()

        const processIds: string[] = []
        for (let i = 0; i < votingProcessessCount; i++) {
            let processId = await contractInstance.getProcessId(this.entityAccount.address, i)
            processIds.push(processId)

            await contractInstance.create(DEFAULT_ENVELOPE_TYPE, DEFAULT_PROCESS_MODE, this.metadata, this.merkleRoot, this.merkleTree,
                this.startBlock, this.numberOfBlocks, this.questionCount)
        }

        return contractInstance as any
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
    withModes(enabledModes: number[]) {
        this.enabledModes = enabledModes
        return this
    }
    withEnvelopeTypes(supportedEnvelopeTypes: number[]) {
        this.enabledEnvelopeTypes = supportedEnvelopeTypes
        return this
    }
    withQuestionCount(questionCount: number) {
        this.questionCount = questionCount
        return this
    }
}
