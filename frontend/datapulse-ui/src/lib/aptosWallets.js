export const APTOS_WALLETS = [
  { id: "petra", name: "Petra", installUrl: "https://petra.app/" },
  { id: "martian", name: "Martian", installUrl: "https://martianwallet.xyz/" },
  { id: "pontem", name: "Pontem", installUrl: "https://pontem.network/wallet" },
  { id: "fewcha", name: "Fewcha", installUrl: "https://fewcha.app/" },
]

function normalizeWalletName(value) {
  return `${value || ""}`.trim().toLowerCase()
}

function getAptosStandardProviders() {
  if (typeof window === "undefined" || !window.aptos) {
    return []
  }

  if (Array.isArray(window.aptos.providers)) {
    return window.aptos.providers
  }

  return [window.aptos]
}

function findStandardProviderById(walletId) {
  const expected = normalizeWalletName(walletId)
  const providers = getAptosStandardProviders()

  const matched = providers.find((provider) => {
    const providerName = normalizeWalletName(provider?.name)
    return providerName.includes(expected)
  })

  return matched || null
}

function getAddressFromAccount(account) {
  if (!account) {
    return ""
  }

  if (typeof account.address === "string") {
    return account.address
  }

  if (account.address && typeof account.address.toString === "function") {
    return `${account.address.toString()}`
  }

  if (typeof account.accountAddress === "string") {
    return account.accountAddress
  }

  return ""
}

export function resolveWalletProvider(walletId) {
  const standardProvider = findStandardProviderById(walletId)
  if (standardProvider) {
    return standardProvider
  }

  if (typeof window === "undefined") {
    return null
  }

  // Petra must use Wallet Standard provider only.
  if (walletId === "petra") {
    return null
  }

  if (walletId === "martian") {
    return window.martian || (window.aptos?.isMartian ? window.aptos : null)
  }
  if (walletId === "pontem") {
    return window.pontem || (window.aptos?.isPontem ? window.aptos : null)
  }
  if (walletId === "fewcha") {
    return window.fewcha || null
  }

  const fallbackStandard = getAptosStandardProviders().find((provider) =>
    typeof provider?.connect === "function"
  )
  return fallbackStandard || null
}

export function getInstalledAptosWallets() {
  return APTOS_WALLETS.filter((wallet) => Boolean(resolveWalletProvider(wallet.id)))
}

export function extractWalletAddress(connectResult, accountResult) {
  const candidate =
    connectResult?.address ||
    connectResult?.account?.address ||
    accountResult?.address ||
    accountResult?.accountAddress ||
    null

  return candidate ? `${candidate}`.trim() : ""
}

export async function connectAptosProvider(provider, options = {}) {
  const { allowLegacy = true } = options

  // Wallet Standard path.
  const standardConnect =
    provider?.features?.["standard:connect"] ||
    provider?.features?.["aptos:connect"]
  if (standardConnect && typeof standardConnect.connect === "function") {
    const result = await standardConnect.connect()
    const accountCandidates = []

    if (Array.isArray(provider.accounts)) {
      accountCandidates.push(...provider.accounts)
    }
    if (Array.isArray(result?.accounts)) {
      accountCandidates.push(...result.accounts)
    }
    if (Array.isArray(result)) {
      accountCandidates.push(...result)
    }

    const matched = accountCandidates
      .map((account) => getAddressFromAccount(account))
      .find(Boolean)

    if (matched) {
      return matched
    }
  }

  // Legacy fallback for non-Petra providers.
  if (allowLegacy && typeof provider?.connect === "function") {
    const connectResult = await provider.connect()
    const accountResult = typeof provider.account === "function" ? await provider.account() : null
    const legacyAddress = extractWalletAddress(connectResult, accountResult)
    if (legacyAddress) {
      return legacyAddress
    }
  }

  throw new Error("Unable to read Aptos account from wallet provider.")
}

export function shortWalletAddress(address) {
  if (!address || address.length < 12) {
    return address || ""
  }
  return `${address.slice(0, 6)}...${address.slice(-6)}`
}
