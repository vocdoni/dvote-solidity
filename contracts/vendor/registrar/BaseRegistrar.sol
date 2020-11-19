// SPDX-License-Identifier: BSD-2-Clause
pragma solidity ^0.6.0;
pragma experimental ABIEncoderV2;

import "registry/ENS.sol";
import "openzeppelin/token/ERC721/IERC721.sol";
import "openzeppelin/access/Ownable.sol";

abstract contract BaseRegistrar is IERC721, Ownable {
    uint constant public GRACE_PERIOD = 90 days;

    event ControllerAdded(address indexed controller);
    event ControllerRemoved(address indexed controller);
    event NameMigrated(uint256 indexed id, address indexed owner, uint expires);
    event NameRegistered(uint256 indexed id, address indexed owner, uint expires);
    event NameRenewed(uint256 indexed id, uint expires);

    // The ENS registry
    ENS public ens;

    // The namehash of the TLD this registrar owns (eg, .eth)
    bytes32 public baseNode;

    // A map of addresses that are authorised to register and renew names.
    mapping(address=>bool) public controllers;

    // Authorises a controller, who can register and renew domains.
    function addController(address controller) external virtual;

    // Revoke controller permission for an address.
    function removeController(address controller) external virtual;

    // Set the resolver for the TLD this registrar manages.
    function setResolver(address resolver) external virtual;

    // Returns the expiration timestamp of the specified label hash.
    function nameExpires(uint256 id) external virtual view returns(uint);

    // Returns true iff the specified name is available for registration.
    function available(uint256 id) public view virtual returns(bool);

    /**
     * @dev Register a name.
     */
    function register(uint256 id, address owner, uint duration) external virtual returns(uint);

    function renew(uint256 id, uint duration) external virtual returns(uint);

    /**
     * @dev Reclaim ownership of a name in ENS, if you own it in the registrar.
     */
    function reclaim(uint256 id, address owner) external virtual;
}