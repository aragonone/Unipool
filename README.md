[![Build Status](https://travis-ci.org/aragon/Unipool.svg?branch=master)](https://travis-ci.org/aragon/Unipool)
[![Coverage Status](https://coveralls.io/repos/github/k06a/Unipool/badge.svg?branch=master)](https://coveralls.io/github/k06a/Unipool?branch=master)

# ANT Unipool

Staking pool for ANT liquidity rewards. Forked from [Synthetix]().

Owner of the contract pours ANT to the contract to be shared as rewards during 30 days.
Users stake their liquidity tokens and receive rewards from that pool directly proportional to the period of time they had their liquidity tokens staked and to their share out of the total stake.

For more context see those blog posts by Synthetix:

https://blog.synthetix.io/uniswap-seth-pool-incentives/
https://blog.synthetix.io/new-uniswap-seth-lp-reward-system/

And this blog post announcing Aragon rewards program:

https://aragon.org/blog/liquidity-rewards

The frontend is here:

https://liquidity.aragon.org/

## Providing rewards

:warning: To make sure that rewards are accounted for properly by the contract, an `approveAndCall` must be called on the [ANT contract](https://etherscan.io/address/0x960b236a07cf122663c4303350609a66a7b288c0), with the following params:

- Unipool address as the `target`
- The reward contributed (50k) as the `amount` (with the 18 decimals)
- Empty `data`

Don’t send `ANT` to this contract by direct regular transfers!

## Staking liquidity tokens

### Stake

To be eligible to claim rewards, users must call `stake` function on this contract with the amount they want to contribute as param. This way their share of the rewards will be properly accounted for.

Previously, an approval to this contract must be done on the liquidity token contract.

Don’t send liquidity tokens (nor any other tokens) to this contract by direct regular transfers!

### Unstake

If users want to unstake part or all of their contribution, they can call `withdraw` with the amount to get the liquidity tokens back to their wallets.

They can also call `exit`, that will unstake all their balance and claim their rewards.

### Claim

To claim their share of the rewards, users can call `getReward` at any time.

They can also call `exit`, that will unstake all their balance and claim their rewards.

## :warning: Known issue

If during the reward period (30 days) the total amount of stake in the contract is zero for some time, the reward corresponding to that time will be lost (stuck in the contract). This could happen if:

- Everybody withdraws before the end of the reward period. Very unlikely, as people would miss the rewards.
- If rewards are added to the pool before anybody stakes. This is a little bit more likely, although with proper advertising it shouldn’t. Besides, there is an easy workaround: owner can stake a tiny amount, before adding the funds.

## Uniswap

- Liquidity pool:
https://uniswap.info/pair/0xfa19de406e8f5b9100e4dd5cad8a503a6d686efe

- Liquidity token: Uniswap ETH/ANT UNI-v2, deployed here:

https://etherscan.io/address/0xfa19de406e8f5b9100e4dd5cad8a503a6d686efe

- Mainnet deployment:

https://etherscan.io/address/0xEA4D68CF86BcE59Bf2bFA039B97794ce2c43dEBC

## Balancer

- Liquidity pool:

https://pools.balancer.exchange/#/pool/0x2cF9106fAF2C5C8713035d40df655fB1B9B0F9B9

- Liquidity token: Balancer WETH/ANT BPT, deployed here:

https://etherscan.io/address/0x2cF9106fAF2C5C8713035d40df655fB1B9B0F9B9

- Mainnet deployment:

TODO
