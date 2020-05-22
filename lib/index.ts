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
// VOTING PROCESS TYPES
///////////////////////////////////////////////////////////////////////////////

type IEnvelopeType = 0 | 1 | 4 | 6 | 8 | 10 | 12 | 14
const envelopeTypeValues = [0, 1, 4, 6, 8, 10, 12, 14]

export class ProcessEnvelopeType {
    private _type: IEnvelopeType
    constructor(envelopeType: IEnvelopeType) {
        if (!envelopeTypeValues.includes(envelopeType)) throw new Error("Invalid envelope type")
        this._type = envelopeType
    }

    public static REALTIME_POLL = 0
    public static PETITION_SIGNING = 1
    public static ENCRYPTED_POLL = 4
    public static ENCRYPTED_PRIVATE_POLL = 6
    public static REALTIME_ELECTION = 8
    public static PRIVATE_ELECTION = 10
    public static ELECTION = 12
    public static REALTIME_PRIVATE_ELECTION = 14

    get isRealtimePoll(): boolean { return this._type == ProcessEnvelopeType.REALTIME_POLL }
    get isPetitionSigning(): boolean { return this._type == ProcessEnvelopeType.PETITION_SIGNING }
    get isEncryptedPoll(): boolean { return this._type == ProcessEnvelopeType.ENCRYPTED_POLL }
    get isEncryptedPrivatePoll(): boolean {
        return this._type == ProcessEnvelopeType.ENCRYPTED_PRIVATE_POLL
    }
    get isRealtimeElection(): boolean { return this._type == ProcessEnvelopeType.REALTIME_ELECTION }
    get isPrivateElection(): boolean { return this._type == ProcessEnvelopeType.PRIVATE_ELECTION }
    get isElection(): boolean { return this._type == ProcessEnvelopeType.ELECTION }
    get isRealtimePrivateElection(): boolean {
        return this._type == ProcessEnvelopeType.REALTIME_PRIVATE_ELECTION
    }

    get isRealtime(): boolean {
        return this._type == ProcessEnvelopeType.REALTIME_POLL ||
            this._type == ProcessEnvelopeType.REALTIME_ELECTION ||
            this._type == ProcessEnvelopeType.REALTIME_PRIVATE_ELECTION
    }
}

type IMode = 0 | 1
const modeValues = [0, 1]

export class ProcessMode {
    private _mode: IMode
    constructor(processMode: IMode) {
        if (!modeValues.includes(processMode)) throw new Error("Invalid process mode")
        this._mode = processMode
    }

    public static SCHEDULED_SINGLE_ENVELOPE = 0
    public static ON_DEMAND_SINGLE_ENVELOPE = 1

    get isScheduled(): boolean { return this._mode == ProcessMode.SCHEDULED_SINGLE_ENVELOPE }
    get isOnDemand(): boolean { return this._mode == ProcessMode.ON_DEMAND_SINGLE_ENVELOPE }
    get isSingleEnvelope(): boolean {
        return this._mode == ProcessMode.SCHEDULED_SINGLE_ENVELOPE ||
            this._mode == ProcessMode.ON_DEMAND_SINGLE_ENVELOPE
    }
}

type IStatus = 0 | 1 | 2 | 3
const statusValues = [0, 1, 2, 3]

export class ProcessStatus {
    private _status: IStatus
    constructor(processStatus: IStatus) {
        if (!statusValues.includes(processStatus)) throw new Error("Invalid process mode")
        this._status = processStatus
    }

    public static OPEN = 0
    public static ENDED = 1
    public static CANCELED = 2
    public static PAUSED = 3

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
    create(envelopeType: IEnvelopeType, mode: IMode, metadata: string, censusMerkleRoot: string, censusMerkleTree: string, startBlock: number | BigNumber, numberOfBlocks: number | BigNumber): Promise<ContractTransaction>,
    /** Retrieve the current data for the given process */
    get(processId: string): Promise<{ envelopeType: IEnvelopeType, mode: IMode, entityAddress: string, startBlock: BigNumber, numberOfBlocks: BigNumber, metadata: string, censusMerkleRoot: string, censusMerkleTree: string, status: IStatus }>,
    /** Update the voting process status that corresponds to the given Id */
    setProcessStatus(processId: string, status: IStatus): Promise<ContractTransaction>,

    /** Add a valid envelope type */
    addEnvelopeType(envelopeType: number): Promise<ContractTransaction>,
    /** Remove a valid envelope type */
    removeEnvelopeType(envelopeType: number): Promise<ContractTransaction>,
    /** check if envelopeType is accepted */
    checkEnvelopeType(envelopeType: number): Promise<boolean>, 
    /** Add a valid mode type */
    addMode(mode: number): Promise<ContractTransaction>,
    /** Remove a valid mode type */
    removeMode(mode: number): Promise<ContractTransaction>,
    /** check if mode is accepted */
    checkMode(mode: number): Promise<boolean>,

    /** Register the public key of a new validator */
    addValidator(validatorPublicKey: string): Promise<ContractTransaction>,
    /** Remove the public key at the given index for a validator */
    removeValidator(idx: number, validatorPublicKey: string): Promise<ContractTransaction>,
    /** Retrieve the current list of validators on the Vocchain */
    getValidators(): Promise<string[]>,

    /** Register the public key of a new oracle */
    addOracle(oracleAddr: string): Promise<ContractTransaction>,
    /** Remove the public key at the given index for an oracle */
    removeOracle(idx: number, oracleAddr: string): Promise<ContractTransaction>,
    /** Retrieve the current list of oracles on the Vocchain */
    getOracles(): Promise<string[]>,

    /** Publish the results for the given process */
    publishResults(processId: string, results: string): Promise<ContractTransaction>,
    /** Retrieve the available results for the given process */
    getResults(processId: string): Promise<{ results: string }>
}
