import { BigNumber, Transaction } from "ethers/utils"

export interface EntityResolverInstance {
    supportsInterface(interfaceID: string): boolean
    getEntityId(entityAddress: string): string

    setAddr(node: string, address: string): Promise<Transaction>
    addr(node: string): Promise<string>

    setText(node: string, key: string, value: string): Promise<Transaction>
    text(node: string, key: string): Promise<string>

    setListText(node: string, key: string, number, value: string): Promise<Transaction>
    pushListText(node: string, key: string, value: string): Promise<Transaction>
    removeListIndex(node: string, key: string, number): Promise<Transaction>
    list(node: string, key: string): Promise<string[]>
    listText(node: string, key: string, number): Promise<string>
}

type VotingProcessData = {
    entityResolver: string,
    entityAddress: string,
    processName: string,
    metadataContentUri: string,
    startTime: BigNumber,
    endTime: BigNumber,
    voteEncryptionPublicKey: string,
    canceled: boolean
}
type RelayData = {
    publicKey: string,
    messagingUri: string
}

export interface VotingProcessInstance {
    getNextProcessId(entityAddress: string): string
    getProcessId(entityAddress: string, processIndex: number): Promise<string>

    create(entityResolver: string, processName: string, metadataContentUri: string, startTime: BigNumber, endTime: BigNumber, voteEncryptionPublicKey: string): Promise<Transaction>
    get(processId: string): Promise<VotingProcessData>
    cancel(processId: string): Promise<Transaction>
    
    addRelay(processId: string, relayAddress: string, publicKey: string, messagingUri: string): Promise<Transaction>
    disableRelay(processId: string, relayAddress: string): Promise<Transaction>
    getRelayIndex(processId: string): Promise<string[]>
    isActiveRelay(processId: string, relayAddress: string): Promise<boolean>
    getRelay(processId: string, relayAddress: string): Promise<RelayData>
    
    registerVoteBatch(processId: string, dataContentUri: string): Promise<Transaction>
    getVoteBatchCount(processId: string): Promise<number>
    getBatch(processId: string, batchNumber: number): Promise<string>
    
    revealPrivateKey(processId: string, privateKey: string): Promise<Transaction>
    getPrivateKey(processId: string): Promise<string>
}
