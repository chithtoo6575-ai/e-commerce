import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const envFile = path.join(root, '.env')
if (typeof process.loadEnvFile === 'function' && fs.existsSync(envFile)) process.loadEnvFile(envFile)

function required(name) {
  const value = process.env[name]?.trim()
  if (!value) throw new Error(`Set ${name} in the API server environment before setup.`)
  return value
}

function httpsUrl(name) {
  let url
  try { url = new URL(required(name)) } catch { throw new Error(`${name} must be a valid public HTTPS URL.`) }
  const hostname = url.hostname.toLowerCase().replace(/^\[|\]$/g, '')
  const octets = hostname.split('.').map(Number)
  const localIpv6 = hostname === '::' || hostname === '::1' || /^(fc|fd|fe[89ab])/i.test(hostname)
  const placeholderHost = hostname === 'example.com' || hostname.endsWith('.example')
  const privateIpv4 = octets.length === 4 && octets.every((octet) => Number.isInteger(octet) && octet >= 0 && octet <= 255)
    && (octets[0] === 0 || octets[0] === 10 || octets[0] === 127 || (octets[0] === 169 && octets[1] === 254)
      || (octets[0] === 172 && octets[1] >= 16 && octets[1] <= 31) || (octets[0] === 192 && octets[1] === 168))
  if (url.protocol !== 'https:' || !hostname || hostname === 'localhost' || hostname.endsWith('.localhost') || localIpv6 || placeholderHost || privateIpv4) {
    throw new Error(`${name} must use a publicly reachable HTTPS URL, not a local or private address.`)
  }
  return url.toString()
}

async function callBotApi(token, method, payload) {
  const response = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(10_000)
  })
  const result = await response.json()
  if (!response.ok || result.ok !== true) throw new Error(result.description || `Telegram ${method} failed.`)
}

async function setup() {
  const token = required('TELEGRAM_BOT_TOKEN')
  const webhookSecret = required('TELEGRAM_WEBHOOK_SECRET')
  const webhookUrl = httpsUrl('TELEGRAM_WEBHOOK_URL')
  const miniAppUrl = httpsUrl('TELEGRAM_MINI_APP_URL')
  if (!/^[A-Za-z0-9_-]{1,256}$/.test(webhookSecret)) throw new Error('TELEGRAM_WEBHOOK_SECRET must contain 1 to 256 letters, digits, underscores, or hyphens.')
  if (!/^-?\d+$/.test(required('TELEGRAM_ADMIN_CHAT_ID'))) throw new Error('TELEGRAM_ADMIN_CHAT_ID must be a numeric Telegram chat ID.')
  if (!/^\d+$/.test(required('TELEGRAM_ADMIN_USER_ID'))) throw new Error('TELEGRAM_ADMIN_USER_ID must be a numeric Telegram user ID.')

  await callBotApi(token, 'setWebhook', {
    url: webhookUrl,
    secret_token: webhookSecret,
    allowed_updates: ['message', 'callback_query']
  })
  await callBotApi(token, 'setMyCommands', {
    commands: [
      { command: 'start', description: 'Open the HTOO Shop Mini App' },
      { command: 'help', description: 'Show available shop commands' },
      { command: 'orders', description: 'View your orders or recent shop orders' },
      { command: 'pending', description: 'Show orders awaiting fulfillment (admin)' }
    ]
  })
  await callBotApi(token, 'setChatMenuButton', {
    menu_button: {
      type: 'web_app',
      text: 'Open HTOO Shop',
      web_app: { url: miniAppUrl }
    }
  })
}

setup().then(() => {
  console.log('Telegram webhook, commands, and Mini App menu configured.')
}).catch((error) => {
  const safeMessage = String(error.message || 'Telegram setup failed.').replaceAll(process.env.TELEGRAM_BOT_TOKEN || '\u0000', '[redacted]')
  console.error(`Telegram setup failed: ${safeMessage}`)
  process.exitCode = 1
})
