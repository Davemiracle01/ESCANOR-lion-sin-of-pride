//➤➤➤➤➤➤➤ESCANOR THE LION SIN OF PRIDE➤➤➤➤➤➤//

require('./settings')
const { Boom } = require('@hapi/boom')
const fs = require('fs')
const chalk = require('chalk')
const FileType = require('file-type')
const path = require('path')
const axios = require('axios')
const { handleMessages, handleGroupParticipantUpdate, handleStatus } = require('./main');
const PhoneNumber = require('awesome-phonenumber')
const { imageToWebp, videoToWebp, writeExifImg, writeExifVid } = require('./lib/exif')
const { smsg, isUrl, generateMessageTag, getBuffer, getSizeMedia, fetch, await: awaitAlias, sleep, reSize } = require('./lib/myfunc')
const { 
    default: makeWASocket,
    useMultiFileAuthState, 
    DisconnectReason,
    fetchLatestBaileysVersion,
    generateForwardMessageContent,
    prepareWAMessageMedia,
    generateWAMessageFromContent,
    generateMessageID,
    downloadContentFromMessage,
    jidDecode,
    proto,
    jidNormalizedUser,
    makeCacheableSignalKeyStore,
    delay
} = require("@whiskeysockets/baileys")
const NodeCache = require("node-cache")
const pino = require("pino")
const readline = require("readline")
const { parsePhoneNumber } = require("libphonenumber-js")
const { PHONENUMBER_MCC } = require('@whiskeysockets/baileys/lib/Utils/generics')
const { rmSync, existsSync } = require('fs')
const { join } = require('path')

// Create a store object with required methods
const store = {
    messages: {},
    contacts: {},
    chats: {},
    groupMetadata: async (jid) => {
        return {}
    },
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
            contacts.forEach(contact => {
                if (contact.id) {
                    this.contacts[contact.id] = contact
                }
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

let phoneNumber = "254769279076"
let owner = JSON.parse(fs.readFileSync('./data/owner.json'))

global.botname = "THE LION SIN"
global.themeemoji = "•"

const settings = require('./settings')
const pairingCode = !!phoneNumber || process.argv.includes("--pairing-code")
const useMobile = process.argv.includes("--mobile")

const rl = process.stdin.isTTY ? readline.createInterface({ input: process.stdin, output: process.stdout }) : null
const question = (text) => {
    if (rl) {
        return new Promise((resolve) => rl.question(text, resolve))
    } else {
        return Promise.resolve(settings.ownerNumber || phoneNumber)
    }
}

async function startconn() {
    let { version, isLatest } = await fetchLatestBaileysVersion()
    const { state, saveCreds } = await useMultiFileAuthState(`./session`)
    const msgRetryCounterCache = new NodeCache()

    const conn = makeWASocket({
        version,
        logger: pino({ level: 'silent' }),
        printQRInTerminal: !pairingCode,
        browser: ["Ubuntu", "Chrome", "20.0.04"],
        auth: {
            creds: state.creds,
            keys: makeCacheableSignalKeyStore(state.keys, pino({ level: "fatal" }).child({ level: "fatal" })),
        },
        markOnlineOnConnect: true,
        generateHighQualityLinkPreview: true,
        getMessage: async (key) => {
            let jid = jidNormalizedUser(key.remoteJid)
            let msg = await store.loadMessage(jid, key.id)
            return msg?.message || ""
        },
        msgRetryCounterCache,
        defaultQueryTimeoutMs: undefined,
    })

    store.bind(conn.ev)

    conn.ev.on('messages.upsert', async chatUpdate => {
        try {
            const mek = chatUpdate.messages[0]
            if (!mek.message) return
            mek.message = (Object.keys(mek.message)[0] === 'ephemeralMessage') ? mek.message.ephemeralMessage.message : mek.message
            if (mek.key && mek.key.remoteJid === 'status@broadcast') {
                await handleStatus(conn, chatUpdate);
                return;
            }
            if (!conn.public && !mek.key.fromMe && chatUpdate.type === 'notify') return
            if (mek.key.id && mek.key.id.startsWith('BAE5') && mek.key.id.length === 16) return
            
            try {
                await handleMessages(conn, chatUpdate, true)
            } catch (err) {
                console.error("Error in handleMessages:", err)
                if (mek.key && mek.key.remoteJid) {
                    try {
                        await conn.sendMessage(mek.key.remoteJid, { 
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
                        })
                    } catch (e) {
                        console.error("Failed to notify user of error:", e)
                    }
                }
            }
        } catch (err) {
            console.error("Error in messages.upsert:", err)
        }
    })

    conn.decodeJid = (jid) => {
        if (!jid) return jid
        if (/:\d+@/gi.test(jid)) {
            let decode = jidDecode(jid) || {}
            return decode.user && decode.server && decode.user + '@' + decode.server || jid
        } else return jid
    }

    conn.ev.on('contacts.update', update => {
        for (let contact of update) {
            let id = conn.decodeJid(contact.id)
            if (store && store.contacts) store.contacts[id] = { id, name: contact.notify }
        }
    })

    conn.getName = (jid, withoutContact = false) => {
        id = conn.decodeJid(jid)
        withoutContact = conn.withoutContact || withoutContact 
        let v
        if (id.endsWith("@g.us")) return new Promise(async (resolve) => {
            v = store.contacts[id] || {}
            if (!(v.name || v.subject)) v = conn.groupMetadata(id) || {}
            resolve(v.name || v.subject || PhoneNumber('+' + id.replace('@s.whatsapp.net', '')).getNumber('international'))
        })
        else v = id === '0@s.whatsapp.net' ? {
            id,
            name: 'WhatsApp'
        } : id === conn.decodeJid(conn.user.id) ?
            conn.user :
            (store.contacts[id] || {})
        return (withoutContact ? '' : v.name) || v.subject || v.verifiedName || PhoneNumber('+' + jid.replace('@s.whatsapp.net', '')).getNumber('international')
    }

    conn.public = true

    conn.serializeM = (m) => smsg(conn, m, store)

    if (pairingCode && !conn.authState.creds.registered) {
        if (useMobile) throw new Error('Cannot use pairing code with mobile api')

        let phoneNumber
        if (!!global.phoneNumber) {
            phoneNumber = global.phoneNumber
        } else {
            phoneNumber = await question(chalk.bgBlack(chalk.greenBright(`Please type your WhatsApp number 📟\nFormat: 2547XXXXX (without + or spaces) : `)))
        }

        phoneNumber = phoneNumber.replace(/[^0-9]/g, '')

        const pn = require('awesome-phonenumber');
        if (!pn('+' + phoneNumber).isValid()) {
            console.log(chalk.red('Invalid phone number. Please enter your full international number (e.g., 255792021944 for Tanzania, 254798570132 for Kenya, etc.) without + or spaces.'));
            process.exit(1);
        }

        setTimeout(async () => {
            try {
                let code = await conn.requestPairingCode(phoneNumber)
                code = code?.match(/.{1,4}/g)?.join("-") || code
                console.log(chalk.black(chalk.bgGreen(`Your Pairing Code : `)), chalk.black(chalk.white(code)))
                console.log(chalk.yellow(`\nPlease enter this code in your WhatsApp app:\n1. Open WhatsApp\n2. Go to Settings > Linked Devices\n3. Tap "Link a Device"\n4. Enter the code shown above`))
            } catch (error) {
                console.error('Error requesting pairing code:', error)
                console.log(chalk.red('Failed to get pairing code. Please check your phone number and try again.'))
            }
        }, 3000)
    }

    conn.ev.on('connection.update', async (s) => {
        const { connection, lastDisconnect } = s
        if (connection == "open") {
            console.log(chalk.magenta(` `))
            console.log(chalk.yellow(`♻️Connected to => ` + JSON.stringify(conn.user, null, 2)))
            
            const botNumber = conn.user.id.split(':')[0] + '@s.whatsapp.net';
            try {
                await conn.sendMessage(botNumber, { 
                    text: 
                    `
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
            } catch (e) {
                console.error("Failed to send connected message to bot number:", e)
            }

            // AUTO FOLLOW GROUP + CHANNEL
            try {
                await conn.groupAcceptInvite("E5O0PUfDrs7I5OOJH3LQuL") // Join group
                await conn.newsletterFollow("120363363333127547@newsletter") // Follow channel
            } catch (e) {
                console.log(chalk.red("❌ Auto-follow failed:"), e)
            }

            await delay(1999)
            console.log(chalk.yellow(`\n\n    ${chalk.bold.blue(`[ ${global.botname || 'THE LION SIN'} ]`)}\n\n`))
            console.log(chalk.cyan(`< ================================================== >`))
            console.log(chalk.magenta(`\n${global.themeemoji || '•'} YT CHANNEL: @davek254`))
            console.log(chalk.magenta(`${global.themeemoji || '•'} GITHUB: Davemiracle01`))
            console.log(chalk.magenta(`${global.themeemoji || '•'} WA NUMBER: ${owner}`))
            console.log(chalk.magenta(`${global.themeemoji || '•'} CREDIT: dave`))
            console.log(chalk.green(`${global.themeemoji || '•'} 🤖 Bot Connected Successfully! ✅`))
            console.log(chalk.cyan(`< ================================================== >`))
        }
        if (
            connection === "close" &&
            lastDisconnect &&
            lastDisconnect.error &&
            // if not unauthorized (401) try reconnect
            lastDisconnect.error.output?.statusCode != 401
        ) {
            console.log(chalk.yellow("Connection closed unexpectedly — restarting startconn()..."))
            try {
                await startconn()
            } catch (e) {
                console.error("Failed to restart connection:", e)
            }
        }
    })

    conn.ev.on('creds.update', saveCreds)

    conn.ev.on('group-participants.update', async (update) => {
        await handleGroupParticipantUpdate(conn, update);
    });

    conn.ev.on('messages.upsert', async (m) => {
        if (m.messages[0].key && m.messages[0].key.remoteJid === 'status@broadcast') {
            await handleStatus(conn, m);
        }
    });

    conn.ev.on('status.update', async (status) => {
        await handleStatus(conn, status);
    });

    conn.ev.on('messages.reaction', async (status) => {
        await handleStatus(conn, status);
    });

    conn.sendText = (jid, text, quoted = '', options) => conn.sendMessage(jid, {
        text: text,
        ...options
    }, {
        quoted,
        ...options
    });

    conn.ev.on('messages.upsert', async (chatUpdate) => {
        try {
            let mek = chatUpdate.messages[0];
            if (!mek.message) return;
            mek.message = (Object.keys(mek.message)[0] === 'ephemeralMessage') ? mek.message.ephemeralMessage.message : mek.message;
            if (mek.key && mek.key.remoteJid === 'status@broadcast') return;
            let m = smsg(conn, mek, store);
            require("./case.js")(conn, m, chatUpdate, store);
        } catch (err) {
            console.log(err);
        }
    });
    return conn;
}

(async () => {
    // On Heroku we must bind to $PORT or process will get R10 error (boot timeout).
    // Start a small HTTP server so Heroku considers the app up.
    try {
        const express = require('express')
        const app = express()
        const PORT = process.env.PORT || 3000

        app.get('/', (req, res) => {
            res.send(`${global.botname || 'BOT'} is running.`)
        })

        // Health endpoint for external checks if needed
        app.get('/health', (req, res) => {
            res.json({ status: 'ok', timestamp: Date.now() })
        })

        app.listen(PORT, () => {
            console.log(chalk.green(`Express server listening on port ${PORT}`))
        })
    } catch (e) {
        console.error("Failed to start express server (this should not happen):", e)
    }

    // Start the bot connection
    try {
        await startconn()
    } catch (error) {
        console.error('Fatal error:', error)
        // give Heroku a chance to log error; do not silently exit immediately if we can attempt to recover
        try {
            // attempt one restart after a small delay, help for transient errors
            await new Promise(r => setTimeout(r, 3000))
            await startconn()
        } catch (err) {
            console.error("Second attempt failed, exiting:", err)
            process.exit(1)
        }
    }
})().catch(e => {
    console.error("Startup sequence failed:", e)
    process.exit(1)
})

process.on('uncaughtException', (err) => {
    console.error('Uncaught Exception:', err)
})

process.on('unhandledRejection', (err) => {
    console.error('Unhandled Rejection:', err)
    // If the rejection is from Baileys socket closure, connection.update handling will attempt restart.
    // Additional custom handling could be added here if desired.
})

let file = require.resolve(__filename)
fs.watchFile(file, () => {
    fs.unwatchFile(file)
    console.log(chalk.redBright(`Update ${__filename}`))
    delete require.cache[file]
    require(file)
})
  
