pragma solidity ^0.5.0;

import "../Unipool.sol";


contract UnipoolMock is Unipool {

    constructor(IERC20 uniToken, IERC20 antToken) public {
        UNI = uniToken;
        ANT = antToken;
    }
}
