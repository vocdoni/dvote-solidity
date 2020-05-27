import * as EntityResolver from "./entity-resolver.json"
import * as VotingProcess from "./voting-process.json"

import { ContractTransaction } from "ethers"
import { BigNumber } from "ethers/utils"

///////////////////////////////////////////////////////////////////////////////
// SMART CONTRACTS ABI + BYTECODE
///////////////////////////////////////////////////////////////////////////////

export { EntityResolver }
export { VotingProcess }

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

export type IProcessMode = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14 | 15
export const processModeValues = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15]

/** Wrapper class to enumerate and handle valid values of a process mode */
export class ProcessMode {
    private _mode: IProcessMode
    constructor(processMode: IProcessMode) {
        if (!processModeValues.includes(processMode)) throw new Error("Invalid process mode")
        this._mode = processMode
    }

    /** If set, the process will work like `status=PAUSED` before `startBlock` and like `status=ENDED` after `startBlock + blockCount`. The process works on demand, by default. */
    public static SCHEDULED: IProcessMode = 1 << 0 as IProcessMode
    /** Allows the process creator to update the census while it is `open` or `paused`. Disabled by default. */
    public static DYNAMIC_CENSUS: IProcessMode = 1 << 1 as IProcessMode
    /** Allows the process creator to update the metadata while it is `open` or `paused`. Disabled by default. */
    public static DYNAMIC_METADATA: IProcessMode = 1 << 2 as IProcessMode
    /** Sets the process so that the metadata is encrypted. Disabled by default. */
    public static ENCRYPTED_METADATA: IProcessMode = 1 << 3 as IProcessMode

    /** Returns the value that represents the given process mode */
    public static make(flags: { scheduled?: boolean, dynamicCensus?: boolean, dynamicMetadata?: boolean, encryptedMetadata?: boolean } = {}): IProcessMode {
        let result = 0
        result |= flags.scheduled ? ProcessMode.SCHEDULED : 0
        result |= flags.dynamicCensus ? ProcessMode.DYNAMIC_CENSUS : 0
        result |= flags.dynamicMetadata ? ProcessMode.DYNAMIC_METADATA : 0
        result |= flags.encryptedMetadata ? ProcessMode.ENCRYPTED_METADATA : 0
        return result as IProcessMode
    }

    /** Returns true if the process relies on `startBlock` and `blockCount`. Returns false if it works on demand. */
    get isScheduled(): boolean { return (this._mode & ProcessMode.SCHEDULED) != 0 }
    /** Returns true if the process does not rely on `startBlock` and `blockCount`. */
    get isOnDemand(): boolean { return (this._mode & ProcessMode.SCHEDULED) == 0 }

    /** Returns true if the census can be updated by the creator. */
    get hasDynamicCensus(): boolean { return (this._mode & ProcessMode.DYNAMIC_CENSUS) != 0 }
    /** Returns true if the metadata can be updated by the creator. */
    get hasDynamicMetadata(): boolean { return (this._mode & ProcessMode.DYNAMIC_METADATA) != 0 }
    /** Returns true if the process metadata is expected to be encrypted. */
    get hasMetadataEncrypted(): boolean { return (this._mode & ProcessMode.ENCRYPTED_METADATA) != 0 }
}

export type IProcessEnvelopeType = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7
export const processEnvelopeTypeValues = [0, 1, 2, 3, 4, 5, 6, 7]

/** Wrapper class to enumerate and handle valid values of a process envelope type */
export class ProcessEnvelopeType {
    private _type: IProcessEnvelopeType
    constructor(envelopeType: IProcessEnvelopeType) {
        if (!processEnvelopeTypeValues.includes(envelopeType)) throw new Error("Invalid envelope type")
        this._type = envelopeType
    }

    /** Sets the flag to enforce votes to be sent encrypted. Votes will become public when the process ends. Disabled by default. */
    public static ENCRYPTED_VOTES: IProcessEnvelopeType = 1 << 0 as IProcessEnvelopeType
    /** Sets the process to verify votes with ZK-Snarks. By default, the vote signature is checked (this can reveal the voter's identity). */
    public static ANONYMOUS_VOTERS: IProcessEnvelopeType = 1 << 1 as IProcessEnvelopeType
    /** Sets the process so that questions are voted one by one, instead of all at once. Enables `questionIndex` and `questionCount`. Single envelope by default. */
    public static MULTI_ENVELOPE: IProcessEnvelopeType = 1 << 2 as IProcessEnvelopeType

    /** Returns the value that represents the given envelope type */
    public static make(flags: { encryptedVotes?: boolean, anonymousVoters?: boolean, multiEnvelope?: boolean } = {}): IProcessEnvelopeType {
        let result = 0
        result |= flags.encryptedVotes ? ProcessEnvelopeType.ENCRYPTED_VOTES : 0
        result |= flags.anonymousVoters ? ProcessEnvelopeType.ANONYMOUS_VOTERS : 0
        result |= flags.multiEnvelope ? ProcessEnvelopeType.MULTI_ENVELOPE : 0
        return result as IProcessEnvelopeType
    }

    /** Returns true if envelopes are expected to be sent encrypted. Inverse of `isRealtime` */
    get hasEncryptedVotes(): boolean { return (this._type & ProcessEnvelopeType.ENCRYPTED_VOTES) != 0 }
    /** Returns true if envelopes are not encrypted and results can be seen in real time. Inverse of `hasEncryptedVotes` */
    get isRealtime(): boolean { return (this._type & ProcessEnvelopeType.ENCRYPTED_VOTES) == 0 }

    /** Returns true if franchise proofs are validated with ZK-Snarks. */
    get hasAnonymousVoters(): boolean { return (this._type & ProcessEnvelopeType.ANONYMOUS_VOTERS) != 0 }

    /** Returns true if the process expects an envelope to be sent for each question. */
    get isMultiEnvelope(): boolean { return (this._type & ProcessEnvelopeType.MULTI_ENVELOPE) != 0 }
    /** Returns true if the process expects a single envelope to be sent with all the votes. */
    get isSingleEnvelope(): boolean { return (this._type & ProcessEnvelopeType.MULTI_ENVELOPE) == 0 }
}

export type IProcessStatus = 0 | 1 | 2 | 3
export const processStatusValues = [0, 1, 2, 3]

/** Wrapper class to enumerate and handle valid values of a process status */
export class ProcessStatus {
    private _status: IProcessStatus
    constructor(processStatus: IProcessStatus) {
        if (!processStatusValues.includes(processStatus)) throw new Error("Invalid process mode")
        this._status = processStatus
    }

    /** The process is accepting votes normally. */
    public static OPEN: IProcessStatus = 0
    /** The process has already ended. Results will be available soon. */
    public static ENDED: IProcessStatus = 1
    /** The process has been canceled. Results will not be available anytime. */
    public static CANCELED: IProcessStatus = 2
    /** The process is temporarily paused and votes are not accepted at the time. It might be resumed in the future. */
    public static PAUSED: IProcessStatus = 3

    get isOpen(): boolean { return this._status == ProcessStatus.OPEN }
    get isEnded(): boolean { return this._status == ProcessStatus.ENDED }
    get isCanceled(): boolean { return this._status == ProcessStatus.CANCELED }
    get isPaused(): boolean { return this._status == ProcessStatus.PAUSED }
}

/** Smart Contract operations for a Voting Process contract */
export interface VotingProcessContractMethods {
    /** Retrieves the amount of voting processes that the entity has created */
    getEntityProcessCount(entityAddress: string): Promise<BigNumber>,
    /** Get the process ID that would be assigned to the next voting process */
    getNextProcessId(entityAddress: string): Promise<string>,
    /** Compute the process ID that corresponds to the given parameters */
    getProcessId(entityAddress: string, processCountIndex: number): Promise<string>,
    /** Get the windex within the global array where the given process is stored */
    getProcessIndex(processId: string): Promise<BigNumber>,

    /** Update the genesis link and hash */
    setGenesis(genesisData: string): Promise<ContractTransaction>,
    /** Retrieve the current genesis block content link */
    getGenesis(): Promise<string>,

    /** Update the Chain ID */
    setChainId(newChainId: number): Promise<ContractTransaction>,
    /** Retrieve the current Chain ID */
    getChainId(): Promise<BigNumber>,

    /** Publish a new voting process using the given metadata link */
    create(
        mode: IProcessMode,
        envelopeType: IProcessEnvelopeType,
        metadata: string,
        censusMerkleRoot: string,
        censusMerkleTree: string,
        startBlock: number | BigNumber,
        blockCount: number | BigNumber,
        questionCount: number,
        maxValue: number,
        uniqueValues: boolean,
        maxTotalCost: number,
        costExponent: number,
        maxVoteOverwrites: number,
        paramsSignature: string,
        namespace: number
    ): Promise<ContractTransaction>,
    /** Retrieve the current data for the given process */
    get(processId: string): Promise<{
        mode: IProcessMode,
        envelopeType: IProcessEnvelopeType,
        entityAddress: string,
        startBlock: BigNumber,
        blockCount: BigNumber,
        metadata: string,
        censusMerkleRoot: string,
        censusMerkleTree: string,
        status: IProcessStatus,
        questionIndex: number,
        questionCount: number,
        maxValue: number,
        uniqueValues: boolean,
        maxTotalCost: number,
        costExponent: number,
        maxVoteOverwrites: number,
        paramsSignature: string,
        namespace: number
    }>,
    /** Update the process status that corresponds to the given ID */
    setStatus(processId: string, status: IProcessStatus): Promise<ContractTransaction>,
    /** Updates the census of the given process (only if the mode allows dynamic census) */
    setCensus(processId: string, censusMerkleRoot: string, censusMerkleTree: string): Promise<ContractTransaction>,

    /** Registers the public key of a new validator */
    addValidator(validatorPublicKey: string): Promise<ContractTransaction>,
    /** Removes the public key at the given index for a validator */
    removeValidator(idx: number, validatorPublicKey: string): Promise<ContractTransaction>,
    /** Retrieves the current list of validators on the Vocchain */
    getValidators(): Promise<string[]>,

    /** Registers the address of a new oracle */
    addOracle(oracleAddr: string): Promise<ContractTransaction>,
    /** Removes the address at the given index for an oracle */
    removeOracle(idx: number, oracleAddr: string): Promise<ContractTransaction>,
    /** Retrieves the current list of oracles on the Vocchain */
    getOracles(): Promise<string[]>,

    /** Increments the index of the current question (only when INCREMENTAL mode is set) */
    incrementQuestionIndex(processId: string): Promise<ContractTransaction>

    /** Sets the given results for the given process */
    publishResults(processId: string, results: string): Promise<ContractTransaction>,
    /** Retrieve the available results for the given process */
    getResults(processId: string): Promise<{ results: string }>
}
