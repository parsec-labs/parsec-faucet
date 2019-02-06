/**
 * Copyright (c) 2018-present, Leap DAO (leapdao.org)
 *
 * This source code is licensed under the Mozilla Public License Version 2.0
 * found in the LICENSE file in the root directory of this source tree.
 */

const Contract = require('./contract');

const TOKEN_ABI = [{ constant: true, inputs: [{ name: '_owner', type: 'address' }], name: 'balanceOf', outputs: [{ name: '', type: 'uint256' }], payable: false, stateMutability: 'view', type: 'function' }, { constant: false, inputs: [{ name: '_to', type: 'address' }, { name: '_amountBabz', type: 'uint256' }], name: 'transfer', outputs: [{ name: '', type: 'bool' }], payable: false, stateMutability: 'nonpayable', type: 'function' }];

module.exports = class Token extends Contract {

  constructor(web3, senderAddr, sqs, queueUrl, tokenAddr) {
    super(web3, senderAddr, sqs, queueUrl);
    this.tokenAddr = tokenAddr;
  }

  balanceOf(address) {
    const contract = this.web3.eth.contract(TOKEN_ABI).at(this.tokenAddr);
    return this.call(contract.balanceOf.call, address);
  }

  transfer(to, amount) {
    const contract = this.web3.eth.contract(TOKEN_ABI).at(this.tokenAddr);
    return this.sendTransaction(
      contract,
      'transfer',
      200000,
      [to, amount],
    );
  }

}
