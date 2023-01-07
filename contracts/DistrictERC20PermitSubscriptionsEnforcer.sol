//SPDX-License-Identifier: MIT
pragma solidity 0.8.15;

import { BytesLib } from "@delegatable/delegatable-sol/contracts/libraries/BytesLib.sol";
import { CaveatEnforcer, Transaction } from "@delegatable/delegatable-sol/contracts/CaveatEnforcer.sol";
import "@delegatable/delegatable-sol/contracts/Delegatable.sol";

contract DistrictERC20PermitSubscriptionsEnforcer is CaveatEnforcer, Delegatable {
  mapping(bytes32 => bool) public isCanceled;
  mapping(bytes32 => uint256) public lastTimestamp;
  uint64 public immutable subPeriod;

  constructor(string memory name, uint64 _subPeriod) Delegatable(name, "1") {
    subPeriod = _subPeriod;
  }

  function enforceCaveat(
    bytes calldata terms,
    Transaction calldata transaction,
    bytes32 delegationHash
  ) public override returns (bool) {
    require(
      !isCanceled[delegationHash],
      "DistrictERC20SubscriptionsEnforcer:canceled-subscription"
    );
    bytes4 targetSig = bytes4(transaction.data[0:4]);
    bytes4 _allowedSig = 0x97e18d6e;
    require(targetSig == _allowedSig, "DistrictERC20SubscriptionsEnforcer:invalid-method");
    uint64 _subPeriod = subPeriod;
    uint64 _currentTime = uint64(block.timestamp);
    require(
      lastTimestamp[delegationHash] + _subPeriod < _currentTime,
      "DistrictERC20SubscriptionsEnforcer:invalid-subscritpion-time"
    );

    if (lastTimestamp[delegationHash] == 0) {
      lastTimestamp[delegationHash] = _currentTime;
      return true;
    }
    lastTimestamp[delegationHash] += _subPeriod;
    return true;
  }

  function renewSubscription(SignedDelegation calldata signedDelegation, bytes32 domainHash)
    public
  {
    address signer = verifyExternalDelegationSignature(signedDelegation, domainHash);
    address sender = _msgSender();
    require(signer == sender, "DistrictERC20SubscriptionsEnforcer:no-renew-permission");
    bytes32 delegationHash = GET_SIGNEDDELEGATION_PACKETHASH(signedDelegation);
    isCanceled[delegationHash] = false;
    lastTimestamp[delegationHash] = 0;
  }

  function cancelSubscription(SignedDelegation calldata signedDelegation, bytes32 domainHash)
    public
  {
    address signer = verifyExternalDelegationSignature(signedDelegation, domainHash);
    address sender = _msgSender();
    require(signer == sender, "DistrictERC20SubscriptionsEnforcer:no-cancel-permission");
    bytes32 delegationHash = GET_SIGNEDDELEGATION_PACKETHASH(signedDelegation);
    isCanceled[delegationHash] = true;
  }

  function verifyExternalDelegationSignature(
    SignedDelegation memory signedDelegation,
    bytes32 domainHash
  ) public view virtual returns (address) {
    Delegation memory delegation = signedDelegation.delegation;
    bytes32 sigHash = getExternalDelegationTypedDataHash(delegation, domainHash);
    address recoveredSignatureSigner = recover(sigHash, signedDelegation.signature);
    return recoveredSignatureSigner;
  }

  function getExternalDelegationTypedDataHash(Delegation memory delegation, bytes32 domainHash)
    public
    pure
    returns (bytes32)
  {
    bytes32 digest = keccak256(
      abi.encodePacked("\x19\x01", domainHash, GET_DELEGATION_PACKETHASH(delegation))
    );
    return digest;
  }

  function _msgSender() internal view override returns (address sender) {
    if (msg.sender == address(this)) {
      bytes memory array = msg.data;
      uint256 index = msg.data.length;
      assembly {
        // Load the 32 bytes word from memory with the address on the lower 20 bytes, and mask those.
        sender := and(mload(add(array, index)), 0xffffffffffffffffffffffffffffffffffffffff)
      }
    } else {
      sender = msg.sender;
    }
    return sender;
  }
}
