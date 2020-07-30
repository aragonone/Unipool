pragma solidity ^0.5.0;

import "@openzeppelin/contracts/math/Math.sol";
import "@openzeppelin/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts/ownership/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";
import "@aragon/court/contracts/standards/ApproveAndCall.sol";


contract LPTokenWrapper {
    using SafeMath for uint256;
    using SafeERC20 for IERC20;

    // Balancer ANT/WETH pair token
    IERC20 public BPT = IERC20(0x2cF9106fAF2C5C8713035d40df655fB1B9B0F9B9);

    uint256 private _totalSupply;
    mapping(address => uint256) private _balances;

    function totalSupply() public view returns (uint256) {
        return _totalSupply;
    }

    function balanceOf(address account) public view returns (uint256) {
        return _balances[account];
    }

    function stake(uint256 amount) public {
        _totalSupply = _totalSupply.add(amount);
        _balances[msg.sender] = _balances[msg.sender].add(amount);
        BPT.safeTransferFrom(msg.sender, address(this), amount);
    }

    function withdraw(uint256 amount) public {
        _totalSupply = _totalSupply.sub(amount);
        _balances[msg.sender] = _balances[msg.sender].sub(amount);
        BPT.safeTransfer(msg.sender, amount);
    }
}


contract Balancerpool is LPTokenWrapper, Ownable, ApproveAndCallFallBack {
    uint256 public constant DURATION = 30 days;
    // Aragon Network Token
    IERC20 public ANT = IERC20(0x960b236A07cf122663c4303350609A66A7B288C0);

    uint256 public periodFinish;
    uint256 public rewardRate;
    uint256 public lastUpdateTime;
    uint256 public rewardPerTokenStored;
    mapping(address => uint256) public userRewardPerTokenPaid;
    mapping(address => uint256) public rewards;

    event RewardAdded(uint256 reward);
    event Staked(address indexed user, uint256 amount);
    event Withdrawn(address indexed user, uint256 amount);
    event RewardPaid(address indexed user, uint256 reward);
    event FundsRecovered(address token, uint256 amount);

    modifier updateReward(address account) {
        rewardPerTokenStored = rewardPerToken();
        lastUpdateTime = lastTimeRewardApplicable();
        if (account != address(0)) {
            rewards[account] = earned(account);
            userRewardPerTokenPaid[account] = rewardPerTokenStored;
        }
        _;
    }

    function lastTimeRewardApplicable() public view returns (uint256) {
        return Math.min(block.timestamp, periodFinish);
    }

    function rewardPerToken() public view returns (uint256) {
        if (totalSupply() == 0) {
            return rewardPerTokenStored;
        }
        return
            rewardPerTokenStored.add(
                lastTimeRewardApplicable()
                    .sub(lastUpdateTime)
                    .mul(rewardRate)
                    .mul(1e18)
                    .div(totalSupply())
            );
    }

    function earned(address account) public view returns (uint256) {
        return
            balanceOf(account)
                .mul(rewardPerToken().sub(userRewardPerTokenPaid[account]))
                .div(1e18)
                .add(rewards[account])
            ;
    }

    // stake visibility is public as overriding LPTokenWrapper's stake() function
    function stake(uint256 amount) public updateReward(msg.sender) {
        require(amount > 0, "Cannot stake 0");
        super.stake(amount);
        emit Staked(msg.sender, amount);
    }

    function withdraw(uint256 amount) public updateReward(msg.sender) {
        require(amount > 0, "Cannot withdraw 0");
        super.withdraw(amount);
        emit Withdrawn(msg.sender, amount);
    }

    function exit() external {
        withdraw(balanceOf(msg.sender));
        getReward();
    }

    function getReward() public updateReward(msg.sender) {
        uint256 reward = earned(msg.sender);
        if (reward > 0) {
            rewards[msg.sender] = 0;
            ANT.safeTransfer(msg.sender, reward);
            emit RewardPaid(msg.sender, reward);
        }
    }

    /**
     * @dev This function must be triggered by the contribution token approve-and-call fallback.
     *      It will update reward rate and time.
     * @param _from Address of the original caller approving the tokens
     * @param _amount Amount of reward tokens added to the pool
     * @param _token Address of the token triggering the approve-and-call fallback
     */
    function receiveApproval(address _from, uint256 _amount, address _token, bytes calldata) external updateReward(address(0)) {
        require(_amount > 0, "Cannot approve 0");
        require(
            _token == msg.sender && _token == address(ANT),
            "Wrong token"
        );

        if (block.timestamp >= periodFinish) {
            rewardRate = _amount.div(DURATION);
        } else {
            uint256 remaining = periodFinish.sub(block.timestamp);
            uint256 leftover = remaining.mul(rewardRate);
            rewardRate = _amount.add(leftover).div(DURATION);
        }
        lastUpdateTime = block.timestamp;
        periodFinish = block.timestamp.add(DURATION);

        ANT.safeTransferFrom(_from, address(this), _amount);

        emit RewardAdded(_amount);
    }

    /**
     * @notice Recover all `_token` sent to this contract and send them to the owner.
     *         It doesn’t work for reward and liquidity tokens.
     * @param _token ERC20 token to recover, zero for ETH
     */
    function recoverFunds(IERC20 _token) external onlyOwner {
        require(_token != ANT, "Cannot recover ANT");
        require(_token != BPT, "Cannot recover BPT");

        address owner = owner();
        uint256 amount;
        if (address(_token) == address(0)) { // ETH
            amount = address(this).balance;
            // solium-disable-next-line security/no-call-value
            (bool success, ) = owner.call.value(amount)("");
            require(success, "Transfer failed.");
        } else { // ERC20 tokens
            amount = _token.balanceOf(address(this));
            _token.safeTransfer(owner, amount);
        }

        emit FundsRecovered(address(_token), amount);
    }
}
