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

describe('DistrictChainlinkAggregatorV3PriceAboveEnforcer', () => {
  const CONTACT_NAME = 'ERC20Delegatable';
  let CONTRACT_INFO: any;
  let delegatableUtils: any;
  let signer0: SignerWithAddress;
  let wallet0: Wallet;
  let wallet1: Wallet;
  let pk0: string;
  let pk1: string;

  // Smart Contracts
  let DistrictChainlinkAggregatorV3PriceAboveEnforcer: Contract;
  let DistrictChainlinkAggregatorV3PriceAboveEnforcerFactory: ContractFactory;
  let ERC20Delegatable: Contract;
  let ERC20DelegatableFactory: ContractFactory;
  let chainlinkMockOracle: MockContract;

  before(async () => {
    [signer0] = await getSigners();
    [wallet0, wallet1] = getPrivateKeys(signer0.provider as unknown as Provider);
    ERC20DelegatableFactory = await ethers.getContractFactory('ERC20Delegatable');
    DistrictChainlinkAggregatorV3PriceAboveEnforcerFactory = await ethers.getContractFactory(
      'DistrictChainlinkAggregatorV3PriceAboveEnforcer',
    );
    pk0 = wallet0._signingKey().privateKey;
    pk1 = wallet1._signingKey().privateKey;
  });

  beforeEach(async () => {
    await network.provider.request({
      method: 'hardhat_reset',
      params: [],
    });
    ERC20Delegatable = await ERC20DelegatableFactory.connect(wallet0).deploy(
      CONTACT_NAME,
      'TRUST',
      ethers.utils.parseEther('1'),
    );

    let oracleArtifact = await artifacts.readArtifact('AggregatorV3Interface');
    chainlinkMockOracle = await deployMockContract(wallet0, oracleArtifact.abi);

    DistrictChainlinkAggregatorV3PriceAboveEnforcer =
      await DistrictChainlinkAggregatorV3PriceAboveEnforcerFactory.connect(wallet0).deploy();

    CONTRACT_INFO = {
      chainId: ERC20Delegatable.deployTransaction.chainId,
      verifyingContract: ERC20Delegatable.address,
      name: CONTACT_NAME,
    };
    delegatableUtils = generateUtil(CONTRACT_INFO);
  });

  it('should SUCCEED to INVOKE method if priceThreshold above chainlinkPrice', async () => {
    const PK = wallet0._signingKey().privateKey.substring(2);
    expect(await ERC20Delegatable.balanceOf(wallet0.address)).to.eq(ethers.utils.parseEther('1'));

    let chainlinkPriceFeedAddress = chainlinkMockOracle.address;
    let priceThresholdSign = '01'; // 00 for negative, 01 for positive
    let unsignedPriceThreshold = '000000000000000000000000000000000000000000000000000002BA7DEF3000'; // in decimal is 3000000000000
    let inputTerms = chainlinkPriceFeedAddress + priceThresholdSign + unsignedPriceThreshold;

    const _delegation = generateDelegation(CONTACT_NAME, ERC20Delegatable, PK, wallet1.address, [
      {
        enforcer: DistrictChainlinkAggregatorV3PriceAboveEnforcer.address,
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
          authority: [_delegation],
          transaction: {
            to: ERC20Delegatable.address,
            gasLimit: '210000000000000000',
            data: (
              await ERC20Delegatable.populateTransaction.transfer(
                wallet1.address,
                ethers.utils.parseEther('0.5'),
              )
            ).data,
          },
        },
      ],
    };
    const invocation = delegatableUtils.signInvocation(INVOCATION_MESSAGE, pk1);

    await chainlinkMockOracle.mock.latestRoundData.returns(0, 2000000000000, 0, 0, 0);

    await ERC20Delegatable.invoke([
      {
        signature: invocation.signature,
        invocations: invocation.invocations,
      },
    ]);
    expect(await ERC20Delegatable.balanceOf(wallet0.address)).to.eq(ethers.utils.parseEther('0.5'));
  });
  it('should FAIL to INVOKE method if priceThreshold below chainlinkPrice', async () => {
    const PK = wallet0._signingKey().privateKey.substring(2);
    expect(await ERC20Delegatable.balanceOf(wallet0.address)).to.eq(ethers.utils.parseEther('1'));

    let chainlinkPriceFeedAddress = chainlinkMockOracle.address;
    let priceThresholdSign = '01'; // 00 for negative, 01 for positive
    let unsignedPriceThreshold = '000000000000000000000000000000000000000000000000000002BA7DEF3000'; // in decimal is 3000000000000
    let inputTerms = chainlinkPriceFeedAddress + priceThresholdSign + unsignedPriceThreshold;

    const _delegation = generateDelegation(CONTACT_NAME, ERC20Delegatable, PK, wallet1.address, [
      {
        enforcer: DistrictChainlinkAggregatorV3PriceAboveEnforcer.address,
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
          authority: [_delegation],
          transaction: {
            to: ERC20Delegatable.address,
            gasLimit: '210000000000000000',
            data: (
              await ERC20Delegatable.populateTransaction.transfer(
                wallet1.address,
                ethers.utils.parseEther('0.5'),
              )
            ).data,
          },
        },
      ],
    };
    const invocation = delegatableUtils.signInvocation(INVOCATION_MESSAGE, pk1);

    await chainlinkMockOracle.mock.latestRoundData.returns(0, 4000000000000, 0, 0, 0);

    await expect(
      ERC20Delegatable.invoke([
        {
          signature: invocation.signature,
          invocations: invocation.invocations,
        },
      ]),
    ).to.be.revertedWith(
      'DistrictChainlinkAggregatorV3PriceAboveEnforcer:priceThreshold <= chainlinkPrice',
    );
  });

  it('should FAIL to INVOKE method if priceThreshold is NOT 0 (negative), or 1 (positive)', async () => {
    const PK = wallet0._signingKey().privateKey.substring(2);
    expect(await ERC20Delegatable.balanceOf(wallet0.address)).to.eq(ethers.utils.parseEther('1'));

    let chainlinkPriceFeedAddress = chainlinkMockOracle.address;
    let priceThresholdSign = '02'; // 00 for negative, 01 for positive
    let unsignedPriceThreshold = '000000000000000000000000000000000000000000000000000002BA7DEF3000'; // in decimal is 3000000000000
    let inputTerms = chainlinkPriceFeedAddress + priceThresholdSign + unsignedPriceThreshold;

    const _delegation = generateDelegation(CONTACT_NAME, ERC20Delegatable, PK, wallet1.address, [
      {
        enforcer: DistrictChainlinkAggregatorV3PriceAboveEnforcer.address,
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
          authority: [_delegation],
          transaction: {
            to: ERC20Delegatable.address,
            gasLimit: '210000000000000000',
            data: (
              await ERC20Delegatable.populateTransaction.transfer(
                wallet1.address,
                ethers.utils.parseEther('0.5'),
              )
            ).data,
          },
        },
      ],
    };
    const invocation = delegatableUtils.signInvocation(INVOCATION_MESSAGE, pk1);

    await chainlinkMockOracle.mock.latestRoundData.returns(0, 2000000000000, 0, 0, 0);

    await expect(
      ERC20Delegatable.invoke([
        {
          signature: invocation.signature,
          invocations: invocation.invocations,
        },
      ]),
    ).to.be.revertedWith(
      'DistrictChainlinkAggregatorV3PriceAboveEnforcer:priceThreshold MUST be 0 (negative), or 1 (positive)',
    );
  });
});
