# DVote Solidity Changelog

## 0.16.0

- The process contract is now payable
- A price can be defined for every process that is created (to prevent spam)
- The processes contract now has a `withdraw` function, callable by the owner
- Split the Namespaces contract into Namespaces and Genesis
  - The Genesis contract acts as a global register of Chains (chain ID, genesis, oracles, validators)
  - The Namespaces contract acts as a global register where process contracts register themselves
- The Processes contract has been adapted to the new Namespaces contract
- The `Processes` method `setResults` and `getResults` are now part of a future contract `Results`
  - Oracles now set a process' results on the Results contract
  - The results contract can then set the `RESULTS` status on the process contract
- `EnsPublicResolver` is now renamed to `EnsResolver` in TypeScript
- Validators now have a `bytes32` data type

## 0.15.0

- Allowing to retrieve and count registered ERC20 tokens

## 0.14.0

- Adding the chainID as a process contract parameter, so that process ID's do not collide if multiple chains host the same entity

## 0.13.1

- Minor fix to support CA process contract parameters

## 0.13.0

- **Breaking**: Census Origin indexes updated (grouped by type)
  - Adding `OFF_CHAIN_TREE_WEIGHTED` and `OFF_CHAIN_CA`
  - Renaming `OFF_CHAIN` into `OFF_CHAIN_TREE`
- Renaming `censusMerkleRoot` into `censusRoot` (internal)
- Renaming `censusMerkleTree` into `censusUri` (internal)

## 0.12.6

- Using `_isBigNumber` instead of comparing `evmBlockHeight` with `BigNumber`

## 0.12.5

- Storing the census Root on EVM processes
- Typing the `tokenStorageProofAddress` Solidity getter

## 0.12.4

- Fix two checks on the process `mode` for EVM processes
- Adapt the TypeScript wrappers to reflect these changes

## 0.12.3

- Add the `overrides` parameter to `registerToken`

## 0.12.2

- Adding a missing TS type

## 0.12.1

- Minor changes
  - More descriptive revert error
  - Returning `paramsSignature` as null in `ProcessContractParameters.fromContract()`

## 0.12.0

**Breaking changes**
- Process contract
  - Removing the redundant flag `MODE_ALLOW_VOTE_OVERWRITE` of `mode`. Use `maxVoteOverride` Instead.
  - Moving `mode` > `MODE_ENCRYPTED_METADATA` at the position of `MODE_ALLOW_VOTE_OVERWRITE`.
  - Moving `uniqueValues` as a flag of `envelopeType`
  - Merging `namespace` as an argument with `maxTotalCost` and `costExponent` in `newProcess()` and `get()`
  - Splitting `newProcess` into two internal functions for off-chain censuses and EVM based censuses
  - Adding `censusOrigin` and `enum CensusOrigin {OFF_CHAIN, ERC20, ERC721, ERC1155, ERC777, MINI_ME}`
  - Using `startBlock` and `blockCount` as `uint32`
  - Storing the evmBlockHeight as the census snapshot point for EVM processes
- Adding `Chainable` and `Ownable` as base contracts of `Processes`
- Adding the `TokenStorageProof` contract and `ITokenStorageProof`
- Adding the library `ContractSupport`
- Using `IERC20` from OpenZeppelin

## 0.11.1

- Allowing to pass transaction options in `ProcessContractParameters.toContractParams()`

## 0.11.0

- Using the ENS registry contracts from xENS and OpenZeppelin. 
- Exporting `IMethodOverrides`
- Using Ethers v5

## 0.10.0

- Removing `getEntityId` from the contract (no longer needed, since entityId == entityAddress)
- Adding `ensHashAddress` as a reference hash function to interact with the ENS nodes

## 0.9.1

- Exposing `IProcessCreateParams`

## 0.9.0

- Adding `ProcessContractParameters` to wrap and upwrap the params tuples submitted and retrieved from the Smart Contract
- Removing `wrapProcessCreateParams` and `unwrapProcessState`
- Allowing to read the raw `value` from `ProcessMode`, `ProcessEnvelopeType` and `ProcessStatus`

## 0.8.0

- The process contracts are now future proof
  - Instances can now be frozen and forked
  - Process state can be retrieved from any predecessor
  - Two new methods are available `activate` and `activateSuccessor`, to handle the transition with a single source of truth at all times
  - For future versions to interact with deprecated ones, `ProcessStore` is now available as an interface
  - Calls on processes created before `activationBlock` will be forwarded to the instance that holds them
  - Updates on predecessor instances need to be made there, since `msg.sender` would not allow forwarding from the successor
  - Inactive instances won't allow to create new processes or update the census
- The namespace data has been moved to a separate contract (Namespaces)
  - The `NamespaceStore` interface is also available, for all versions to be able to reference it

## 0.7.0

Substantial Voting contract refactor to support a wide range of participatory processes

- Adding `mode`, `envelopeType` and `status` to every process
    - Process mode flags (auto start, interruptible, dynamic census, vote overwrite, encrypted metadata)
    - Envelope type flags (serial envelopes, anonymous voting, encrypted votes)
    - Status (ready, ended, canceled, paused, results)
    - Providing TypeScript wrappers to work with them
- Adding `questionIndex` and `questionCount` for serial voting
- Adding `maxCount`, `maxValue`, `uniqueValues`, `maxTotalCost`, `costExponent`, `maxVotesOverwrite` and `paramsSignature` to parameterize processes
- Introducing namespaces
  - Chain ID, genesis data, validators and oracles now belong to a namespace
  - Global getters are replaced by `getNamespace()`
- Unified naming conventions for getters, setters and events
- Condensed contract parameters into tuples
- `getProcessId()` is now pure
  - The processId is computed using the namespace instead of the genesis data and the chainId
- Using Solidity 0.6.x
- Testing using in-memory Ganache server, which enables self-sufficient CI tests
- Refactoring the tests to run with Ethers.js

## 0.6.0

- Refactoring the testcases to use Ethers.js
- Use an in-memory internal Ganache testnet to test
