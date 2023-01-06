//SPDX-License-Identifier: MIT
pragma solidity 0.8.15;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/draft-IERC20Permit.sol";
import "@delegatable/delegatable-sol/contracts/Delegatable.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract VerifyingContractERC20PermitSubscriptions is Delegatable, Ownable {
  address public immutable subToken;
  uint256 public immutable subAmount;

  constructor(
    string memory name,
    address _subToken,
    uint256 _subAmount
  ) Delegatable(name, "1") {
    subToken = _subToken;
    subAmount = _subAmount;
  }

  function approveSubscription(
    address subscriber,
    uint256 totalSubscriptionAmount,
    uint256 deadline,
    uint8 v,
    bytes32 r,
    bytes32 s
  ) external {
    require(msg.sender == address(this), "VerifyingContract:invalid-sender");
    IERC20Permit(subToken).permit(
      subscriber,
      address(this),
      totalSubscriptionAmount,
      deadline,
      v,
      r,
      s
    );
  }

  function paySubscription() external {
    require(msg.sender == address(this), "VerifyingContract:invalid-sender");
    IERC20(subToken).transferFrom(_msgSender(), address(this), subAmount);
  }

  function withdraw(
    address _token,
    address _to,
    uint256 _amount
  ) public onlyOwner {
    IERC20(_token).transfer(_to, _amount);
  }

  function _msgSender() internal view override(DelegatableCore, Context) returns (address sender) {
    if (msg.sender == address(this)) {
      bytes memory array = msg.data;
      uint256 index = msg.data.length;
      assembly {
        sender := and(mload(add(array, index)), 0xffffffffffffffffffffffffffffffffffffffff)
      }
    } else {
      sender = msg.sender;
    }
    return sender;
  }
}
