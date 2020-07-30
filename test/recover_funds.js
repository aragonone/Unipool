const { BN, expectRevert } = require('openzeppelin-test-helpers');
const { expect } = require('chai');
const truffleConfig = require('../truffle-config');

const Bpt = artifacts.require('UniMock');
const Ant = artifacts.require('AntMock');

const Balancerpool = artifacts.require('BalancerpoolMock');

const ZERO_ADDRESS = '0x' + '0'.repeat(40);

contract('Balancerpool', function ([_, owner, user, other]) {
    describe('Balancerpool', async function () {
        beforeEach(async function () {
            this.bal = await Bpt.new();
            this.bpt = await Bpt.new();
            this.ant = await Ant.new('Aragon Network Token', 'ANT', 18);
            this.pool = await Balancerpool.new(this.bpt.address, this.ant.address, { from: owner });
        });

        it('Owner can recover tokens', async function () {
            const recoverAmount = new BN(web3.utils.toWei('1000'));
            await this.bal.mint(this.pool.address, recoverAmount);

            const initialBalance = new BN(await this.bal.balanceOf(owner));
            await this.pool.recoverFunds(this.bal.address, { from: owner });
            const finalBalance = await this.bal.balanceOf(owner);

            expect(finalBalance).to.be.bignumber.equal(initialBalance.add(recoverAmount));
        });

        it('Owner can recover ETH', async function () {
            const recoverAmount = new BN(web3.utils.toWei('10'));
            await this.pool.sendTransaction({ from: other, value: recoverAmount });

            const initialBalance = new BN(await web3.eth.getBalance(owner));
            const receipt = await this.pool.recoverFunds(ZERO_ADDRESS, { from: owner });
            const txPrice = (new BN(receipt.receipt.gasUsed)).mul(new BN(truffleConfig.networks.development.gasPrice));
            const finalBalance = await web3.eth.getBalance(owner);

            expect(finalBalance).to.be.bignumber.equal(initialBalance.add(recoverAmount).sub(txPrice));
        });

        it('Owner can’t recover ANT', async function () {
            await this.ant.mint(this.pool.address, web3.utils.toWei('1000000'));

            await expectRevert(this.pool.recoverFunds(this.ant.address, { from: owner }), 'Cannot recover ANT');
        });

        it('Owner can’t recover BPT', async function () {
            await this.bpt.mint(this.pool.address, web3.utils.toWei('1000'));

            await expectRevert(this.pool.recoverFunds(this.bpt.address, { from: owner }), 'Cannot recover BPT');
        });

        it('Non-owner can’t call recoverFunds', async function () {
            await expectRevert(this.pool.recoverFunds(this.bal.address, { from: user }), 'Ownable: caller is not the owner');
        });
    });
});
