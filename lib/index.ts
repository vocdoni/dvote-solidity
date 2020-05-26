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

export type IProcessEnvelopeType = 0 | 1 | 4 | 6 | 8 | 10 | 12 | 14
export const processEnvelopeTypeValues = [0, 1, 4, 6, 8, 10, 12, 14]

/** Wrapper class to enumerate and handle valid values of a process envelope type */
export class ProcessEnvelopeType {
    private _type: IProcessEnvelopeType
    constructor(envelopeType: IProcessEnvelopeType) {
        if (!processEnvelopeTypeValues.includes(envelopeType)) throw new Error("Invalid envelope type")
        this._type = envelopeType
    }

    /** A public poll. Votes are visible and voter public keys can be recovered. */
    public static REALTIME_POLL: IProcessEnvelopeType = 0
    /** A process where voters can simply support the given cause, no other choice is available. Signatures are visible and voter public keys can be recovered. */
    public static PETITION_SIGNING: IProcessEnvelopeType = 1
    /** A poll where votes remain encrypted until the end of the process and voter public keys can be recovered. */
    public static ENCRYPTED_POLL: IProcessEnvelopeType = 4
    /** A poll where votes remain encrypted until the end of the process. The metadata is encrypted and voter public keys could be recovered for those within the private group. */
    public static ENCRYPTED_PRIVATE_POLL: IProcessEnvelopeType = 6
    /** A public election where votes are visible as soon as they are computed. The voter's identity is verified, but it remains anonymous even after the process has ended. */
    public static REALTIME_ELECTION: IProcessEnvelopeType = 8
    /** An election where the metadata is encrypted and votes remain encrypted until the process ends. The voter's identity is verified, but it remains anonymous even after the process has ended. */
    public static PRIVATE_ELECTION: IProcessEnvelopeType = 10
    /** A standard election where votes remain encrypted until the process has ended. The voter's identity is verified but it remains anonymous even after the process has ended. */
    public static ELECTION: IProcessEnvelopeType = 12
    /** An election where the metadata is encrypted but votes are visible as soon as they are computed. The voter's identity is verified, but it remains anonymous even after the process has ended. */
    public static REALTIME_PRIVATE_ELECTION: IProcessEnvelopeType = 14

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

export type IProcessMode = 0 | 1 | 3
export const processModeValues = [0, 1, 3]

/** Wrapper class to enumerate and handle valid values of a process mode */
export class ProcessMode {
    private _mode: IProcessMode
    constructor(processMode: IProcessMode) {
        if (!processModeValues.includes(processMode)) throw new Error("Invalid process mode")
        this._mode = processMode
    }

    /** A process where voters can vote after `startBlock` and before `endBlock`. Only one envelope is accepted. */
    public static SCHEDULED_SINGLE: IProcessMode = 0
    /** A process that can be started and stopped when the creator deems it appropriate. Only one envelope is accepted. */
    public static ON_DEMAND_SINGLE: IProcessMode = 1
    /**
     * An on-demand process where only one question can be voted at a time. The currently active question is defined by `questionIndex` on the contract.
     * One envelope is expected for each question of the process. */
    public static ASSEMBLY: IProcessMode = 3

    /** Returns true if the process relies on `startBlock` and `numberOfBlocks` */
    get isScheduled(): boolean { return this._mode == ProcessMode.SCHEDULED_SINGLE }
    /** Returns true if the process relies on the creator to be started, stopped, etc. */
    get isOnDemand(): boolean {
        return this._mode == ProcessMode.ON_DEMAND_SINGLE ||
            this._mode == ProcessMode.ASSEMBLY
    }
    /** Returns true if the current mode accepte only one envelope per voter. */
    get isSingleEnvelope(): boolean {
        return this._mode == ProcessMode.SCHEDULED_SINGLE ||
            this._mode == ProcessMode.ON_DEMAND_SINGLE
    }
    /** Returns true if the process questions must be voted separately, according to the current `questionIndex` in the contract. */
    get isAssembly(): boolean { return this._mode == ProcessMode.ASSEMBLY }
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

    /** Increments the index of the current question (multi-envelope mode only) */
    incrementQuestionIndex(processId: string): Promise<ContractTransaction>

    /** Sets the given results for the given process */
    publishResults(processId: string, results: string): Promise<ContractTransaction>,
    /** Retrieve the available results for the given process */
    getResults(processId: string): Promise<{ results: string }>
}
