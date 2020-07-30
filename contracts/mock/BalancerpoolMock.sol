pragma solidity ^0.5.0;

import "../Balancerpool.sol";


contract BalancerpoolMock is Balancerpool {

    event FundsReceived(address sende, uint256 value);

    constructor(IERC20 bptToken, IERC20 antToken) public {
        BPT = bptToken;
        ANT = antToken;
    }

    /**
     * @dev Base contract is not payable. We are adding this here to test that ETH can be recovered.
     *      ETH could end up in the contract in some edge cases, like a selfdestruct
     */
    function () external payable {
        emit FundsReceived(msg.sender, msg.value);
    }
}
