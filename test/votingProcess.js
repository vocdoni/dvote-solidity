const assert = require('assert')

var VotingProcess = artifacts.require("VotingProcess")
const { increaseTimestamp } = require("./util-timestamp")

contract('VotingProcess', function (accounts) {

	const entityAddress = accounts[0]
	const relayAddress = accounts[1]
	const randomAddress1 = accounts[2]
	const randomAddress2 = accounts[3]

	const defaultResolver = "0x1234567890123456789012345678901234567890"
	const defaultProcessName = "Process name"
	const defaultMetadataContentUri = "bzz://1234,ipfs://ipfs/1234"
	const defaultEncryptionPublicKey = "0x1234"

	it("should deploy the contract", async () => {
		const instance = await VotingProcess.deployed()
		assert.ok(instance)
		assert.ok(instance.address.match(/^0x[0-9a-fA-F]{40}$/))
	})

	it("should compute a process ID from the entity address and the process index", async () => {
		const instance = await VotingProcess.deployed()
		assert(instance.getProcessId)
		assert(instance.getProcessId.call)

		const proc1 = await instance.getProcessId.call(entityAddress, 0)
		const proc2 = await instance.getProcessId.call(entityAddress, 0)
		const proc3 = await instance.getProcessId.call(entityAddress, 1)
		const proc4 = await instance.getProcessId.call(entityAddress, 1)
		const proc5 = await instance.getProcessId.call(entityAddress, 2)
		const proc6 = await instance.getProcessId.call(entityAddress, 3)

		assert.equal(proc1, proc2)
		assert.equal(proc3, proc4)

		assert.notEqual(proc1, proc3)
		assert.notEqual(proc1, proc5)
		assert.notEqual(proc1, proc6)

		assert.notEqual(proc3, proc5)
		assert.notEqual(proc3, proc6)

		assert.notEqual(proc5, proc6)
	})

	it("should compute the next process ID", async () => {
		const instance = await VotingProcess.deployed()
		assert(instance.getNextProcessId)
		assert(instance.getNextProcessId.call)

		// The entity has 0 processes at the moment
		const proc1A = await instance.getProcessId.call(entityAddress, 1)
		const proc1B = await instance.getNextProcessId.call(entityAddress)

		assert.equal(proc1A, proc1B)

		let blockNumber = await web3.eth.getBlockNumber()
		let startTime = (await web3.eth.getBlock(blockNumber)).timestamp + 50
		let endTime = startTime + 50

		await instance.create(
			defaultResolver,
			defaultProcessName,
			defaultMetadataContentUri,
			startTime,
			endTime,
			defaultEncryptionPublicKey,
			{ from: entityAddress }
		)

		// The entity has 0 processes at the moment
		const proc2A = await instance.getProcessId.call(entityAddress, 2)
		const proc2B = await instance.getNextProcessId.call(entityAddress)

		assert.equal(proc2A, proc2B)
	})

	describe("should create a process", () => {
		it("should allow anyone to create one", async () => {
			const instance = await VotingProcess.deployed()

			let blockNumber = await web3.eth.getBlockNumber()
			let startTime = (await web3.eth.getBlock(blockNumber)).timestamp + 50
			let endTime = startTime + 50

			await instance.create(
				defaultResolver,
				defaultProcessName,
				defaultMetadataContentUri,
				startTime,
				endTime,
				defaultEncryptionPublicKey,
				{ from: entityAddress }
			)
			await instance.create(
				defaultResolver,
				defaultProcessName,
				defaultMetadataContentUri,
				startTime,
				endTime,
				defaultEncryptionPublicKey,
				{ from: randomAddress1 }
			)
			await instance.create(
				defaultResolver,
				defaultProcessName,
				defaultMetadataContentUri,
				startTime,
				endTime,
				defaultEncryptionPublicKey,
				{ from: randomAddress2 }
			)
		})

		it("should emit an event", async () => {
			const instance = await VotingProcess.deployed()

			const expectedProcessId = await instance.getNextProcessId.call(entityAddress)

			let blockNumber = await web3.eth.getBlockNumber()
			let startTime = (await web3.eth.getBlock(blockNumber)).timestamp + 50
			let endTime = startTime + 50

			let result = await instance.create(
				defaultResolver,
				defaultProcessName,
				defaultMetadataContentUri,
				startTime,
				endTime,
				defaultEncryptionPublicKey,
				{ from: entityAddress }
			)

			assert.ok(result)
			assert.ok(result.logs)
			assert.ok(result.logs[0])
			assert.equal(result.logs[0].event, "ProcessCreated")
			assert.equal(result.logs[0].args, 2)
			assert.equal(result.logs[0].args[0], entityAddress)
			assert.equal(result.logs[0].args[1], expectedProcessId)

		})

		it("should enforce startTime's greater than the current timestamp", async () => {
			const instance = await VotingProcess.deployed()

			let blockNumber = await web3.eth.getBlockNumber()
			let startTime = (await web3.eth.getBlock(blockNumber)).timestamp - 50  // <<--
			let endTime = (await web3.eth.getBlock(blockNumber)).timestamp + 50

			try {
				await instance.create(
					defaultResolver,
					defaultProcessName,
					defaultMetadataContentUri,
					startTime,
					endTime,
					defaultEncryptionPublicKey,
					{ from: entityAddress }
				)
				assert.fail("The transaction should have thrown an error")
			}
			catch (err) {
				assert(err.message.match(/revert/), "The transaction should be reverted")
			}
		})
		it("should enforce endTime's greater than the given startTime", async () => {
			const instance = await VotingProcess.deployed()

			// equal failing
			let blockNumber = await web3.eth.getBlockNumber()
			let startTime = (await web3.eth.getBlock(blockNumber)).timestamp + 50
			let endTime = startTime  // <<--

			try {
				await instance.create(
					defaultResolver,
					defaultProcessName,
					defaultMetadataContentUri,
					startTime,
					endTime,
					defaultEncryptionPublicKey,
					{ from: entityAddress }
				)
				assert.fail("The transaction should have thrown an error")
			}
			catch (err) {
				assert(err.message.match(/revert/), "The transaction should be reverted")
			}

			// Lower failing
			blockNumber = await web3.eth.getBlockNumber()
			startTime = (await web3.eth.getBlock(blockNumber)).timestamp + 50
			endTime = startTime - Math.ceil(100 * Math.random())   // <<--

			try {
				await instance.create(
					defaultResolver,
					defaultProcessName,
					defaultMetadataContentUri,
					startTime,
					endTime,
					defaultEncryptionPublicKey,
					{ from: entityAddress }
				)
				assert.fail("The transaction should have thrown an error")
			}
			catch (err) {
				assert(err.message.match(/revert/), "The transaction should be reverted")
			}
		})
		it("should increase the processCount of the entity on success", async () => {
			const instance = await VotingProcess.deployed()

			const prev = await instance.processCount.call(entityAddress)

			let blockNumber = await web3.eth.getBlockNumber()
			let startTime = (await web3.eth.getBlock(blockNumber)).timestamp + 50
			let endTime = startTime + 50

			await instance.create(
				defaultResolver,
				defaultProcessName,
				defaultMetadataContentUri,
				startTime,
				endTime,
				defaultEncryptionPublicKey,
				{ from: entityAddress }
			)

			const current = await instance.processCount.call(entityAddress)

			assert.equal(current, prev + 1, "processCount should have increased by 1")
		})
		it("should not increase the processCount of the entity on error", async () => {
			const instance = await VotingProcess.deployed()

			const prev = await instance.processCount.call(entityAddress)

			let blockNumber = await web3.eth.getBlockNumber()
			let startTime = (await web3.eth.getBlock(blockNumber)).timestamp - 50   // <<--
			let endTime = startTime - 50   // <<--

			await instance.create(
				defaultResolver,
				defaultProcessName,
				defaultMetadataContentUri,
				startTime,
				endTime,
				defaultEncryptionPublicKey,
				{ from: entityAddress }
			)

			const current = await instance.processCount.call(entityAddress)

			assert.equal(current, prev, "processCount should not have changed")
		})
		it("retrieved metadata should match the one submitted", async () => {
			const instance = await VotingProcess.deployed()

			const entityResolver = "0x0987654321098765432109876543210987654321"
			const processName = "PROCESS NAME TO TEST"
			const metadataContentUri = "ipfs://ipfs/some-hash-here"
			const voteEncryptionPublicKey = "TESTING-ENCRYPTION_KEY"

			let blockNumber = await web3.eth.getBlockNumber()
			let startTime = (await web3.eth.getBlock(blockNumber)).timestamp + 100
			let endTime = startTime + 100

			await instance.create(
				entityResolver,
				processName,
				metadataContentUri,
				startTime,
				endTime,
				voteEncryptionPublicKey,
				{ from: entityAddress }
			)
			const count = await instance.processCount.call(entityAddress)
			const processId = await instance.getProcessId.call(entityAddress, count - 1)

			const processData = await instance.get(processId)
			assert.equal(processData.entityResolver, entityResolver)
			assert.equal(processData.entityAddress, entityAddress)
			assert.equal(processData.processName, processName)
			assert.equal(processData.metadataContentUri, metadataContentUri)
			assert.equal(processData.startTime, startTime)
			assert.equal(processData.endTime, endTime)
			assert.equal(processData.voteEncryptionPublicKey, voteEncryptionPublicKey)

			const privateKey = await instance.getPrivateKey(processId)
			assert.equal(privateKey, "")
		})
	})

	describe("should cancel the process", () => {
		it("only when the entity requests it")
		it("only if it not yet canceled")
		it("not after startTime")
	})

	describe("should register a relay", () => {
		it("only when the entity requests it")
		it("only when the process ID exists")
		it("only when the process is not canceled")
		it("should fail if it already exists")
		it("should add the relay address to the relay list")
		it("should return true on isActiveRelay")
	})

	describe("should register a vote batch", () => {
		it("only when a registered relay submits it")
		it("only when the relay is active")
		it("only when the process ID exists")
		it("only when the process is not canceled")
		it("not before startTime")
		it("not after endTime")
		it("should increase the voteBatchCount on success")
		it("should not increase the voteBatchCount on error")
	})

	describe("should disable a relay", () => {
		it("only when the entity requests it")
		it("only when the process ID exists")
		it("only when the process is not canceled")
		it("should fail if it does not exist")
		it("should remove the relay address from the relay list")
		it("should return false on isActiveRelay")
		it("should fail to register new vote batches from a disabled relay")
	})

	describe("should accept the encryption private key", () => {
		it("only when the entity requests it")
		it("only when the process ID exists")
		it("only when the process is not canceled")
		it("only after endTime")
		it("only if the key matches the public key registered")
	})

})
