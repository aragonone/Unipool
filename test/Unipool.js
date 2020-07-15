const { BN, expectRevert, time } = require('openzeppelin-test-helpers');
const { expect } = require('chai');
const { utils: { toWei: wei } } = web3;

const Uni = artifacts.require('UniMock');
const Ant = artifacts.require('AntMock');
const Unipool = artifacts.require('UnipoolMock');

async function timeIncreaseTo (seconds) {
    const delay = 10 - new Date().getMilliseconds();
    await new Promise(resolve => setTimeout(resolve, delay));
    await time.increaseTo(seconds);
}

const almostEqualDiv1e18 = function (expectedOrig, actualOrig) {
    const _1e18 = new BN('10').pow(new BN('18'));
    const expected = expectedOrig.div(_1e18);
    const actual = actualOrig.div(_1e18);
    this.assert(
        expected.eq(actual) ||
        expected.addn(1).eq(actual) || expected.addn(2).eq(actual) ||
        actual.addn(1).eq(expected) || actual.addn(2).eq(expected),
        'expected #{act} to be almost equal #{exp}',
        'expected #{act} to be different from #{exp}',
        expectedOrig.toString(),
        actualOrig.toString(),
    );
};

require('chai').use(function (chai, utils) {
    chai.Assertion.overwriteMethod('almostEqualDiv1e18', function (original) {
        return function (value) {
            if (utils.flag(this, 'bignumber')) {
                var expected = new BN(value);
                var actual = new BN(this._obj);
                almostEqualDiv1e18.apply(this, [expected, actual]);
            } else {
                original.apply(this, arguments);
            }
        };
    });
});

const assertBalance = async function (promise, expectedValue) {
    expect(await promise).to.be.bignumber.almostEqualDiv1e18(wei(expectedValue));
};

contract('Unipool', function ([_, wallet1, wallet2, wallet3, wallet4]) {
    const ZERO_DATA = '0x00';

    describe('Unipool', async function () {
        beforeEach(async function () {
            this.uni = await Uni.new();
            this.ant = await Ant.new('Aragon Network Token', 'ANT', 18);
            this.pool = await Unipool.new(this.uni.address, this.ant.address);

            await this.ant.mint(wallet1, wei('1000000'));
            await this.uni.mint(wallet1, wei('1000'));
            await this.uni.mint(wallet2, wei('1000'));
            await this.uni.mint(wallet3, wei('1000'));
            await this.uni.mint(wallet4, wei('1000'));

            await this.uni.approve(this.pool.address, new BN(2).pow(new BN(255)), { from: wallet1 });
            await this.uni.approve(this.pool.address, new BN(2).pow(new BN(255)), { from: wallet2 });
            await this.uni.approve(this.pool.address, new BN(2).pow(new BN(255)), { from: wallet3 });
            await this.uni.approve(this.pool.address, new BN(2).pow(new BN(255)), { from: wallet4 });

            this.started = (await time.latest()).addn(10);
            await timeIncreaseTo(this.started);
        });

        it('Two stakers with the same stakes wait 30 days', async function () {
            // 72000 ANT per week for 3 weeks
            await this.ant.approveAndCall(this.pool.address, wei('72000'), ZERO_DATA, { from: wallet1 });

            await assertBalance(this.ant.balanceOf(this.pool.address), '72000');
            await assertBalance(this.pool.rewardPerToken(), '0');
            await assertBalance(this.pool.earned(wallet1), '0');
            await assertBalance(this.pool.earned(wallet2), '0');

            await this.pool.stake(wei('1'), { from: wallet1 });
            await this.pool.stake(wei('1'), { from: wallet2 });

            await assertBalance(this.pool.rewardPerToken(), '0');
            await assertBalance(this.pool.earned(wallet1), '0');
            await assertBalance(this.pool.earned(wallet2), '0');

            await timeIncreaseTo(this.started.add(time.duration.days(30)));

            await assertBalance(this.pool.rewardPerToken(), '36000');
            await assertBalance(this.pool.earned(wallet1), '36000');
            await assertBalance(this.pool.earned(wallet2), '36000');
        });

        it('Two stakers with the different (1:3) stakes wait 30 days', async function () {
            // 72000 ANT per week
            await this.ant.approveAndCall(this.pool.address, wei('72000'), ZERO_DATA, { from: wallet1 });

            await assertBalance(this.ant.balanceOf(this.pool.address), '72000');
            await assertBalance(this.pool.rewardPerToken(), '0');
            await assertBalance(this.pool.balanceOf(wallet1), '0');
            await assertBalance(this.pool.balanceOf(wallet2), '0');
            await assertBalance(this.pool.earned(wallet1), '0');
            await assertBalance(this.pool.earned(wallet2), '0');

            await this.pool.stake(wei('1'), { from: wallet1 });
            await this.pool.stake(wei('3'), { from: wallet2 });

            await assertBalance(this.pool.rewardPerToken(), '0');
            await assertBalance(this.pool.earned(wallet1), '0');
            await assertBalance(this.pool.earned(wallet2), '0');

            await timeIncreaseTo(this.started.add(time.duration.days(30)));

            await assertBalance(this.pool.rewardPerToken(), '18000');
            await assertBalance(this.pool.earned(wallet1), '18000');
            await assertBalance(this.pool.earned(wallet2), '54000');
        });

        it('Two stakers with the different (1:3) stakes wait 60 days', async function () {
            //
            // 1x: +----------------+ = 72k for 30d + 18k for 60d
            // 3x:         +--------+ =  0k for 30d + 54k for 60d
            //

            // 72000 ANT per week
            await this.ant.approveAndCall(this.pool.address, wei('72000'), ZERO_DATA, { from: wallet1 });

            await assertBalance(this.ant.balanceOf(this.pool.address), '72000');

            await this.pool.stake(wei('1'), { from: wallet1 });

            await timeIncreaseTo(this.started.add(time.duration.days(30)));

            await this.pool.stake(wei('3'), { from: wallet2 });

            await assertBalance(this.pool.rewardPerToken(), '72000');
            await assertBalance(this.pool.earned(wallet1), '72000');
            await assertBalance(this.pool.earned(wallet2), '0');

            // Forward to week 3 and notifyReward weekly
            for (let i = 1; i < 3; i++) {
                await timeIncreaseTo(this.started.add(time.duration.days(30 * (i + 1))));
                await this.ant.approveAndCall(this.pool.address, wei('72000'), ZERO_DATA, { from: wallet1 });
            }

            await assertBalance(this.pool.rewardPerToken(), '90000');
            await assertBalance(this.pool.earned(wallet1), '90000');
            await assertBalance(this.pool.earned(wallet2), '54000');
        });

        it('Three stakers with the different (1:3:5) stakes wait 90 days', async function () {
            //
            // 1x: +----------------+--------+ = 18k for 30d +  8k for 60d + 12k for 90d
            // 3x: +----------------+          = 54k for 30d + 24k for 60d +  0k for 90d
            // 5x:         +-----------------+ =  0k for 30d + 40k for 60d + 60k for 90d
            //

            // 72000 ANT per week for 3 weeks
            await this.ant.approveAndCall(this.pool.address, wei('72000'), ZERO_DATA, { from: wallet1 });
            await assertBalance(this.ant.balanceOf(this.pool.address), '72000');

            await this.pool.stake(wei('1'), { from: wallet1 });
            await this.pool.stake(wei('3'), { from: wallet2 });

            await timeIncreaseTo(this.started.add(time.duration.days(30)));

            await this.pool.stake(wei('5'), { from: wallet3 });

            await assertBalance(this.pool.rewardPerToken(), '18000');
            await assertBalance(this.pool.earned(wallet1), '18000');
            await assertBalance(this.pool.earned(wallet2), '54000');

            await this.ant.approveAndCall(this.pool.address, wei('72000'), ZERO_DATA, { from: wallet1 });
            await timeIncreaseTo(this.started.add(time.duration.days(60)));

            await assertBalance(this.pool.rewardPerToken(), '26000'); // 18k + 8k
            await assertBalance(this.pool.earned(wallet1), '26000');
            await assertBalance(this.pool.earned(wallet2), '78000');
            await assertBalance(this.pool.earned(wallet3), '40000');

            await this.pool.exit({ from: wallet2 });

            await this.ant.approveAndCall(this.pool.address, wei('72000'), ZERO_DATA, { from: wallet1 });
            await timeIncreaseTo(this.started.add(time.duration.days(90)));

            await assertBalance(this.pool.rewardPerToken(), '38000'); // 18k + 8k + 12k
            await assertBalance(this.pool.earned(wallet1), '38000');
            await assertBalance(this.pool.earned(wallet2), '0');
            await assertBalance(this.pool.earned(wallet3), '100000');
        });

        it('One staker on 2 durations with gap', async function () {
            // 72000 ANT for 60 days
            await this.ant.approveAndCall(this.pool.address, wei('72000'), ZERO_DATA, { from: wallet1 });
            await assertBalance(this.ant.balanceOf(this.pool.address), '72000');

            await this.pool.stake(wei('1'), { from: wallet1 });

            await timeIncreaseTo(this.started.add(time.duration.days(60)));

            await assertBalance(this.pool.rewardPerToken(), '72000');
            await assertBalance(this.pool.earned(wallet1), '72000');

            // 72000 ANT for 90 days
            await this.ant.approveAndCall(this.pool.address, wei('72000'), ZERO_DATA, { from: wallet1 });

            await timeIncreaseTo(this.started.add(time.duration.days(90)));

            await assertBalance(this.pool.rewardPerToken(), '144000');
            await assertBalance(this.pool.earned(wallet1), '144000');
        });

        it('Reward from mocked distribution to 10,000', async function () {
            // 10000 ANT for 30 days
            await this.ant.approveAndCall(this.pool.address, wei('10000'), ZERO_DATA, { from: wallet1 });
            await assertBalance(this.ant.balanceOf(this.pool.address), '10000');

            await assertBalance(this.pool.rewardPerToken(), '0');
            await assertBalance(this.pool.balanceOf(wallet1), '0');
            await assertBalance(this.pool.balanceOf(wallet2), '0');
            await assertBalance(this.pool.earned(wallet1), '0');
            await assertBalance(this.pool.earned(wallet2), '0');

            await this.pool.stake(wei('1'), { from: wallet1 });
            await this.pool.stake(wei('3'), { from: wallet2 });

            await assertBalance(this.pool.rewardPerToken(), '0');
            await assertBalance(this.pool.earned(wallet1), '0');
            await assertBalance(this.pool.earned(wallet2), '0');

            await timeIncreaseTo(this.started.add(time.duration.days(30)));

            await assertBalance(this.pool.rewardPerToken(), '2500');
            await assertBalance(this.pool.earned(wallet1), '2500');
            await assertBalance(this.pool.earned(wallet2), '7500');
        });

        // TODO: if for some period the total supply is zero, rewards for that period are lost!
        it('stake late solo', async function () {
            // reward
            await this.ant.approveAndCall(this.pool.address, wei('50000'), ZERO_DATA, { from: wallet1 });
            await assertBalance(this.pool.earned(wallet2), '0');

            // day 15
            await timeIncreaseTo(this.started.add(time.duration.days(15)));
            // stake
            await this.pool.stake(wei('1'), { from: wallet2 });
            await assertBalance(this.pool.earned(wallet2), '0');

            // day 30
            await timeIncreaseTo(this.started.add(time.duration.days(30)));
            await assertBalance(this.pool.earned(wallet2), '25000');

            // day 45
            await timeIncreaseTo(this.started.add(time.duration.days(45)));
            await assertBalance(this.pool.earned(wallet2), '25000');
        });

        it('withdraw early solo', async function () {
            // stake
            await this.pool.stake(wei('1'), { from: wallet2 });
            // reward
            await this.ant.approveAndCall(this.pool.address, wei('50000'), ZERO_DATA, { from: wallet1 });
            await assertBalance(this.pool.earned(wallet2), '0');

            // day 15
            await timeIncreaseTo(this.started.add(time.duration.days(15)));
            await assertBalance(this.pool.earned(wallet2), '25000');

            // withdraw
            await this.pool.withdraw(wei('1'), { from: wallet2 });
            await assertBalance(this.pool.earned(wallet2), '25000');

            // day 30
            await timeIncreaseTo(this.started.add(time.duration.days(30)));
            await assertBalance(this.pool.earned(wallet2), '25000');

            // day 45
            await timeIncreaseTo(this.started.add(time.duration.days(45)));
            await assertBalance(this.pool.earned(wallet2), '25000');
        });

        it('stake late with another one', async function () {
            // stake 1
            await this.pool.stake(wei('1'), { from: wallet1 });
            // reward
            await this.ant.approveAndCall(this.pool.address, wei('60000'), ZERO_DATA, { from: wallet1 });
            await assertBalance(this.pool.earned(wallet2), '0');

            // day 15
            await timeIncreaseTo(this.started.add(time.duration.days(15)));
            // stake 2
            await this.pool.stake(wei('2'), { from: wallet2 });
            await assertBalance(this.pool.earned(wallet2), '0');

            // day 30
            await timeIncreaseTo(this.started.add(time.duration.days(30)));
            await assertBalance(this.pool.earned(wallet2), '20000');

            // day 45
            await timeIncreaseTo(this.started.add(time.duration.days(45)));
            await assertBalance(this.pool.earned(wallet2), '20000');
        });

        it('withdraw early', async function () {
            // stake 1
            await this.pool.stake(wei('1'), { from: wallet1 });
            // stake 2
            await this.pool.stake(wei('2'), { from: wallet2 });

            // reward
            await this.ant.approveAndCall(this.pool.address, wei('60000'), ZERO_DATA, { from: wallet1 });
            await assertBalance(this.pool.earned(wallet2), '0');

            // day 15
            await timeIncreaseTo(this.started.add(time.duration.days(15)));
            await assertBalance(this.pool.earned(wallet2), '20000');
            // withdraw
            await this.pool.withdraw(wei('2'), { from: wallet2 });
            await assertBalance(this.pool.earned(wallet2), '20000');

            // day 30
            await timeIncreaseTo(this.started.add(time.duration.days(30)));
            await assertBalance(this.pool.earned(wallet2), '20000');

            // day 45
            await timeIncreaseTo(this.started.add(time.duration.days(45)));
            await assertBalance(this.pool.earned(wallet2), '20000');
        });

        it('can’t withdraw zero amount', async function () {
            await this.pool.stake(wei('1'), { from: wallet1 });
            // reward
            await this.ant.approveAndCall(this.pool.address, wei('60000'), ZERO_DATA, { from: wallet1 });

            await timeIncreaseTo(this.started.add(time.duration.days(30)));

            await expectRevert(this.pool.withdraw('0', { from: wallet1 }), 'Cannot withdraw 0');
            await this.pool.withdraw(wei('1'), { from: wallet1 });
        });

        it('can’t exit after withdrawing all', async function () {
            await this.pool.stake(wei('1'), { from: wallet1 });
            // reward
            await this.ant.approveAndCall(this.pool.address, wei('60000'), ZERO_DATA, { from: wallet1 });

            await timeIncreaseTo(this.started.add(time.duration.days(30)));

            await this.pool.withdraw(wei('1'), { from: wallet1 });
            await expectRevert(this.pool.exit({ from: wallet1 }), 'Cannot withdraw 0');
        });

        it('can get reward', async function () {
            await this.pool.stake(wei('1'), { from: wallet2 });
            // reward
            await this.ant.approveAndCall(this.pool.address, wei('60000'), ZERO_DATA, { from: wallet1 });

            await timeIncreaseTo(this.started.add(time.duration.days(30)));

            await this.pool.getReward({ from: wallet2 });
            await assertBalance(this.ant.balanceOf(wallet2), '60000');
        });

        it('can’t call approveAndCall with amount zero', async function () {
            await expectRevert(this.ant.approveAndCall(this.pool.address, '0', ZERO_DATA, { from: wallet1 }), 'Cannot approve 0');
        });

        it('can’t call approveAndCall from a different token', async function () {
            const token = await Ant.new('Another New Token', 'ANT', 18);
            await expectRevert(token.approveAndCall(this.pool.address, wei('60000'), ZERO_DATA, { from: wallet1 }), 'Wrong token');
        });
    });
});
