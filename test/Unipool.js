const commonTests = require('./helpers/common');

const Unipool = artifacts.require('UnipoolMock');

contract('Unipool', function (accounts) {
    commonTests(artifacts, web3, accounts, Unipool);
});
