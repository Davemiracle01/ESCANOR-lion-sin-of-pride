// ➤➤➤➤➤➤➤ ESCANOR THE LION, SON OF PRIDE ➤➤➤➤➤➤➤ //

require('./settings')
const { Boom } = require('@hapi/boom')
const fs = require('fs')
const chalk = require('chalk')
const { fetchLatestBaileysVersion } = require("@whiskeysockets/baileys")
const { useMultiFileAuthState, makeWASocket, DisconnectReason } = require("@whiskeysockets/baileys")
const { delay } = require("@whiskeysockets/baileys")
const NodeCache = require('node-cache')
const pino = require('pino')
const readline = require('readline')
const { jidNormalizedUser, makeCacheableSignalKeyStore, jidDecode } = require("@whiskeysockets/baileys")
const { handleMessages, handleGroupParticipantUpdate, handleStatus } = require('./main')

// Environment variables
const OWNER_NUMBER = process.env.OWNER_NUMBER || '254769279076'
const BOT_NAME = process.env.BOT_NAME || 'ESCANOR - Lion Sin of Pride'
const PREFIX = process.env.PREF || '.'
const SESSION_STRING = process.env.SESSION_ID || null

// Initialize store object
const store = {
    messages: {},
    contacts: {},
    chats: {},
    groupMetadata: async (jid) => ({}),
    bind: function(ev) {
        ev.on('messages.upsert', ({ messages }) => {
            messages.forEach(msg => {
                if (msg.key && msg.key.remoteJid) {
                    this.messages[msg.key.remoteJid] = this.messages[msg.key.remoteJid] || {}
                    this.messages[msg.key.remoteJid][msg.key.id] = msg
                }
            })
        })
        ev.on('contacts.update', (contacts) => {
            contacts.forEach(c => {
                if (c.id) this.contacts[c.id] = c
            })
        })
        ev.on('chats.set', (chats) => {
            this.chats = chats
        })
    },
    loadMessage: async (jid, id) => {
        return this.messages[jid]?.[id] || null
    }
}

// User info & Global vars
let phoneNumber = OWNER_NUMBER
let owner = { number: OWNER_NUMBER }
global.botname = BOT_NAME
global.themeemoji = "•"

const pairingCode = false // Not used here
const useMobile = false // Not used here
const rl = readline.createInterface({ input: process.stdin, output: process.stdout })
const question = (text) => new Promise((res) => rl.question(text, res))

// Main connection start
async function start() {
    // Fetch latest Baileys version
    const { version } = await fetchLatestBaileysVersion()

    // Ensure session folder exists
    const sessionDir = './session'
    if (!fs.existsSync(sessionDir)) {
        fs.mkdirSync(sessionDir, { recursive: true })
        console.log(chalk.green('Created session directory!'))
    }

    // Load auth state
    const { state, saveCreds } = await useMultiFileAuthState(sessionDir)
    const msgRetryCache = new NodeCache()

    // If SESSION_STRING exists, restore session
    if (SESSION_STRING) {
        // Logic for restoring session from string (if needed)
        // Skip, as bailey's useMultiFileAuthState doesn't support directly passing session string
        // You might want to implement custom session restore if needed
    }

    const sock = makeWASocket({
        version,
        logger: pino({ level: 'silent' }),
        printQRInTerminal: true,
        browser: ["Ubuntu", "Chrome", "20.0.04"],
        auth: {
            creds: state.creds,
            keys: makeCacheableSignalKeyStore(state.keys, pino({ level: 'fatal' }).child({ level: 'fatal' })),
        },
        markOnlineOnConnect: true,
        generateHighQualityLinkPreview: true,
        getMessage: async (key) => {
            let jid = jidNormalizedUser(key.remoteJid)
            let msg = await store.loadMessage(jid, key.id)
            return msg?.message || ""
        },
        msgRetryCounterCache: new NodeCache(),
        defaultQueryTimeoutMs: undefined,
    })

    // Bind store
    store.bind(sock.ev)

    // Handle incoming messages
    sock.ev.on('messages.upsert', async ({ messages, type }) => {
        try {
            const msg = messages[0]
            if (!msg.message) return
            msg.message = (Object.keys(msg.message)[0] === 'ephemeralMessage') ? msg.message.ephemeralMessage.message : msg.message
            if (msg.key.remoteJid === 'status@broadcast') {
                await handleStatus(sock, { messages, type })
                return
            }
            if (!sock.public && !msg.key.fromMe && type === 'notify') return
            if (msg.key.id.startsWith('BAE5') && msg.key.id.length === 16) return

            try {
                await handleMessages(sock, { messages, type }, true)
            } catch (err) {
                console.error("Error in handleMessages:", err)
                if (msg.key.remoteJid) {
                    await sock.sendMessage(msg.key.remoteJid, { 
                        text: '❌ An error occurred while processing your message.',
                        contextInfo: {
                            forwardingScore: 1,
                            isForwarded: false,
                            forwardedNewsletterMessageInfo: {
                                newsletterJid: '@newsletter',
                                newsletterName: 'ESCANOR',
                                serverMessageId: -1
                            }
                        }
                    }).catch(console.error)
                }
            }
        } catch (err) {
            console.error("Error in message upsert:", err)
        }
    })

    // Decode jid helper
    sock.decodeJid = (jid) => {
        if (!jid) return jid
        if (/:\d+@/gi.test(jid)) {
            const decoded = jidDecode(jid) || {}
            return decoded.user && decoded.server ? `${decoded.user}@${decoded.server}` : jid
        } else return jid
    }

    // Update contacts
    sock.ev.on('contacts.update', update => {
        for (const contact of update) {
            const id = sock.decodeJid(contact.id)
            if (store?.contacts) store.contacts[id] = { id, name: contact.notify }
        }
    })

    // getName function
    sock.getName = (jid, withoutContact = false) => {
        const id = sock.decodeJid(jid)
        let v
        if (id.endsWith("@g.us")) {
            return new Promise(async (resolve) => {
                v = store.contacts[id] || {}
                if (!(v.name || v.subject)) v = await sock.groupMetadata(id) || {}
                resolve(v.name || v.subject || PhoneNumber('+' + id.replace('@s.whatsapp.net', '')).getNumber('international'))
            })
        } else {
            v = id === '0@s.whatsapp.net' ? { id, name: 'WhatsApp' } : id === sock.decodeJid(sock.user.id) ? sock.user : (store.contacts[id] || {})
            return (withoutContact ? '' : v.name) || v.subject || v.verifiedName || PhoneNumber('+' + id.replace('@s.whatsapp.net', '')).getNumber('international')
        }
    }

    sock.public = true
    sock.serializeM = (m) => smsg(sock, m, store)

    // Handle connection update
    sock.ev.on('connection.update', async ({ connection, lastDisconnect }) => {
        if (connection === 'open') {
            console.log(chalk.magenta(` `))
            console.log(chalk.yellow(`♻️ Connected to => ${JSON.stringify(sock.user, null, 2)}`))
            const botNumber = sock.user.id.split(':')[0] + '@s.whatsapp.net'
            await sock.sendMessage(botNumber, {
                text: `
┏❐═⭔ *CONNECTED* ⭔═❐
┃⭔ *Bot:* ${global.botname}
┃⭔ *Time:* ${new Date().toLocaleString()}
┃⭔ *Status:* Online
┃⭔ *User:* ${botNumber}
┗❐═⭔════════⭔═❐`,
                contextInfo: {
                    forwardingScore: 1,
                    isForwarded: false,
                    forwardedNewsletterMessageInfo: {
                        newsletterJid: '@newsletter',
                        newsletterName: 'ESCANOR',
                        serverMessageId: -1
                    }
                }
            })

            // Optional: auto join group / channels, etc.
        } 

        if (connection === 'close' && lastDisconnect?.error?.output?.statusCode != 401) {
            start()
        }
    })

    // Save credentials on update
    sock.ev.on('creds.update', saveCreds)

    // Group participant update
    sock.ev.on('group-participants.update', async (update) => {
        await handleGroupParticipantUpdate(sock, update)
    })

    // Status update, reactions etc.
    sock.ev.on('status.update', async (status) => { await handleStatus(sock, status) })

    // Custom send text
    sock.sendText = (jid, text, quoted = '', options) => sock.sendMessage(jid, { text, ...options }, { quoted, ...options })

    // Handle reactions, etc.
    sock.ev.on('messages.upsert', async ({ messages }) => {
        // Your existing code...
    })

    return sock
}

// Start the bot
start().catch((err) => {
    console.error('Fatal Error:', err)
})

process.on('uncaughtException', (err) => { console.log('Uncaught:', err) })
process.on('unhandledRejection', (err) => { console.log('Rejection:', err) })

// Watch file for hot reloads if developing
let file = require.resolve(__filename)
fs.watchFile(file, () => {
    fs.unwatchFile(file)
    console.log(chalk.redBright(`Update ${__filename}`))
    delete require.cache[file]
    require(file)
})
