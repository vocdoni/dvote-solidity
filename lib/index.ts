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

/** Wrapper class to enumerate and handle valid values of a process mode */
export class ProcessMode {
    private _mode: number
    constructor(processMode: number) {
        const allFlags = ProcessMode.AUTO_START | ProcessMode.INTERRUPTIBLE | ProcessMode.DYNAMIC_CENSUS | ProcessMode.ALLOW_VOTE_OVERWRITE | ProcessMode.ENCRYPTED_METADATA
        if (processMode > allFlags) throw new Error("Invalid process mode")
        this._mode = processMode
    }

    /** By default, the process is started on demand (PAUSED). If set, the process will sIf set, the process will work like `status=PAUSED` before `startBlock` and like `status=ENDED` after `startBlock + blockCount`. The process works on demand, by default.tart as OPEN and the Vochain will allow incoming votes after `startBlock` */
    public static AUTO_START: number = 1 << 0
    /** By default, the process can't be paused, ended or canceled. If set, the process can be paused, ended or canceled by the creator. */
    public static INTERRUPTIBLE: number = 1 << 1
    /** By default, the census is immutable. When set, the creator can update the census while the process remains `OPEN` or `PAUSED`. */
    public static DYNAMIC_CENSUS: number = 1 << 2
    /** By default, the first valid vote is final. If set, users will be allowed to vote up to `maxVoteOverwrites` times and the last valid vote will be counted. */
    public static ALLOW_VOTE_OVERWRITE: number = 1 << 3
    /** By default, the metadata is not encrypted. If set, clients should fetch the decryption key before trying to display the metadata. */
    public static ENCRYPTED_METADATA: number = 1 << 4

    /** Returns the value that represents the given process mode */
    public static make(flags: { autoStart?: boolean, interruptible?: boolean, dynamicCensus?: boolean, allowVoteOverwrite?: boolean, encryptedMetadata?: boolean } = {}): number {
        let result = 0
        result |= flags.autoStart ? ProcessMode.AUTO_START : 0
        result |= flags.interruptible ? ProcessMode.INTERRUPTIBLE : 0
        result |= flags.dynamicCensus ? ProcessMode.DYNAMIC_CENSUS : 0
        result |= flags.allowVoteOverwrite ? ProcessMode.ALLOW_VOTE_OVERWRITE : 0
        result |= flags.encryptedMetadata ? ProcessMode.ENCRYPTED_METADATA : 0
        return result
    }

    /** Returns true if the Vochain will open the process at `startBlock`. */
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

/** Wrapper class to enumerate and handle valid values of a process envelope type */
export class ProcessEnvelopeType {
    private _type: number
    constructor(envelopeType: number) {
        const allFlags = ProcessEnvelopeType.SERIAL | ProcessEnvelopeType.ANONYMOUS | ProcessEnvelopeType.ENCRYPTED_VOTES
        if (envelopeType > allFlags) throw new Error("Invalid envelope type")
        this._type = envelopeType
    }

    /** By default, all votes are sent within a single envelope. When set, the process questions are voted one by one (enables `questionIndex`). */
    public static SERIAL: number = 1 << 0
    /** By default, the franchise proof relies on an ECDSA signature (this could reveal the voter's identity). When set, the franchise proof will use ZK-Snarks. */
    public static ANONYMOUS: number = 1 << 1
    /** By default, votes are sent unencrypted. When the flag is set, votes are sent encrypted and become public when the process ends. */
    public static ENCRYPTED_VOTES: number = 1 << 2

    /** Returns the value that represents the given envelope type */
    public static make(flags: { serial?: boolean, anonymousVoters?: boolean, encryptedVotes?: boolean } = {}): number {
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
        mode: number,
        envelopeType: number,
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
        mode: number,
        envelopeType: number,
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
    /** Retrieves the current list of validators on the Vochain */
    getValidators(): Promise<string[]>,
    /** Checks whether the given public key is registered as a validator */
    isValidator(validatorPublicKey: string): Promise<boolean>,

    /** Registers the address of a new oracle */
    addOracle(oracleAddr: string): Promise<ContractTransaction>,
    /** Removes the address at the given index for an oracle */
    removeOracle(idx: number, oracleAddr: string): Promise<ContractTransaction>,
    /** Retrieves the current list of oracles on the Vochain */
    getOracles(): Promise<string[]>,
    /** Checks whether the given address is registered as an oracle */
    isOracle(oracleAddress: string): Promise<boolean>,

    /** Increments the index of the current question (only when INCREMENTAL mode is set) */
    incrementQuestionIndex(processId: string): Promise<ContractTransaction>

    /** Sets the given results for the given process */
    setResults(processId: string, results: string): Promise<ContractTransaction>,
    /** Retrieve the available results for the given process */
    getResults(processId: string): Promise<{ results: string }>
}
