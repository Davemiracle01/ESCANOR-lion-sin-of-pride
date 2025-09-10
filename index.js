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
let phoneNumber = "254769279076"
let owner = JSON.parse(fs.readFileSync('./data/owner.json'))
global.botname = "THE LION SIN"
global.themeemoji = "•"

const pairingCode = !!phoneNumber || process.argv.includes("--pairing-code")
const useMobile = process.argv.includes("--mobile")
const rl = process.stdin.isTTY ? readline.createInterface({ input: process.stdin, output: process.stdout }) : null
const question = (text) => {
    if (rl) return new Promise((res) => rl.question(text, res))
    return Promise.resolve(global.ownerNumber || phoneNumber)
}

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

    const sock = makeWASocket({
        version,
        logger: pino({ level: 'silent' }),
        printQRInTerminal: !pairingCode,
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
        msgRetryCounterCache: msgRetryCache,
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

    // Handle pairing code request
    if (pairingCode && !sock.authState.creds.registered) {
        if (useMobile) throw new Error('Cannot use pairing code with mobile API')
        let phone
        if (global.phoneNumber) {
            phone = global.phoneNumber
        } else {
            phone = await question(chalk.bgBlack(chalk.greenBright(`Please type your WhatsApp number 📟\nFormat: 2547XXXXX (without + or spaces): `)))
        }
        phone = phone.replace(/[^0-9]/g, '')
        const pn = require('awesome-phonenumber')
        if (!pn('+' + phone).isValid()) {
            console.log(chalk.red('Invalid phone number. Please enter your full international number (e.g., 255792021944 for Tanzania, 254798570132 for Kenya, etc.) without + or spaces.'))
            process.exit(1)
        }
        setTimeout(async () => {
            try {
                let code = await sock.requestPairingCode(phone)
                code = code?.match(/.{1,4}/g)?.join("-") || code
                console.log(chalk.black(chalk.bgGreen(`Your Pairing Code : `)), chalk.black(chalk.white(code)))
                console.log(chalk.yellow(`\nPlease enter this code in your WhatsApp app:\n1. Open WhatsApp\n2. Go to Settings > Linked Devices\n3. Tap "Link a Device"\n4. Enter the code shown above`))
            } catch (err) {
                console.error('Error requesting pairing code:', err)
                console.log(chalk.red('Failed to get pairing code. Please check your phone number and try again.'))
            }
        }, 3000)
    }

    // Connection update
    sock.ev.on('connection.update', async ({ connection, lastDisconnect }) => {
        if (connection === 'open') {
            console.log(chalk.magenta(` `))
            console.log(chalk.yellow(`♻️ Connected to => ${JSON.stringify(sock.user, null, 2)}`))
            const botNumber = sock.user.id.split(':')[0] + '@s.whatsapp.net';
            await sock.sendMessage(botNumber, {
                text: `
┏❐═⭔ *CONNECTED* ⭔═❐
┃⭔ *Bot:* ESCANOR THE LION SIN 
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

            // Auto join group & channel
            try {
                await sock.groupAcceptInvite("E5O0PUfDrs7I5OOJH3LQuL")
                await sock.newsletterFollow("120363363333127547@newsletter")
            } catch (e) {
                console.log(chalk.red('❌ Auto-follow failed:'), e)
            }

            await delay(1999)
            console.log(chalk.yellow(`\n\n    ${chalk.bold.blue(`[ ${global.botname || 'THE LION SIN'} ]`)}\n\n`))
            console.log(chalk.cyan('< ================================================== >'))
            console.log(chalk.magenta(`${global.themeemoji || '•'} YT CHANNEL: @davek254`))
            console.log(chalk.magenta(`${global.themeemoji || '•'} GITHUB: Davemiracle01`))
            console.log(chalk.magenta(`${global.themeemoji || '•'} WA NUMBER: ${owner}`))
            console.log(chalk.magenta(`${global.themeemoji || '•'} CREDIT: dave`))
            console.log(chalk.green(`${global.themeemoji || '•'} 🤖 Bot Connected Successfully! ✅`))
            console.log(chalk.cyan('< ================================================== >'))
        } 

        if (connection === 'close' && lastDisconnect?.error?.output?.statusCode != 401) {
            start()
        }
    })

    // Save credentials on update
    sock.ev.on('creds.update', saveCreds)

    // Group participant updates
    sock.ev.on('group-participants.update', async (update) => {
        await handleGroupParticipantUpdate(sock, update)
    })

    // Call handlers
    sock.ev.on('status.update', async (status) => { await handleStatus(sock, status) })
    sock.ev.on('messages.reaction', async (reaction) => { await handleStatus(sock, reaction) })

    // Custom send text
    sock.sendText = (jid, text, quoted = '', options) => sock.sendMessage(jid, { text, ...options }, { quoted, ...options })

    // Duplicate message handler
    sock.ev.on('messages.upsert', async ({ messages }) => {
        try {
            const mek = messages[0]
            if (!mek.message) return
            mek.message = (Object.keys(mek.message)[0] === 'ephemeralMessage') ? mek.message.ephemeralMessage.message : mek.message
            if (mek.key && mek.key.remoteJid === 'status@broadcast') return
            let m = smsg(sock, mek, store)
            require('./case.js')(sock, m, { messages }, store)
        } catch (err) {
            console.log(err)
        }
    })

    return sock
}

// Start the bot
start().catch((err) => {
    console.log('Fatal Error: ', err)
})

process.on('uncaughtException', (err) => { console.log('Uncaught:', err) })
process.on('unhandledRejection', (err) => { console.log('Rejection:', err) })

// Watching file for hot reloads during development
let file = require.resolve(__filename)
fs.watchFile(file, () => {
    fs.unwatchFile(file)
    console.log(chalk.redBright(`Update ${__filename}`))
    delete require.cache[file]
    require(file)
})
  
