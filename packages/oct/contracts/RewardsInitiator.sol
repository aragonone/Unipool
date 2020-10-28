pragma solidity 0.5.16;

import "./lib/IERC20.sol";
import "./lib/IRewardDistributionRecipient.sol";


contract RewardsInitiator {
    string constant private ERROR_TOO_EARLY = "REWARDS_CTRL:TOO_EARLY";

    uint256 constant public earliestStartTime = 1603983600; // 2020-10-29 15:00 UTC

    // Pools
    IRewardDistributionRecipient public uniPool = IRewardDistributionRecipient(0x37B7870148b4B815cb6A4728a84816Cc1150e3aa);
    IRewardDistributionRecipient public bptPool = IRewardDistributionRecipient(0x7F2b9E4134Ba2f7E99859aE40436Cbe888E86B79);

    function initiate() external {
        require(block.timestamp >= earliestStartTime, ERROR_TOO_EARLY);

        uint256 uniRewardBalance = poolRewardBalance(uniPool);
        uniPool.notifyRewardAmount(uniRewardBalance);

        uint256 bptRewardBalance = poolRewardBalance(bptPool);
        bptPool.notifyRewardAmount(bptRewardBalance);
    }

    function poolRewardBalance(IRewardDistributionRecipient _pool) public view returns (uint256) {
        IERC20 rewardToken = _pool.rewardToken();
        return rewardToken.balanceOf(address(_pool));
    }
}
