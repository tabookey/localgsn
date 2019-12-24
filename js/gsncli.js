import { startGsnRelay, stopGsnRelay } from './localGsn'

async function run () {

  const relayAddress = await startGsnRelay(1, {verbose:false})

  console.log('relayaddr=',relayAddress)
  setTimeout(async () => {
    console.log('stopping')
    await stopGsnRelay()
    console.log('stopped..')
  }, 2000)
}

run()
