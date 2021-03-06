//var ethUtils = require('ethereumjs-util');



const typedData = {
    types: {
        EIP712Domain: [
            { name: 'name', type: 'string' },
            { name: 'version', type: 'string' },
            { name: 'chainId', type: 'uint256' },
            { name: 'verifyingContract', type: 'address' },
        ],
        Oracle: [
            { name: 'contractAddress', type: 'address' },
            { name: 'executionTime', type: 'uint32' }
        ],
        Bet: [
            { name: 'bedId', type: 'string' },
            { name: 'maker', type: 'address' },
            { name: 'taker', type: 'address' },
            { name: 'amount', type: 'uin32' },
            { name: 'expirationTime', type: 'uint32' },
            { name: 'OracleSpec', type: 'Oracle' }
        ],
    },
    primaryType: 'Bet',
    domain: {
        name: 'Smart Bets',
        version: '1',
        chainId: 3,
        verifyingContract: '0xCcCCccccCCCCcCCCCCCcCcCccCcCCCcCcccccccC',
    }
};

// bet = {
//     { betId: "BET_ID_STRING"},
//     { makerAddress: "address" }, //from metamask
//     { takerAddress: "address"}, // empty or full
//     { amount : 1 },
//     { expirationTime : 11010101}, //"unix time stamp"
//     { oracleSpec :
//         Oracle :{
//             {contractAddress : "Address",},
//             {executionTime : 110101010} //unix time stamp
//         }
//     }
// }
// Builds the bet object used for signing - see above
function createBet(
                betId,
                makerAddress,
                takerAddress,
                amount,
                expirationTime,
                oracleContractAddress,
                oracleExecutionTime)
{
    bet = {};
    bet["betId"] = betId;
    bet["makerAddress"] = makerAddress;
    bet["takerAddress"] = takerAddress;
    bet["amount"] = amount;
    bet["expirationTime"] = expirationTime;
    var oracle = {};
    oracle["contractAddress"] = oracleContractAddress;
    oracle["executionTime"] = oracleExecutionTime;
    bet["oracleSpec"] = oracle;
}


const types = typedData.types;

// Recursively finds all the dependencies of a type
function dependencies(primaryType, found = []) {
    if (found.includes(primaryType)) {
        return found;
    }
    if (types[primaryType] === undefined) {
        return found;
    }
    found.push(primaryType);
    for (let field of types[primaryType]) {
        for (let dep of dependencies(field.type, found)) {
            if (!found.includes(dep)) {
                found.push(dep);
            }
        }
    }
    return found;
}

function encodeType(primaryType) {
    // Get dependencies primary first, then alphabetical
    let deps = dependencies(primaryType);
    deps = deps.filter(t => t != primaryType);
    deps = [primaryType].concat(deps.sort());

    // Format as a string with fields
    let result = '';
    for (let type of deps) {
        result += `${type}(${types[type].map(({ name, type }) => `${type} ${name}`).join(',')})`;
    }
    return result;
}

function typeHash(primaryType) {
    return ethUtil.sha3(encodeType(primaryType));
}

function encodeData(primaryType, data) {
    let encTypes = [];
    let encValues = [];

    // Add typehash
    encTypes.push('bytes32');
    encValues.push(typeHash(primaryType));

    // Add field contents
    for (let field of types[primaryType]) {
        let value = data[field.name];
        if (field.type == 'string' || field.type == 'bytes') {
            encTypes.push('bytes32');
            value = ethUtil.sha3(value);
            encValues.push(value);
        } else if (types[field.type] !== undefined) {
            encTypes.push('bytes32');
            value = ethUtil.sha3(encodeData(field.type, value));
            encValues.push(value);
        } else if (field.type.lastIndexOf(']') === field.type.length - 1) {
            throw 'TODO: Arrays currently unimplemented in encodeData';
        } else {
            encTypes.push(field.type);
            encValues.push(value);
        }
    }

    return abi.rawEncode(encTypes, encValues);
}

function structHash(primaryType, data) {
    return ethUtil.sha3(encodeData(primaryType, data));
}

function signHash(bet) {
    return ethUtil.sha3(
        Buffer.concat([
            Buffer.from('1901', 'hex'),
            structHash('EIP712Domain', typedData.domain),
            structHash(typedData.primaryType, bet),
        ]),
    );
}

//web3.eth.accounts.signTransaction({
//    to: '0xF0109fC8DF283027b6285cc889F5aA624EaC1F55',
//    value: '1000000000',
//    gas: 2000000
//}, '0x4c0883a69102937d6231471b5dbb6204fe5129617082792ae468d01a3f362318')
//.then(console.log);
// returns the following
// {
//     messageHash: '0x88cfbd7e51c7a40540b233cf68b62ad1df3e92462f1c6018d6d67eae0f3b08f5',
//     v: '0x25',
//     r: '0xc9cf86333bcb065d140032ecaab5d9281bde80f21b9687b3e94161de42d51895',
//     s: '0x727a108a0b8d101465414033c3f705a9c7b826e596766046ee1183dbc8aeaa68',
//     rawTransaction: '0xf869808504e3b29200831e848094f0109fc8df283027b6285cc889f5aa624eac1f55843b9aca008025a0c9cf86333bcb065d140032ecaab5d9281bde80f21b9687b3e94161de42d51895a0727a108a0b8d101465414033c3f705a9c7b826e596766046ee1183dbc8aeaa68'
// }

//const privateKey = ethUtil.sha3('cow'); // needs to be unique
//const address = ethUtil.privateToAddress(privateKey);
//const sig = ethUtil.ecsign(signHash(), privateKey);

// store sig and bet object together

// const expect = chai.expect;
// expect(encodeType('Mail')).to.equal('Mail(Person from,Person to,string contents)Person(string name,address wallet)');
// expect(ethUtil.bufferToHex(typeHash('Mail'))).to.equal(
//     '0xa0cedeb2dc280ba39b857546d74f5549c3a1d7bdc2dd96bf881f76108e23dac2',
// );
// expect(ethUtil.bufferToHex(encodeData(typedData.primaryType, typedData.message))).to.equal(
//     '0xa0cedeb2dc280ba39b857546d74f5549c3a1d7bdc2dd96bf881f76108e23dac2fc71e5fa27ff56c350aa531bc129ebdf613b772b6604664f5d8dbe21b85eb0c8cd54f074a4af31b4411ff6a60c9719dbd559c221c8ac3492d9d872b041d703d1b5aadf3154a261abdd9086fc627b61efca26ae5702701d05cd2305f7c52a2fc8',
// );
// expect(ethUtil.bufferToHex(structHash(typedData.primaryType, typedData.message))).to.equal(
//     '0xc52c0ee5d84264471806290a3f2c4cecfc5490626bf912d01f240d7a274b371e',
// );
// expect(ethUtil.bufferToHex(structHash('EIP712Domain', typedData.domain))).to.equal(
//     '0xf2cee375fa42b42143804025fc449deafd50cc031ca257e0b194a650a912090f',
// );
// expect(ethUtil.bufferToHex(signHash())).to.equal('0xbe609aee343fb3c4b28e1df9e632fca64fcfaede20f02e86244efddf30957bd2');
// expect(ethUtil.bufferToHex(address)).to.equal('0xcd2a3d9f938e13cd947ec05abc7fe734df8dd826');
// expect(sig.v).to.equal(28);
// expect(ethUtil.bufferToHex(sig.r)).to.equal('0x4355c47d63924e8a72e509b65029052eb6c299d53a04e167c5775fd466751c9d');
// expect(ethUtil.bufferToHex(sig.s)).to.equal('0x07299936d304c153f6443dfa05f40ff007d72911b6f72307f996231605b91562');
