/* global web3 */


// EXTERNAL USAGE:
// 
// const { increaseTimestamp } = require("./util-time-travel");
// await increaseTimestamp(20);


function increaseTimestamp(seconds = 10) {
	return new Promise((resolve, reject) => {
		const transaction = {
			jsonrpc: "2.0",
			method: "evm_increaseTime",
			params: [seconds],
			id: Date.now(),
		}
		web3.currentProvider.send(
			transaction,
			error => error ? reject(error) : resolve()
		)
	}).then(() => mineBlock())
}

function mineBlock() {
	return new Promise((resolve, reject) => {
		const transaction = {
			jsonrpc: "2.0",
			method: "evm_mine",
			params: [],
			id: Date.now(),
		}
		web3.currentProvider.send(
			transaction,
			error => error ? reject(error) : resolve()
		)
	})
}

module.exports = {
	increaseTimestamp
}
