pragma solidity ^0.5.0;

import "./IERC20.sol";


interface IRewardDistributionRecipient {
    function notifyRewardAmount(uint256 reward) external;

    // Note that this is specific to the Unipool contracts used
    function rewardToken() external view returns (IERC20 token);
}
