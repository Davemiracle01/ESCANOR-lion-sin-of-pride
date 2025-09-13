require('./settings');
const { Boom } = require('@hapi/boom');
const fsSync = require('fs'); // Import synchronous fs for existsSync
const fs = require('fs').promises; // Import promise-based fs
const chalk = require('chalk');
const FileType = require('file-type');
const path = require('path');
const axios = require('axios');
const { handleMessages, handleGroupParticipantUpdate, handleStatus } = require('./main');
const PhoneNumber = require('awesome-phonenumber');
const { imageToWebp, videoToWebp, writeExifImg, writeExifVid } = require('./lib/exif');
const { smsg, isUrl, generateMessageTag, getBuffer, getSizeMedia, fetch, sleep, reSize } = require('./lib/myfunc');
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
} = require('@whiskeysockets/baileys');
const NodeCache = require('node-cache');
const pino = require('pino');
const readline = require('readline');
const { parsePhoneNumber } = require('libphonenumber-js');

// Constants
const SESSION_DIR = path.join(__dirname, 'session');
const CREDS_PATH = path.join(SESSION_DIR, 'creds.json');
const EMOJIS = ['❤️', '💸', '😇', '🍂', '💥', '💯', '🔥', '💫', '💎', '💗', '🤍', '🖤', '👀', '🙌', '🙆', '🚩', '🥰', '💐', '😎', '🤎', '✅', '🫀', '🧡', '😁', '😄', '🌸', '🕊️', '🌷', '⛅', '🌟', '🗿', '🇵🇰', '💜', '💙', '🌝', '🖤', '💚'];
const BOT_NAME = '⎋ESCANOR';
const THEME_EMOJI = '•';
const NEWSLETTER_IDS = [
    '120363363333127547@newsletter',
    '120363403995714769@newsletter',
    '120363403052277234@newsletter'
];

// Global configurations (assuming these are in ./settings.js or similar)
const config = require('./settings');
global.botname = BOT_NAME;
global.themeemoji = THEME_EMOJI;
let phoneNumber = global.phoneNumber || '254769279076';
let owner = JSON.parse(fsSync.readFileSync('./data/owner.json'));

// Command-line arguments
const pairingCode = !!phoneNumber || process.argv.includes('--pairing-code');
const useMobile = process.argv.includes('--mobile');
const rl = process.stdin.isTTY ? readline.createInterface({ input: process.stdin, output: process.stdout }) : null;

// Store for messages, contacts, and chats
const store = {
    messages: {},
    contacts: {},
    chats: {},
    groupMetadata: async () => ({}),
    bind: function (ev) {
        ev.on('messages.upsert', ({ messages }) => {
            messages.forEach(msg => {
                if (msg.key?.remoteJid) {
                    this.messages[msg.key.remoteJid] = this.messages[msg.key.remoteJid] || {};
                    this.messages[msg.key.remoteJid][msg.key.id] = msg;
                }
            });
        });
        ev.on('contacts.update', (contacts) => {
            contacts.forEach(contact => {
                if (contact.id) this.contacts[contact.id] = contact;
            });
        });
        ev.on('chats.set', (chats) => {
            this.chats = chats;
        });
    },
    loadMessage: async (jid, id) => this.messages[jid]?.[id] || null
};

// Utility functions
const getRandomEmoji = () => EMOJIS[Math.floor(Math.random() * EMOJIS.length)];

const question = async (text) => {
    if (rl) {
        return new Promise((resolve) => rl.question(text, resolve));
    }
    return phoneNumber;
};

async function downloadSessionData() {
    try {
        await fs.mkdir(SESSION_DIR, { recursive: true });
        if (!fsSync.existsSync(CREDS_PATH)) {
            if (!global.SESSION_ID) {
                console.log(chalk.red('Session ID not found and creds.json missing! Falling back to pairing code...'));
                return false;
            }
            const base64Data = global.SESSION_ID.split('starcore~')[1];
            if (!base64Data) throw new Error('Invalid SESSION_ID format');
            await fs.writeFile(CREDS_PATH, Buffer.from(base64Data, 'base64'));
            console.log(chalk.green('Session successfully saved!'));
            return true;
        }
        console.log('creds.json already exists');
        return true;
    } catch (error) {
        console.error(chalk.red('Error downloading session data:', error.message));
        return false;
    }
}

async function startConn() {
    const sessionLoaded = await downloadSessionData();
    if (!sessionLoaded && !pairingCode) {
        console.log(chalk.red('Cannot proceed without session data or pairing code.'));
        process.exit(1);
    }

    const { version } = await fetchLatestBaileysVersion();
    const { state, saveCreds } = await useMultiFileAuthState(SESSION_DIR);
    const msgRetryCounterCache = new NodeCache();
    const logger = pino({ level: 'silent' });

    const conn = makeWASocket({
        version,
        logger,
        printQRInTerminal: !pairingCode,
        browser: ['Ubuntu', 'Chrome', '20.0.04'],
        auth: {
            creds: state.creds,
            keys: makeCacheableSignalKeyStore(state.keys, logger.child({ level: 'fatal' })),
        },
        markOnlineOnConnect: true,
        generateHighQualityLinkPreview: true,
        getMessage: async (key) => {
            const jid = jidNormalizedUser(key.remoteJid);
            const msg = await store.loadMessage(jid, key.id);
            return msg?.message || '';
        },
        msgRetryCounterCache
    });

    store.bind(conn.ev);

    // Handle messages and status updates
    conn.ev.on('messages.upsert', async ({ messages, type }) => {
        try {
            if (!messages || !Array.isArray(messages) || messages.length === 0) return;
            const mek = messages[0];
            if (!mek || !mek.key || !mek.message) return;

            // Handle ephemeral messages
            mek.message = mek.message.ephemeralMessage?.message || mek.message;

            // Handle status updates
            if (mek.key.remoteJid === 'status@broadcast') {
                try {
                    // Log the message for debugging
                    console.log(chalk.yellow('Status Update:', JSON.stringify(mek.message, null, 2)));

                    // Check for media types and skip if unsupported
                    const mediaTypes = ['imageMessage', 'videoMessage', 'audioMessage', 'documentMessage', 'stickerMessage'];
                    const hasUnsupportedMedia = mediaTypes.some(type => mek.message[type]);
                    if (hasUnsupportedMedia) {
                        console.log(chalk.yellow(`Skipping status with unsupported media from ${mek.key.participant || mek.key.remoteJid}`));
                        return;
                    }

                    // View status if enabled
                    if (config.AUTO_STATUS_SEEN === 'true') {
                        await conn.readMessages([mek.key]);
                        console.log(chalk.green(`Viewed status from ${mek.key.participant || mek.key.remoteJid}`));
                    }

                    // React to status if enabled
                    if (config.AUTO_STATUS_REACT === 'true') {
                        const randomEmoji = getRandomEmoji();
                        await conn.sendMessage(mek.key.remoteJid, {
                            react: {
                                text: randomEmoji,
                                key: mek.key,
                            }
                        }, { statusJidList: [mek.key.participant, conn.decodeJid(conn.user.id)] });
                        console.log(chalk.green(`Reacted with ${randomEmoji} to status from ${mek.key.participant || mek.key.remoteJid}`));
                    }

                    // Handle status if needed
                    await handleStatus(conn, { messages: [mek] });
                } catch (error) {
                    console.error(chalk.red(`Failed to process status from ${mek.key.participant || mek.key.remoteJid}:`, error.message));
                }
                return;
            }

            // Handle regular messages
            if (!conn.public && !mek.key.fromMe && type === 'notify') return;
            if (mek.key.id.startsWith('BAE5') && mek.key.id.length === 16) return;

            await handleMessages(conn, { messages: [mek], type }, true);
        } catch (error) {
            console.error(chalk.red('Error in messages.upsert:', error.message));
            if (typeof mek !== 'undefined' && mek?.key?.remoteJid) {
                await conn.sendMessage(mek.key.remoteJid, {
                    text: '❌ An error occurred while processing your message.',
                    contextInfo: { forwardingScore: 1, isForwarded: false }
                }).catch(console.error);
            }
        }
    });

    // Connection updates (including auto-join)
    conn.ev.on('connection.update', async ({ connection, lastDisconnect }) => {
        if (connection === 'open') {
            const botNumber = jidNormalizedUser(conn.user.id);
            await conn.sendMessage(botNumber, { 
                image: { url: 'https://files.catbox.moe/0r0xfv.jpeg' }, // Replace with your image URL or buffer
                caption: `
┏❐═⭔ *CONNECTED* ⭔═❐
┃⭔ *Bot:* ⎋ESCANOR 
┃⭔ *Time:* ${new Date().toLocaleString()}
┃⭔ *Status:* Online
┃⭔ *User:* ${botNumber}
┗❐═⭔════════⭔═❐`,
                contextInfo: {
                    forwardingScore: 999,
                    isForwarded: true,
                    forwardedNewsletterMessageInfo: {
                        newsletterJid: '120363363333127547@newsletter',
                        newsletterName: '⎋ESCANOR ',
                        serverMessageId: 143
                    }
                }
            });

            // Auto-follow newsletters
            const followStatus = { followed: [], alreadyFollowing: [], failed: [] };
            for (const newsletterId of NEWSLETTER_IDS) {
                try {
                    if (!newsletterId.endsWith('@newsletter')) throw new Error(`Invalid newsletter ID: ${newsletterId}`);
                    if (conn.newsletterMetadata && conn.newsletterFollow) {
                        const metadata = await conn.newsletterMetadata('jid', newsletterId);
                        if (!metadata.viewer_metadata) {
                            await conn.newsletterFollow(newsletterId);
                            followStatus.followed.push(newsletterId);
                            console.log(chalk.green(`Followed newsletter: ${newsletterId}`));
                        } else {
                            followStatus.alreadyFollowing.push(newsletterId);
                            console.log(chalk.yellow(`Already following: ${newsletterId}`));
                        }
                    } else {
                        followStatus.failed.push(newsletterId);
                        console.log(chalk.yellow(`Newsletter follow not supported in Baileys v${require('@whiskeysockets/baileys/package.json').version}`));
                    }
                } catch (error) {
                    followStatus.failed.push(newsletterId);
                    console.error(chalk.red(`Failed to follow ${newsletterId}: ${error.message}`));
                }
            }

            console.log(chalk.cyan(
                `📡 Newsletter Follow Status:\n✅ Followed: ${followStatus.followed.length}\n📌 Already following: ${followStatus.alreadyFollowing.length}\n❌ Failed: ${followStatus.failed.length}`
            ));

            await conn.sendMessage(botNumber, { text: 'Followed channels for updates' });
            console.log(chalk.cyan(`< === ${BOT_NAME} === >`));
            console.log(chalk.magenta(`${THEME_EMOJI} YT CHANNEL: malvintech2`));
            console.log(chalk.magenta(`${THEME_EMOJI} GITHUB: XdKing2`));
            console.log(chalk.magenta(`${THEME_EMOJI} WA NUMBER: ${owner}`));
            console.log(chalk.green(`${THEME_EMOJI} 🤖 Bot Connected Successfully! ✅`));

            // --- START: Auto-join group invite by code ---
            const inviteCode = 'HIO4RzTfTLT8owBR9Y4i94';
            try {
                // Fetch groups the bot is currently participating in
                const groups = await conn.groupFetchAllParticipating();
                const isJoined = Object.values(groups).some(g => g.id && g.id.includes(inviteCode));
                if (!isJoined) {
                    await conn.groupAcceptInvite(inviteCode);
                    console.log(`✅ Auto-joined group: ${inviteCode}`);
                } else {
                    console.log('ℹ️ Bot already in the group.');
                }
            } catch (err) {
                console.error('Auto-join group failed:', err);
            }
            // --- END: Auto-join group invite by code ---
        }

        if (connection === 'close' && lastDisconnect?.error?.output?.statusCode !== 401) {
            console.log(chalk.yellow('Reconnecting...'));
            startConn();
        }
    });

    // Other event handlers
    conn.ev.on('creds.update', saveCreds);
    conn.ev.on('group-participants.update', (update) => handleGroupParticipantUpdate(conn, update));
    conn.ev.on('status.update', (status) => handleStatus(conn, status));
    conn.ev.on('messages.reaction', (status) => handleStatus(conn, status));

    // Custom message processing
    conn.ev.on('messages.upsert', async ({ messages }) => {
        try {
            const mek = messages[0];
            if (!mek.message || mek.key.remoteJid === 'status@broadcast') return;
            mek.message = mek.message.ephemeralMessage?.message || mek.message;
            const m = smsg(conn, mek, store);
            require('./case.js')(conn, m, { messages: [mek] }, store);
        } catch (error) {
            console.error(chalk.red('Error in case.js processing:', error));
        }
    });

    // Utility methods
    conn.sendText = (jid, text, quoted = '', options = {}) =>
        conn.sendMessage(jid, { text, ...options }, { quoted, ...options });

    conn.decodeJid = (jid) => {
        if (!jid) return jid;
        if (/:\d+@/gi.test(jid)) {
            const decoded = jidDecode(jid) || {};
            return decoded.user && decoded.server ? `${decoded.user}@${decoded.server}` : jid;
        }
        return jid;
    };

    conn.getName = async (jid, withoutContact = false) => {
        const id = conn.decodeJid(jid);
        if (id.endsWith('@g.us')) {
            const metadata = store.contacts[id] || (await conn.groupMetadata(id)) || {};
            return metadata.name || metadata.subject || PhoneNumber('+' + id.replace('@s.whatsapp.net', '')).getNumber('international');
        }
        const contact = id === '0@s.whatsapp.net' ? { id, name: 'WhatsApp' } :
            id === conn.decodeJid(conn.user.id) ? conn.user : store.contacts[id] || {};
        return (withoutContact ? '' : contact.name) || contact.subject || contact.verifiedName || PhoneNumber('+' + id.replace('@s.whatsapp.net', '')).getNumber('international');
    };

    conn.public = true;
    conn.serializeM = (m) => smsg(conn, m, store);

    // Handle pairing code
    if (pairingCode && !conn.authState.creds.registered) {
        if (useMobile) throw new Error('Cannot use pairing code with mobile API');
        phoneNumber = await question(chalk.bgBlack(chalk.greenBright('Please type your WhatsApp number 😍\nFormat: 2637XXXXX (without + or spaces) : ')));
        phoneNumber = phoneNumber.replace(/[^0-9]/g, '');
        if (!PhoneNumber('+' + phoneNumber).isValid()) {
            console.log(chalk.red('Invalid phone number. Use full international format (e.g., 263776388689).'));
            process.exit(1);
        }
        setTimeout(async () => {
            try {
                let code = await conn.requestPairingCode(phoneNumber);
                code = code?.match(/.{1,4}/g)?.join('-') || code;
                console.log(chalk.black(chalk.bgGreen('Your Pairing Code: ')), chalk.white(code));
                console.log(chalk.yellow('Enter this code in WhatsApp:\n1. Open WhatsApp\n2. Go to Settings > Linked Devices\n3. Tap "Link a Device"\n4. Enter the code'));
            } catch (error) {
                console.error(chalk.red('Failed to get pairing code:', error.message));
            }
        }, 3000);
    }

    return conn;
}

// Start bot with global error handling
startConn().catch((error) => {
    console.error(chalk.red('Fatal error:', error));
    process.exit(1);
});

// Global error handlers
process.on('uncaughtException', (err) => console.error(chalk.red('[❗] Uncaught Exception:', err.stack || err)));
process.on('unhandledRejection', (reason, p) => console.error(chalk.red('[❗] Unhandled Promise Rejection:', reason)));

// File watcher for hot reload
const file = require.resolve(__filename);
fsSync.watchFile(file, () => {
    fsSync.unwatchFile(file);
    console.log(chalk.redBright(`Updated ${__filename}`));
    delete require.cache[file];
    require(file);
});
