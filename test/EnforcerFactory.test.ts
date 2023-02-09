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
import { abi } from '../artifacts/contracts/enforcerFactory/EnforcerFactory.sol/EnforcerFactory.json';

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

describe('EnforcerFactory', () => {
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
  let enforcerFactory: Contract;
  let enforcerFactoryFactory: ContractFactory;

  before(async () => {
    [signer0, signer1] = await getSigners();
    [wallet0, wallet1] = getPrivateKeys(signer0.provider as unknown as Provider); //
    verifyingContractFactory = await ethers.getContractFactory(
      'VerifyingContractERC20PermitSubscriptions',
    );
    erc20PermitTokenFactory = await ethers.getContractFactory('TokenPermit');
    enforcerFactoryFactory = await ethers.getContractFactory('EnforcerFactory');
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

    enforcerFactory = await enforcerFactoryFactory.connect(wallet0).deploy();

    verifyingContract = await verifyingContractFactory
      .connect(wallet0)
      .deploy(CONTRACT_NAME, erc20PermitToken.address, 1, subPeriod);
    await verifyingContract.deployed();

    CONTRACT_INFO = {
      chainId: verifyingContract.deployTransaction.chainId,
      verifyingContract: verifyingContract.address,
      name: CONTRACT_NAME,
    };
    delegatableUtils = generateUtil(CONTRACT_INFO);
  });

  it('should SUCCEED to deploy enforcer', async () => {
    let saltEnforcer = 1;
    // get enforcer future address
    let enforcerAddress = await enforcerFactory.connect(wallet0).getAddress(saltEnforcer);
    // deploy enforcer
    let deployTx = await enforcerFactory.connect(wallet0).deploySubscriptions(saltEnforcer);
    // pointer to enforcer
    let enforcer = new ethers.Contract(enforcerAddress, abi);

    // console.log(deployTx);
  });
  it('should SUCCEED to INVOKE paySubscription', async () => {
    let saltEnforcer = 1;
    // get enforcer future address
    let enforcerAddress = await enforcerFactory.connect(wallet0).getAddress(saltEnforcer);
    // deploy enforcer
    let deployTx = await enforcerFactory.connect(wallet0).deploySubscriptions(saltEnforcer);
    // pointer to enforcer
    let enforcer = new ethers.Contract(enforcerAddress, abi);

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
        enforcer: enforcer.address,
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
});
