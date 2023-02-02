//SPDX-License-Identifier: MIT
pragma solidity 0.8.15;

import { BytesLib } from "@delegatable/delegatable-sol/contracts/libraries/BytesLib.sol";
import { CaveatEnforcer, Transaction } from "@delegatable/delegatable-sol/contracts/CaveatEnforcer.sol";
import "@delegatable/delegatable-sol/contracts/Delegatable.sol";
import "hardhat/console.sol";

contract DistrictERC20StreamPaymentsEnforcer is
  CaveatEnforcer,
  Delegatable("DistrictERC20PermitSubscriptionsEnforcer", "1")
{
  mapping(bytes32 => bool) public isCanceled;

  function enforceCaveat(
    bytes calldata terms,
    Transaction calldata transaction,
    bytes32 delegationHash
  ) public override returns (bool) {
    // check if canceled
    require(!isCanceled[delegationHash], "enforcer:canceled-subscription");

    // check if correct function call
    bytes4 targetSig = bytes4(transaction.data[0:4]);
    bytes4 _allowedSig = 0xcf5f8da0;
    require(targetSig == _allowedSig, "enforcer:invalid-method");

    // check recipient
    address txRecipient = BytesLib.toAddress(transaction.data, 16);
    address recipient = BytesLib.toAddress(terms, 0);
    require(txRecipient == recipient, "enforcer:invalid-recipient");

    // check token
    address txToken = BytesLib.toAddress(transaction.data, 48);
    address token = BytesLib.toAddress(terms, 20);
    require(txToken == token, "enforcer:invalid-token");

    // check startStreamTime
    uint64 txStartStreamTimestamp = BytesLib.toUint64(transaction.data, 92);
    uint64 startStreamTimestamp = BytesLib.toUint64(terms, 40);
    require(txStartStreamTimestamp == startStreamTimestamp, "enforcer:invalid-startTime");

    // check endStreamTime
    uint64 endStreamTimestamp = BytesLib.toUint64(terms, 48);
    uint64 txEndStreamTimestamp = BytesLib.toUint64(transaction.data, 124);
    require(endStreamTimestamp == txEndStreamTimestamp, "enforcer:invalid-end");

    // check amount
    uint256 txAmount = BytesLib.toUint256(transaction.data, 132);
    // uint256 amount = BytesLib.toUint256(terms, 56);
    return true;
  }

  function cancelSubscription(SignedDelegation calldata signedDelegation, bytes32 domainHash)
    external
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
