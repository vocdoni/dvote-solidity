// SPDX-License-Identifier: AGPL-3.0-or-later

pragma solidity >=0.6.0 <0.7.0;
pragma experimental ABIEncoderV2;

import "./base.sol"; // Base contracts (Chained, Owned)
import "./common.sol"; // Common interface for retro compatibility
import "./lib.sol"; // Helpers

// INFO: This contract is the ground for future ERC3k dispute resolution of results on chain.

contract Results is IResultsStore, Owned {
    // GLOBAL DATA

    address public genesisAddress; // Address of the global genesis contract instance
    address public processesAddress; // Address of the current processes contract instance

    // DATA STRUCTS
    struct ProcessResults {
        uint32[][] tally; // The tally for every question, option and value
        uint32 height; // The amount of valid envelopes registered
        bool defined;
    }

    mapping(bytes32 => ProcessResults) internal results; // Mapping of all processes indexed by the Process ID

    // MODIFIERS

    /// @notice Fails if the msg.sender is not an authorired oracle
    modifier onlyOracle(uint32 vochainId) override {
        // Only an Oracle within the chainId is valid
        require(
            IGenesisStore(genesisAddress).isOracle(vochainId, msg.sender),
            "Not oracle"
        );
        _;
    }

    constructor(address genesisAddr) public {
        require(ContractSupport.isContract(genesisAddr), "Invalid genesisAddr");
        genesisAddress = genesisAddr;
    }

    // SETTERS

    function setProcessesAddress(address processesAddr)
        public
        override
        onlyContractOwner
    {
        require(
            ContractSupport.isContract(processesAddr),
            "Invalid processesAddr"
        );
        processesAddress = processesAddr;
    }

    function setResults(
        bytes32 processId,
        uint32[][] memory tally,
        uint32 height,
        uint32 vochainId
    ) public override onlyOracle(vochainId) {
        require(height > 0, "No votes");
        require(!results[processId].defined, "Already defined");
        require(
            processesAddress != address(0x0),
            "Processes address undefined"
        );

        results[processId].tally = tally;
        results[processId].height = height;

        // Try to set the process state as RESULTS (will revert if non-existing or if the current state is invalid)
        IProcessStore proc = IProcessStore(processesAddress);
        proc.setStatus(processId, IProcessStore.Status.RESULTS);

        emit ResultsAvailable(processId);
    }

    // GETTERS

    /// @notice Fetch the results of the given processId, if any
    function getResults(bytes32 processId)
        public
        view
        override
        returns (uint32[][] memory tally, uint32 height)
    {
        require(results[processId].defined, "Not found");

        return (results[processId].tally, results[processId].height);
    }
}
