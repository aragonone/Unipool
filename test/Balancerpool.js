const commonTests = require('./helpers/common');

const Balancerpool = artifacts.require('BalancerpoolMock');

contract('Balancerpool', function (accounts) {
    commonTests(artifacts, web3, accounts, Balancerpool);
});
