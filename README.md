# DVote Solidity
This repo provides toolkit to interact with the EntityResolver and the VotingProcess smart contracts.

* Smart Contracts source code in Solidity
* JSON files with the contract ABI and the Bytecode of each
* Javascript file to import the JSON ABI and Bytecode

## Get started

Install NodeJS and NPM on your system.

```
make all
```

## Usage

From NodeJS, import the library:

```javascript
const { EntityResolver, VotingProcess } = require("dvote-js")

console.log(EntityResolver.abi, EntityResolver.bytecode)
console.log(VotingProcess.abi, VotingProcess.bytecode)

```

If you use Typescript, you may need to add `"resolveJsonModule": true` n your `tsconfig.json` file.

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
const ethers = require("ethers")
const config = ...

const { abi: entityResolverAbi, bytecode: entityResolverByteCode } = require("../build/entity-resolver.json")
const { abi: votingProcessAbi, bytecode: votingProcessByteCode } = require("../build/voting-process.json")

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

const tx = await resolver.setText(...)
const tx = await process.create(...)

```

## Development

Compile and export the contracts ABI and Bytecode:
    `make all`

Start a local blockchain:
    `npm run ganache`

Run the test suite locally
    `make test`

### Current testing

Feel free to contribute any additional test cases that you consider necessary.

```mocha
DVote Solidity
    EntityResolver
      ✓ Should deploy the contract (73ms)
      ✓ Should compute the ID of an entity by its address (129ms)
      Text Records
        ✓ Should set a Text record and keep the right value (138ms)
        ✓ Should override an existing Text record (111ms)
        ✓ Should reject updates from extraneous accounts (102ms)
        ✓ Should override the entity name (150ms)
        ✓ Should emit an event (75ms)
      Text List records
        ✓ Push a Text List record (230ms)
        ✓ Set a Text List record (311ms)
        ✓ Remove a Text List record (785ms)
        ✓ Should fail updating non-existing indexes (64ms)
        ✓ Should fail removing non-existing indexes (500ms)
        ✓ Should reject pushing values from extraneous accounts
        ✓ Should reject setting values from extraneous accounts (232ms)
        ✓ Should emit events on push, update and remove (311ms)
    VotingProcess
      ✓ should deploy the contract (60ms)
      ✓ should compute a processId from the entity address and the process index (129ms)
      ✓ should compute the next processId (192ms)
      should set genesis
        ✓ only contract creator
        ✓ should persist (179ms)
        ✓ should emit an event (71ms)
      should set chainId
        ✓ only contract creator
        ✓ should persist (1585ms)
        ✓ should fail if duplicated
        ✓ should emit an event (59ms)
      should create a process
        ✓ should allow anyone to create one (424ms)
        ✓ should emit an event (116ms)
        ✓ should increase the processCount of the entity on success (132ms)
        ✓ should not increase the processCount of the entity on error (56ms)
        ✓ retrieved metadata should match the one submitted (339ms)
      should cancel the process
        ✓ only when the entity account requests it (422ms)
        ✓ if is not yet canceled (324ms)
        ✓ if it not yet ended (258ms)
        ✓ should emit an event (216ms)
      should end the process
        ✓ only when the entity account requests it (375ms)
        ✓ if is not yet ended (245ms)
        ✓ if it not canceled (241ms)
        ✓ should emit an event (179ms)
      should pause the process
        ✓ only if the entity account requests it (366ms)
        ✓ if not canceled (252ms)
        ✓ if not ended (254ms)
        ✓ if not paused yet (221ms)
        ✓ if opened (201ms)
        ✓ should emit an event (183ms)
      should open the process
        ✓ if not canceled (229ms)
        ✓ if not ended (305ms)
        ✓ if not opened yet (201ms)
        ✓ if paused (329ms)
      should register a validator
        ✓ only when the contract owner requests it (127ms)
        ✓ should fail if NOT owner adds Validator (125ms)
        ✓ should add the validator public key to the validator list (177ms)
        ✓ should not add the validator public key to the validator list if exists (120ms)
        ✓ should emit an event (101ms)
      should remove a validator
        ✓ only when the contract owner account requests it (161ms)
        ✓ should fail if the idx does not match validatorPublicKey (85ms)
        ✓ should emit an event (142ms)
      should register an oracle
        ✓ only when the contract owner requests it (107ms)
        ✓ should add the oracle address to the oracle list (156ms)
        ✓ should not add the oracle address to the oracle list if exists (109ms)
        ✓ should emit an event (77ms)
      should remove a oracle
        ✓ only when the contract owner requests it (171ms)
        ✓ should fail if the idx is not valid (138ms)
        ✓ should fail if the idx does not match oracleAddress (146ms)
        ✓ should emit an event (127ms)
      should accept the results
        ✓ only when the sender is an oracle (409ms)
        ✓ only when the processId exists (88ms)
        ✓ only when the process is not canceled (350ms)
        ✓ should retrieve the submited results (286ms)
        ✓ should overwrite it in case of a mistake (370ms)
        ✓ should emit an event (4290ms)


  70 passing (24s)

```

