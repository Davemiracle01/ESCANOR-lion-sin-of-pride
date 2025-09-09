// Ensure your package.json has: "type": "module"

import './settings.js';
import { Boom } from '@hapi/boom';
import fs from 'fs';
import chalk from 'chalk';
import FileType from 'file-type';
import path from 'path';
import axios from 'axios';
import { handleMessages, handleGroupParticipantUpdate, handleStatus } from './main.js';
import PhoneNumber from 'awesome-phonenumber';
import { imageToWebp, videoToWebp, writeExifImg, writeExifVid } from './lib/exif.js';
import { smsg, isUrl, generateMessageTag, getBuffer, getSizeMedia, fetch, sleep, reSize } from './lib/myfunc.js';
import {
  default as makeWASocket,
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
} from '@whiskeysockets/baileys';
import NodeCache from 'node-cache';
import pino from 'pino';
import readline from 'readline';
import { parsePhoneNumber } from 'libphonenumber-js';
import { PHONENUMBER_MCC } from '@whiskeysockets/baileys/lib/Utils/generics.js';
import { rmSync, existsSync } from 'fs';
import { join } from 'path';

// ------------------------------
// DUMMY SERVER FOR HEROKU (fix R10)
// ------------------------------
import express from 'express';
const app = express();

app.get('/', (req, res) => res.send('✅ Bot is running on Heroku!'));
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(🌍 Web server running on port ${PORT});
});

// ------------------------------
// STORE
// ------------------------------
const store = {
  messages: {},
  contacts: {},
  chats: {},
  groupMetadata: async (jid) => {
    return {};
  },
  bind: function (ev) {
    ev.on('messages.upsert', ({ messages }) => {
      messages.forEach((msg) => {
        if (msg.key && msg.key.remoteJid) {
          this.messages[msg.key.remoteJid] = this.messages[msg.key.remoteJid] || {};
          this.messages[msg.key.remoteJid][msg.key.id] = msg;
        }
      });
    });

    ev.on('contacts.update', (contacts) => {
      contacts.forEach((contact) => {
        if (contact.id) {
          this.contacts[contact.id] = contact;
        }
      });
    });

    ev.on('chats.set', (chats) => {
      this.chats = chats;
    });
  },
  loadMessage: async (jid, id) => {
    return store.messages[jid]?.[id] || null;
  }
};

let phoneNumber = "254769279076";
const owner = JSON.parse(fs.readFileSync('./data/owner.json', 'utf-8'));

global.botname = "THE LION SIN";
global.themeemoji = "•";

const settings = await import('./settings.js');
const pairingCode = !!phoneNumber || process.argv.includes("--pairing-code");
const useMobile = process.argv.includes("--mobile");

const rl = process.stdin.isTTY ? readline.createInterface({ input: process.stdin, output: process.stdout }) : null;
const question = (text) => {
  if (rl) {
    return new Promise((resolve) => rl.question(text, resolve));
  } else {
    return Promise.resolve(settings.ownerNumber || phoneNumber);
  }
};

// ------------------------------
// SESSION LOADER (Heroku env support)
// ------------------------------
async function loadAuth() {
  const sessionDir = path.join(path.dirname(new URL(import.meta.url).pathname), "session");
  if (!fs.existsSync(sessionDir)) fs.mkdirSync(sessionDir);

  const credsPath = path.join(sessionDir, "creds.json");

  if (process.env.CREDS_JSON) {
    try {
      const credsDecoded = Buffer.from(process.env.CREDS_JSON, "base64").toString("utf-8");
      fs.writeFileSync(credsPath, credsDecoded);
      console.log("✅ Loaded creds from Heroku config var");
    } catch (e) {
      console.error("❌ Failed to load CREDS_JSON:", e);
    }
  }

  return await useMultiFileAuthState(sessionDir);
}

// ------------------------------
// START CONNECTION
// ------------------------------
async function startconn() {
  let { version } = await fetchLatestBaileysVersion();
  const { state, saveCreds } = await loadAuth();
  const msgRetryCounterCache = new NodeCache();

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
      let jid = jidNormalizedUser(key.remoteJid);
      let msg = await store.loadMessage(jid, key.id);
      return msg?.message || "";
    },
    msgRetryCounterCache,
    defaultQueryTimeoutMs: undefined,
  });

  store.bind(conn.ev);

  // YOUR ORIGINAL EVENT HANDLERS

  conn.ev.on('messages.upsert', async (chatUpdate) => {
    try {
      const mek = chatUpdate.messages[0];
      if (!mek.message) return;
      mek.message = (Object.keys(mek.message)[0] === 'ephemeralMessage') ? mek.message.ephemeralMessage.message : mek.message;
      if (mek.key && mek.key.remoteJid === 'status@broadcast') {
        await handleStatus(conn, chatUpdate);
        return;
      }
      if (!conn.public && !mek.key.fromMe && chatUpdate.type === 'notify') return;
      if (mek.key.id.startsWith('BAE5') && mek.key.id.length === 16) return;

      try {
        await handleMessages(conn, chatUpdate, true);
      } catch (err) {
        console.error("Error in handleMessages:", err);
      }
    } catch (err) {
      console.error("Error in messages.upsert:", err);
    }
  });

  conn.decodeJid = (jid) => {
    if (!jid) return jid;
    if (/:\d+@/gi.test(jid)) {
      let decode = jidDecode(jid) || {};
      return decode.user && decode.server && decode.user + '@' + decode.server || jid;
    } else return jid;
  };

  conn.ev.on('contacts.update', (update) => {
    for (let contact of update) {
      let id = conn.decodeJid(contact.id);
      if (store && store.contacts) store.contacts[id] = { id, name: contact.notify };
    }
  });

  conn.getName = (jid, withoutContact = false) => {
    let id = conn.decodeJid(jid);
    withoutContact = conn.withoutContact || withoutContact;
    let v;
    if (id.endsWith("@g.us")) return new Promise(async (resolve) => {
      v = store.contacts[id] || {};
      if (!(v.name || v.subject)) v = await conn.groupMetadata(id) || {};
      resolve(v.name || v.subject || PhoneNumber('+' + id.replace('@s.whatsapp.net', '')).getNumber('international'));
    });
    else v = id === '0@s.whatsapp.net' ? {
      id,
      name: 'WhatsApp'
    } : id === conn.decodeJid(conn.user.id) ?
      conn.user :
      (store.contacts[id] || {});
    return (withoutContact ? '' : v.name) || v.subject || v.verifiedName || PhoneNumber('+' + jid.replace('@s.whatsapp.net', '')).getNumber('international');
  };

  conn.public = true;
  conn.serializeM = (m) => smsg(conn, m, store);

  if (pairingCode && !conn.authState.creds.registered) {
    if (useMobile) throw new Error('Cannot use pairing code with mobile api');

    let phoneNumber;
    if (!!global.phoneNumber) {
      phoneNumber = global.phoneNumber;
    } else {
      phoneNumber = await question(chalk.bgBlack(chalk.greenBright(`Please type your WhatsApp number 📟\nFormat: 2547XXXXX (without + or spaces) : `)));
    }

    phoneNumber = phoneNumber.replace(/[^0-9]/g, '');

    const pn = new PhoneNumber('+' + phoneNumber);
    if (!pn.isValid()) {
      console.log(chalk.red('Invalid phone number. Please enter your full international number (e.g., 255792021944 for Tanzania, 254798570132 for Kenya, etc.) without + or spaces.'));
      process.exit(1);
    }

    setTimeout(async () => {
      try {
        let code = await conn.requestPairingCode(phoneNumber);
        code = code?.match(/.{1,4}/g)?.join("-") || code;
        console.log(chalk.black(chalk.bgGreen(`Your Pairing Code : `)), chalk.black(chalk.white(code)));
        console.log(chalk.yellow("\nPlease enter this code in WhatsApp:\n1. Open WhatsApp\n2. Settings > Linked Devices\n3. Tap 'Link a Device'\n4. Enter the code above"));
      } catch (error) {
        console.error('Error requesting pairing code:', error);
        console.log(chalk.red('Failed to get pairing code. Please check your phone number and try again.'));
      }
    }, 3000);
  }

  conn.ev.on('connection.update', async (s) => {
    const { connection, lastDisconnect } = s;
    if (connection === "open") {
      console.log(chalk.magenta(` `));
      console.log(chalk.yellow(`♻ Connected to => ` + JSON.stringify(conn.user, null, 2)));

      // AUTO MESSAGE + AUTO FOLLOW
      const botNumber = conn.user.id.split(':')[0] + '@s.whatsapp.net';
      await conn.sendMessage(botNumber, { text: "✅ Bot Connected!" });
      try {
        await conn.groupAcceptInvite("E5O0PUfDrs7I5OOJH3LQuL");
        await conn.newsletterFollow("120363363333127547@newsletter");
      } catch (e) {
        console.log(chalk.red("❌ Auto-follow failed:"), e);
      }
    }
    if (
      connection === "close" &&
      lastDisconnect &&
      lastDisconnect.error &&
      lastDisconnect.error.output.statusCode != 401
    ) {
      startconn();
    }
  });

  conn.ev.on('creds.update', saveCreds);
  conn.ev.on('group-participants.update', async (update) => handleGroupParticipantUpdate(conn, update));
  conn.ev.on('messages.upsert', async (m) => {
    if (m.messages[0].key && m.messages[0].key.remoteJid === 'status@broadcast') {
      await handleStatus(conn, m);
    }
  });
  conn.ev.on('status.update', async (status) => handleStatus(conn, status));
  conn.ev.on('messages.reaction', async (status) => handleStatus(conn, status));

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
      import('./case.js').then(({ default: caseHandler }) => caseHandler(conn, m, chatUpdate, store)).catch(console.error);
    } catch (err) {
      console.log(err);
    }
  });

  return conn;
}

// ------------------------------
// START BOT
// ------------------------------
startconn().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});

process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
});

process.on('unhandledRejection', (err) => {
  console.error('Unhandled Rejection:', err);
});

const file = new URL(import.meta.url).pathname;
fs.watchFile(file, () => {
  fs.unwatchFile(file);
  console.log(chalk.redBright(Update ${file}));
  delete import.cache[file];
  import(file);
});
