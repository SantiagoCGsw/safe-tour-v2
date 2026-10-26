import './env.js'

const rpcUrl = process.env.CHAIN_RPC_URL ?? ''
const contrato = process.env.CHAIN_CONTRACT_ADDRESS ?? ''

export const chainConfig = Object.freeze({
  red: process.env.CHAIN_NETWORK ?? '',
  rpcUrl,
  contrato,
  configurada: Boolean(rpcUrl && contrato && process.env.CHAIN_PRIVATE_KEY),
})