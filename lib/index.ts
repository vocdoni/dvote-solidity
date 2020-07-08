import * as EntityResolver from "./entity-resolver.json"
import * as Process from "./process.json"
import * as Namespace from "./namespace.json"

import { ContractTransaction } from "ethers"
import { BigNumber } from "ethers/utils"

///////////////////////////////////////////////////////////////////////////////
// SMART CONTRACTS ABI + BYTECODE
///////////////////////////////////////////////////////////////////////////////

export { EntityResolver }
export { Process }
export { Namespace }

///////////////////////////////////////////////////////////////////////////////
// ENTITY RESOLVER TYPES
///////////////////////////////////////////////////////////////////////////////

/** Custom Smart Contract operations for an Entity Resolver contract */
export type EntityResolverContractMethods = {
    /** Whether the resolver supports an interface */
    supportsInterface(interfaceID: string): Promise<boolean>

    /** Get the entity ID for a given Ethereum address */
    getEntityId(entityAddress: string): Promise<string>

    /** Get the address associated with the given node */
    addr(node: string): Promise<string>
    /** Sets the address for the given node */
    setAddr(node: string, address: string): Promise<ContractTransaction>

    /**
     * Returns the text associated with an ENS node and key.
     * @param entityId The ENS node to query.
     * @param key The key to retrieve.
     * @return The record's text.
     */
    text(entityId: string, key: string): Promise<string>
    /**
     * Sets the text of the ENS node and key.
     * May only be called by the owner of that node in the ENS registry.
     * @param entityId The ENS node to modify.
     * @param key The key to modify.
     * @param value The text to store.
     */
    setText(entityId: string, key: string, value: string): Promise<ContractTransaction>

    /**
     * Returns the list associated with an ENS node and key.
     * @param entityId The ENS node to query.
     * @param key The key of the list.
     * @return The list array of values.
     */
    list(entityId: string, key: string): Promise<string[]>
    /**
     * Returns the text associated with an ENS node, key and index.
     * @param entityId The ENS node to query.
     * @param key The key of the list.
     * @param index The index within the list to retrieve.
     * @return The list entry's text value.
     */
    listText(entityId: string, key: string, index: number): Promise<string>
    /**
     * Sets the text of the ENS node, key and index.
     * May only be called by the owner of that node in the ENS registry.
     * @param entityId The ENS node to modify.
     * @param key The key of the list to modify.
     * @param index The index of the list to set.
     * @param value The text to store.
     */
    setListText(entityId: string, key: string, index: number, value: string): Promise<ContractTransaction>
    /**
     * Appends a new value on the given ENS node and key.
     * May only be called by the owner of that node in the ENS registry.
     * @param entityId The ENS node to modify.
     * @param key The key of the list to modify.
     * @param value The text to store.
     */
    pushListText(entityId: string, key: string, value: string): Promise<ContractTransaction>
    /**
     * Removes the value on the ENS node, key and index.
     * May only be called by the owner of that node in the ENS registry.
     * Note: This may cause items to be arranged in a different order.
     * @param entityId The ENS node to modify.
     * @param key The key of the list to modify.
     * @param index The index to remove.
     */
    removeListIndex(entityId: string, key: string, index: number): Promise<ContractTransaction>
}

///////////////////////////////////////////////////////////////////////////////
// VOTING PROCESS FLAGS
///////////////////////////////////////////////////////////////////////////////

export type IProcessMode = number

/** Wrapper class to enumerate and handle valid values of a process mode */
export class ProcessMode {
    private _mode: IProcessMode
    constructor(processMode: IProcessMode) {
        const allFlags = ProcessMode.AUTO_START | ProcessMode.INTERRUPTIBLE | ProcessMode.DYNAMIC_CENSUS | ProcessMode.ALLOW_VOTE_OVERWRITE | ProcessMode.ENCRYPTED_METADATA
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
    /** By default, the first valid vote is final. If set, users will be allowed to vote up to `maxVoteOverwrites` times and the last valid vote will be counted. */
    public static ALLOW_VOTE_OVERWRITE: IProcessMode = 1 << 3
    /** By default, the metadata is not encrypted. If set, clients should fetch the decryption key before trying to display the metadata. */
    public static ENCRYPTED_METADATA: IProcessMode = 1 << 4

    /** Returns the value that represents the given process mode */
    public static make(flags: { autoStart?: boolean, interruptible?: boolean, dynamicCensus?: boolean, allowVoteOverwrite?: boolean, encryptedMetadata?: boolean } = {}): IProcessMode {
        let result = 0
        result |= flags.autoStart ? ProcessMode.AUTO_START : 0
        result |= flags.interruptible ? ProcessMode.INTERRUPTIBLE : 0
        result |= flags.dynamicCensus ? ProcessMode.DYNAMIC_CENSUS : 0
        result |= flags.allowVoteOverwrite ? ProcessMode.ALLOW_VOTE_OVERWRITE : 0
        result |= flags.encryptedMetadata ? ProcessMode.ENCRYPTED_METADATA : 0
        return result
    }

    /** Returns true if the Vochain will not allow votes until `startBlock`. */
    get isAutoStart(): boolean { return (this._mode & ProcessMode.AUTO_START) != 0 }
    /** Returns true if the process can be paused, ended and canceled by the creator. */
    get isInterruptible(): boolean { return (this._mode & ProcessMode.INTERRUPTIBLE) != 0 }
    /** Returns true if the census can be updated by the creator. */
    get hasDynamicCensus(): boolean { return (this._mode & ProcessMode.DYNAMIC_CENSUS) != 0 }
    /** Returns true if voters can overwrite their last vote. */
    get allowsVoteOverwrite(): boolean { return (this._mode & ProcessMode.ALLOW_VOTE_OVERWRITE) != 0 }
    /** Returns true if the process metadata is expected to be encrypted. */
    get hasEncryptedMetadata(): boolean { return (this._mode & ProcessMode.ENCRYPTED_METADATA) != 0 }
}

export type IProcessEnvelopeType = number

/** Wrapper class to enumerate and handle valid values of a process envelope type */
export class ProcessEnvelopeType {
    private _type: IProcessEnvelopeType
    constructor(envelopeType: IProcessEnvelopeType) {
        const allFlags = ProcessEnvelopeType.SERIAL | ProcessEnvelopeType.ANONYMOUS | ProcessEnvelopeType.ENCRYPTED_VOTES
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

    /** Returns the value that represents the given envelope type */
    public static make(flags: { serial?: boolean, anonymousVoters?: boolean, encryptedVotes?: boolean } = {}): IProcessEnvelopeType {
        let result = 0
        result |= flags.serial ? ProcessEnvelopeType.SERIAL : 0
        result |= flags.anonymousVoters ? ProcessEnvelopeType.ANONYMOUS : 0
        result |= flags.encryptedVotes ? ProcessEnvelopeType.ENCRYPTED_VOTES : 0
        return result
    }

    /** Returns true if the process expects one envelope to be sent for each question. */
    get hasSerialVoting(): boolean { return (this._type & ProcessEnvelopeType.SERIAL) != 0 }
    /** Returns true if franchise proofs use ZK-Snarks. */
    get hasAnonymousVoters(): boolean { return (this._type & ProcessEnvelopeType.ANONYMOUS) != 0 }
    /** Returns true if envelopes are to be sent encrypted. */
    get hasEncryptedVotes(): boolean { return (this._type & ProcessEnvelopeType.ENCRYPTED_VOTES) != 0 }
}

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

export type IProcessCreateParams = {
    mode: ProcessMode | number,
    envelopeType: ProcessEnvelopeType | number,
    metadata: string,
    censusMerkleRoot: string,
    censusMerkleTree: string,
    startBlock: number | BigNumber,
    blockCount: number,
    questionCount: number,
    maxCount: number,
    maxValue: number,
    maxVoteOverwrites: number,
    uniqueValues: boolean,
    maxTotalCost: number,
    costExponent: number,
    namespace: number,
    paramsSignature: string
}

type IProcessCreateParamsTuple = [
    number[], // mode_envelopeType
    string[], // metadata_censusMerkleRoot_censusMerkleTree
    number | BigNumber, // startBlock
    number, // blockCount
    number[], // questionCount_maxCount_maxValue_maxVoteOverwrites
    boolean, // uniqueValues
    number[], // maxTotalCost_costExponent
    number, // namespace
    string // paramsSignature
]
type IProcessStateTuple = [
    number[], // mode_envelopeType
    string, // entityAddress
    string[], // metadata_censusMerkleRoot_censusMerkleTree
    BigNumber, // startBlock
    number, // blockCount
    IProcessStatus, // status
    number[], // questionIndex_questionCount_maxCount_maxValue_maxVoteOverwrites
    boolean, // uniqueValues
    number[] // maxTotalCost_costExponent_namespace
]

/** Smart Contract operations for a Voting Process contract */
export interface ProcessContractMethods {
    // HELPERS

    /** Retrieves the amount of processes that the entity has created */
    getEntityProcessCount(entityAddress: string): Promise<BigNumber>,
    /** Get the process ID that would be assigned to the next process */
    getNextProcessId(entityAddress: string, namespace: number): Promise<string>,
    /** Compute the process ID that corresponds to the given parameters */
    getProcessId(entityAddress: string, processCountIndex: number, namespace: number): Promise<string>,

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

    // GETTERS

    /**
     * Retrieve the on-chain parameters for the given process:
     * 
     * ```[
        mode_envelopeType: number[],
        entityAddress: string,
        startBlock: BigNumber,
        blockCount: number,
        metadata_censusMerkleRoot_censusMerkleTree: string[],
        status: IProcessStatus,
        questionIndex_questionCount_maxCount_maxValue_maxVoteOverwrites: number[],
        uniqueValues: boolean,
        maxTotalCost_costExponent: number[],
        namespace: number,
        paramsSignature: string
     * ]```
     */
    get(processId: string): Promise<IProcessStateTuple>,
    /** Retrieve the available results for the given process */
    getParamsSignature(processId: string): Promise<{ paramsSignature: string }>
    /** Retrieve the available results for the given process */
    getResults(processId: string): Promise<{ results: string }>
    /** Gets the address of the process instance where the given processId was originally created. 
     * This allows to know where to send update transactions, after a fork has occurred. */
    getCreationInstance(processId): Promise<string>,

    // GLOBAL METHODS

    /** Sets the current instance as active, if not already */
    activate(): Promise<ContractTransaction>,
    /** Sets the target instance as the successor and deactivates the current one */
    activateSuccessor(successor: string): Promise<ContractTransaction>,
    /** Updates the address of the contract holding the details of the active namespaces */
    setNamespaceAddress(namespaceAddr: string): Promise<ContractTransaction>,

    // PER-PROCESS METHODS

    /**
     * Publish a new voting process using the given parameters
     * 
     * ```[
        mode_envelopeType: number[], 
        metadata_censusMerkleRoot_censusMerkleTree: string[], 
        startBlock: number | BigNumber, 
        blockCount: number, 
        questionCount_maxCount_maxValue_maxVoteOverwrites: number[], 
        uniqueValues: boolean, 
        maxTotalCost_costExponent: number[], 
        namespace: number, 
        paramsSignature: string 
     * ]```
     * */
    newProcess(...args: IProcessCreateParamsTuple): Promise<ContractTransaction>,
    /** Update the process status that corresponds to the given ID */
    setStatus(processId: string, status: IProcessStatus): Promise<ContractTransaction>,
    /** Increments the index of the current question (only when INCREMENTAL mode is set) */
    incrementQuestionIndex(processId: string): Promise<ContractTransaction>
    /** Updates the census of the given process (only if the mode allows dynamic census) */
    setCensus(processId: string, censusMerkleRoot: string, censusMerkleTree: string): Promise<ContractTransaction>,
    /** Sets the given results for the given process */
    setResults(processId: string, results: string): Promise<ContractTransaction>,
}

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
    setNamespace(namespace: number, chainId: string, genesis: string, validators: string[], oracles: string[]): Promise<ContractTransaction>,
    /** Update the Chain ID of the given namespace */
    setChainId(namespace: number, chainId: string): Promise<ContractTransaction>,
    /** Update the genesis of the given namespace */
    setGenesis(namespace: number, genesisData: string): Promise<ContractTransaction>,
    /** Registers the public key of a new validator */
    addValidator(namespace: number, validatorPublicKey: string): Promise<ContractTransaction>,
    /** Removes the public key at the given index for a validator */
    removeValidator(namespace: number, idx: number, validatorPublicKey: string): Promise<ContractTransaction>,
    /** Registers the address of a new oracle */
    addOracle(namespace: number, oracleAddr: string): Promise<ContractTransaction>,
    /** Removes the address at the given index for an oracle */
    removeOracle(namespace: number, idx: number, oracleAddr: string): Promise<ContractTransaction>,
}

// HELPERS

/** Wraps and unwraps the parameters sent to `Process.newProcess()` and obtained from `Process.get()` for convenience */
export class ProcessContractParameters {
    mode: ProcessMode;
    envelopeType: ProcessEnvelopeType;
    entityAddress?: string;
    metadata: string;
    censusMerkleRoot: string;
    censusMerkleTree: string;
    startBlock: number;
    blockCount: number;
    status?: ProcessStatus;
    questionIndex?: number;
    questionCount: number;
    maxCount: number;
    maxValue: number;
    maxVoteOverwrites: number;
    uniqueValues: boolean;
    maxTotalCost: number;
    costExponent: number;
    namespace: number;
    paramsSignature?: string;
    results?: string;

    /** Parse a plain parameters object  */
    static fromParams(params: IProcessCreateParams): ProcessContractParameters {
        // Integrity checks
        if (params.metadata.length == 0)
            throw new Error("Invalid metadata")
        else if (params.censusMerkleRoot.length == 0)
            throw new Error("Invalid censusMerkleRoot")
        else if (params.censusMerkleTree.length == 0)
            throw new Error("Invalid censusMerkleTree")
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
        else if (params.paramsSignature.length == 0)
            throw new Error("Invalid paramsSignature")

        const result = new ProcessContractParameters()

        // Direct assignations
        if (typeof params.mode == "number") result.mode = new ProcessMode(params.mode) // Fail on error
        else result.mode = params.mode

        if (typeof params.envelopeType == "number") result.envelopeType = new ProcessEnvelopeType(params.envelopeType) // Fail on error
        else result.envelopeType = params.envelopeType

        result.metadata = params.metadata
        result.censusMerkleRoot = params.censusMerkleRoot
        result.censusMerkleTree = params.censusMerkleTree
        result.startBlock = typeof params.startBlock == "number" ? params.startBlock : params.startBlock.toNumber()
        result.blockCount = params.blockCount
        result.questionCount = params.questionCount
        result.maxCount = params.maxCount
        result.maxValue = params.maxValue
        result.maxVoteOverwrites = params.maxVoteOverwrites
        result.uniqueValues = !!params.uniqueValues
        result.maxTotalCost = params.maxTotalCost
        result.costExponent = params.costExponent
        result.namespace = params.namespace
        result.paramsSignature = params.paramsSignature

        return result
    }

    /** Convert the output data from `get()` into a JSON object */
    static fromContract(params: IProcessStateTuple): ProcessContractParameters {
        const result = new ProcessContractParameters()

        if (!Array.isArray(params) || params.length != 9)
            throw new Error("Invalid parameters list")
        else if (!Array.isArray(params[0]) ||
            params[0].length != 2 ||
            params[0].some((item) => typeof item != "number"))
            throw new Error("Invalid parameters mode_envelopeType list")

        result.mode = new ProcessMode(params[0][0])
        result.envelopeType = new ProcessEnvelopeType(params[0][1])

        if (typeof params[1] != "string") throw new Error("Invalid entityAddress")
        result.entityAddress = params[1]

        if (!Array.isArray(params[2]) || params[2].length != 3 || params[2].some((item) => typeof item != "string"))
            throw new Error("Invalid parameters metadata_censusMerkleRoot_censusMerkleTree list")

        result.metadata = params[2][0]
        result.censusMerkleRoot = params[2][1]
        result.censusMerkleTree = params[2][2]

        if (!(params[3] instanceof BigNumber || typeof params[3] == "number"))
            throw new Error("Invalid startBlock")

        result.startBlock = params[3].toNumber()

        if (typeof params[4] != "number") throw new Error("Invalid blockCount")
        result.blockCount = params[4]

        if (typeof params[5] != "number") throw new Error("Invalid status")
        result.status = new ProcessStatus(params[5])

        if (!Array.isArray(params[6]) || params[6].length != 5 || params[6].some((item) => typeof item != "number"))
            throw new Error("Invalid parameters questionIndex_questionCount_maxCount_maxValue_maxVoteOverwrites list")
        result.questionIndex = params[6][0]
        result.questionCount = params[6][1]
        result.maxCount = params[6][2]
        result.maxValue = params[6][3]
        result.maxVoteOverwrites = params[6][4]

        if (typeof params[7] != "boolean") throw new Error("Invalid uniqueParams")
        result.uniqueValues = params[7]

        if (!Array.isArray(params[8]) || params[8].length != 3 || params[8].some((item) => typeof item != "number"))
            throw new Error("Invalid parameters maxTotalCost_costExponent_namespace list")

        result.maxTotalCost = params[8][0]
        result.costExponent = params[8][1]
        result.namespace = params[8][2]

        return result
    }

    /** Arrange the JSON object into the parameters for `newProcess()` */
    toContractParams(): IProcessCreateParamsTuple {
        return [
            [this.mode.value, this.envelopeType.value], // int mode_envelopeType
            [
                this.metadata,
                this.censusMerkleRoot,
                this.censusMerkleTree
            ], // String metadata_censusMerkleRoot_censusMerkleTree
            this.startBlock, // BigNumber startBlock
            this.blockCount, // int blockCount
            [
                this.questionCount,
                this.maxCount,
                this.maxValue,
                this.maxVoteOverwrites
            ], // int questionCount_maxCount_maxValue_maxVoteOverwrites
            this.uniqueValues, // bool uniqueValues
            [this.maxTotalCost, this.costExponent], // int maxTotalCost_costExponent
            this.namespace, // int namespace
            this.paramsSignature // String paramsSignature
        ];
    }
}
