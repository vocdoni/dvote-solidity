import * as EnsRegistry from "./ens-registry.json"
import * as EnsPublicResolver from "./ens-public-resolver.json"
import * as Process from "./processes.json"
import * as TokenStorageProof from "./token-storage-proof.json"
import * as Namespace from "./namespaces.json"

import { ContractTransaction, utils, BigNumber } from "ethers"

///////////////////////////////////////////////////////////////////////////////
// SMART CONTRACTS ABI + BYTECODE
///////////////////////////////////////////////////////////////////////////////

export { EnsRegistry }
export { EnsPublicResolver }
export { Process }
export { TokenStorageProof }
export { Namespace }

export type IMethodOverrides = {
    gasLimit?: number
    gasPrice?: BigNumber
    nonce?: number
    value?: BigNumber
    chainId?: number
}
export declare const defaultMethodOverrides: IMethodOverrides

///////////////////////////////////////////////////////////////////////////////
// ENTITY RESOLVER TYPES
///////////////////////////////////////////////////////////////////////////////

/** Custom Smart Contract operations for an ENS Registry contract */
export type EnsRegistryContractMethods = {
    setRecord(node: string, owner: string, resolver: string, ttl: BigNumber, overrides?: IMethodOverrides): Promise<ContractTransaction>,
    setSubnodeRecord(node: string, label: string, owner: string, resolver: string, ttl: BigNumber, overrides?: IMethodOverrides): Promise<ContractTransaction>,
    setOwner(node: string, owner: string, overrides?: IMethodOverrides): Promise<ContractTransaction>,
    setSubnodeOwner(node: string, label: string, owner: string, overrides?: IMethodOverrides): Promise<ContractTransaction>,
    setResolver(node: string, resolver: string, overrides?: IMethodOverrides): Promise<ContractTransaction>,
    setTTL(node: string, ttl: BigNumber, overrides?: IMethodOverrides): Promise<ContractTransaction>,
    setApprovalForAll(operator: string, approved: Boolean, overrides?: IMethodOverrides): Promise<ContractTransaction>,
    owner(node: string): Promise<string>,
    resolver(node: string): Promise<string>,
    ttl(node: string): Promise<BigNumber>,
    recordExists(node: string): Promise<boolean>,
    isApprovedForAll(_owner: string, operator: string): Promise<boolean>,
}

/** Custom Smart Contract operations for a Public Resolver contract */
export type EnsPublicResolverContractMethods = {
    /** Whether the resolver supports an interface */
    supportsInterface(interfaceID: string): Promise<boolean>

    /** Get the address associated with the given node */
    addr(node: string): Promise<string>
    /** Sets the address for the given node */
    setAddr(node: string, address: string, overrides?: IMethodOverrides): Promise<ContractTransaction>

    /**
     * Returns the text associated with an ENS node and key.
     * @param hashedEntityAddress The ENS node to query.
     * @param key The key to retrieve.
     * @return The record's text.
     */
    text(hashedEntityAddress: string, key: string): Promise<string>
    /**
     * Sets the text of the ENS node and key.
     * May only be called by the owner of that node in the ENS registry.
     * @param hashedEntityAddress The ENS node to modify. @see ensHashAddress()
     * @param key The key to modify.
     * @param value The text to store.
     */
    setText(hashedEntityAddress: string, key: string, value: string, overrides?: IMethodOverrides): Promise<ContractTransaction>
}

/**
 * Hashes the address of an Entity to interact with the Entity Resolver contract
 * @param address
 */
export function ensHashAddress(address: string): string {
    return utils.keccak256(address)
}

///////////////////////////////////////////////////////////////////////////////
// PROCESS TYPES AND WRAPPERS
///////////////////////////////////////////////////////////////////////////////

// PROCESS MODE

export type IProcessMode = number

/** Wrapper class to enumerate and handle valid values of a process mode */
export class ProcessMode {
    private _mode: IProcessMode
    constructor(processMode: IProcessMode) {
        const allFlags = ProcessMode.AUTO_START | ProcessMode.INTERRUPTIBLE | ProcessMode.DYNAMIC_CENSUS | ProcessMode.ENCRYPTED_METADATA
        if (processMode > allFlags) throw new Error("Invalid process mode")

        this._mode = processMode
    }
    get value() { return this._mode }

    /** By default, the process is started on demand (PAUSED). If set, the process will sIf set, the process will work like `status=PAUSED` before `startBlock` and like `status=ENDED` after `startBlock + blockCount`. The process works on demand, by default.tart as READY and the Vochain will allow incoming votes after `startBlock` */
    public static AUTO_START: IProcessMode = 1 << 0
    /** By default, the process can't be paused, ended or canceled. If set, the process can be paused, ended or canceled by the creator. */
    public static INTERRUPTIBLE: IProcessMode = 1 << 1
    /** By default, the census is immutable. When set, the creator can update the census while the process remains `READY` or `PAUSED`. */
    public static DYNAMIC_CENSUS: IProcessMode = 1 << 2
    /** By default, the metadata is not encrypted. If set, clients should fetch the decryption key before trying to display the metadata. */
    public static ENCRYPTED_METADATA: IProcessMode = 1 << 3

    /** Returns the value that represents the given process mode */
    public static make(flags: { autoStart?: boolean, interruptible?: boolean, dynamicCensus?: boolean, encryptedMetadata?: boolean } = {}): IProcessMode {
        let result = 0
        result |= flags.autoStart ? ProcessMode.AUTO_START : 0
        result |= flags.interruptible ? ProcessMode.INTERRUPTIBLE : 0
        result |= flags.dynamicCensus ? ProcessMode.DYNAMIC_CENSUS : 0
        result |= flags.encryptedMetadata ? ProcessMode.ENCRYPTED_METADATA : 0
        return result
    }

    /** Returns true if the Vochain will not allow votes until `startBlock`. */
    get isAutoStart(): boolean { return (this._mode & ProcessMode.AUTO_START) != 0 }
    /** Returns true if the process can be paused, ended and canceled by the creator. */
    get isInterruptible(): boolean { return (this._mode & ProcessMode.INTERRUPTIBLE) != 0 }
    /** Returns true if the census can be updated by the creator. */
    get hasDynamicCensus(): boolean { return (this._mode & ProcessMode.DYNAMIC_CENSUS) != 0 }
    /** Returns true if the process metadata is expected to be encrypted. */
    get hasEncryptedMetadata(): boolean { return (this._mode & ProcessMode.ENCRYPTED_METADATA) != 0 }
}

// PROCESS ENVELOPE TYPE

export type IProcessEnvelopeType = number

/** Wrapper class to enumerate and handle valid values of a process envelope type */
export class ProcessEnvelopeType {
    private _type: IProcessEnvelopeType
    constructor(envelopeType: IProcessEnvelopeType) {
        const allFlags = ProcessEnvelopeType.SERIAL | ProcessEnvelopeType.ANONYMOUS | ProcessEnvelopeType.ENCRYPTED_VOTES | ProcessEnvelopeType.UNIQUE_VALUES
        if (envelopeType > allFlags) throw new Error("Invalid envelope type")
        this._type = envelopeType
    }
    get value() { return this._type }

    /** By default, all votes are sent within a single envelope. When set, the process questions are voted one by one (enables `questionIndex`). */
    public static SERIAL: IProcessEnvelopeType = 1 << 0
    /** By default, the franchise proof relies on an ECDSA signature (this could reveal the voter's identity). When set, the franchise proof will use ZK-Snarks. */
    public static ANONYMOUS: IProcessEnvelopeType = 1 << 1
    /** By default, votes are sent unencrypted. When the flag is set, votes are sent encrypted and become public when the process ends. */
    public static ENCRYPTED_VOTES: IProcessEnvelopeType = 1 << 2
    /** Whether choices for a question can only appear once or not. */
    public static UNIQUE_VALUES: IProcessEnvelopeType = 1 << 3

    /** Returns the value that represents the given envelope type */
    public static make(flags: { serial?: boolean, anonymousVoters?: boolean, encryptedVotes?: boolean, uniqueValues?: boolean } = {}): IProcessEnvelopeType {
        let result = 0
        result |= flags.serial ? ProcessEnvelopeType.SERIAL : 0
        result |= flags.anonymousVoters ? ProcessEnvelopeType.ANONYMOUS : 0
        result |= flags.encryptedVotes ? ProcessEnvelopeType.ENCRYPTED_VOTES : 0
        result |= flags.uniqueValues ? ProcessEnvelopeType.UNIQUE_VALUES : 0
        return result
    }

    /** Returns true if the process expects one envelope to be sent for each question. */
    get hasSerialVoting(): boolean { return (this._type & ProcessEnvelopeType.SERIAL) != 0 }
    /** Returns true if franchise proofs use ZK-Snarks. */
    get hasAnonymousVoters(): boolean { return (this._type & ProcessEnvelopeType.ANONYMOUS) != 0 }
    /** Returns true if envelopes are to be sent encrypted. */
    get hasEncryptedVotes(): boolean { return (this._type & ProcessEnvelopeType.ENCRYPTED_VOTES) != 0 }
    /** Returns true if choices must be unique per question. */
    get hasUniqueValues(): boolean { return (this._type & ProcessEnvelopeType.UNIQUE_VALUES) != 0 }
}

// PROCESS CENSUS ORIGIN

/** Wrapper class to enumerate and handle valid values of a process census origin */
export class ProcessCensusOrigin {
    private _status: IProcessCensusOrigin
    constructor(censusOrigin: IProcessCensusOrigin) {
        if (!processCensusOriginValues.includes(censusOrigin)) throw new Error("Invalid origin")
        this._status = censusOrigin
    }
    get value() { return this._status }

    /** The process will allow voters from an off-chain Census Merkle Root */
    public static OFF_CHAIN_TREE: IProcessCensusOrigin = 1
    /** The process will allow voters from an off-chain Census Merkle Root to submit weighted votes */
    public static OFF_CHAIN_TREE_WEIGHTED: IProcessCensusOrigin = 2
    /** The process will allow voters holding a valid signature from a predefined Public Key */
    public static OFF_CHAIN_CA: IProcessCensusOrigin = 3
    /** The process will allow voters holding assets on a predefined ERC20 token contract */
    public static ERC20: IProcessCensusOrigin = 11
    /** The process will allow voters holding assets on a predefined ERC721 token contract */
    public static ERC721: IProcessCensusOrigin = 12
    /** The process will allow voters holding assets on a predefined ERC1155 token contract */
    public static ERC1155: IProcessCensusOrigin = 13
    /** The process will allow voters holding assets on a predefined ERC777 token contract */
    public static ERC777: IProcessCensusOrigin = 14
    /** The process will allow voters holding assets on a predefined ERC20 (MiniMe) token contract */
    public static MINI_ME: IProcessCensusOrigin = 15

    get isOffChain(): boolean { return this._status == ProcessCensusOrigin.OFF_CHAIN_TREE }
    get isOffChainWeighted(): boolean { return this._status == ProcessCensusOrigin.OFF_CHAIN_TREE_WEIGHTED }
    get isOffChainCA(): boolean { return this._status == ProcessCensusOrigin.OFF_CHAIN_CA }
    get isErc20(): boolean { return this._status == ProcessCensusOrigin.ERC20 }
    get isErc721(): boolean { return this._status == ProcessCensusOrigin.ERC721 }
    get isErc1155(): boolean { return this._status == ProcessCensusOrigin.ERC1155 }
    get isErc777(): boolean { return this._status == ProcessCensusOrigin.ERC777 }
    get isMiniMe(): boolean { return this._status == ProcessCensusOrigin.MINI_ME }
}

export type IProcessCensusOrigin = 1 | 2 | 3 | 11 | 12 | 13 | 14 | 15
export const processCensusOriginValues = [
    ProcessCensusOrigin.OFF_CHAIN_TREE,
    ProcessCensusOrigin.OFF_CHAIN_TREE_WEIGHTED,
    ProcessCensusOrigin.OFF_CHAIN_CA,
    ProcessCensusOrigin.ERC20,
    ProcessCensusOrigin.ERC721,
    ProcessCensusOrigin.ERC1155,
    ProcessCensusOrigin.ERC777,
    ProcessCensusOrigin.MINI_ME
]

// PROCESS STATUS

/** Wrapper class to enumerate and handle valid values of a process status */
export class ProcessStatus {
    private _status: IProcessStatus
    constructor(processStatus: IProcessStatus) {
        if (!processStatusValues.includes(processStatus)) throw new Error("Invalid status")
        this._status = processStatus
    }
    get value() { return this._status }

    /** The process is ready to accept votes, according to `AUTO_START`, `startBlock` and `blockCount`. */
    public static READY: IProcessStatus = 0
    /** The creator has ended the process and the results will be available soon. */
    public static ENDED: IProcessStatus = 1
    /** The process has been canceled. Results will not be available anytime. */
    public static CANCELED: IProcessStatus = 2
    /** The process is temporarily paused and votes are not accepted at the time. It might be resumed in the future. */
    public static PAUSED: IProcessStatus = 3
    /** The process is ended and its results are available. */
    public static RESULTS: IProcessStatus = 4

    get isReady(): boolean { return this._status == ProcessStatus.READY }
    get isEnded(): boolean { return this._status == ProcessStatus.ENDED }
    get isCanceled(): boolean { return this._status == ProcessStatus.CANCELED }
    get isPaused(): boolean { return this._status == ProcessStatus.PAUSED }
    get hasResults(): boolean { return this._status == ProcessStatus.RESULTS }
}

export type IProcessStatus = 0 | 1 | 2 | 3 | 4
export const processStatusValues = [
    ProcessStatus.READY,
    ProcessStatus.ENDED,
    ProcessStatus.CANCELED,
    ProcessStatus.PAUSED,
    ProcessStatus.RESULTS
]

export class ProcessResults {
    private _results: IProcessResults
    constructor(tally: number[][], height: number) {
        if (!Array.isArray(tally) || tally.length < 1) throw new Error("Invalid tally")
        else if (typeof height === "undefined" || height < 1) throw new Error("Invalid height")

        this._results = { tally, height }
    }

    get value(): IProcessResults { return this._results }

    get tally(): number[][] { return this._results.tally }
    get height(): number { return this._results.height }

    set tally(tally: number[][]) { this._results.tally = tally }
    set height(height: number) { this._results.height = height }
}

export type IProcessResults = {
    tally: number[][],
    height: number,
}

export type IProcessCreateParams = {
    mode: ProcessMode | number,
    envelopeType: ProcessEnvelopeType | number,
    censusOrigin: ProcessCensusOrigin | number,
    tokenAddress?: string,
    metadata: string,
    censusRoot: string,
    censusUri?: string,
    startBlock: number,
    blockCount: number,
    questionCount: number,
    maxCount: number,
    maxValue: number,
    maxVoteOverwrites: number,
    maxTotalCost: number,
    costExponent: number,
    namespace: number,
    evmBlockHeight?: number,
    paramsSignature: string
}

type IProcessCreateParamsTuple = [
    number[], // mode_envelopeType_censusOrigin
    string,   // tokenContractAddress
    string[], // metadata_censusRoot_censusUri
    number[], // startBlock_blockCount
    number[], // questionCount_maxCount_maxValue_maxVoteOverwrites
    number[], // maxTotalCost_costExponent_namespace
    number, // evmBlockHeight
    string, // paramsSignature
    IMethodOverrides? // (Optional) Ethereum transaction overrides
]
type IProcessStateTuple = [
    number[], // mode_envelopeType_censusOrigin
    string,   // entityAddress
    string[], // metadata_censusRoot_censusUri
    number[], // startBlock_blockCount
    IProcessStatus, // status
    number[], // questionIndex_questionCount_maxCount_maxValue_maxVoteOverwrites
    number[], // maxTotalCost_costExponent_namespace
    BigNumber // evmBlockHeight
]

/** Smart Contract operations for a Voting Process contract */
export interface ProcessContractMethods {
    // HELPERS

    /** Retrieves the amount of processes that the entity has created */
    getEntityProcessCount(entityAddress: string): Promise<BigNumber>,
    /** Get the process ID that would be assigned to the next process */
    getNextProcessId(entityAddress: string, namespace: number): Promise<string>,
    /** Compute the process ID that corresponds to the given parameters */
    getProcessId(entityAddress: string, processCountIndex: number, namespace: number, chainId: number | BigNumber): Promise<string>,

    // GLOBAL VARIABLES
    /** The block at which the contract became active. If it is zero, then it still needs activation from its predecessor. */
    activationBlock(): Promise<BigNumber>
    /** The address of the contract in operation before us. It if is zero, it means that we are the first instance. */
    predecessorAddress(): Promise<string>
    /** The address of our successor. If zero, it means that we are the current active instance.
     * Otherwise, new processes need to be created on the last successor instance.
     */
    successorAddress(): Promise<string>
    /** The address of the contract that defined the details of all namespaces */
    namespaceAddress(): Promise<string>
    /** The address of the token storage proofs contract used by EVM census processes */
    tokenStorageProofAddress(): Promise<string>
    /** The chain ID of the Ethereum network where the contract lives */
    chainId(): Promise<BigNumber>

    // GETTERS

    /**
     * Retrieve the on-chain parameters for the given process:
     * 
     * ```[
        mode_envelopeType_censusOrigin: number[],
        entityAddress: string,  
        metadata_censusRoot_censusUri: string[],
        startBlock_blockCount: number[],
        status: IProcessStatus,
        questionIndex_questionCount_maxCount_maxValue_maxVoteOverwrites: number[],
        maxTotalCost_costExponent_namespace: number[]
     * ]```
     */
    get(processId: string): Promise<IProcessStateTuple>,
    /** Retrieve the available results for the given process */
    getParamsSignature(processId: string): Promise<{ paramsSignature: string }>
    /** Retrieve the available results for the given process */
    getResults(processId: string): Promise<IProcessResults>
    /** Gets the address of the process instance where the given processId was originally created. 
     * This allows to know where to send update transactions, after a fork has occurred. */
    getCreationInstance(processId): Promise<string>,

    // GLOBAL METHODS

    /** Sets the current instance as active, if not already */
    activate(overrides?: IMethodOverrides): Promise<ContractTransaction>,
    /** Sets the target instance as the successor and deactivates the current one */
    activateSuccessor(successor: string, overrides?: IMethodOverrides): Promise<ContractTransaction>,
    /** Updates the address of the contract holding the details of the active namespaces */
    setNamespaceAddress(namespaceAddr: string, overrides?: IMethodOverrides): Promise<ContractTransaction>,

    // PER-PROCESS METHODS

    /**
     * Publish a new voting process using the given parameters
     * 
     * ```[
        mode_envelopeType_censusOrigin: number[],
        metadata_censusRoot_censusUri: string[],
        tokenContractAddress: string,  
        startBlock_blockCount: number[],
        questionCount_maxCount_maxValue_maxVoteOverwrites: number[],
        maxTotalCost_costExponent_namespace: number[],
        paramsSignature: string,
        overrides?: IMethodOverrides?
     * ]```
     * */
    newProcess(...args: IProcessCreateParamsTuple): Promise<ContractTransaction>,
    /** Update the process status that corresponds to the given ID */
    setStatus(processId: string, status: IProcessStatus, overrides?: IMethodOverrides): Promise<ContractTransaction>,
    /** Increments the index of the current question (only when INCREMENTAL mode is set) */
    incrementQuestionIndex(processId: string, overrides?: IMethodOverrides): Promise<ContractTransaction>
    /** Updates the census of the given process (only if the mode allows dynamic census) */
    setCensus(processId: string, censusRoot: string, censusUri: string, overrides?: IMethodOverrides): Promise<ContractTransaction>,
    /** Sets the given results for the given process */
    setResults(processId: string, tally: number[][], height: number, overrides?: IMethodOverrides): Promise<ContractTransaction>,
    /** Adds the given signature to the given process results */
    addResultsSignature(processId: string, signature: string, overrides?: IMethodOverrides): Promise<ContractTransaction>,
    /** Adds the given proof to the given process results */
    addResultsProof(processId: string, proof: string, overrides?: IMethodOverrides): Promise<ContractTransaction>,
}

/** Wraps and unwraps the parameters sent to `Process.newProcess()` and obtained from `Process.get()` for convenience */
export class ProcessContractParameters {
    mode: ProcessMode;
    envelopeType: ProcessEnvelopeType;
    censusOrigin: ProcessCensusOrigin;
    entityAddress?: string;
    metadata: string;
    censusRoot: string;
    censusUri: string;
    startBlock: number;
    blockCount: number;
    status?: ProcessStatus;
    questionIndex?: number;
    questionCount: number;
    maxCount: number;
    maxValue: number;
    maxVoteOverwrites: number;
    maxTotalCost: number;
    costExponent: number;
    namespace: number;
    evmBlockHeight: number;
    paramsSignature?: string;

    /** Parse a plain parameters object  */
    static fromParams(params: IProcessCreateParams): ProcessContractParameters {
        // Integrity checks
        if (!params.metadata)
            throw new Error("Invalid metadata")
        else if (!params.censusRoot)
            throw new Error("Invalid censusRoot")
        // censusUri > see below
        else if (params.questionCount < 1 || params.questionCount > 255)
            throw new Error("Invalid questionCount")
        else if (params.maxCount < 1 || params.maxCount > 255)
            throw new Error("Invalid maxCount")
        else if (params.maxValue < 1 || params.maxValue > 255)
            throw new Error("Invalid maxValue")
        else if (params.maxVoteOverwrites < 0 || params.maxVoteOverwrites > 255)
            throw new Error("Invalid maxVoteOverwrites")
        // uniqueValues is either falsy or truthy
        else if (params.maxTotalCost < 0 || params.maxTotalCost > 65355)
            throw new Error("Invalid maxTotalCost")
        else if (params.costExponent < 0 || params.costExponent > 65355)
            throw new Error("Invalid costExponent")
        else if (params.namespace < 0 || params.namespace > 65355)
            throw new Error("Invalid namespace")
        // evmBlockHeight > see below
        else if (!params.paramsSignature)
            throw new Error("Invalid paramsSignature")

        const result = new ProcessContractParameters()

        // Direct assignations
        if (typeof params.mode == "number") result.mode = new ProcessMode(params.mode) // Fail on error
        else result.mode = params.mode

        if (typeof params.envelopeType == "number") result.envelopeType = new ProcessEnvelopeType(params.envelopeType) // Fail on error
        else result.envelopeType = params.envelopeType

        if (typeof params.censusOrigin == "number") result.censusOrigin = new ProcessCensusOrigin(params.censusOrigin as IProcessCensusOrigin) // Fail on error
        else result.censusOrigin = params.censusOrigin

        if (result.censusOrigin.isOffChain || result.censusOrigin.isOffChainWeighted || result.censusOrigin.isOffChainCA) {
            if (!params.censusUri)
                throw new Error("Invalid censusUri")
        } else {
            if (!result.mode.isAutoStart) {
                throw new Error("Auto start is mandatory on EVM processes")
            }
            else if (result.mode.isInterruptible) {
                throw new Error("EVM processes cannot be interruptible")
            }
            else if (result.mode.hasDynamicCensus) {
                throw new Error("EVM processes cannot have dynamic censuses")
            }
            else if (!params.evmBlockHeight || typeof params.evmBlockHeight != "number" || params.evmBlockHeight < 0) {
                throw new Error("Invalid evmBlockHeight for an EVM census-based process")
            }
        }

        result.entityAddress = params.tokenAddress || "0x0000000000000000000000000000000000000000"
        result.metadata = params.metadata
        result.censusRoot = params.censusRoot
        result.censusUri = params.censusUri || ""
        result.startBlock = params.startBlock
        result.blockCount = params.blockCount
        result.questionCount = params.questionCount
        result.maxCount = params.maxCount
        result.maxValue = params.maxValue
        result.maxVoteOverwrites = params.maxVoteOverwrites
        result.maxTotalCost = params.maxTotalCost
        result.costExponent = params.costExponent
        result.namespace = params.namespace
        result.evmBlockHeight = params.evmBlockHeight || 0
        result.paramsSignature = params.paramsSignature

        return result
    }

    /**
     * Convert the output data from `get()` into a JSON object.
     * NOTE: `paramsSignature` is not defined within `params`, so it will be null.
     * */
    static fromContract(params: IProcessStateTuple): ProcessContractParameters {
        const result = new ProcessContractParameters()

        if (!Array.isArray(params) || params.length != 8)
            throw new Error("Invalid parameters list")
        else if (!Array.isArray(params[0]) ||
            params[0].length != 3 ||
            params[0].some((item) => typeof item != "number"))
            throw new Error("Invalid parameters mode_envelopeType_censusOrigin list")

        result.mode = new ProcessMode(params[0][0])
        result.envelopeType = new ProcessEnvelopeType(params[0][1])
        result.censusOrigin = new ProcessCensusOrigin(params[0][2] as IProcessCensusOrigin)

        if (typeof params[1] != "string") throw new Error("Invalid entityAddress")
        result.entityAddress = params[1]

        if (!Array.isArray(params[2]) || params[2].length != 3 || params[2].some((item) => typeof item != "string"))
            throw new Error("Invalid parameters metadata_censusRoot_censusUri list")

        result.metadata = params[2][0]
        result.censusRoot = params[2][1]
        result.censusUri = params[2][2]

        if (!Array.isArray(params[3]) || typeof params[3][0] != "number")
            throw new Error("Invalid startBlock")

        result.startBlock = params[3][0]

        if (typeof params[3][1] != "number") throw new Error("Invalid blockCount")
        result.blockCount = params[3][1]

        if (typeof params[4] != "number") throw new Error("Invalid status")
        result.status = new ProcessStatus(params[4])

        if (!Array.isArray(params[5]) || params[5].length != 5 || params[5].some((item) => typeof item != "number"))
            throw new Error("Invalid parameters questionIndex_questionCount_maxCount_maxValue_maxVoteOverwrites list")
        result.questionIndex = params[5][0]
        result.questionCount = params[5][1]
        result.maxCount = params[5][2]
        result.maxValue = params[5][3]
        result.maxVoteOverwrites = params[5][4]

        if (!Array.isArray(params[6]) || params[6].length != 3 || params[6].some((item) => typeof item != "number"))
            throw new Error("Invalid parameters maxTotalCost_costExponent_namespace list")

        result.maxTotalCost = params[6][0]
        result.costExponent = params[6][1]
        result.namespace = params[6][2]

        if (typeof params[7] == "number") result.evmBlockHeight = params[7]
        else if (params[7] && params[7]._isBigNumber) result.evmBlockHeight = params[7].toNumber()
        else throw new Error("Invalid blockCount")

        result.paramsSignature = null

        return result
    }

    /**
     * Arrange the JSON object into the parameters for `newProcess()`
     * 
     * @param transactionOptions Optional parameters to pass to the deployment contract transaction (ethers.js)
     */
    toContractParams(transactionOptions?: IMethodOverrides): IProcessCreateParamsTuple {
        const paramsResult: IProcessCreateParamsTuple = [
            [this.mode.value, this.envelopeType.value, this.censusOrigin.value], // int mode_envelopeType_censusOrigin
            this.entityAddress,
            [
                this.metadata,
                this.censusRoot,
                this.censusUri || "ipfs://"
            ], // String metadata_censusRoot_censusUri
            [this.startBlock, this.blockCount], // int startBlock_blockCount
            [
                this.questionCount,
                this.maxCount,
                this.maxValue,
                this.maxVoteOverwrites
            ], // int questionCount_maxCount_maxValue_maxVoteOverwrites
            [this.maxTotalCost, this.costExponent, this.namespace], // int maxTotalCost_costExponent_namespace
            this.evmBlockHeight, // uint256 evmBlockHeight
            this.paramsSignature // String paramsSignature
        ]
        if (transactionOptions) paramsResult.push(transactionOptions)
        return paramsResult
    }
}

///////////////////////////////////////////////////////////////////////////////
// NAMESPACE TYPES
///////////////////////////////////////////////////////////////////////////////

/** Smart Contract operations for a Namespace */
export interface NamespaceContractMethods {
    // GETTERS

    /** Retrieve all the fields of the given namespace: `[ chainId: string, genesis: string,validators: string[],oracles: string[] ]` */
    getNamespace(namespace: number): Promise<[string, string, string[], string[]]>,
    /** Checks whether the given public key is registered as a validator in the given namespace */
    isValidator(namespace: number, validatorPublicKey: string): Promise<boolean>,
    /** Checks whether the given address is registered as an oracle in the given namespace */
    isOracle(namespace: number, oracleAddress: string): Promise<boolean>,

    // SETTERS
    setNamespace(namespace: number, chainId: string, genesis: string, validators: string[], oracles: string[], overrides?: IMethodOverrides): Promise<ContractTransaction>,
    /** Update the Chain ID of the given namespace */
    setChainId(namespace: number, chainId: string, overrides?: IMethodOverrides): Promise<ContractTransaction>,
    /** Update the genesis of the given namespace */
    setGenesis(namespace: number, genesisData: string, overrides?: IMethodOverrides): Promise<ContractTransaction>,
    /** Registers the public key of a new validator */
    addValidator(namespace: number, validatorPublicKey: string, overrides?: IMethodOverrides): Promise<ContractTransaction>,
    /** Removes the public key at the given index for a validator */
    removeValidator(namespace: number, idx: number, validatorPublicKey: string, overrides?: IMethodOverrides): Promise<ContractTransaction>,
    /** Registers the address of a new oracle */
    addOracle(namespace: number, oracleAddr: string, overrides?: IMethodOverrides): Promise<ContractTransaction>,
    /** Removes the address at the given index for an oracle */
    removeOracle(namespace: number, idx: number, oracleAddr: string, overrides?: IMethodOverrides): Promise<ContractTransaction>,
}

///////////////////////////////////////////////////////////////////////////////
// STORAGE PROOF TYPES
///////////////////////////////////////////////////////////////////////////////

/** Smart Contract operations for Storage Proofs */
export interface TokenStorageProofContractMethods {
    // GETTERS

    /** Determines whether the given address is registered as an ERC token contract */
    isRegistered(ercTokenAddress: string): Promise<boolean>

    /** Retrieves the token addresses registered at the given index. If it doesn't exist, the request throws an error. */
    tokenAddresses(idx: number): Promise<string>,

    /** Retrieves the amount of ERC20 tokens registered on the contract.  */
    tokenCount(): Promise<number>,

    /** Fetches a Merkle Proof for the sender, validating that he/she had some balance on the contract at a given block number */
    getProof(ercTokenAddress: string, blockNumber: number | BigNumber): Promise<Buffer>

    /** Fetches a Merkle Proof for the sender, validating that he/she had some balance on the contract at a given block number */
    getBalance(token: string, holder: string, blockNumber: number | BigNumber, storageProof: Buffer, balanceMappingPosition: number): Promise<BigNumber>

    /** Fetches the balance mapping position stored for a given token */
    getBalanceMappingPosition(ercTokenAddress: string): Promise<BigNumber>

    /** Fetches the storage root for an account of the State Trie on a specific lock number */
    getStorageRoot(account: string, blockNumber: number | BigNumber, blockHeaderRLP: Buffer, accountStateProof: Buffer): Promise<String>

    /** Fetches the storage content of the Storage Tree of an account on the State trie given a proof for that account */
    getStorage(slot: number | BigNumber, stateRoot: string, storageProof: Buffer): Promise<BigNumber>

    /** Fetches the holder storage slot given the holder address */
    getHolderBalanceSlot(holder: string, balanceMappingPosition: number | BigNumber)

    /** Fetches the balance of a holder of a token and validates the data through merkle proofs */
    getBalance(token: string, holder: string, blockNumber: number | BigNumber, blockHeaderRLP: Buffer, accountStateProof: Buffer, storageProof: Buffer, balanceMappingPosition: number | BigNumber): Promise<BigNumber>

    /** Fetches the block header State root hash given an RLP encoded block */
    getBlockHeaderStateRoot(blockHeaderRLP: Buffer, blockhash: string): Promise<string>

    // SETTERS

    /** Checks that the given contract is an ERC token, validates that the balance of the sender matches the one obtained from the storage position and registers the token address */
    registerToken(tokenAddress: string, balanceMappingPosition: number | BigNumber, blockNumber: number | BigNumber, blockHeaderRLP: Buffer, accountStateProof: Buffer, storageProof: Buffer, overrides?: IMethodOverrides): Promise<ContractTransaction>
}

///////////////////////////////////////////////////////////////////////////////
// STORAGE PROOF TEST TYPES
///////////////////////////////////////////////////////////////////////////////

/** Smart Contract operations for Storage Proofs Test */
export interface TokenStorageProofTestContractMethods {
    exposedVerify(siblings: Buffer, rootHash: string, key: string): Promise<string>
    testVerify(): Promise<number | BigNumber>
    testExclusion(): Promise<string>
    verifyAccountProof(proof: Buffer, hash: string, account: string): Promise<string>
}
