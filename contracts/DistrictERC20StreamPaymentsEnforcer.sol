//SPDX-License-Identifier: MIT
pragma solidity 0.8.15;

import { BytesLib } from "@delegatable/delegatable-sol/contracts/libraries/BytesLib.sol";
import { CaveatEnforcer, Transaction } from "@delegatable/delegatable-sol/contracts/CaveatEnforcer.sol";
import "@delegatable/delegatable-sol/contracts/Delegatable.sol";
import "hardhat/console.sol";

interface IVerifier {
  function getTokensPerSecond() external returns (uint256);
}

contract DistrictERC20StreamPaymentsEnforcer is
  CaveatEnforcer,
  Delegatable("DistrictERC20PermitSubscriptionsEnforcer", "1")
{
  mapping(bytes32 => bool) public isCanceled;
  mapping(bytes32 => uint256) public totalWithdrawals;

  function enforceCaveat(
    bytes calldata terms,
    Transaction calldata transaction,
    bytes32 delegationHash
  ) public override returns (bool) {
    // check if canceled
    require(!isCanceled[delegationHash], "enforcer:canceled-subscription");

    // check if correct function call
    require(bytes4(transaction.data[0:4]) == 0xd4d5c582, "enforcer:invalid-method");

    // check recipient
    require(BytesLib.toAddress(transaction.data, 16) == BytesLib.toAddress(terms, 0), 
                "enforcer:invalid-recipient");

    // check token
    require(BytesLib.toAddress(transaction.data, 48) == BytesLib.toAddress(terms, 20), 
                "enforcer:invalid-token");

    // check startStreamTime
    uint64 startStreamTimestamp = BytesLib.toUint64(terms, 40);
    require(startStreamTimestamp == BytesLib.toUint64(transaction.data, 92), 
              "enforcer:invalid-startTime");

    // check endStreamTime
    uint64 endStreamTimestamp = BytesLib.toUint64(terms, 48);
    require(endStreamTimestamp == BytesLib.toUint64(transaction.data, 124), 
              "enforcer:invalid-end");

    // check original amount
    uint256 originalAmount = BytesLib.toUint256(terms, 56);
    require(BytesLib.toUint256(transaction.data, 132) == originalAmount,
           "enforcer:invalid-original-amount");

    // // check verifier 
    address verifier = BytesLib.toAddress(terms, 88);
    require(verifier == BytesLib.toAddress(transaction.data, 176), "enforcer:invalid-verifier");

    // ensure allowed withdrawal limits
    uint256 tokensPerSecond = IVerifier(verifier).getTokensPerSecond();
    uint256 currentTimestamp = block.timestamp;
    uint256 elapsedTime = currentTimestamp - startStreamTimestamp;
    uint256 streamTotalTime = endStreamTimestamp - startStreamTimestamp;
    if (elapsedTime > streamTotalTime) {
      elapsedTime = streamTotalTime;
    }
    uint256 totalTokensStreamed = elapsedTime * tokensPerSecond;
    uint256 tokensRequested = BytesLib.toUint256(transaction.data, 196);
    uint256 totalWithdrawal = totalWithdrawals[delegationHash]; 
    require(totalWithdrawal + tokensRequested <= totalTokensStreamed, "enforcer:large-withdrawal");
    require(totalTokensStreamed <= originalAmount, "enforcer:large-withdrawal-1");
    totalWithdrawals[delegationHash] += tokensRequested;

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
