import { ethers, network, artifacts } from 'hardhat';
import { expect } from 'chai';
import { Provider } from '@ethersproject/providers';
import { Contract, ContractFactory, Wallet } from 'ethers';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';

// @ts-ignore
import { generateUtil } from 'eth-delegatable-utils';
import { getPrivateKeys } from '../utils/getPrivateKeys';
import { generateDelegation } from './utils';
import { deployMockContract, MockContract } from 'ethereum-waffle';

const { getSigners } = ethers;

async function getPermitSignature(signer, token, spender, value, deadline) {
  const [nonce, name, version, chainId] = await Promise.all([
    token.nonces(signer.address),
    token.name(),
    '1',
    signer.getChainId(),
  ]);

  return ethers.utils.splitSignature(
    await signer._signTypedData(
      {
        name,
        version,
        chainId,
        verifyingContract: token.address,
      },
      {
        Permit: [
          {
            name: 'owner',
            type: 'address',
          },
          {
            name: 'spender',
            type: 'address',
          },
          {
            name: 'value',
            type: 'uint256',
          },
          {
            name: 'nonce',
            type: 'uint256',
          },
          {
            name: 'deadline',
            type: 'uint256',
          },
        ],
      },
      {
        owner: signer.address,
        spender,
        value,
        nonce,
        deadline,
      },
    ),
  );
}

describe('DistrictERC20SubscriptionsEnforcer', () => {
  const CONTRACT_NAME = 'ERC20PermitSubscriptions';
  let ENFORCER_NAME = 'DistrictERC20PermitSubscriptionsEnforcer';
  let CONTRACT_INFO: any;
  let delegatableUtils: any;

  let signer0: SignerWithAddress;
  let signer1: SignerWithAddress;
  let verifyingContract: Contract;
  let verifyingContractFactory: ContractFactory;
  let erc20PermitTokenFactory: ContractFactory;
  let erc20PermitToken: Contract;
  let wallet0: Wallet;
  let wallet1: Wallet;
  let pk0: string;
  let pk1: string;
  let districtERC20SubscriptionsEnforcer: Contract;
  let districtERC20SubscriptionsEnforcerFactory: ContractFactory;

  before(async () => {
    [signer0, signer1] = await getSigners();
    [wallet0, wallet1] = getPrivateKeys(signer0.provider as unknown as Provider); //
    verifyingContractFactory = await ethers.getContractFactory(
      'VerifyingContractERC20PermitSubscriptions',
    );
    erc20PermitTokenFactory = await ethers.getContractFactory('TokenPermit');
    districtERC20SubscriptionsEnforcerFactory = await ethers.getContractFactory(
      'DistrictERC20PermitSubscriptionsEnforcer',
    );
    pk0 = wallet0._signingKey().privateKey;
    pk1 = wallet1._signingKey().privateKey;
  });

  beforeEach(async () => {
    let subPeriod = 5;
    await network.provider.request({
      method: 'hardhat_reset',
      params: [],
    });
    erc20PermitToken = await erc20PermitTokenFactory.connect(wallet0).deploy();
    await erc20PermitToken.deployed();

    verifyingContract = await verifyingContractFactory
      .connect(wallet0)
      .deploy(CONTRACT_NAME, erc20PermitToken.address, 1, subPeriod);
    await verifyingContract.deployed();

    districtERC20SubscriptionsEnforcer = await districtERC20SubscriptionsEnforcerFactory
      .connect(wallet0)
      .deploy();

    CONTRACT_INFO = {
      chainId: verifyingContract.deployTransaction.chainId,
      verifyingContract: verifyingContract.address,
      name: CONTRACT_NAME,
    };
    delegatableUtils = generateUtil(CONTRACT_INFO);
  });

  it('should SUCCEED to approveSubscriptiopn', async () => {
    expect(await erc20PermitToken.allowance(wallet0.address, verifyingContract.address)).to.equal(
      0,
    );
    const deadline = ethers.constants.MaxUint256;
    let totalSubscriptionAmount = 12;
    const { v, r, s } = await getPermitSignature(
      wallet0,
      erc20PermitToken,
      verifyingContract.address,
      totalSubscriptionAmount,
      deadline,
    );

    const INVOCATION_MESSAGE = {
      replayProtection: {
        nonce: '0x01',
        queue: '0x00',
      },
      batch: [
        {
          authority: [],
          transaction: {
            to: verifyingContract.address,
            gasLimit: '210000000000000000',
            data: (
              await verifyingContract.populateTransaction.approveSubscription(
                wallet0.address,
                totalSubscriptionAmount,
                deadline,
                v,
                r,
                s,
              )
            ).data,
          },
        },
      ],
    };

    const invocation = delegatableUtils.signInvocation(INVOCATION_MESSAGE, pk1);

    let tx = await verifyingContract.invoke([
      {
        signature: invocation.signature,
        invocations: invocation.invocations,
      },
    ]);
    expect(await erc20PermitToken.allowance(wallet0.address, verifyingContract.address)).to.equal(
      totalSubscriptionAmount,
    );
  });

  it('should SUCCEED to INVOKE paySubscription', async () => {
    expect(await erc20PermitToken.allowance(wallet0.address, verifyingContract.address)).to.equal(
      0,
    );
    const deadline = ethers.constants.MaxUint256;
    let totalSubscriptionAmount = 12;
    const { v, r, s } = await getPermitSignature(
      wallet0,
      erc20PermitToken,
      verifyingContract.address,
      totalSubscriptionAmount,
      deadline,
    );

    let salt = '01';
    let inputTerms = verifyingContract.address + salt;

    const _delegation = generateDelegation(CONTRACT_NAME, verifyingContract, pk0, wallet1.address, [
      {
        enforcer: districtERC20SubscriptionsEnforcer.address,
        terms: inputTerms,
      },
    ]);

    const INVOCATION_MESSAGE = {
      replayProtection: {
        nonce: '0x01',
        queue: '0x00',
      },
      batch: [
        {
          authority: [],
          transaction: {
            to: verifyingContract.address,
            gasLimit: '210000000000000000',
            data: (
              await verifyingContract.populateTransaction.approveSubscription(
                wallet0.address,
                totalSubscriptionAmount,
                deadline,
                v,
                r,
                s,
              )
            ).data,
          },
        },
        {
          authority: [_delegation],
          transaction: {
            to: verifyingContract.address,
            gasLimit: '210000000000000000',
            data: (await verifyingContract.populateTransaction.paySubscription()).data,
          },
        },
      ],
    };

    const invocation = delegatableUtils.signInvocation(INVOCATION_MESSAGE, pk1);

    let tx = await verifyingContract.invoke([
      {
        signature: invocation.signature,
        invocations: invocation.invocations,
      },
    ]);
    expect(await erc20PermitToken.balanceOf(verifyingContract.address)).to.equal(1);
  });

  it('should FAIL to INVOKE paySubscription if early', async () => {
    expect(await erc20PermitToken.allowance(wallet0.address, verifyingContract.address)).to.equal(
      0,
    );
    const deadline = ethers.constants.MaxUint256;
    let totalSubscriptionAmount = 12;
    const { v, r, s } = await getPermitSignature(
      wallet0,
      erc20PermitToken,
      verifyingContract.address,
      totalSubscriptionAmount,
      deadline,
    );

    let salt = '01';
    let inputTerms = verifyingContract.address + salt;

    const _delegation = generateDelegation(CONTRACT_NAME, verifyingContract, pk0, wallet1.address, [
      {
        enforcer: districtERC20SubscriptionsEnforcer.address,
        terms: inputTerms,
      },
    ]);

    const INVOCATION_MESSAGE = {
      replayProtection: {
        nonce: '0x01',
        queue: '0x00',
      },
      batch: [
        {
          authority: [],
          transaction: {
            to: verifyingContract.address,
            gasLimit: '210000000000000000',
            data: (
              await verifyingContract.populateTransaction.approveSubscription(
                wallet0.address,
                totalSubscriptionAmount,
                deadline,
                v,
                r,
                s,
              )
            ).data,
          },
        },
        {
          authority: [_delegation],
          transaction: {
            to: verifyingContract.address,
            gasLimit: '210000000000000000',
            data: (await verifyingContract.populateTransaction.paySubscription()).data,
          },
        },
        {
          authority: [_delegation],
          transaction: {
            to: verifyingContract.address,
            gasLimit: '210000000000000000',
            data: (await verifyingContract.populateTransaction.paySubscription()).data,
          },
        },
      ],
    };

    const invocation = delegatableUtils.signInvocation(INVOCATION_MESSAGE, pk1);

    await expect(
      verifyingContract.invoke([
        {
          signature: invocation.signature,
          invocations: invocation.invocations,
        },
      ]),
    ).to.be.revertedWith('DistrictERC20SubscriptionsEnforcer:invalid-subscritpion-time');
  });

  it('should FAIL to INVOKE paySubscription if canceled', async () => {
    expect(await erc20PermitToken.allowance(wallet0.address, verifyingContract.address)).to.equal(
      0,
    );
    const deadline = ethers.constants.MaxUint256;
    let totalSubscriptionAmount = 12;
    const { v, r, s } = await getPermitSignature(
      wallet0,
      erc20PermitToken,
      verifyingContract.address,
      totalSubscriptionAmount,
      deadline,
    );

    let salt = '01';
    let inputTerms = verifyingContract.address + salt;

    const _delegation = generateDelegation(CONTRACT_NAME, verifyingContract, pk0, wallet1.address, [
      {
        enforcer: districtERC20SubscriptionsEnforcer.address,
        terms: inputTerms,
      },
    ]);

    const INVOCATION_MESSAGE = {
      replayProtection: {
        nonce: '0x01',
        queue: '0x00',
      },
      batch: [
        {
          authority: [],
          transaction: {
            to: verifyingContract.address,
            gasLimit: '210000000000000000',
            data: (
              await verifyingContract.populateTransaction.approveSubscription(
                wallet0.address,
                totalSubscriptionAmount,
                deadline,
                v,
                r,
                s,
              )
            ).data,
          },
        },
        {
          authority: [_delegation],
          transaction: {
            to: verifyingContract.address,
            gasLimit: '210000000000000000',
            data: (await verifyingContract.populateTransaction.paySubscription()).data,
          },
        },
      ],
    };

    const invocation = delegatableUtils.signInvocation(INVOCATION_MESSAGE, pk1);

    const domainHash = await districtERC20SubscriptionsEnforcer.getEIP712DomainHash(
      CONTRACT_NAME,
      '1',
      CONTRACT_INFO.chainId,
      verifyingContract.address,
    );

    await districtERC20SubscriptionsEnforcer
      .connect(wallet0)
      .cancelSubscription(_delegation, domainHash);

    await expect(
      verifyingContract.invoke([
        {
          signature: invocation.signature,
          invocations: invocation.invocations,
        },
      ]),
    ).to.be.revertedWith('DistrictERC20SubscriptionsEnforcer:canceled-subscription');
  });

  it('should SUCCEED to INVOKE paySubscription if new salt', async () => {
    expect(await erc20PermitToken.allowance(wallet0.address, verifyingContract.address)).to.equal(
      0,
    );
    const deadline = ethers.constants.MaxUint256;
    let totalSubscriptionAmount = 12;
    const { v, r, s } = await getPermitSignature(
      wallet0,
      erc20PermitToken,
      verifyingContract.address,
      totalSubscriptionAmount,
      deadline,
    );

    let salt = '01';
    let inputTerms = verifyingContract.address + salt;

    const _delegation = generateDelegation(CONTRACT_NAME, verifyingContract, pk0, wallet1.address, [
      {
        enforcer: districtERC20SubscriptionsEnforcer.address,
        terms: inputTerms,
      },
    ]);

    const INVOCATION_MESSAGE = {
      replayProtection: {
        nonce: '0x01',
        queue: '0x00',
      },
      batch: [
        {
          authority: [],
          transaction: {
            to: verifyingContract.address,
            gasLimit: '210000000000000000',
            data: (
              await verifyingContract.populateTransaction.approveSubscription(
                wallet0.address,
                totalSubscriptionAmount,
                deadline,
                v,
                r,
                s,
              )
            ).data,
          },
        },
        {
          authority: [_delegation],
          transaction: {
            to: verifyingContract.address,
            gasLimit: '210000000000000000',
            data: (await verifyingContract.populateTransaction.paySubscription()).data,
          },
        },
      ],
    };

    const invocation = delegatableUtils.signInvocation(INVOCATION_MESSAGE, pk1);

    const domainHash = await districtERC20SubscriptionsEnforcer.getEIP712DomainHash(
      CONTRACT_NAME,
      '1',
      CONTRACT_INFO.chainId,
      verifyingContract.address,
    );

    await districtERC20SubscriptionsEnforcer
      .connect(wallet0)
      .cancelSubscription(_delegation, domainHash);

    await expect(
      verifyingContract.invoke([
        {
          signature: invocation.signature,
          invocations: invocation.invocations,
        },
      ]),
    ).to.be.revertedWith('DistrictERC20SubscriptionsEnforcer:canceled-subscription');

    ////
    salt = '02';
    inputTerms = verifyingContract.address + salt;

    const _delegation1 = generateDelegation(
      CONTRACT_NAME,
      verifyingContract,
      pk0,
      wallet1.address,
      [
        {
          enforcer: districtERC20SubscriptionsEnforcer.address,
          terms: inputTerms,
        },
      ],
    );

    const INVOCATION_MESSAGE_1 = {
      replayProtection: {
        nonce: '0x01',
        queue: '0x00',
      },
      batch: [
        {
          authority: [],
          transaction: {
            to: verifyingContract.address,
            gasLimit: '210000000000000000',
            data: (
              await verifyingContract.populateTransaction.approveSubscription(
                wallet0.address,
                totalSubscriptionAmount,
                deadline,
                v,
                r,
                s,
              )
            ).data,
          },
        },
        {
          authority: [_delegation1],
          transaction: {
            to: verifyingContract.address,
            gasLimit: '210000000000000000',
            data: (await verifyingContract.populateTransaction.paySubscription()).data,
          },
        },
      ],
    };

    const invocation1 = delegatableUtils.signInvocation(INVOCATION_MESSAGE_1, pk1);

    let tx = await verifyingContract.invoke([
      {
        signature: invocation1.signature,
        invocations: invocation1.invocations,
      },
    ]);
    expect(await erc20PermitToken.balanceOf(verifyingContract.address)).to.equal(1);
  });
});
