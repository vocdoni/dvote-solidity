# DVote Solidity
This repo provides toolkit to interact with the EntityResolver and the VotingProcess smart contracts.

* Smart Contracts source code in Solidity
* JSON files with the contract ABI and the Bytecode of each
* JS/Typescript support to import the JSON ABI and Bytecode

## Get started

Install NodeJS and NPM on your system.

```
npm install dvote-solidity
```

## Usage

To import the ABI and the bytecode:

```javascript
const { EntityResolver, VotingProcess } = require("dvote-solidity")

console.log(EntityResolver.abi)
console.log(EntityResolver.bytecode)

console.log(VotingProcess.abi)
console.log(VotingProcess.bytecode)
```

If you use Typescript, you may need to add `"resolveJsonModule": true` in your `tsconfig.json` file.

Then use Web3 or Ethers.js to attach to an instance or deploy your own:

### Web3

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

function deployVotingProcess() {
	return web3.eth.getAccounts().then(accounts => {
		return new web3.eth.Contract(votingProcessAbi)
			.deploy({ data: votingProcessByteCode })
			.send({ from: accounts[0], gas: "2600000" })
	})
}
```

### Ethers.js

```javascript
const { EntityResolver, VotingProcess } = require("dvote-solidity")
const ethers = require("ethers")
const config = ...

const { abi: entityResolverAbi, bytecode: entityResolverByteCode } = EntityResolver
const { abi: votingProcessAbi, bytecode: votingProcessByteCode } = VotingProcess

const provider = new ethers.providers.JsonRpcProvider(config.GATEWAY_URL)

const privateKey = ethers.Wallet.fromMnemonic(config.MNEMONIC).privateKey
const address = await ethers.Wallet.fromMnemonic(config.MNEMONIC).getAddress()

const wallet = new ethers.Wallet(privateKey, provider);

// deploying
const resolverFactory = new ethers.ContractFactory(entityResolverAbi, entityResolverByteCode, wallet)
const processFactory = new ethers.ContractFactory(votingProcessAbi, votingProcessByteCode, wallet)

const resolverInstance = await resolverFactory.deploy()
console.log(resolverInstance.address)

const processInstance = await processFactory.deploy()
console.log(processInstance.address)

// or attaching
const resolver = new ethers.Contract(resolverAddress, entityResolverAbi, wallet);
const process = new ethers.Contract(processAddress, votingProcessAbi, wallet);

const tx1 = await resolver.setText(...)
await tx1.wait()
const tx2 = await process.create(...)
await tx2.wait()
```

## Types and values

A Voting Process is defined by the following fields within the contract:

```solidity
struct Process {
    uint8 mode; // The selected process mode. See: https://vocdoni.io/docs/#/architecture/components/process
    uint8 envelopeType; // One of valid envelope types, see: https://vocdoni.io/docs/#/architecture/components/process
    address entityAddress; // The Ethereum address of the Entity
    uint256 startBlock; // Tendermint block number on which the voting process starts
    uint256 blockCount; // Amount of Tendermint blocks during which the voting process is active
    string metadata; // Content Hashed URI of the JSON meta data (See Data Origins)
    string censusMerkleRoot; // Hex string with the Merkle Root hash of the census
    string censusMerkleTree; // Content Hashed URI of the exported Merkle Tree (not including the public keys)
    uint8 status; // One of 0 [ready], 1 [ended], 2 [canceled], 3 [paused], 4 [results]
    uint8 questionIndex; // The index of the currently active question (only assembly processes)
    uint8 questionCount; // How many questions the process has (only assembly processes)
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
     |`---- allowVoteOverride
     `----- encryptedMetadata
```

### autoStart

- `false` ⇒ Will start by itself on block `startBlock`
- `true` ⇒ Needs to be manually started by the admin

Enforce `startBlock` > 0 accordingly

### interruptible

- `false` ⇒ AUTO_END only
- `true` ⇒ The admin can end, pause and cancel, in addition to AUTO_END
    - Pausing a process prevents votes from being received. `numberOfBlocks` stays unchanged by now

### dynamicCensus

- `false` ⇒ Census is immutable
- `true` ⇒ Census can be edited during the life-cycle of the process. Allowing to add, subtract new keys, or change the census entirely, to a process that has already started. The admin has the opportunity to obscurely cheat by enabling keys and then remove them

### allowVoteOverride

- `false` ⇒ Only the first vote is counted
- `true` ⇒ The last vote is valid. The previous one can be overwritten up to `maxVoteOverwrites` times.

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

- `false` Only one envelope is expected with all votes
- `true` The process accepts an envelope for each question

### anonymous

- `false` The voter identity (public key) can be known and therefore we say the vote is pseudonymous. If  an observer can correlate the voter public key with personal data the voter can be identified.
- `true` The voter public key won't be known. Instead, the voter will prove that it can vote by computing a ZK-Snarks proof on its device.

### encryptedVote

- `false` Votes are sent in plain text. Results can be seen in real time.
- `true` The vote payload will be encrypted. The results will only be available once the encryption key is published at the end of the process by the miners.

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
  - Vochain nodes will accept incoming votes if `AUTO_START` is enabled
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
    ✓ Should deploy the contract (112ms)
    ✓ Should compute the ID of an entity by its address (194ms)
    Text Records
      ✓ Should set a Text record and keep the right value (159ms)
      ✓ Should override an existing Text record (111ms)
      ✓ Should reject updates from extraneous accounts (184ms)
      ✓ Should override the entity name (213ms)
      ✓ Should emit an event (4013ms)
    Text List records
      ✓ Push a Text List record (271ms)
      ✓ Set a Text List record (395ms)
      ✓ Remove a Text List record (810ms)
      ✓ Should fail updating non-existing indexes
      ✓ Should fail removing non-existing indexes (469ms)
      ✓ Should reject pushing values from extraneous accounts (117ms)
      ✓ Should reject setting values from extraneous accounts (264ms)
      ✓ Should emit events on push (929ms)
      ✓ Should emit events on update (3920ms)
      ✓ Should emit events on remove (3932ms)

  Voting Process
    ✓ should deploy the contract (432ms)
    ✓ should compute a processId from the entity address, index and namespace (130ms)
    ✓ should compute the next processId (437ms)
    Namespace management
      ✓ should set a whole namespace at once (1461ms)
      ✓ should allow only the contract creator to update a namespace (42ms)
      ✓ should emit an event (2801ms)
    ChainID updates
      ✓ only contract creator
      ✓ should persist (80ms)
      ✓ should fail if duplicated (91ms)
      ✓ should emit an event (2025ms)
    Genesis updates
      ✓ only contract creator
      ✓ should persist (188ms)
      ✓ should fail if duplicated (91ms)
      ✓ should emit an event (2050ms)
    Validator inclusion
      ✓ only when the contract owner requests it (164ms)
      ✓ should add the validator public key to the validator list (238ms)
      ✓ should fail if it is already present (162ms)
      ✓ should add the validator to the right namespace (199ms)
      ✓ should emit an event (1165ms)
    Validator removal
      ✓ only when the contract owner account requests it (259ms)
      ✓ should fail if the idx does not match validatorPublicKey (168ms)
      ✓ should remove from the right namespace (212ms)
      ✓ should emit an event (1725ms)
    Oracle inclusion
      ✓ only when the contract owner requests it (152ms)
      ✓ should add the oracle address to the oracle list (194ms)
      ✓ should fail if it is already present (135ms)
      ✓ should add the validator to the right namespace (180ms)
      ✓ should emit an event (1186ms)
    Oracle removal
      ✓ only when the contract owner requests it (227ms)
      ✓ should fail if the idx is not valid (215ms)
      ✓ should fail if the idx does not match oracleAddress (189ms)
      ✓ should remove from the right namespace (206ms)
      ✓ should emit an event (1091ms)
    Process Creation
      ✓ should allow anyone to create a process (468ms)
      ✓ retrieved metadata should match the one submitted (3209ms)
      ✓ getting a non-existent process should fail (52ms)
      ✓ unwrapped metadata should match the unwrapped response (784ms)
      ✓ should increment the processCount of the entity on success (222ms)
      ✓ should fail with auto start set and startBlock being zero
      ✓ should fail if not interruptible and blockCount is zero
      ✓ should fail if the metadata or census references are empty
      ✓ should fail if questionCount is zero
      ✓ should fail if allowVoteOverwrite is set but maxVoteOverwrites is zero
      ✓ should fail if maxValue is zero
      ✓ should not increment the processCount of the entity on error (45ms)
      ✓ should emit an event (1836ms)
    Process Status
      ✓ setting the status of a non-existent process should fail (52ms)
      ✓ should create paused processes by default (410ms)
      ✓ should create processes in ready status when autoStart is set (394ms)
      ✓ should reject invalid status codes (554ms)
      ✓ should emit an event (14902ms)
      Not interruptible
        ✓ should allow paused => ready (the first time) if autoStart is not set (658ms)
        ✓ should reject any other status update (656ms)
      Interruptible
        from ready
          ✓ should fail if setting to ready (510ms)
          ✓ should allow to set to paused (600ms)
          ✓ should allow to set to ended (550ms)
          ✓ should allow to set to canceled (687ms)
          ✓ should fail if setting to results (494ms)
          ✓ should fail if someone else tries to update the status (2310ms)
        from paused
          ✓ should allow to set to ready (715ms)
          ✓ should fail if setting to paused (780ms)
          ✓ should allow to set to ended (537ms)
          ✓ should allow to set to canceled (543ms)
          ✓ should fail if setting to results (608ms)
          ✓ should fail if someone else tries to update the status (2292ms)
        from ended
          ✓ should never allow the status to be updated [creator] (766ms)
          ✓ should never allow the status to be updated [other account] (1455ms)
        from canceled
          ✓ should never allow the status to be updated [creator] (625ms)
          ✓ should never allow the status to be updated [other account] (1409ms)
        from results
          ✓ should never allow the status to be updated [creator] (785ms)
          ✓ should never allow the status to be updated [other account] (1589ms)
        only the oracle
          ✓ can set the results (1312ms)
    Serial envelope
      ✓ incrementing the question index of a non-existent process should fail (66ms)
      ✓ The question index should be read-only by default (410ms)
      ✓ The question index can be incremented in serial envelope mode (547ms)
      ✓ Should only allow the process creator to increment (520ms)
      ✓ Should fail if the process is paused (478ms)
      ✓ Should fail if the process is terminated (1548ms)
      ✓ Should end a process after the last question has been incremented (893ms)
      ✓ Should emit an event when the current question is incremented (3256ms)
      ✓ Should emit an event when question increment ends the process (3623ms)
    Dynamic Census
      ✓ setting the census of a non-existent process should fail (71ms)
      ✓ Should keep the census read-only by default (876ms)
      ✓ Should allow to update the census in dynamic census mode (986ms)
      ✓ Should only allow the creator to update the census (493ms)
      ✓ Should fail updating the census on terminated processes (1974ms)
      ✓ should emit an event (1113ms)
    Process Results
      ✓ getting the results of a non-existent process should fail (127ms)
      ✓ setting results on a non-existent process should fail (156ms)
      ✓ should be accepted when the sender is a registered oracle (217ms)
      ✓ should be accepted when the processId exists (111ms)
      ✓ should not be accepted when the process is canceled (568ms)
      ✓ should retrieve the submited results (257ms)
      ✓ allow oracles to set the results (1214ms)
      ✓ should prevent publishing twice (239ms)
      ✓ should emit an event (1280ms)

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


  123 passing (2m)
```

