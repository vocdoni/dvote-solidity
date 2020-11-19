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
- Allows to control how the Vochain should handle the process
- Allows to control what status clients should display
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
const { EntityResolver, Process, Namespace } = require("dvote-solidity")

console.log(EntityResolver.abi)
console.log(EntityResolver.bytecode)

console.log(Process.abi)
console.log(Process.bytecode)

console.log(Namespace.abi)
console.log(Namespace.bytecode)
```

If you use Typescript, you may need to add `"resolveJsonModule": true` in your `tsconfig.json` file.

Then use a client library to attach to an instance or deploy your own:

### JavaScript (ethers.js)

```javascript
const { EntityResolver, Process } = require("dvote-solidity")
const ethers = require("ethers")
const config = { ... }

const { abi: entityResolverAbi, bytecode: entityResolverByteCode } = EntityResolver
const { abi: processAbi, bytecode: processByteCode } = Process
const { abi: namespaceAbi, bytecode: namespaceByteCode } = Namespace

const provider = new ethers.providers.JsonRpcProvider(config.GATEWAY_URL)

const privateKey = ethers.Wallet.fromMnemonic(config.MNEMONIC).privateKey
const address = await ethers.Wallet.fromMnemonic(config.MNEMONIC).getAddress()

const wallet = new ethers.Wallet(privateKey, provider);

// deploying
const resolverFactory = new ethers.ContractFactory(entityResolverAbi, entityResolverByteCode, wallet)
const processFactory = new ethers.ContractFactory(processAbi, processByteCode, wallet)
const namespaceFactory = new ethers.ContractFactory(namespaceAbi, namespaceByteCode, wallet)

const resolverInstance = await resolverFactory.deploy()
console.log("Resolver deployed at", resolverInstance.address)

const namespaceInstance = await namespaceFactory.deploy()
console.log("Namespace deployed at", namespaceInstance.address)

// The process contract needs the address of an already deployed namespace instance
const predecessorInstanceAddress = "0x0000000000000000000000000000000000000000" // No predecessor
const processInstance = await processFactory.deploy(predecessorInstanceAddress, namespaceInstance.address)
console.log("Process deployed at", processInstance.address)

// or attaching
const resolver = new ethers.Contract(resolverAddress, entityResolverAbi, wallet)
const process = new ethers.Contract(processAddress, processAbi, wallet)
const namespace = new ethers.Contract(namespaceAddress, namespaceAbi, wallet)

const tx1 = await resolver.setText(...)
await tx1.wait()
const tx2 = await process.newProcess(...)
await tx2.wait()
const tx3 = await process.addOracle(...)
await tx3.wait()
```

### Web3.js

```javascript
const Web3 = require("web3")
const web3 = new Web3(_your_provider_)

function deployEntityResolver() {
	return web3.eth.getAccounts().then(accounts => {
		return new web3.eth.Contract(entityResolverAbi)
			.deploy({ data: entityResolverByteCode })
			.send({ from: accounts[0], gas: "1300000" })
	})
}

function deployProcess() {
	return web3.eth.getAccounts().then(accounts => {
		return new web3.eth.Contract(processAbi)
			.deploy({ data: processByteCode })
			.send({ from: accounts[0], gas: "2600000" })
	})
}
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
    string censusMerkleRoot; // Hex string with the Merkle Root hash of the census
    string censusMerkleTree; // Content Hashed URI of the exported Merkle Tree (not including the public keys)
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
0x00011111
     |||||
     ||||`- autoStart
     |||`-- interruptible
     ||`--- dynamicCensus
     |`---- allowVoteOverwrite
     `----- encryptedMetadata
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

### allowVoteOverwrite

- `false` ⇒ Only the first vote is counted
- `true` ⇒ The last vote is counted. The previous vote can be overwritten up to `maxVoteOverwrites` times.

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
ProcessMode.ALLOW_VOTE_OVERWRITE // => 8
ProcessMode.ENCRYPTED_METADATA // => 16

// Also
mode = ProcessMode.make({})
// => 0
mode = ProcessMode.make({ autoStart: false, interruptible: false, dynamicCensus: false, allowVoteOverwrite: false, encryptedMetadata: false, })
// => 0
mode = ProcessMode.make({ autoStart: true, interruptible: true, dynamicCensus: true, allowVoteOverwrite: true, encryptedMetadata: true, })
// => 31

// And also
const pMode = new ProcessMode(31)
pMode.isAutoStart // true
pMode.isInterruptible // true
pMode.hasDynamicCensus // true
pMode.allowsVoteOverwrite // true
pMode.hasEncryptedMetadata // true
```

## Envelope Type

The envelope type tells how the vote envelope is formatted and handled. Its value is generated by combining the flags below.

```
0x00000111
       |||
       ||`- serial
       |`-- anonymous
       `--- encryptedVote
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

### JavaScript wrapper

A JavaScript wrapper is available for convenience

```typescript
import { ProcessEnvelopeType } from "dvote-solidity"
// Flags
ProcessEnvelopeType.SERIAL // => 1
ProcessEnvelopeType.ANONYMOUS // => 2
ProcessEnvelopeType.ENCRYPTED_VOTES // => 4

// Also
type = ProcessEnvelopeType.make({})
// => 0
type = ProcessEnvelopeType.make({ serial: false, anonymousVoters: false, encryptedVotes: false })
// => 0
type = ProcessEnvelopeType.make({ serial: true, anonymousVoters: true, encryptedVotes: true })
// => 7

// And also
const pEnvType = new ProcessEnvelopeType(7)
pEnvType.hasSerialVoting // true
pEnvType.hasAnonymousVoters // true
pEnvType.hasEncryptedVotes // true
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
  Entity Resolver
    ✓ Should deploy the contract (685ms)
    ✓ Should compute the ID of an entity by its address (1056ms)
    Text Records
      ✓ Should set a Text record and keep the right value (954ms)
      ✓ Should override an existing Text record (631ms)
      ✓ Should reject updates from extraneous accounts (1397ms)
      ✓ Should override the entity name (1363ms)
      ✓ Should emit an event (4020ms)

  Namespace contract
    ✓ should deploy the contract (192ms)
    Namespace management
      ✓ should set a whole namespace at once (1774ms)
      ✓ should allow only the contract creator to update a namespace (43ms)
      ✓ should emit an event (367ms)
    ChainID updates
      ✓ only contract creator
      ✓ should persist (123ms)
      ✓ should fail if duplicated (104ms)
      ✓ should emit an event (2584ms)
    Genesis updates
      ✓ only contract creator
      ✓ should persist (259ms)
      ✓ should fail if duplicated (101ms)
      ✓ should emit an event (2452ms)
    Validator inclusion
      ✓ only when the contract owner requests it (431ms)
      ✓ should add the validator public key to the validator list (462ms)
      ✓ should fail if it is already present (427ms)
      ✓ should add the validator to the right namespace (402ms)
      ✓ should emit an event (864ms)
    Validator removal
      ✓ only when the contract owner account requests it (484ms)
      ✓ should fail if the idx does not match validatorPublicKey (408ms)
      ✓ should remove from the right namespace (443ms)
      ✓ should emit an event (1235ms)
    Oracle inclusion
      ✓ only when the contract owner requests it (1008ms)
      ✓ should add the oracle address to the oracle list (1037ms)
      ✓ should fail if it is already present (1012ms)
      ✓ should add the validator to the right namespace (1035ms)
      ✓ should emit an event (2415ms)
    Oracle removal
      ✓ only when the contract owner requests it (1068ms)
      ✓ should fail if the idx is not valid (1058ms)
      ✓ should fail if the idx does not match oracleAddress (1393ms)
      ✓ should remove from the right namespace (1022ms)
      ✓ should emit an event (2119ms)

  Process contract
    ✓ should deploy the contract (1456ms)
    ✓ should fail deploying if the predecessor address is not a contract (354ms)
    ✓ should fail deploying if the namespace address is not a contract (727ms)
    ✓ should compute a processId from the entity address, index and namespace (102ms)
    ✓ should compute the next processId (275ms)
    Process Creation
      ✓ should allow anyone to create a process (478ms)
      ✓ retrieved metadata should match the one submitted (3119ms)
      ✓ getting a non-existent process should fail (59ms)
      ✓ unwrapped metadata should match the unwrapped response (745ms)
      ✓ paramsSignature should match the given one (681ms)
      ✓ should increment the processCount of the entity on success (199ms)
      ✓ should fail with auto start set and startBlock being zero
      ✓ should fail if not interruptible and blockCount is zero
      ✓ should fail if the metadata or census references are empty
      ✓ should fail if questionCount is zero
      ✓ should fail if maxCount is zero or above 100 (52ms)
      ✓ should fail if maxValue is zero
      ✓ should fail if allowVoteOverwrite is set but maxVoteOverwrites is zero
      ✓ should not increment the processCount of the entity on error (48ms)
      ✓ should emit an event (3017ms)
    Process Status
      ✓ setting the status of a non-existent process should fail (62ms)
      ✓ should create paused processes by default (643ms)
      ✓ should create processes in ready status when autoStart is set (615ms)
      ✓ should reject invalid status codes (770ms)
      ✓ should emit an event (15750ms)
      Not interruptible
        ✓ should allow paused => ready (the first time) if autoStart is not set (1178ms)
        ✓ should reject any other status update (934ms)
      Interruptible
        from ready
          ✓ should fail if setting to ready (638ms)
          ✓ should allow to set to paused (903ms)
          ✓ should allow to set to ended (743ms)
          ✓ should allow to set to canceled (900ms)
          ✓ should fail if setting to results (681ms)
          ✓ should fail if someone else tries to update the status (1922ms)
        from paused
          ✓ should allow to set to ready (787ms)
          ✓ should fail if setting to paused (679ms)
          ✓ should allow to set to ended (771ms)
          ✓ should allow to set to canceled (748ms)
          ✓ should fail if setting to results (658ms)
          ✓ should fail if someone else tries to update the status (2885ms)
        from ended
          ✓ should never allow the status to be updated [creator] (869ms)
          ✓ should never allow the status to be updated [other account] (2317ms)
        from canceled
          ✓ should never allow the status to be updated [creator] (853ms)
          ✓ should never allow the status to be updated [other account] (1878ms)
        from results
          ✓ should never allow the status to be updated [creator] (908ms)
          ✓ should never allow the status to be updated [other account] (2156ms)
        only the oracle
          ✓ can set the results (1204ms)
    Serial envelope
      ✓ incrementing the question index of a non-existent process should fail (172ms)
      ✓ The question index should be read-only by default (696ms)
      ✓ The question index can be incremented in serial envelope mode (886ms)
      ✓ Should only allow the process creator to increment (801ms)
      ✓ Should fail if the process is paused (765ms)
      ✓ Should fail if the process is terminated (2338ms)
      ✓ Should end a process after the last question has been incremented (1095ms)
      ✓ Should emit an event when the current question is incremented (4591ms)
      ✓ Should emit an event when question increment ends the process (3393ms)
    Dynamic Census
      ✓ setting the census of a non-existent process should fail (86ms)
      ✓ Should keep the census read-only by default (1398ms)
      ✓ Should allow to update the census in dynamic census mode (1941ms)
      ✓ Should only allow the creator to update the census (799ms)
      ✓ Should fail updating the census on terminated processes (2349ms)
      ✓ should emit an event (1711ms)
    Process Results
      ✓ getting the results of a non-existent process should fail (54ms)
      ✓ setting results on a non-existent process should fail (686ms)
      ✓ should be accepted when the sender is a registered oracle (242ms)
      ✓ should be accepted when the processId exists (740ms)
      ✓ should not be accepted when the process is canceled (1070ms)
      ✓ should retrieve the submited results (725ms)
      ✓ should allow oracles to set the results (1292ms)
      ✓ should prevent publishing twice (821ms)
      ✓ should emit an event (896ms)
    Namespace management
      ✓ should allow to retrieve the current namespace contract address (617ms)
      ✓ should allow the contract creator to update the namespace contract address (368ms)
      ✓ should fail if someone else attempts to update the namespace contract address (657ms)
      ✓ should stop allowing setResults from an oracle that no longer belongs to the new instance (1912ms)
      ✓ should emit an event (1232ms)
    Instance forking
      ✓ should allow to deploy a contract with no predecessorAddress (422ms)
      ✓ should not allow to deploy with itself as a predecessor (289ms)
      ✓ should retrieve the predecessorAddress if set (1023ms)
      ✓ should retrieve the successorAddress if set (1160ms)
      ✓ should have no successor by default (1041ms)
      ✓ should allow to read processes on the old instance from the new one (1808ms)
      ✓ should get the instance address where a process was originally created (2385ms)
      ✓ reading from non-existing processes should fail the same from a forked instance (1268ms)
      ✓ getEntityProcessCount should count both new and old processes (3478ms)
      ✓ namespace data should stay the same after a fork (1023ms)
    Instance activation
      ✓ should retrieve the activationBlock if set (1538ms)
      ✓ should not allow to create new processes before it has been activated (1139ms)
      ✓ should allow to create new processes after the predecessor activates it (1365ms)
      ✓ should not allow to create new processes after a successor has been activated (1275ms)
      ✓ should not allow to update the census after a successor has been activated (1202ms)
      ✓ should allow to update the status, questionIndex and results after a successor has been activated (1527ms)
      ✓ only the predecessor should be able to activate a new contract (2300ms)
      ✓ only the contract owner should be able to call activateSuccessor contract (1270ms)
      ✓ should not allow to activate itself as a successor (636ms)
      ✓ should not allow to activate if not active itself (1597ms)
      ✓ should fail activating with no predecessor defined (1243ms)
      ✓ can only be deactivated once (1281ms)
      ✓ can only be activated once (640ms)

  Envelope Type wrapper
    ✓ Should build correct bitmasks
    ✓ Should identity the appropriate flags
    ✓ Should fail for invalid types

  Process contract parameter wrapper
    ✓ should wrap the 'create' input parameters
    ✓ should unwrap the 'get' response values

  Process Mode wrapper
    ✓ Should build correct bitmasks
    ✓ Should identity the appropriate flags
    ✓ Should fail for invalid types

  Process Status wrapper
    ✓ should handle valid process status
    ✓ should fail on invalid process status


  146 passing (5m)
```

## Deployments

### xDAI and Sokol

Both networks currently feature a prior version. Expect them to be soon replaced by version 0.10.0.

### Goerli

- Entity resolver deployed at `0x7fBf10CE8b0cF34b6F8104A83387ACe6E4b067eE`
  - ENS: `entities.dev.vocdoni.eth`
- Namespace deployed at `0xCB0d4fDeB158611c31550BCF5715617402adfAF4`
- Process deployed at `0x0932D53F7545d39a747C68DD327e330daf104385`
  - Predecessor: `0x0000000000000000000000000000000000000000`
  - Namespace: `0xCB0d4fDeB158611c31550BCF5715617402adfAF4`
  - ENS: `processes.dev.vocdoni.eth`


## Development

Run `npm install` to get the dependencies

On Linux, you may need to remove `package-lock.json` and try again.
