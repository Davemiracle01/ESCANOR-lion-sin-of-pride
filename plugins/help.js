const fs = require('fs');
const path = require('path');
const settings = require('../settings');

function formatTime(seconds) {
  const units = [
    { value: Math.floor(seconds / 86400), unit: 'd' },
    { value: Math.floor((seconds % 86400) / 3600), unit: 'h' },
    { value: Math.floor((seconds % 3600) / 60), unit: 'm' },
    { value: Math.floor(seconds % 60), unit: 's' },
  ];
  return units.filter(({ value }) => value > 0)
    .map(({ value, unit }) => `${value}${unit}`)
    .join(' ') || '0s';
}

const commandCategories = {
  Owner: {
    'Bot Management': ['.chatbot', '.resetlink', '.welcome', '.goodbye'],
    'User Control': [
      '.ban', '.unban', '.promote', '.demote', '.mute', '.unmute', '.delete',
      '.kick', '.warnings', '.warn', '.antilink', '.antibadword', '.clear',
      '.tag', '.tagall',
    ],
  },
  General: {
    Status: ['.ping', '.runtime'],
    Info: ['.groupinfo', '.admins', '.jid', '.owner'],
    Help: ['.menu'],
    Fun: ['.joke', '.quote', '.fact', '.weather', '.news', '.attp', '.lyrics', '.8ball', '.trt', '.ss', '.tts', '.vv'],
  },
  Settings: {
    Mode: ['.public', '.private', '.autostatus', '.autoread', '.antidelete', '.autoreact', '.autobio', '.autotyping', '.autorecording'],
    Cleanup: ['.clearsession', '.cleartmp'],
    Profile: ['.getpp', '.setpp'],
  },
  Sticker: {
    Creation: ['.blur', '.simage', '.sticker', '.tgsticker', '.meme', '.take', '.emojimix'],
  },
  Game: {
    Challenges: ['.tictactoe', '.hangman', '.guess', '.trivia', '.answer', '.truth', '.dare'],
  },
  'Search AI': {
    AI: ['.gpt', '.gptgo', '.gemini', '.imagine', '.flux'],
  },
  Other: {
    Misc: ['.compliment', '.insult', '.flirt', '.shayari', '.goodnight', '.roseday', '.character', '.wasted', '.ship', '.simp', '.stupid'],
  },
  Maker: {
    Effects: ['.metallic', '.ice', '.snow', '.impressive', '.matrix', '.light', '.neon', '.devil', '.purple', '.thunder', '.leaves', '.1917', '.arena', '.hacker', '.sand', '.blackpink', '.glitch', '.fire'],
  },
  Search: {
    Media: ['.play', '.song', '.instagram', '.facebook', '.tiktok', '.video', '.ytmp4'],
  },
  GitHub: {
    Code: ['.git', '.github', '.sc', '.script', '.repo', '.gitclone'],
  },
};

Object.values(commandCategories).forEach(category => {
  Object.keys(category).forEach(subcat => category[subcat].sort());
});

const totalCommands = Object.values(commandCategories)
  .flatMap(category => Object.values(category).flat())
  .length;

async function helpCommand(sock, chatId, message) {
  try {
    const stickerPath = path.join(__dirname, '../escastickers/escanor1.webp');
    if (fs.existsSync(stickerPath)) {
      await sock.sendMessage(chatId, { sticker: fs.readFileSync(stickerPath) }, { quoted: message });
    }

    const uptime = formatTime(process.uptime());
    const botName = settings.botName || 'ESCANOR';

    let helpText = `╭─═☆〔 *${botName}* 〕☆═─╮
│ 👑  Owner    : ${settings.botOwner}
│ 🌐  Mode     : *${settings.public ? 'PUBLIC' : 'SELF'}*
│ 💼  Prefix   : [${settings.prefix || '.'}]
│ 📊  Commands : ${totalCommands}
│ ⏳  Uptime   : ${uptime}
│ 🛠   Version : ${settings.version}
╰───────────────╯

📘 *Menu Navigation*

`;

    for (const [category, subcats] of Object.entries(commandCategories)) {
      helpText += `*${category.toUpperCase()}*\n`;
      for (const [subcat, cmds] of Object.entries(subcats)) {
        let emojiIcon = '';
        switch (subcat.toLowerCase()) {
          case 'status': emojiIcon = '📈'; break;  // symbolizing rise, data
          case 'system': emojiIcon = '⏰'; break;
          case 'info': emojiIcon = 'ℹ️'; break;
          case 'help': emojiIcon = '❔'; break;
          case 'owner': emojiIcon = '👑'; break;
          default: emojiIcon = '►';
        }
        helpText += `\n${emojiIcon} ${subcat}:\n`;
        cmds.forEach(cmd => { helpText += `  ├─ ${cmd}\n`; });
      }
      helpText += '\n';
    }

    await sock.sendMessage(chatId, {
      video: { url: 'https://files.catbox.moe/r2emn1.mp4' },
      gifPlayback: true,
      caption: helpText.trim(),
      footer: '🔥 ESCANOR BOT SYSTEM 🔥',
      headerType: 4,
      contextInfo: {
        externalAdReply: {
          title: 'ESCANOR - The Lion Sin of Pride',
          body: 'Unleash the pride with powerful commands!',
          thumbnailUrl: 'https://files.catbox.moe/0r0xfv.jpeg',
          mediaUrl: 'https://files.catbox.moe/r2emn1.mp4',
          mediaType: 2,
          renderLargerThumbnail: true,
          sourceUrl: 'https://github.com/Davemiracle01/ESCANOR-lion-sin-of-pride',
        },
      },
    }, { quoted: message });

    await sock.sendMessage(chatId, {
      audio: { url: 'https://files.catbox.moe/w8xll7.mp3' },
      mimetype: 'audio/mpeg',
      ptt: true,
    }, { quoted: message });

  } catch (err) {
    console.error('Help command error:', err);
    await sock.sendMessage(chatId, { text: 'Failed to load menu. Please try again.' }, { quoted: message });
  }
}

module.exports = helpCommand;
