const { BN, expectRevert, time } = require('openzeppelin-test-helpers');
const { expect } = require('chai');

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

function commonTests (artifacts, web3, accounts, LiquidityRewardsPool) {
    const [_, wallet1, wallet2, wallet3, wallet4] = accounts;

    const Lpt = artifacts.require('LptMock');
    const Ant = artifacts.require('AntMock');

    const ZERO_DATA = '0x00';

    async function getAndCheckReward (ant, pool, user, amount) {
        const initialBalance = await ant.balanceOf(user);
        await pool.getReward({ from: user });
        const finalBalance = await ant.balanceOf(user);
        expect(finalBalance.sub(initialBalance)).to.be.bignumber.almostEqualDiv1e18(amount);
    };

    describe('Unipool', async function () {
        beforeEach(async function () {
            this.lpt = await Lpt.new();
            this.ant = await Ant.new('Aragon Network Token', 'ANT', 18);
            this.pool = await LiquidityRewardsPool.new(this.lpt.address, this.ant.address);

            await this.ant.mint(wallet1, web3.utils.toWei('1000000'));
            await this.lpt.mint(wallet1, web3.utils.toWei('1000'));
            await this.lpt.mint(wallet2, web3.utils.toWei('1000'));
            await this.lpt.mint(wallet3, web3.utils.toWei('1000'));
            await this.lpt.mint(wallet4, web3.utils.toWei('1000'));

            await this.lpt.approve(this.pool.address, new BN(2).pow(new BN(255)), { from: wallet1 });
            await this.lpt.approve(this.pool.address, new BN(2).pow(new BN(255)), { from: wallet2 });
            await this.lpt.approve(this.pool.address, new BN(2).pow(new BN(255)), { from: wallet3 });
            await this.lpt.approve(this.pool.address, new BN(2).pow(new BN(255)), { from: wallet4 });

            this.started = (await time.latest()).addn(10);
            await time.increaseTo(this.started);
        });

        it('Two stakers with the same stakes wait 30 days', async function () {
            // 72000 ANT per week for 3 weeks
            await this.ant.approveAndCall(this.pool.address, web3.utils.toWei('72000'), ZERO_DATA, { from: wallet1 });

            expect(await this.ant.balanceOf(this.pool.address)).to.be.bignumber.almostEqualDiv1e18(web3.utils.toWei('72000'));
            expect(await this.pool.rewardPerToken()).to.be.bignumber.almostEqualDiv1e18('0');
            expect(await this.pool.earned(wallet1)).to.be.bignumber.equal('0');
            expect(await this.pool.earned(wallet2)).to.be.bignumber.equal('0');

            await this.pool.stake(web3.utils.toWei('1'), { from: wallet1 });
            expect(await this.pool.earned(wallet1)).to.be.bignumber.equal('0');

            await this.pool.stake(web3.utils.toWei('1'), { from: wallet2 });
            expect(await this.pool.earned(wallet2)).to.be.bignumber.equal('0');

            expect(await this.pool.rewardPerToken()).to.be.bignumber.almostEqualDiv1e18('0');

            await time.increaseTo(this.started.add(time.duration.days(30)));

            expect(await this.pool.rewardPerToken()).to.be.bignumber.almostEqualDiv1e18(web3.utils.toWei('36000'));
            expect(await this.pool.earned(wallet1)).to.be.bignumber.almostEqualDiv1e18(web3.utils.toWei('36000'));
            expect(await this.pool.earned(wallet2)).to.be.bignumber.almostEqualDiv1e18(web3.utils.toWei('36000'));

            await getAndCheckReward(this.ant, this.pool, wallet1, web3.utils.toWei('36000'));
            await getAndCheckReward(this.ant, this.pool, wallet2, web3.utils.toWei('36000'));
        });

        it('Two stakers with the different (1:3) stakes wait 30 days', async function () {
            // 72000 ANT per week
            await this.ant.approveAndCall(this.pool.address, web3.utils.toWei('72000'), ZERO_DATA, { from: wallet1 });

            expect(await this.ant.balanceOf(this.pool.address)).to.be.bignumber.almostEqualDiv1e18(web3.utils.toWei('72000'));
            expect(await this.pool.rewardPerToken()).to.be.bignumber.almostEqualDiv1e18('0');
            expect(await this.pool.balanceOf(wallet1)).to.be.bignumber.equal('0');
            expect(await this.pool.balanceOf(wallet2)).to.be.bignumber.equal('0');
            expect(await this.pool.earned(wallet1)).to.be.bignumber.equal('0');
            expect(await this.pool.earned(wallet2)).to.be.bignumber.equal('0');

            await this.pool.stake(web3.utils.toWei('1'), { from: wallet1 });
            expect(await this.pool.earned(wallet1)).to.be.bignumber.equal('0');

            await this.pool.stake(web3.utils.toWei('3'), { from: wallet2 });
            expect(await this.pool.earned(wallet2)).to.be.bignumber.equal('0');

            expect(await this.pool.rewardPerToken()).to.be.bignumber.almostEqualDiv1e18('0');

            await time.increaseTo(this.started.add(time.duration.days(30)));

            expect(await this.pool.rewardPerToken()).to.be.bignumber.almostEqualDiv1e18(web3.utils.toWei('18000'));
            expect(await this.pool.earned(wallet1)).to.be.bignumber.almostEqualDiv1e18(web3.utils.toWei('18000'));
            expect(await this.pool.earned(wallet2)).to.be.bignumber.almostEqualDiv1e18(web3.utils.toWei('54000'));

            await getAndCheckReward(this.ant, this.pool, wallet1, web3.utils.toWei('18000'));
            await getAndCheckReward(this.ant, this.pool, wallet2, web3.utils.toWei('54000'));
        });

        it('Two stakers with the different (1:3) stakes wait 60 days', async function () {
            //
            // 1x: +----------------+ = 72k for 30d + 18k for 60d
            // 3x:         +--------+ =  0k for 30d + 54k for 60d
            //

            // 72000 ANT per week
            await this.ant.approveAndCall(this.pool.address, web3.utils.toWei('72000'), ZERO_DATA, { from: wallet1 });

            expect(await this.ant.balanceOf(this.pool.address)).to.be.bignumber.almostEqualDiv1e18(web3.utils.toWei('72000'));

            await this.pool.stake(web3.utils.toWei('1'), { from: wallet1 });

            await time.increaseTo(this.started.add(time.duration.days(30)));

            await this.pool.stake(web3.utils.toWei('3'), { from: wallet2 });

            expect(await this.pool.rewardPerToken()).to.be.bignumber.almostEqualDiv1e18(web3.utils.toWei('72000'));
            expect(await this.pool.earned(wallet1)).to.be.bignumber.almostEqualDiv1e18(web3.utils.toWei('72000'));
            expect(await this.pool.earned(wallet2)).to.be.bignumber.almostEqualDiv1e18(web3.utils.toWei('0'));

            // Forward to week 3 and notifyReward weekly
            for (let i = 1; i < 3; i++) {
                await time.increaseTo(this.started.add(time.duration.days(30 * (i + 1))));
                await this.ant.approveAndCall(this.pool.address, web3.utils.toWei('72000'), ZERO_DATA, { from: wallet1 });
            }

            expect(await this.pool.rewardPerToken()).to.be.bignumber.almostEqualDiv1e18(web3.utils.toWei('90000'));
            expect(await this.pool.earned(wallet1)).to.be.bignumber.almostEqualDiv1e18(web3.utils.toWei('90000'));
            expect(await this.pool.earned(wallet2)).to.be.bignumber.almostEqualDiv1e18(web3.utils.toWei('54000'));

            await getAndCheckReward(this.ant, this.pool, wallet1, web3.utils.toWei('90000'));
            await getAndCheckReward(this.ant, this.pool, wallet2, web3.utils.toWei('54000'));
        });

        it('Three stakers with the different (1:3:5) stakes wait 90 days', async function () {
            //
            // 1x: +----------------+--------+ = 18k for 30d +  8k for 60d + 12k for 90d
            // 3x: +----------------+          = 54k for 30d + 24k for 60d +  0k for 90d
            // 5x:         +-----------------+ =  0k for 30d + 40k for 60d + 60k for 90d
            //

            // 72000 ANT per week for 3 weeks
            await this.ant.approveAndCall(this.pool.address, web3.utils.toWei('72000'), ZERO_DATA, { from: wallet1 });
            expect(await this.ant.balanceOf(this.pool.address)).to.be.bignumber.almostEqualDiv1e18(web3.utils.toWei('72000'));

            await this.pool.stake(web3.utils.toWei('1'), { from: wallet1 });
            await this.pool.stake(web3.utils.toWei('3'), { from: wallet2 });

            await time.increaseTo(this.started.add(time.duration.days(30)));

            await this.pool.stake(web3.utils.toWei('5'), { from: wallet3 });

            expect(await this.pool.rewardPerToken()).to.be.bignumber.almostEqualDiv1e18(web3.utils.toWei('18000'));
            expect(await this.pool.earned(wallet1)).to.be.bignumber.almostEqualDiv1e18(web3.utils.toWei('18000'));
            expect(await this.pool.earned(wallet2)).to.be.bignumber.almostEqualDiv1e18(web3.utils.toWei('54000'));

            await this.ant.approveAndCall(this.pool.address, web3.utils.toWei('72000'), ZERO_DATA, { from: wallet1 });
            await time.increaseTo(this.started.add(time.duration.days(60)));

            expect(await this.pool.rewardPerToken()).to.be.bignumber.almostEqualDiv1e18(web3.utils.toWei('26000')); // 18k + 8k
            expect(await this.pool.earned(wallet1)).to.be.bignumber.almostEqualDiv1e18(web3.utils.toWei('26000'));
            expect(await this.pool.earned(wallet2)).to.be.bignumber.almostEqualDiv1e18(web3.utils.toWei('78000'));
            expect(await this.pool.earned(wallet3)).to.be.bignumber.almostEqualDiv1e18(web3.utils.toWei('40000'));

            await this.pool.exit({ from: wallet2 });

            await this.ant.approveAndCall(this.pool.address, web3.utils.toWei('72000'), ZERO_DATA, { from: wallet1 });
            await time.increaseTo(this.started.add(time.duration.days(90)));

            expect(await this.pool.rewardPerToken()).to.be.bignumber.almostEqualDiv1e18(web3.utils.toWei('38000')); // 18k + 8k + 12k
            expect(await this.pool.earned(wallet1)).to.be.bignumber.almostEqualDiv1e18(web3.utils.toWei('38000'));
            expect(await this.pool.earned(wallet2)).to.be.bignumber.almostEqualDiv1e18(web3.utils.toWei('0'));
            expect(await this.pool.earned(wallet3)).to.be.bignumber.almostEqualDiv1e18(web3.utils.toWei('100000'));

            await getAndCheckReward(this.ant, this.pool, wallet1, web3.utils.toWei('38000'));
            await getAndCheckReward(this.ant, this.pool, wallet3, web3.utils.toWei('100000'));
        });

        it('One staker on 2 durations with gap', async function () {
            // 72000 ANT for 60 days
            await this.ant.approveAndCall(this.pool.address, web3.utils.toWei('72000'), ZERO_DATA, { from: wallet1 });
            expect(await this.ant.balanceOf(this.pool.address)).to.be.bignumber.almostEqualDiv1e18(web3.utils.toWei('72000'));

            await this.pool.stake(web3.utils.toWei('1'), { from: wallet1 });

            await time.increaseTo(this.started.add(time.duration.days(60)));

            expect(await this.pool.rewardPerToken()).to.be.bignumber.almostEqualDiv1e18(web3.utils.toWei('72000'));
            expect(await this.pool.earned(wallet1)).to.be.bignumber.almostEqualDiv1e18(web3.utils.toWei('72000'));

            // 72000 ANT for 90 days
            await this.ant.approveAndCall(this.pool.address, web3.utils.toWei('72000'), ZERO_DATA, { from: wallet1 });

            await time.increaseTo(this.started.add(time.duration.days(90)));

            expect(await this.pool.rewardPerToken()).to.be.bignumber.almostEqualDiv1e18(web3.utils.toWei('144000'));
            expect(await this.pool.earned(wallet1)).to.be.bignumber.almostEqualDiv1e18(web3.utils.toWei('144000'));

            await getAndCheckReward(this.ant, this.pool, wallet1, web3.utils.toWei('144000'));
        });

        it('Reward from mocked distribution to 10,000', async function () {
            // 10000 ANT for 30 days
            await this.ant.approveAndCall(this.pool.address, web3.utils.toWei('10000'), ZERO_DATA, { from: wallet1 });
            expect(await this.ant.balanceOf(this.pool.address)).to.be.bignumber.almostEqualDiv1e18(web3.utils.toWei('10000'));

            expect(await this.pool.rewardPerToken()).to.be.bignumber.almostEqualDiv1e18('0');
            expect(await this.pool.balanceOf(wallet1)).to.be.bignumber.equal('0');
            expect(await this.pool.balanceOf(wallet2)).to.be.bignumber.equal('0');
            expect(await this.pool.earned(wallet1)).to.be.bignumber.equal('0');
            expect(await this.pool.earned(wallet2)).to.be.bignumber.equal('0');

            await this.pool.stake(web3.utils.toWei('1'), { from: wallet1 });
            expect(await this.pool.earned(wallet1)).to.be.bignumber.equal('0');

            await this.pool.stake(web3.utils.toWei('3'), { from: wallet2 });
            expect(await this.pool.earned(wallet2)).to.be.bignumber.equal('0');

            expect(await this.pool.rewardPerToken()).to.be.bignumber.almostEqualDiv1e18('0');

            await time.increaseTo(this.started.add(time.duration.days(30)));

            expect(await this.pool.rewardPerToken()).to.be.bignumber.almostEqualDiv1e18(web3.utils.toWei('2500'));
            expect(await this.pool.earned(wallet1)).to.be.bignumber.almostEqualDiv1e18(web3.utils.toWei('2500'));
            expect(await this.pool.earned(wallet2)).to.be.bignumber.almostEqualDiv1e18(web3.utils.toWei('7500'));

            await getAndCheckReward(this.ant, this.pool, wallet1, web3.utils.toWei('2500'));
            await getAndCheckReward(this.ant, this.pool, wallet2, web3.utils.toWei('7500'));
        });

        // TODO: if for some period the total supply is zero, rewards for that period are lost!
        it('stake late solo', async function () {
            // reward
            await this.ant.approveAndCall(this.pool.address, web3.utils.toWei('50000'), ZERO_DATA, { from: wallet1 });
            expect(await this.pool.earned(wallet2)).to.be.bignumber.equal('0');

            // day 15
            await time.increaseTo(this.started.add(time.duration.days(15)));
            // stake
            await this.pool.stake(web3.utils.toWei('1'), { from: wallet2 });
            expect(await this.pool.earned(wallet2)).to.be.bignumber.equal('0');

            // day 30
            await time.increaseTo(this.started.add(time.duration.days(30)));
            expect(await this.pool.earned(wallet2)).to.be.bignumber.almostEqualDiv1e18(web3.utils.toWei('25000'));

            // day 45
            await time.increaseTo(this.started.add(time.duration.days(45)));
            expect(await this.pool.earned(wallet2)).to.be.bignumber.almostEqualDiv1e18(web3.utils.toWei('25000'));

            await getAndCheckReward(this.ant, this.pool, wallet2, web3.utils.toWei('25000'));
        });

        it('withdraw early solo', async function () {
            // stake
            await this.pool.stake(web3.utils.toWei('1'), { from: wallet2 });
            // reward
            await this.ant.approveAndCall(this.pool.address, web3.utils.toWei('50000'), ZERO_DATA, { from: wallet1 });
            expect(await this.pool.earned(wallet2)).to.be.bignumber.equal('0');

            // day 15
            await time.increaseTo(this.started.add(time.duration.days(15)));
            expect(await this.pool.earned(wallet2)).to.be.bignumber.almostEqualDiv1e18(web3.utils.toWei('25000'));

            // withdraw
            await this.pool.withdraw(web3.utils.toWei('1'), { from: wallet2 });
            expect(await this.pool.earned(wallet2)).to.be.bignumber.almostEqualDiv1e18(web3.utils.toWei('25000'));

            // day 30
            await time.increaseTo(this.started.add(time.duration.days(30)));
            expect(await this.pool.earned(wallet2)).to.be.bignumber.almostEqualDiv1e18(web3.utils.toWei('25000'));

            // day 45
            await time.increaseTo(this.started.add(time.duration.days(45)));
            expect(await this.pool.earned(wallet2)).to.be.bignumber.almostEqualDiv1e18(web3.utils.toWei('25000'));

            await getAndCheckReward(this.ant, this.pool, wallet2, web3.utils.toWei('25000'));
        });

        it('stake late with another one', async function () {
            // stake 1
            await this.pool.stake(web3.utils.toWei('1'), { from: wallet1 });
            // reward
            await this.ant.approveAndCall(this.pool.address, web3.utils.toWei('60000'), ZERO_DATA, { from: wallet1 });
            expect(await this.pool.earned(wallet2)).to.be.bignumber.equal('0');

            // day 15
            await time.increaseTo(this.started.add(time.duration.days(15)));
            // stake 2
            await this.pool.stake(web3.utils.toWei('2'), { from: wallet2 });
            expect(await this.pool.earned(wallet2)).to.be.bignumber.equal('0');

            // day 30
            await time.increaseTo(this.started.add(time.duration.days(30)));
            expect(await this.pool.earned(wallet2)).to.be.bignumber.almostEqualDiv1e18(web3.utils.toWei('20000'));

            // day 45
            await time.increaseTo(this.started.add(time.duration.days(45)));
            expect(await this.pool.earned(wallet2)).to.be.bignumber.almostEqualDiv1e18(web3.utils.toWei('20000'));

            await getAndCheckReward(this.ant, this.pool, wallet2, web3.utils.toWei('20000'));
        });

        it('withdraw early with another one', async function () {
            // stake 1
            await this.pool.stake(web3.utils.toWei('1'), { from: wallet1 });
            // stake 2
            await this.pool.stake(web3.utils.toWei('2'), { from: wallet2 });

            // reward
            await this.ant.approveAndCall(this.pool.address, web3.utils.toWei('60000'), ZERO_DATA, { from: wallet1 });
            expect(await this.pool.earned(wallet2)).to.be.bignumber.equal('0');

            // day 15
            await time.increaseTo(this.started.add(time.duration.days(15)));
            expect(await this.pool.earned(wallet2)).to.be.bignumber.almostEqualDiv1e18(web3.utils.toWei('20000'));
            // withdraw
            await this.pool.withdraw(web3.utils.toWei('2'), { from: wallet2 });
            expect(await this.pool.earned(wallet2)).to.be.bignumber.almostEqualDiv1e18(web3.utils.toWei('20000'));

            // day 30
            await time.increaseTo(this.started.add(time.duration.days(30)));
            expect(await this.pool.earned(wallet2)).to.be.bignumber.almostEqualDiv1e18(web3.utils.toWei('20000'));

            // day 45
            await time.increaseTo(this.started.add(time.duration.days(45)));
            expect(await this.pool.earned(wallet2)).to.be.bignumber.almostEqualDiv1e18(web3.utils.toWei('20000'));

            await getAndCheckReward(this.ant, this.pool, wallet2, web3.utils.toWei('20000'));
        });

        it('can’t withdraw zero amount', async function () {
            await this.pool.stake(web3.utils.toWei('1'), { from: wallet1 });
            // reward
            await this.ant.approveAndCall(this.pool.address, web3.utils.toWei('60000'), ZERO_DATA, { from: wallet1 });

            await time.increaseTo(this.started.add(time.duration.days(30)));

            await expectRevert(this.pool.withdraw('0', { from: wallet1 }), 'Cannot withdraw 0');
            await this.pool.withdraw(web3.utils.toWei('1'), { from: wallet1 });
        });

        it('can’t exit after withdrawing all', async function () {
            await this.pool.stake(web3.utils.toWei('1'), { from: wallet1 });
            // reward
            await this.ant.approveAndCall(this.pool.address, web3.utils.toWei('60000'), ZERO_DATA, { from: wallet1 });

            await time.increaseTo(this.started.add(time.duration.days(30)));

            await this.pool.withdraw(web3.utils.toWei('1'), { from: wallet1 });
            await expectRevert(this.pool.exit({ from: wallet1 }), 'Cannot withdraw 0');
        });

        it('can get reward', async function () {
            await this.pool.stake(web3.utils.toWei('1'), { from: wallet2 });
            // reward
            await this.ant.approveAndCall(this.pool.address, web3.utils.toWei('60000'), ZERO_DATA, { from: wallet1 });

            await time.increaseTo(this.started.add(time.duration.days(30)));

            await getAndCheckReward(this.ant, this.pool, wallet2, web3.utils.toWei('60000'));
        });

        it('can’t call approveAndCall with amount zero', async function () {
            await expectRevert(this.ant.approveAndCall(this.pool.address, '0', ZERO_DATA, { from: wallet1 }), 'Cannot approve 0');
        });

        it('can’t call approveAndCall from a different token', async function () {
            const token = await Ant.new('Another New Token', 'ANT', 18);
            await expectRevert(token.approveAndCall(this.pool.address, web3.utils.toWei('60000'), ZERO_DATA, { from: wallet1 }), 'Wrong token');
        });
    });
}

module.exports = commonTests
