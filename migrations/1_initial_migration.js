const Unipool = artifacts.require('./Unipool.sol');

module.exports = function (deployer) {
    deployer.deploy(Unipool);
};
