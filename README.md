# DVote Solidity
This repo provides toolkit to interact with the EntityResolver, the Process and the Namespace smart contracts.

* Smart Contracts source code in Solidity
* JSON files with the contract ABI and the Bytecode of each
* JS/Typescript support to import the JSON ABI and Bytecode

## Contracts

### Entity Resolver
The entity resolver is a flexible way to reference entities by their ethereum address or by the Entity ID (the hash of the address). It features the standard ENS implementation plus a specialized version of Text records that allows arrays.

It is currently used for its Text records, which store a link to the Entity Metadata on IPFS.

### Namespace

Allows to define different voting namespaces (production, development, organization X, Y, Z, ...). A namespace contains a `chainId`, `genesis` information, `validators[]` and `oracles[]`.

Every process instance (see below) has to point to one namespace contract.

### Process

In vocdoni, everything is a process, the main building block of any decentralized governance activity.

- Allows to set the details that define the vote
  - Human readable details (Metadata)
- Allows to control how the Vochain should handle the process
  - Who can vote (census origin, census root, census URI)
  - When they can vote (startBlock, blockCount, current status)
  - How ballots should be dealt with (envelopeType, uniqueValues, maxValue, costExponent, ...)
- Acts as the persistent source of truth
- Stores the results

### Storage Proof

In order to run EVM census based elections, voters submit census Merkle Proofs that are checked against a certain block hash on the Ethereum blockchain. This contract is in charge of storing the ERC tokens available and validating the balance mapping position. 

### Base contracts

#### Chainable

It is quite likely that contracts like [process](#process) will need to be upgraded, while we also expect older data to remain available. 

Chainable is a base contract that allows defining predecessor instances and activate future instances succeeding the current one. Legacy data can be navigated to, pretty much as you would do on a MiniMe token contract. 

Contracts inheriting from Chainable can either:
- Have no predecessor and become active as soon as they are deployed
- Have a predecessor and start inactive by default

When a predecessor activates a successor
- The predecessor becomes inactive
- The successor becomes active

## Get started

<!-- To get the raw JSON contract ABI and bytecode [click here](https://gitlab.com/vocdoni/dvote-solidity/-/jobs/artifacts/master/download?job=dvote-solidity-build). -->

For JavaScript, [install NodeJS](https://www.nodejs.org) and NPM on your system.

```
npm install dvote-solidity
```

See [the example](./-/tree/master/lib/example.js) on `/lib/example.js`

## Usage

To import the ABI and the bytecode:

```javascript
const { EnsPublicResolver, Process, TokenStorageProof, Namespace } = require("dvote-solidity")

console.log(EnsPublicResolver.abi)
console.log(EnsPublicResolver.bytecode)

console.log(Process.abi)
console.log(Process.bytecode)

console.log(TokenStorageProof.abi)
console.log(TokenStorageProof.bytecode)

console.log(Namespace.abi)
console.log(Namespace.bytecode)
```

If you use Typescript, you may need to add `"resolveJsonModule": true` in your `tsconfig.json` file.

Then use a client library to attach to an instance or deploy your own:

### JavaScript (ethers.js)

```javascript
const { EnsPublicResolver, Process, TokenStorageProof, Namespace } = require("dvote-solidity")
const ethers = require("ethers")
const config = { ... }

const { abi: entityResolverAbi, bytecode: entityResolverByteCode } = EnsPublicResolver
const { abi: processAbi, bytecode: processByteCode } = Process
const { abi: tokenStorageProofAbi, bytecode: tokenStorageProofByteCode } = TokenStorageProof
const { abi: namespaceAbi, bytecode: namespaceByteCode } = Namespace

const provider = new ethers.providers.JsonRpcProvider(config.GATEWAY_URL)

const privateKey = ethers.Wallet.fromMnemonic(config.MNEMONIC).privateKey
const address = await ethers.Wallet.fromMnemonic(config.MNEMONIC).getAddress()

const wallet = new ethers.Wallet(privateKey, provider);

// deploying
const resolverFactory = new ethers.ContractFactory(entityResolverAbi, entityResolverByteCode, wallet)
const processFactory = new ethers.ContractFactory(processAbi, processByteCode, wallet)
const tokenStorageProofFactory = new ethers.ContractFactory(tokenStorageProofAbi, tokenStorageProofByteCode, wallet)
const namespaceFactory = new ethers.ContractFactory(namespaceAbi, namespaceByteCode, wallet)

const resolverInstance = await resolverFactory.deploy()
console.log("Resolver deployed at", resolverInstance.address)

const tokenStorageProofInstance = await tokenStorageProofFactory.deploy()
console.log("Token Storage Proof deployed at", tokenStorageProofInstance.address)

const namespaceInstance = await namespaceFactory.deploy()
console.log("Namespace deployed at", namespaceInstance.address)

// The process contract needs the address of an already deployed namespace instance
const predecessorInstanceAddress = "0x0000000000000000000000000000000000000000" // No predecessor
const processInstance = await processFactory.deploy(predecessorInstanceAddress, namespaceInstance.address, tokenStorageProofInstance.address)
console.log("Process deployed at", processInstance.address)

// or attaching
const resolver = new ethers.Contract(resolverAddress, entityResolverAbi, wallet)
const process = new ethers.Contract(processAddress, processAbi, wallet)
const tokenStorageProof = new ethers.Contract(tokenStorageProofAddress, tokenStorageProofAbi, wallet)
const namespace = new ethers.Contract(namespaceAddress, namespaceAbi, wallet)

const tx1 = await resolver.setText(...)
await tx1.wait()
const tx2 = await process.newProcess(...)
await tx2.wait()
const tx3 = await process.addOracle(...)
await tx3.wait()
```

## Types and values

A Voting Process is defined by the following fields within the contract:

```solidity
struct Process {
    uint8 mode; // The selected process mode. See: https://vocdoni.io/docs/#/architecture/smart-contracts/process?id=flags
    uint8 envelopeType; // One of valid envelope types, see: https://vocdoni.io/docs/#/architecture/smart-contracts/process?id=flags
    address entityAddress; // The Ethereum address of the Entity
    uint64 startBlock; // Tendermint block number on which the voting process starts
    uint32 blockCount; // Amount of Tendermint blocks during which the voting process should be active
    string metadata; // Content Hashed URI of the JSON meta data (See Data Origins)
    string censusRoot; // Hex string with the Merkle Root hash of the census
    string censusUri; // Content (hashed) URI of the exported Merkle Tree (not including the public keys)
    Status status; // One of 0 [ready], 1 [ended], 2 [canceled], 3 [paused], 4 [results]
    
    uint8 questionIndex; // The index of the currently active question (only assembly processes)
    // How many questions are available to vote
    // questionCount >= 1
    uint8 questionCount;
    
    // How many choices can be made for each question.
    // 1 <= maxCount <= 100
    uint8 maxCount;
    
    // Determines the acceptable value range.
    // N => valid votes will range from 0 to N (inclusive)
    uint8 maxValue;
    
    uint8 maxVoteOverwrites; // How many times a vote can be replaced (only the last one counts)
    // Choices for a question cannot appear twice or more
    
    bool uniqueValues;
    // Limits up to how much cost, the values of a vote can add up to (if applicable).
    // 0 => No limit / Not applicable
    
    uint16 maxTotalCost;
    // Defines the exponent that will be used to compute the "cost" of the options voted and compare it against `maxTotalCost`.
    // totalCost = Σ (value[i] ** costExponent) <= maxTotalCost
    //
    // Exponent range:
    // - 0 => 0.0000
    // - 10000 => 1.0000
    // - 65535 => 6.5535
    uint16 costExponent;
    
    // Self-assign to a certain namespace.
    // This will determine the oracles that listen and react to it.
    // Indirectly, it will also determine the Vochain that hosts this process.
    
    uint16 namespace;
    
    bytes32 paramsSignature; // entity.sign({...}) // fields that the oracle uses to authentify process creation
    
    string results; // string containing the results
}
```

Behaviour is defined by the flags on these variables:
- `mode`
  - The process mode (how it behaves)
- `envelopeType`
  - How votes look like
- `status`
  - Whether the process is open, ended, canceled, paused, results

## Process Mode

The process mode affects both the Vochain, the contract itself and even the metadata.

```
0b00001111
      ||||
      |||`- autoStart
      ||`-- interruptible
      |`--- dynamicCensus
      `---- encryptedMetadata
```

### autoStart

- `false` ⇒ Needs to be set to `READY` by the creator. Starts `PAUSED` by default.
- `true` ⇒ Will start by itself at block `startBlock`.

`newProcess()` enforces `startBlock` > 0 accordingly

### interruptible

- `false` ⇒ Only the Vochain can `END` the process at block `startBlock + blockCount`
- `true` ⇒ In addition to the above, the admin can `END`, `PAUSE` and `CANCEL`
    - Pausing a process prevents votes from being received, `blockCount` stays unchanged by now

### dynamicCensus

- `false` ⇒ Census is immutable
- `true` ⇒ Census can be edited during the life-cycle of the process. Allowing to add, subtract new keys, or change the census entirely, to a process that has already started.
    - Intended for long-term polls
    - Warning: The admin has the opportunity to obscurely cheat by enabling keys and then removing them

### encryptedMetadata

- `false` ⇒ The processMetadata is in plain text
- `true` ⇒ The questions and options of a process will be encrypted, so an observer of the network won't be able to see what the process is about unless it has the key.

It requires a prior process to share the encryption key with the users that will have the rights to read the data. This will be likely be handled by the `User Registry`

### JavaScript wrapper

A JavaScript wrapper is available for convenience

```typescript
import { ProcessMode } from "dvote-solidity"
// Flags
ProcessMode.AUTO_START // => 1
ProcessMode.INTERRUPTIBLE // => 2
ProcessMode.DYNAMIC_CENSUS // => 4
ProcessMode.ENCRYPTED_METADATA // => 8

// Also
mode = ProcessMode.make({})
// => 0
mode = ProcessMode.make({ autoStart: false, interruptible: false, dynamicCensus: false, encryptedMetadata: false })
// => 0
mode = ProcessMode.make({ autoStart: true, interruptible: true, dynamicCensus: true, encryptedMetadata: true })
// => 15

// And also
const pMode = new ProcessMode(15)
pMode.isAutoStart // true
pMode.isInterruptible // true
pMode.hasDynamicCensus // true
pMode.hasEncryptedMetadata // true
```

## Envelope Type

The envelope type tells how the vote envelope is formatted and handled. Its value is generated by combining the flags below.

```
0b00001111
      ||||
      |||`- serial
      ||`-- anonymous
      |`--- encryptedVote
      `---- uniqueValues
```

### serial

- `false` A single envelope is expected with all votes in it
- `true` An envelope needs to be sent for each question, as `questionIndex` increases

### anonymous

- `false` The voter identity (public key) can be known and therefore, the vote is pseudonymous. If an observer can correlate the voter public key with personal data, the voter could be identified.
- `true` The voter public key can't be known. Instead, the voter will submit a ZK-snark proof, ensuring that:
  - He/she belongs to the census of the process
  - He/she has not already voted on the process

### encryptedVote

- `false` Votes are sent in plain text. Results can be seen in real time.
- `true` The vote payload will be encrypted. The results will become available once the encryption key is published at the end of the process by the miners.

### uniqueValues

- `false` The same choice can be made twice or more, as long as maxTotalCost is held.
- `true` Choices for a question cannot appear twice or more.

### JavaScript wrapper

A JavaScript wrapper is available for convenience

```typescript
import { ProcessEnvelopeType } from "dvote-solidity"
// Flags
ProcessEnvelopeType.SERIAL // => 1
ProcessEnvelopeType.ANONYMOUS // => 2
ProcessEnvelopeType.ENCRYPTED_VOTES // => 4
ProcessEnvelopeType.UNIQUE_VALUES // => 8

// Also
type = ProcessEnvelopeType.make({})
// => 0
type = ProcessEnvelopeType.make({ serial: false, anonymousVoters: false, encryptedVotes: false, uniqueValues: false })
// => 0
type = ProcessEnvelopeType.make({ serial: true, anonymousVoters: true, encryptedVotes: true, uniqueValues: true })
// => 15

// And also
const pEnvType = new ProcessEnvelopeType(15)
pEnvType.hasSerialVoting // true
pEnvType.hasAnonymousVoters // true
pEnvType.hasEncryptedVotes // true
pEnvType.hasUniqueValues // true
```

## Process Status
The status of a process is a simple enum, defined as follows:

- `READY` (0)
  - The process is marked as ready. It is intended as a **passive authorization** to open the process
  - Vochain nodes will accept incoming votes if `AUTO_START` is disabled
  - Otherwise, they will accept votes when the Vochain block number reaches `startBlock`
- `ENDED` (1)
  - Tells the Vochain to stop accepting votes and start computing the results (if not already available)
  - Only when `INTERRUPTIBLE` is set
- `CANCELED` (2)
  - Tells the Vochain to stop accepting votes and drop the existing data. No results will be published.
  - Only when `INTERRUPTIBLE` is set
- `PAUSED` (3)
  - Tells the Vochain to stop processing votes temporarily. The process might be resumed in the future.
  - Only when `INTERRUPTIBLE` is set, or right after creation if `AUTO_START` is not set
- `RESULTS` (4)
  - Set by the Oracle as soon as the results of a process have become available

## Development

Compile and export the contracts ABI and Bytecode:
    `make all`

Run the test suite locally
    `make test`

### Current testing

Feel free to contribute any additional test cases that you consider necessary.

```mocha
  Chainable Process contract
    ✓ should fail deploying if the predecessor address is not a contract (1183ms)
    Instance forking
      ✓ should allow to deploy a contract with no predecessorAddress (1083ms)
      ✓ should not allow to deploy with itself as a predecessor (416ms)
      ✓ should retrieve the predecessorAddress if set (1176ms)
      ✓ should retrieve the successorAddress if set (1280ms)
      ✓ should have no successor by default (1198ms)
      ✓ should allow to read processes on the old instance from the new one (2002ms)
      ✓ should get the instance address where a process was originally created (2462ms)
      ✓ reading from non-existing processes should fail the same from a forked instance (1452ms)
      ✓ getEntityProcessCount should count both new and old processes (3493ms)
      ✓ namespace data should stay the same after a fork (1051ms)
    Instance activation
      ✓ should retrieve the activationBlock if set (1202ms)
      ✓ should not allow to create new processes before it has been activated (1273ms)
      ✓ should allow to create new processes after the predecessor activates it (1499ms)
      ✓ should not allow to create new processes after a successor has been activated (1419ms)
      ✓ should not allow to update the census after a successor has been activated (1452ms)
      ✓ should allow to update the status, questionIndex and results after a successor has been activated (1794ms)
      ✓ only the predecessor should be able to activate a new contract (2531ms)
      ✓ only the contract owner should be able to call activateSuccessor contract (1459ms)
      ✓ should not allow to activate itself as a successor (756ms)
      ✓ should not allow to activate if not active itself (2001ms)
      ✓ should fail activating with no predecessor defined (1471ms)
      ✓ can only be deactivated once (1566ms)
      ✓ can only be activated once (804ms)

  Entity Resolver
    ✓ Should deploy the contract (119ms)
    ✓ Should compute the ID of an entity by its address
    Text Records
      ✓ Should set a Text record and keep the right value (132ms)
      ✓ Should override an existing Text record (98ms)
      ✓ Should reject updates from extraneous accounts (293ms)
      ✓ Should override the entity name (290ms)
      ✓ Should emit an event (4026ms)

  Namespace contract
    ✓ should deploy the contract (168ms)
    Namespace management
      ✓ should set a whole namespace at once (1529ms)
      ✓ should allow only the contract creator to update a namespace (63ms)
      ✓ should emit an event (1113ms)
    ChainID updates
      ✓ only contract creator (50ms)
      ✓ should persist (128ms)
      ✓ should fail if duplicated (137ms)
      ✓ should emit an event (2635ms)
    Genesis updates
      ✓ only contract creator
      ✓ should persist (299ms)
      ✓ should fail if duplicated (137ms)
      ✓ should emit an event (2568ms)
    Validator inclusion
      ✓ only when the contract owner requests it (425ms)
      ✓ should add the validator public key to the validator list (448ms)
      ✓ should fail if it is already present (389ms)
      ✓ should add the validator to the right namespace (474ms)
      ✓ should emit an event (998ms)
    Validator removal
      ✓ only when the contract owner account requests it (501ms)
      ✓ should fail if the idx does not match validatorPublicKey (498ms)
      ✓ should remove from the right namespace (550ms)
      ✓ should emit an event (1400ms)
    Oracle inclusion
      ✓ only when the contract owner requests it (936ms)
      ✓ should add the oracle address to the oracle list (882ms)
      ✓ should fail if it is already present (888ms)
      ✓ should add the validator to the right namespace (889ms)
      ✓ should emit an event (3142ms)
    Oracle removal
      ✓ only when the contract owner requests it (974ms)
      ✓ should fail if the idx is not valid (886ms)
      ✓ should fail if the idx does not match oracleAddress (888ms)
      ✓ should remove from the right namespace (1003ms)
      ✓ should emit an event (2924ms)

  Process contract
    ✓ should deploy the contract (1712ms)
    ✓ should fail deploying if the namespace address is not a contract (953ms)
    ✓ should compute a processId from the entity address, index and namespace (151ms)
    ✓ should compute the next processId (251ms)
    Process Creation
      ✓ should allow anyone to create a process (539ms)
      ✓ retrieved metadata should match the one submitted (3088ms)
      ✓ getting a non-existent process should fail (101ms)
      ✓ unwrapped metadata should match the unwrapped response (655ms)
      ✓ paramsSignature should match the given one (704ms)
      ✓ should increment the processCount of the entity on success (217ms)
      ✓ should fail with auto start set and startBlock being zero
      ✓ should fail if not interruptible and blockCount is zero
      ✓ should fail if the metadata or census references are empty
      ✓ should fail if questionCount is zero (58ms)
      ✓ should fail if maxCount is zero or above 100 (55ms)
      ✓ should fail if maxValue is zero
      ✓ should not increment the processCount of the entity on error (59ms)
      ✓ should emit an event (3001ms)
    Process Status
      ✓ setting the status of a non-existent process should fail (116ms)
      ✓ should create paused processes by default (671ms)
      ✓ should create processes in ready status when autoStart is set (679ms)
      ✓ should reject invalid status codes (887ms)
      ✓ should emit an event (14622ms)
      Not interruptible
        ✓ should allow paused => ready (the first time) if autoStart is not set (1077ms)
        ✓ should reject any other status update (1340ms)
      Interruptible
        from ready
          ✓ should fail if setting to ready (887ms)
          ✓ should allow to set to paused (1190ms)
          ✓ should allow to set to ended (1138ms)
          ✓ should allow to set to canceled (1019ms)
          ✓ should fail if setting to results (769ms)
          ✓ should fail if someone else tries to update the status (2483ms)
        from paused
          ✓ should allow to set to ready (1328ms)
          ✓ should fail if setting to paused (953ms)
          ✓ should allow to set to ended (1221ms)
          ✓ should allow to set to canceled (1164ms)
          ✓ should fail if setting to results (1019ms)
          ✓ should fail if someone else tries to update the status (3145ms)
        from ended
          ✓ should never allow the status to be updated [creator] (1035ms)
          ✓ should never allow the status to be updated [other account] (2299ms)
        from canceled
          ✓ should never allow the status to be updated [creator] (913ms)
          ✓ should never allow the status to be updated [other account] (2296ms)
        from results
          ✓ should never allow the status to be updated [creator] (1316ms)
          ✓ should never allow the status to be updated [other account] (2900ms)
        only the oracle
          ✓ can set the results (2566ms)
    Serial envelope
      ✓ incrementing the question index of a non-existent process should fail (259ms)
      ✓ The question index should be read-only by default (1044ms)
      ✓ The question index can be incremented in serial envelope mode (943ms)
      ✓ Should only allow the process creator to increment (811ms)
      ✓ Should fail if the process is paused (869ms)
      ✓ Should fail if the process is terminated (2703ms)
      ✓ Should end a process after the last question has been incremented (1347ms)
      ✓ Should emit an event when the current question is incremented (3078ms)
      ✓ Should emit an event when question increment ends the process (2792ms)
    Dynamic Census
      ✓ setting the census of a non-existent process should fail (220ms)
      ✓ Should keep the census read-only by default (2163ms)
      ✓ Should allow to update the census in dynamic census mode (1651ms)
      ✓ Should only allow the creator to update the census (975ms)
      ✓ Should fail updating the census on terminated processes (2818ms)
      ✓ should emit an event (3283ms)
    Process Results
      ✓ getting the results of a non-existent process should fail (111ms)
      ✓ setting results on a non-existent process should fail (921ms)
      ✓ should be accepted when the sender is a registered oracle (529ms)
      ✓ should be accepted when the processId exists (790ms)
      ✓ should not be accepted when the process is canceled (912ms)
      ✓ should retrieve the submited results (1132ms)
      ✓ should allow oracles to set the results (2100ms)
      ✓ should prevent publishing twice (1243ms)
      ✓ should emit an event (1897ms)
    Namespace management
      ✓ should allow to retrieve the current namespace contract address (773ms)
      ✓ should allow the contract creator to update the namespace contract address (426ms)
      ✓ should fail if someone else attempts to update the namespace contract address (781ms)
      ✓ should stop allowing setResults from an oracle that no longer belongs to the new instance (1663ms)
      ✓ should emit an event (773ms)

  StorageProofTest contract
    ✓ should deploy the contract (257ms)
    ✓ should verify inclusion (358ms)
    ✓ should verify exclusion (175ms)

  Envelope Type wrapper
    ✓ Should build correct bitmasks
    ✓ Should identity the appropriate flags
    ✓ Should fail for invalid types

  Process Census Origin wrapper
    ✓ should handle valid census origins
    ✓ should fail on invalid process status

  Process contract parameter wrapper
    ✓ should wrap the 'create' input parameters
    ✓ should unwrap the 'get' response values

  Process Mode wrapper
    ✓ Should build correct bitmasks
    ✓ Should identify the appropriate flags
    ✓ Should fail for invalid types

  Process Status wrapper
    ✓ should handle valid process status
    ✓ should fail on invalid process status


  150 passing (5m)
```

## Deployments

See `scripts/deploy.ts` to deploy your own version. Copy `config.yaml.template` into `config.yaml` and set your own values.

### xDAI

- ENS registry:
  - Address: `0x00cEBf9E1E81D3CC17fbA0a49306EBA77a8F26cD`
- Domains:
  - Production
    - `entities.vocdoni.eth`
      - `0x80629aF85C5623fDFDD3744c3192824be72B06F6`
    - `processes.vocdoni.eth`
    - `namespaces.vocdoni.eth`
    - `erc20.proofs.vocdoni.eth`
  - Staging
    - `entities.stg.vocdoni.eth`
      - `0x2384D1160CC3F05Cc97605aeA860B23A6EB17b0C`
    - `processes.stg.vocdoni.eth`
    - `namespaces.stg.vocdoni.eth`
    - `erc20.proofs.stg.vocdoni.eth`
  - Development
    - `entities.dev.vocdoni.eth`
      - `0x1D68cfb6f1e8cB6413c69410fbf9F35B6dC586ca`
    - `processes.dev.vocdoni.eth`
    - `namespaces.dev.vocdoni.eth`
    - `erc20.proofs.dev.vocdoni.eth`

### Sokol

- ENS Registry: 
  - Address: `0xDb6C74071116D17a47D9c191cbE6d640111Ee5C2`
- ENS Resolver:
  - Address: `0xf3c50b2f86C0FC53e06CeaB88236BB404c3F2F9d`
  - Domain: `entities.vocdoni.eth`
- Process:
  - Address: `0xd92D591322A2375C1F010DF36FFC23257c71a418`
  - Domain: `processes.vocdoni.eth`
  - Predecessor: `0x0000000000000000000000000000000000000000`
- Token Storage Proofs:
  - ERC20
    - Address: `0xeA2bafa402AbDF2888eB23224df998FaF8AA79a8`
    - Domain: `erc20.proofs.vocdoni.eth`
- Namespace:
  - Address: `0xC9d39F57a14FadA742c69FF7EDaB2C965e933921`
  - Domain: `namespaces.vocdoni.eth`

### Goerli

- ENS Resolver:
  - Address: `0xA5d5A4a1636F358a4E95119EB8E59455bCf368C7`
  - Domain: `entities.vocdoni.eth`
- Process:
  - Address: `0x9dB7d8632DD1BCea307eB3868FC1434d079242F9`
  - Domain: `processes.vocdoni.eth`
  - Predecessor: `0x29270b266B097990423c2E8deFE36c5dC2fD3420`
- Token Storage Proofs:
  - ERC20
    - Address: `0x30963184f2Bcc3a59c1365231eBbbDA8B3B92782`
    - Domain: `erc20.proofs.vocdoni.eth`
- Namespace:
  - Address: `0x4a82b6ca00D36319eb2c2A56aB097912eb25A113`
  - Domain: `namespaces.vocdoni.eth`

## Development

Run `make install` to get the dependencies

On Linux, you may need to remove `package-lock.json` and try again.
