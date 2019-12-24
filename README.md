# Local GSN

In order to test GSN, you need a network with a RelayHub contract and at least one active relay.

To simplify testing, this package bring up everything you need.

Installation: the usual `npm/yarn install localgsn`

### Usage:

in your test script:
```
const { startGsnRelay, stopGsnRelay, relayHubAddress } = require( 'localgsn' )

before( 'start GSN', async ()=>{
	await startGsnRelay()	
})

after( 'stop GSN', async() => {
	await stopGsnRelay()
})

```


### Options

the `startRelayGsn` can receive some parameters:
- `provider` - either a web3 provider, or a URL. defaults to `http://localhost:8545`
- `account` - specific account to use. This account is used to deploy the RelayHub, and then as the owner of the relay.
	can either be an index into the `getAccounts()` array, or actual address.

The function returns the relay address.
