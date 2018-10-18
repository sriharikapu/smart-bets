pragma solidity ^0.4.24;

import "./SmartBet.sol";
import "./Requester.sol"; // TODO: Remove this dependency

import "./ChainlinkContracts.sol"; // Pull in Ownable
pragma experimental ABIEncoderV2;

contract delayedBet is SmartBet, Ownable {
  // Force all consumers to use SmartBets oracle address?
  address constant ROPSTEN_ORACLE_ADDRESS = 0x261a3f70acdc85cfc2ffc8bade43b1d42bf75d69;

  // Store bets
  uint256 public lastPrice;
  uint256 public lastPriceTimestamp;

  mapping(bytes32 => bytes32) public liveBets; // Convert into live bets?

  Requester internal requester; // TODO: Replace this with address and abi calls
  address internal oracle;
  LinkToken internal link;

  constructor(address _requester) public Ownable() {
    oracle = ROPSTEN_ORACLE_ADDRESS;
    requester = Requester(_requester);
  }

  event RequestFulfilled(
    bytes32 requestId,
    uint256 price
  );

  // All entry points to consumer: startBet. TODO: Make this a template?
  // Can have a contract in front of this to swap context from relayer to taker. 
  // Will the taker or the relayer make the startBet transaction?
  //function startBet(Bet memory _bet, address _takerAddress, bytes _signature) public {
  function startBet(Bet memory _bet, address _takerAddress) public {
    //assertStartableBet(_bet, _takerAddress, _signature);

    //requester.lastEthPrice(
    requester.delayedBet(
      // Should this URL be passed in from the relayer? It would allow for full customization,
      // but would it decrease security?
      // Yes, parameterize it: Potentially one contract per bet type. Would decrease security?
      // Why would it decrease security? (EIP712. Need to think about this)
      // No: this would force there to be many consumer contracts.
      // Path would also have to be parameterized if url is
      //"https://min-api.cryptocompare.com/data/price?fsym=ETH&tsyms=USD", // starting to lean towards making this a parameter
      //["USD"],
      _bet.oracleSpec.apiUrl,
      _bet.oracleSpec.keyPath,
      delay(_bet.oracleSpec.executionTime),
      //hash(_bet),
      //"fulfillLastPrice(bytes32,uint256)", 
      "fulfillLastPrice(bytes32)", 
      address(this)
    );
  }

/* Can't run manually anymore because we added the bytes32 4th param
  function startBet(uint256 _delay) public {
    requester.lastEthPrice(
      "fulfillLastPrice(bytes32,uint256)", 
      address(this), 
      _delay
    );
  }*/

  function updateRequestId(bytes32 _requestId, bytes32 _betId) external onlyRequester {
    liveBets[_requestId] = _betId;
  }

  function fulfillLastPrice(bytes32 _requestId, uint256 _price)
    public
    checkChainlinkFulfillment(_requestId)
  {
    emit RequestFulfilled(_requestId, _price);
    lastPriceTimestamp = now;
    lastPrice = _price;
  }

  function withdrawLink() public onlyOwner {
    require(link.transfer(owner, link.balanceOf(address(this))));
  }

  modifier checkChainlinkFulfillment(bytes32 _requestId) {
    require(msg.sender == oracle && liveBets[_requestId] != 0, "Source must be the oracle of the request");
    _;
    delete liveBets[_requestId]; // TODO: bet settlement
  }

  modifier onlyRequester() {
    require(msg.sender == address(requester), "Only the requester can run this function");
    _;
  }
}
