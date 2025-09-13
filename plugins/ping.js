const os = require('os');
const settings = require('../settings.js');

function formatTime(seconds) {
  const days = Math.floor(seconds / (24 * 60 * 60));
  seconds = seconds % (24 * 60 * 60);
  const hours = Math.floor(seconds / (60 * 60));
  seconds = seconds % (60 * 60);
  const minutes = Math.floor(seconds / 60);
  seconds = Math.floor(seconds % 60);

  let time = '';
  if (days > 0) time += `${days}d `;
  if (hours > 0) time += `${hours}h `;
  if (minutes > 0) time += `${minutes}m `;
  if (seconds > 0 || time === '') time += `${seconds}s`;

  return time.trim();
}

async function pingCommand(sock, chatId, message) {
  try {
    // Send initial challenge message with mention pinging sender
    const senderId = message.key.participant || message.key.remoteJid;
    const senderMention = senderId ? [senderId] : [];

    await sock.sendMessage(chatId, {
      text: `*Who dares question my being?* \nPrepare yourself, @${senderId.split('@')[0]}!`,
      mentions: senderMention
    }, { quoted: message });

    const start = Date.now();
    await sock.sendMessage(chatId, { text: 'Pong!' }, { quoted: message });
    const end = Date.now();
    const ping = Math.round((end - start) / 2);

    const uptimeInSeconds = process.uptime();
    const uptimeFormatted = formatTime(uptimeInSeconds);

    // Escanor-themed styled bot info message
    const botInfo = `
╭──❍ 🦁 𝐄𝐬𝐜𝐚𝐧𝐨𝐫 𝐋𝐢𝐨𝐧 𝐒𝐢𝐧 𝐨𝐟 𝐏𝐫𝐢𝐝𝐞 ❍─
┊ 🔥 ᴘɪɴɢ    : ${ping} ms
┊ ⏱  ᴜᴘᴛɪᴍᴇ  : ${uptimeFormatted}
┊ 📜 ᴠᴇʀsɪᴏɴ  : ${settings.version}
╰───────────────
⚔️ ᴘᴏᴡᴇʀ ʀᴇᴠᴇʀʙᴇᴅ ɪɴ ᴇsᴄᴀɴᴏʀ’s ᴍɪɢʜᴛ⚔️
`.trim();

    // Reply to original message with Escanor-themed bot info
    await sock.sendMessage(chatId, { text: botInfo }, { quoted: message });

  } catch (error) {
    console.error('Error in ping command:', error);
    await sock.sendMessage(chatId, { text: '❌ Failed to get bot status.' }, { quoted: message });
  }
}

module.exports = pingCommand;
