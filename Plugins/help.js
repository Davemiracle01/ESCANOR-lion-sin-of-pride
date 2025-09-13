const fs = require('fs');
const path = require('path');
const fetch = require('node-fetch');
const settings = require('../settings');

function formatTime(seconds) {
  const units = [
    { v: Math.floor(seconds / 86400), u: 'd' },
    { v: Math.floor((seconds % 86400) / 3600), u: 'h' },
    { v: Math.floor((seconds % 3600) / 60), u: 'm' },
    { v: Math.floor(seconds % 60), u: 's' },
  ];
  return units.filter(({ v }) => v > 0).map(({ v, u }) => `${v}${u}`).join(' ') || '0s';
}

const commandCategories = {
  Owner: {
    'Bot Management': ['.chatbot', '.resetlink', '.welcome', '.goodbye'].sort(),
    'User Control': [
      '.ban', '.unban', '.promote', '.demote', '.mute', '.unmute', '.delete',
      '.kick', '.warnings', '.warn', '.antilink', '.antibadword', '.clear',
      '.tag', '.tagall',
    ].sort(),
  },
  General: {
    Status: ['.ping', '.runtime'].sort(),
    Info: ['.groupinfo', '.admins', '.jid', '.owner'].sort(),
    Help: ['.menu'].sort(),
    Fun: [
      '.joke', '.quote', '.fact', '.weather', '.news', '.attp', '.lyrics',
      '.8ball', '.trt', '.ss', '.tts', '.vv',
    ].sort(),
  },
  Settings: {
    Mode: [
      '.public', '.private', '.autostatus', '.autoread', '.antidelete',
      '.autoreact', '.autobio', '.autotyping', '.autorecording',
    ].sort(),
    Cleanup: ['.clearsession', '.cleartmp'].sort(),
    Profile: ['.getpp', '.setpp'].sort(),
  },
  Sticker: {
    Creation: ['.blur', '.simage', '.sticker', '.tgsticker', '.meme', '.take', '.emojimix'].sort(),
  },
  Game: {
    Challenges: ['.tictactoe', '.hangman', '.guess', '.trivia', '.answer', '.truth', '.dare'].sort(),
  },
  'Search AI': {
    AI: ['.gpt', '.gptgo', '.gemini', '.imagine', '.flux'].sort(),
  },
  Other: {
    Misc: [
      '.compliment', '.insult', '.flirt', '.shayari', '.goodnight', '.roseday',
      '.character', '.wasted', '.ship', '.simp', '.stupid',
    ].sort(),
  },
  Maker: {
    Effects: [
      '.metallic', '.ice', '.snow', '.impressive', '.matrix', '.light', '.neon',
      '.devil', '.purple', '.thunder', '.leaves', '.1917', '.arena', '.hacker',
      '.sand', '.blackpink', '.glitch', '.fire',
    ].sort(),
  },
  Search: {
    Media: ['.play', '.song', '.instagram', '.facebook', '.tiktok', '.video', '.ytmp4'].sort(),
  },
  GitHub: {
    Code: ['.git', '.github', '.sc', '.script', '.repo', '.gitclone'].sort(),
  },
};

const totalCommands = Object.values(commandCategories)
  .flatMap(category => Object.values(category).flat())
  .length;

async function helpCommand(sock, chatId, message) {
  try {
    // Send sticker first (optional)
    const stickerPath = path.join(__dirname, '../escastickers/escanor1.webp');
    if (fs.existsSync(stickerPath)) {
      await sock.sendMessage(chatId, { sticker: fs.readFileSync(stickerPath) }, { quoted: message });
    }

    // Format uptime and bot name
    const uptimeFormatted = formatTime(process.uptime());
    const botName = settings.botName || 'ESCANOR';

    // Compose the help menu text
    const helpMessage = `
╭═✦〔 🤖 *${botName}* 〕✦═
│ 👤 ᴏᴡɴᴇʀ   : ${settings.botOwner}
│ 🌍 ᴍᴏᴅᴇ    : *${settings.public ? 'ᴘᴜʙʟɪᴄ' : 'sᴇʟғ'}*
│ 🛠️ ᴘʀᴇғɪx  : [ ${settings.prefix || '.'} ]
│ 📈 ᴄᴍᴅs   : ${totalCommands}
│ ⏰ ᴜᴘᴛɪᴍᴇ  : ${uptimeFormatted}
│ 🧪 ᴠᴇʀsɪᴏɴ : ${settings.version}
╰═══⭖══════⭖═══✪

📚 *ᴍᴇɴᴜ ɴᴀᴠɪɢᴀᴛɪᴏɴ:*
${Object.entries(commandCategories).map(([category, subcategories]) => `
📚 *${category.toUpperCase()}*
│
${Object.entries(subcategories).map(([subcat, cmds]) => `│ 📌 *${subcat.toUpperCase()}* ${
      subcat === 'Status' ? '📊' : subcat === 'System' ? '⏰' : subcat === 'Info' ? 'ℹ️' : subcat === 'Help' ? '❓' : subcat === 'Owner' ? '👑' : ''
    }
${cmds.map(cmd => `│ ⊹ ${cmd}`).join('\n')}
│`).join('\n')}
╰═
`).join('\n')}
`;

    // Instead of sending text or image separately, send the GIF video with the help as caption
    await sock.sendMessage(chatId, {
      video: { url: 'https://files.catbox.moe/r2emn1.mp4' },
      gifPlayback: true,  // makes WhatsApp treat video as looping GIF
      caption: helpMessage,
      footer: '🔥 ESCANOR BOT SYSTEM 🔥',
      headerType: 4,
      contextInfo: {
        externalAdReply: {
          title: 'ESCANOR - The Lion Sin of Pride',
          body: 'The ultimate pride commands await you!',
          thumbnailUrl: 'https://files.catbox.moe/0r0xfv.jpeg',
          mediaUrl: 'https://files.catbox.moe/r2emn1.mp4',
          mediaType: 2,
          renderLargerThumbnail: true,
          sourceUrl: 'https://github.com/your-bot-repo',
        },
      },
    }, { quoted: message });

    // Send audio outro (voice note style)
    await sock.sendMessage(
      chatId,
      {
        audio: { url: 'https://files.catbox.moe/w8xll7.mp3' },
        mimetype: 'audio/mpeg',
        ptt: true,
      },
      { quoted: message }
    );

  } catch (error) {
    console.error('Error in help command:', error);
    await sock.sendMessage(chatId, { text: 'Failed to load menu. Try again!' }, { quoted: message });
  }
}

module.exports = helpCommand;
