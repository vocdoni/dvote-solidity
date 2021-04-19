import { BigNumber, Contract, ContractFactory } from "ethers"
import { abi as processAbi, bytecode as processByteCode } from "../../build/processes.json"
import { IProcessCensusOrigin, IProcessEnvelopeType, IProcessMode, ProcessCensusOrigin, ProcessContractParameters, ProcessEnvelopeType, ProcessesContractMethods, ProcessMode } from "../../lib/index"
import { getAccounts, TestAccount } from "../utils"
import ERC20MockBuilder from "./erc20Mock"
import NamespaceBuilder from "./namespace"
import ResultsBuilder from "./results"
import TokenStorageProofBuilder from "./token-storage-proof"


// DEFAULT VALUES
export const DEFAULT_PREDECESSOR_INSTANCE_ADDRESS = "0x0000000000000000000000000000000000000000"
export const DEFAULT_NAMESPACE = 0
export const DEFAULT_PROCESS_PRICE = 0
export const DEFAULT_ETH_CHAIN_ID = 0
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
export const DEFAULT_EVM_BLOCK_HEIGHT = 0
export const DEFAULT_TOKEN_ADDRESS = "0x0000000000000000000000000000000000000000"
export const DEFAULT_PARAMS_SIGNATURE = "0x1111111111111111111111111111111111111111111111111111111111111111"
export const DEFAULT_RESULTS_TALLY = [[0, 1], [2, 3], [4, 5], [6, 7], [8, 9]]
export const DEFAULT_RESULTS_HEIGHT = 10

// BUILDER
export default class ProcessBuilder {
    accounts: TestAccount[]

    entityAccount: TestAccount
    predecessorInstanceAddress: string = DEFAULT_PREDECESSOR_INSTANCE_ADDRESS
    processPrice: number | BigNumber = DEFAULT_PROCESS_PRICE
    enabled: boolean = true
    metadata: string = DEFAULT_METADATA_CONTENT_HASHED_URI
    censusRoot: string = DEFAULT_CENSUS_ROOT
    censusUri: string = DEFAULT_CENSUS_TREE_CONTENT_HASHED_URI
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
    evmBlockHeight: number = DEFAULT_EVM_BLOCK_HEIGHT
    tokenAddress: string
    resultsAddress: string
    namespaceAddress: string
    tokenStorageProofAddress: string
    ethChainId: number = DEFAULT_ETH_CHAIN_ID
    paramsSignature: string = DEFAULT_PARAMS_SIGNATURE

    constructor() {
        this.accounts = getAccounts()
        this.entityAccount = this.accounts[1]
    }

    async build(processCount: number = 1, evm: boolean = false): Promise<Contract & ProcessesContractMethods> {
        if (this.predecessorInstanceAddress != DEFAULT_PREDECESSOR_INSTANCE_ADDRESS && processCount > 0) throw new Error("Unable to create " + processCount + " processes without a null parent, since the contract is inactive. Call .build(0) instead.")
        const deployAccount = this.accounts[0]

        let namespaceAddress = this.namespaceAddress
        if (!namespaceAddress) {
            // Deploy one
            const namespaceInstance = await new NamespaceBuilder().build()
            namespaceAddress = namespaceInstance.address
        }
        let resultsAddress = this.resultsAddress
        if (!resultsAddress) {
            // Deploy one
            const resultsInstance = await new ResultsBuilder().build()
            resultsAddress = resultsInstance.address
        }

        if ((!this.tokenAddress || this.tokenAddress == "") && evm) {
            // Deploy one
            const erc20MockInstance = await new ERC20MockBuilder().build()
            this.tokenAddress = erc20MockInstance.address

        }

        let tokenStorageProofAddress = this.tokenStorageProofAddress
        if (!tokenStorageProofAddress) {
            const tokenStorageProofInstance = await new TokenStorageProofBuilder().build()
            tokenStorageProofAddress = tokenStorageProofInstance.address
        }

        // Processes contract itself
        const contractFactory = new ContractFactory(processAbi, processByteCode, deployAccount.wallet)

        let contractInstance = await contractFactory.deploy(
            this.predecessorInstanceAddress,
            namespaceAddress,
            resultsAddress,
            tokenStorageProofAddress,
            this.ethChainId,
            this.processPrice
        ) as Contract & ProcessesContractMethods

        contractInstance = contractInstance.connect(this.entityAccount.wallet) as Contract & ProcessesContractMethods

        const extraParams = { value: BigNumber.from(this.processPrice || 0) }
        if (evm) {
            for (let i = 0; i < processCount; i++) {
                const params = ProcessContractParameters.fromParams({
                    mode: this.mode,
                    envelopeType: this.envelopeType,
                    censusOrigin: new ProcessCensusOrigin(11),
                    metadata: this.metadata,
                    censusRoot: this.censusRoot,
                    startBlock: this.startBlock,
                    blockCount: this.blockCount,
                    questionCount: this.questionCount,
                    maxCount: this.maxCount,
                    maxValue: this.maxValue,
                    maxVoteOverwrites: this.maxVoteOverwrites,
                    maxTotalCost: this.maxTotalCost,
                    costExponent: this.costExponent,
                    tokenAddress: this.tokenAddress,
                    evmBlockHeight: this.evmBlockHeight,
                    paramsSignature: this.paramsSignature
                }).toContractParamsEvm(extraParams)
    
                await contractInstance.newProcessEvm(...params)
            }
        } else {
            for (let i = 0; i < processCount; i++) {
                const params = ProcessContractParameters.fromParams({
                    mode: this.mode,
                    envelopeType: this.envelopeType,
                    censusOrigin: this.censusOrigin,
                    metadata: this.metadata,
                    censusRoot: this.censusRoot,
                    censusUri: this.censusUri,
                    startBlock: this.startBlock,
                    blockCount: this.blockCount,
                    questionCount: this.questionCount,
                    maxCount: this.maxCount,
                    maxValue: this.maxValue,
                    maxVoteOverwrites: this.maxVoteOverwrites,
                    maxTotalCost: this.maxTotalCost,
                    costExponent: this.costExponent,
                    paramsSignature: this.paramsSignature
                }).toContractParamsStd(extraParams)

                await contractInstance.newProcessStd(...params)
            }
        }

        return contractInstance as Contract & ProcessesContractMethods
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
    withNamespaceAddress(namespaceAddress: string) {
        this.namespaceAddress = namespaceAddress
        return this
    }
    withResultsAddress(resultsAddress: string) {
        this.resultsAddress = resultsAddress
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
    withTokenStorageProof(tokenStorageProofAddress: string) {
        this.tokenStorageProofAddress = tokenStorageProofAddress
        return this
    }
    withNamespaceInstance(namespaceAddress: string) {
        this.namespaceAddress = namespaceAddress
        return this
    }
    withChainId(chainId: number) {
        this.ethChainId = chainId
        return this
    }
    withParamsSignature(paramsSignature: string) {
        this.paramsSignature = paramsSignature
        return this
    }

    withEvmBlockHeight(evmBlockHeight: number) {
        this.evmBlockHeight = evmBlockHeight
        return this
    }

    withTokenAddress(tokenAddress: string) {
        this.tokenAddress = tokenAddress
        return this
    }

    withPrice(processPrice: number | BigNumber) {
        if (this.processPrice < 0) throw new Error("Unable to create process contract, process price must be positive")
        this.processPrice = processPrice
        return this
    }

    // STATIC

    static createDefaultStdProcess(contractInstance: Contract & ProcessesContractMethods) {
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
            paramsSignature: DEFAULT_PARAMS_SIGNATURE
        }).toContractParamsStd()
        return contractInstance.newProcessStd(...params).then(tx => tx.wait())
    }

    static createDefaultEvmProcess(contractInstance: Contract & ProcessesContractMethods) {
        const params = ProcessContractParameters.fromParams({
            mode: DEFAULT_PROCESS_MODE,
            envelopeType: DEFAULT_ENVELOPE_TYPE,
            censusOrigin: DEFAULT_CENSUS_ORIGIN,
            metadata: DEFAULT_METADATA_CONTENT_HASHED_URI,
            censusRoot: DEFAULT_CENSUS_ROOT,
            startBlock: DEFAULT_START_BLOCK,
            blockCount: DEFAULT_BLOCK_COUNT,
            questionCount: DEFAULT_QUESTION_COUNT,
            maxCount: DEFAULT_MAX_COUNT,
            maxValue: DEFAULT_MAX_VALUE,
            maxVoteOverwrites: DEFAULT_MAX_VOTE_OVERWRITES,
            maxTotalCost: DEFAULT_MAX_TOTAL_COST,
            costExponent: DEFAULT_COST_EXPONENT,
            evmBlockHeight: DEFAULT_EVM_BLOCK_HEIGHT,
            paramsSignature: DEFAULT_PARAMS_SIGNATURE
        }).toContractParamsEvm()
        return contractInstance.newProcessEvm(...params).then(tx => tx.wait())
    }
}
