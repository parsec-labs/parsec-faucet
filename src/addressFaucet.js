/**
 * Copyright (c) 2018-present, Leap DAO (leapdao.org)
 *
 * This source code is licensed under the Mozilla Public License Version 2.0
 * found in the LICENSE file in the root directory of this source tree.
 */

const AWS = require('aws-sdk');
const { isValidAddress } = require('ethereumjs-util');
const { Queue, Errors } = require('leap-lambda-boilerplate');
const Db = require('./utils/db');
const util = require('ethereumjs-util');
const Web3 = require("web3");
const ERC721ABI = [
  {
    constant: true,
    inputs: [
      {
        name: "owner",
        type: "address",
      },
    ],
    name: "balanceOf",
    outputs: [
      {
        name: "balance",
        type: "uint256",
      },
    ],
    payable: false,
    stateMutability: "view",
    type: "function",
  },
];
const votingBalanceCardColor = 49159;

const checkSignature = (nonce, signature) => {

  nonce = "\x19Ethereum Signed Message:\n" + nonce.length + nonce;
  nonce = util.keccak(nonce);
  const sig = signature;
  const {v, r, s} = util.fromRpcSig(sig);
  const pubKey  = util.ecrecover(util.toBuffer(nonce), v, r, s);
  const addrBuf = util.pubToAddress(pubKey);
  const addr    = util.bufferToHex(addrBuf);
  return addr;
}

exports.checkSignature = checkSignature;

const handleEthTurin = async (body, tokenContract, db, queue) => {
  const { created } = await db.getAddr(body.address);
  const dayAgo = Date.now() - (120 * 60 * 60 * 1000); // 5 days
  if (dayAgo < created) {
    throw new Errors.BadRequest('not enough time passed since the last claim');
  }

  // check signature
  const recovered = checkSignature(body.toAddress, body.sig);
  if (body.address !== recovered) {
    throw new Errors.BadRequest(`address not signer: ${body.address}, recovered: ${recovered}`);
  }

  // todo: check ownership of NFT
  const count = await tokenContract.balanceOf(body.adddress);
  if (count !== 0) {
    throw new Errors.BadRequest(`${body.adddress} not token holder`);
  }

  if (body.color !== 4) {
    throw new Errors.BadRequest('wrong voice credit color');
  }

  await queue.put(JSON.stringify({address, color: body.color, nftColor: votingBalanceCardColor}));
  // todo: also send balance card
  await db.setAddr(address);

  return { 
    statusCode: 200,
    body: { address, color }
  };
}

exports.handleEthTurin = handleEthTurin;

exports.handler = async (event, context) => {
  context.callbackWaitsForEmptyEventLoop = true;

  const body = typeof event.body === 'string' ? JSON.parse(event.body) : event.body;
  const address = body.address;
  const color = parseInt(body.color) || 0;

  const awsAccountId = context.invokedFunctionArn.split(':')[4];
  const queueUrl = `https://sqs.${process.env.REGION}.amazonaws.com/${awsAccountId}/${process.env.QUEUE_NAME}`;
  const nftAddr = process.env.NFT_ADDR;
  const providerUrl = process.env.PROVIDER_URL;

  const queue = new Queue(new AWS.SQS(), queueUrl);
  const db = new Db(process.env.TABLE_NAME);

  const web3 = new Web3(providerUrl);
  const tokenContract = web3.eth.Contract(ERC721ABI, nftAddr);
  
  if (!isValidAddress(address)) {
    throw new Errors.BadRequest(`Not a valid Ethereum address: ${address}`);
  }

  if (color > 0 && body.sig) {
    return handleEthTurin(body, tokenContract, db, queue);
  }

  const { created } = await db.getAddr(address);
  const dayAgo = Date.now() - (24 * 60 * 60 * 1000);
  if (dayAgo < created) {
    throw new Errors.BadRequest(`not enough time passed since the last claim`);
  }

  await queue.put(JSON.stringify({address, color}));
  await db.setAddr(address);

  return { 
    statusCode: 200,
    body: { address, color }
  };
};
