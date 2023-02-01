//SPDX-License-Identifier: MIT
pragma solidity 0.8.15;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@delegatable/delegatable-sol/contracts/Delegatable.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

interface IEnforcer {
  function getUnclaimedAmount(bytes32 delegationHash) external returns (uint256);
}

contract VerifyingContractERC20StreamPayments is Delegatable, Ownable {
  address public immutable _token;

  constructor(string memory name, address _token_) Delegatable(name, "1") {
    _token = _token_;
  }

  function getToken() public view returns (address) {
    return _token;
  }

  function streamToDate(
    address recipient,
    address enforcer,
    bytes32 delegationHash
  ) external {
    require(msg.sender == address(this), "VerifyingContract:invalid-sender");
    uint256 _amount = IEnforcer(enforcer).getUnclaimedAmount(delegationHash);
    IERC20(_token).transferFrom(_msgSender(), recipient, _amount);
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
