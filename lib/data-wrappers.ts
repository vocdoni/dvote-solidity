import { IProcessCreateEvmParamsTuple, IProcessCreateStdParamsTuple, IProcessStateTuple } from "./contract-definitions"
import { IMethodOverrides } from "./contract-utils"

///////////////////////////////////////////////////////////////////////////////
// PROCESS CONTRACT
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
        const allFlags = ProcessEnvelopeType.SERIAL | ProcessEnvelopeType.ANONYMOUS | ProcessEnvelopeType.ENCRYPTED_VOTES | ProcessEnvelopeType.UNIQUE_VALUES | ProcessEnvelopeType.COST_FROM_WEIGHT
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
    /** If true On EVM-based census processes (weighted), the user's balance will be used as the maxCost. This allows splitting the voting power among several choices, even including quadratic voting scenarios. */
    public static COST_FROM_WEIGHT: IProcessEnvelopeType = 1 << 4
    /** Returns the value that represents the given envelope type */
    public static make(flags: { serial?: boolean, anonymousVoters?: boolean, encryptedVotes?: boolean, uniqueValues?: boolean, costFromWeight?: boolean } = {}): IProcessEnvelopeType {
        let result = 0
        result |= flags.serial ? ProcessEnvelopeType.SERIAL : 0
        result |= flags.anonymousVoters ? ProcessEnvelopeType.ANONYMOUS : 0
        result |= flags.encryptedVotes ? ProcessEnvelopeType.ENCRYPTED_VOTES : 0
        result |= flags.uniqueValues ? ProcessEnvelopeType.UNIQUE_VALUES : 0
        result |= flags.costFromWeight ? ProcessEnvelopeType.COST_FROM_WEIGHT: 0
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
    /** Returns true if cost from weight is activated */
    get hasCostFromWeight(): boolean { return (this._type & ProcessEnvelopeType.COST_FROM_WEIGHT) != 0}
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

// PROCESS CREATION/RETRIEVAL PARAMTERES

/** Wraps and unwraps the parameters sent to `Process.newProcessStd()` and to `Process.newProcessEvm()` and obtained from `Process.get()` for convenience */
export class ProcessContractParameters {
    mode: ProcessMode = new ProcessMode(ProcessMode.make());
    envelopeType: ProcessEnvelopeType = new ProcessEnvelopeType(ProcessEnvelopeType.make());
    censusOrigin: ProcessCensusOrigin = new ProcessCensusOrigin(ProcessCensusOrigin.OFF_CHAIN_TREE);
    /** Entity or Token Address */
    entityAddress?: string | undefined | null;
    owner?: string | undefined | null;
    metadata: string = "";
    censusRoot: string = "";
    censusUri?: string | undefined | null;
    startBlock: number = 0;
    blockCount: number = 1;
    status: ProcessStatus = new ProcessStatus(ProcessStatus.READY);
    questionIndex?: number = 0;
    questionCount: number = 0;
    maxCount: number = 0;
    maxValue: number = 0;
    maxVoteOverwrites: number = 0;
    maxTotalCost: number = 0;
    costExponent: number = 0;
    sourceBlockHeight?: number;
    paramsSignature?: string | undefined | null;

    constructor (processContractParameters?: Partial<ProcessContractParameters>) {
        Object.assign(this, processContractParameters)
    }

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
        // sourceBlockHeight > see below
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
            else if (!params.sourceBlockHeight || typeof params.sourceBlockHeight != "number" || params.sourceBlockHeight < 0) {
                throw new Error("Invalid sourceBlockHeight for an EVM census-based process")
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
        result.sourceBlockHeight = params.sourceBlockHeight
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

        /*
        if (typeof params[1] != "string") throw new Error("Invalid entityAddress")
        result.entityAddress = params[1]
        */
        if (!Array.isArray(params[1]) || params[1].length != 2 || params[1].some((item) => typeof item != "string"))
            throw new Error("Invalid parameters entity_owner")

        result.entityAddress = params[1][0]
        result.owner = params[1][1]

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

        if (!Array.isArray(params[6]) || params[6].length != 2 || params[6].some((item) => typeof item != "number"))
            throw new Error("Invalid parameters maxTotalCost_costExponent list")

        result.maxTotalCost = params[6][0]
        result.costExponent = params[6][1]

        if (typeof params[7] == "number") result.sourceBlockHeight = params[7]
        else { result.sourceBlockHeight = undefined }
        result.paramsSignature = null

        return result
    }

    /**
     * Arrange the JSON object into the parameters for `newProcessEvm()`
     * 
     * @param transactionOptions Optional parameters to pass to the deployment contract transaction (ethers.js)
     */
    toContractParamsEvm(transactionOptions?: IMethodOverrides): IProcessCreateEvmParamsTuple {
        const paramsResult: IProcessCreateEvmParamsTuple = [
            [this.mode.value, this.envelopeType.value, this.censusOrigin.value], // int mode_envelopeType_censusOrigin
            [
                this.metadata,
                this.censusRoot,
            ], // String metadata_censusRoot
            [this.startBlock, this.blockCount], // int startBlock_blockCount
            [
                this.questionCount,
                this.maxCount,
                this.maxValue,
                this.maxVoteOverwrites
            ], // int questionCount_maxCount_maxValue_maxVoteOverwrites
            [this.maxTotalCost, this.costExponent], // int maxTotalCost_costExponent
            this.entityAddress,
            this.sourceBlockHeight, // uint256 sourceBlockHeight
            this.paramsSignature // String paramsSignature
        ]
        if (transactionOptions) paramsResult.push(transactionOptions)
        return paramsResult
    }

    /**
     * Arrange the JSON object into the parameters for `newProcessStd()`
     * 
     * @param transactionOptions Optional parameters to pass to the deployment contract transaction (ethers.js)
     */
    toContractParamsStd(transactionOptions?: IMethodOverrides): IProcessCreateStdParamsTuple {
        const paramsResult: IProcessCreateStdParamsTuple = [
            [this.mode.value, this.envelopeType.value, this.censusOrigin.value], // int mode_envelopeType_censusOrigin
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
            [this.maxTotalCost, this.costExponent], // int maxTotalCost_costExponent
            this.paramsSignature // String paramsSignature
        ]
        if (transactionOptions) paramsResult.push(transactionOptions)
        return paramsResult
    }
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
    sourceBlockHeight?: number,
    paramsSignature: string
}

// RESULTS

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
