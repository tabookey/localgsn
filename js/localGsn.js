//deploy GSN framework:
// - deploy RelayHub (required once per ganache instance, since it has a static address
// - start relay server exec.
// - register relay, stake it.

const { spawn } = require('child_process')
const IRelayHub = require('tabookey-gasless/src/js/relayclient/IRelayHub')
const gsnHubDeploy = require('./gsn-hub-deploy')
const Web3 = require('web3')
const axios = require('axios')

const RELAY_URL='http://localhost:8090'
const DEFAULT_PROVIDER = 'http://localhost:8545'
const DEPLOY_BALANCE = 0.42e18.toString()

const relayHubAddress = gsnHubDeploy.contract.address

// start a relay
// account - either account number (0-10) or address
// verbose - dump relay output to console.
//NOTE: the relay is on hub, so it can be started again.
async function startGsnRelay ({ account = 0, provider = DEFAULT_PROVIDER, localPort, relayUrl = RELAY_URL, verbose } = {}) {
  let nodeUrl
  if (typeof provider == 'string') {
    nodeUrl = provider
    provider = new Web3.providers.HttpProvider(provider)
  }
  const web3 = new Web3(provider)
  if (account === 0 || (account >= 1 && account <= 10)) {
    //its account number, not address:
    const accounts = await web3.eth.getAccounts()
    account = accounts[account]
  }

  //deploy hub if needed:
  await deployRelayHub(web3, account)
  const hub = new web3.eth.Contract(IRelayHub, gsnHubDeploy.contract.address, { from: account })
  const relayAddr = await launchRelay({ relayUrl, localPort, verbose, nodeUrl })

  // fund relay:
  const bal = await web3.eth.getBalance(web3.utils.toChecksumAddress(relayAddr))
  console.log('relay ', relayAddr, 'balance=', bal)

  if (bal < 1e18) {
    await web3.eth.sendTransaction({ from: account, to: relayAddr, value: 1e18 })
    console.log('funded relay')
  }

  // stake relay:
  const relayInfo = await hub.methods.getRelay(relayAddr).call()
  const stake = relayInfo.totalStake
  if (stake < 1e18) {
    console.log('=== staking: ')
    await hub.methods.stake(relayAddr, 24 * 3600 * 7).send({ value: 1e18 })
  }
  console.log('=== wait for relay Ready: ', relayUrl)
  await waitForRelayReady(relayUrl)
  return relayAddr
}

function waitForRelayReady(relayUrl) {
  return new Promise((resolve,reject)=>{
    let counter=0
    const callback=()=>{
      axios.get(relayUrl+'/getaddr').then(res=>{
        if ( res.data && res.data.Ready ) {
		resolve(res.data)
	} else 
        if ( ++counter>10 ) reject("timed-out waiting for relay: "+res.error||res.data ) 
	else setTimeout(callback,300)
      }).catch(err=>{}) //ignore errors.
    }
    callback()
  })
}

// stop a previously-started gsn relay
function stopGsnRelay () {
  stopRelay()
}

async function deployRelayHub (web3, fundingAccount) {
  let code = await web3.eth.getCode(gsnHubDeploy.contract.address)
  if (code.length > 3) {
    // already deployed
    return
  }

  const deployer = gsnHubDeploy.deployer
  if (await web3.eth.getBalance(deployer) < DEPLOY_BALANCE) {
    await web3.eth.sendTransaction({
      from: fundingAccount,
      to: deployer,
      value: DEPLOY_BALANCE
    })
  }

  await web3.eth.sendSignedTransaction(gsnHubDeploy.contract.deployTx)

  code = await web3.eth.getCode(gsnHubDeploy.contract.address)
  if (code.length < 100) {
    throw new Error('failed to deploy RelayHub. wtf?')
  }
}

let ls

//bring up a relay.
function launchRelay ({ verbose, gasPricePercent=-99, localPort, relayUrl = RELAY_URL, nodeUrl }) {
  return new Promise((resolve, reject) => {
    let lastrest = {}
    let output = ''
    const folder = __dirname
    const relayExe = folder + '/../bin/RelayHttpServer.' + process.platform
    const workdir = folder + '/../build/tmp'
    const port = localPort || relayUrl.match(/:(\d+)/)[1]
	
    relayParams = ['-DevMode', '-Workdir', workdir, '-Port', port, '-Url', relayUrl, '-GasPricePercent', gasPricePercent]
    if ( nodeUrl ) {
      relayParams.push( '-EthereumNodeUrl', nodeUrl)
    }
    if ( verbose ) {
      console.log(relayExe, relayParams.join(' '))
    }
    ls = spawn(relayExe, relayParams, { stdio: 'pipe' })
    ls.stderr.on('data', (data) => {
      const text = data.toString()
      output = output + text
      const [_, date, rest] = text.match(/(\d+\/\d+\/\d+ \d+:\d+:\d+)?\s*([\s\S]*)/)

      const m = text.match(/relay server address:\s+(.*)/)
      if (m) {
        resolve(m[1])
      }
      if (lastrest[rest]) {
        return
      } else {
        lastrest[rest] = 1
        if (verbose) {
          console.log(date, rest)
        }
      }
    })
    ls.on('close', (code) => {
      if (verbose) {
        console.log(`child process exited with code ${code}`)
      }
      reject(Error('process quit:\n' + output))
    })
  })
}

function stopRelay () {
  if (ls) {
    ls.kill(9)
  }
}

module.exports = { startGsnRelay, stopGsnRelay, deployRelayHub, relayHubAddress }
