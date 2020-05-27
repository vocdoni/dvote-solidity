import { VotingProcessContractMethods, ProcessEnvelopeType, ProcessMode, IProcessEnvelopeType, IProcessMode } from "../../lib/index"
import { Contract, ContractFactory } from "ethers"
import { getAccounts, TestAccount } from "../utils"

const { abi: votingProcessAbi, bytecode: votingProcessByteCode } = require("../../build/voting-process.json")

// DEFAULT VALUES
export const DEFAULT_CHAIN_ID = 0
export const DEFAULT_METADATA_CONTENT_HASHED_URI = "ipfs://1234,https://server/uri!0987654321"
export const DEFAULT_MERKLE_ROOT = "0x123456789"
export const DEFAULT_MERKLE_TREE_CONTENT_HASHED_URI = "ipfs://1234,https://server/uri!1234567812345678"
export const DEFAULT_START_BLOCK = 12341234
export const DEFAULT_NUMBER_OF_BLOCKS = 500000
export const DEFAULT_ENABLED_PROCESS_MODES = [ProcessMode.make({}), ProcessMode.make({ scheduled: true })]
export const DEFAULT_ENABLED_ENVELOPE_TYPES = [ProcessEnvelopeType.make({}), ProcessEnvelopeType.make({ encryptedVotes: true })]
export const DEFAULT_QUESTION_COUNT = 10
export const DEFAULT_PROCESS_MODE = DEFAULT_ENABLED_PROCESS_MODES[0]
export const DEFAULT_ENVELOPE_TYPE = DEFAULT_ENABLED_ENVELOPE_TYPES[0]

// BUILDER
export default class ProcessBuilder {
    accounts: TestAccount[]

    entityAccount: TestAccount
    metadata: string = DEFAULT_METADATA_CONTENT_HASHED_URI
    merkleRoot: string = DEFAULT_MERKLE_ROOT
    merkleTree: string = DEFAULT_MERKLE_TREE_CONTENT_HASHED_URI
    startBlock: number = DEFAULT_START_BLOCK
    blockCount: number = DEFAULT_NUMBER_OF_BLOCKS
    chainId: number = DEFAULT_CHAIN_ID
    enabledModes: IProcessMode[] = DEFAULT_ENABLED_PROCESS_MODES
    enabledEnvelopeTypes: IProcessEnvelopeType[] = DEFAULT_ENABLED_ENVELOPE_TYPES
    mode: IProcessMode = DEFAULT_PROCESS_MODE
    envelopeType: IProcessEnvelopeType = DEFAULT_ENVELOPE_TYPE
    questionCount: number = DEFAULT_QUESTION_COUNT

    constructor() {
        this.accounts = getAccounts()
        this.entityAccount = this.accounts[1]
    }

    async build(processCount: number = 1): Promise<Contract & VotingProcessContractMethods> {
        const deployAccount = this.accounts[0]
        const contractFactory = new ContractFactory(votingProcessAbi, votingProcessByteCode, deployAccount.wallet)
        let contractInstance = await contractFactory.deploy(this.chainId, this.enabledModes, this.enabledEnvelopeTypes) as Contract & VotingProcessContractMethods

        contractInstance = contractInstance.connect(this.entityAccount.wallet) as Contract & VotingProcessContractMethods

        for (let i = 0; i < processCount; i++) {
            // let processId = await contractInstance.getProcessId(this.entityAccount.address, i)

            await contractInstance.create(this.mode, this.envelopeType, this.metadata, this.merkleRoot, this.merkleTree,
                this.startBlock, this.blockCount, this.questionCount)
        }

        return contractInstance as Contract & VotingProcessContractMethods
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
    withModes(enabledModes: IProcessMode[]) {
        this.enabledModes = enabledModes
        return this
    }
    withEnvelopeTypes(supportedEnvelopeTypes: IProcessEnvelopeType[]) {
        this.enabledEnvelopeTypes = supportedEnvelopeTypes
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
    withQuestionCount(questionCount: number) {
        this.questionCount = questionCount
        return this
    }
}
