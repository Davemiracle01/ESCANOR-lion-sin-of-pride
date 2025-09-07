const settings = require('../settings');
const fs = require('fs');
const path = require('path');

// Format uptime
function formatTime(seconds) {
    const days = Math.floor(seconds / (24 * 60 * 60));
    seconds %= 24 * 60 * 60;
    const hours = Math.floor(seconds / (60 * 60));
    seconds %= 60 * 60;
    const minutes = Math.floor(seconds / 60);
    seconds = Math.floor(seconds % 60);

    let time = '';
    if (days > 0) time += `${days}d `;
    if (hours > 0) time += `${hours}h `;
    if (minutes > 0) time += `${minutes}m `;
    if (seconds > 0 || time === '') time += `${seconds}s`;

    return time.trim();
}

async function helpCommand(sock, chatId, message) {
    try {
        const start = Date.now();

        // Sticker intro
        const stickerPath = path.join(__dirname, '../escastickers/escanor1.webp');
        if (fs.existsSync(stickerPath)) {
            await sock.sendMessage(chatId, { 
                sticker: fs.readFileSync(stickerPath) 
            }, { quoted: message });
        }

        await sock.sendMessage(chatId, { text: '_🌟 The pride of Escanor awakens... 🌟_' }, { quoted: message });
        const end = Date.now();
        const ping = Math.round((end - start) / 2);

        const uptimeFormatted = formatTime(process.uptime());
        const now = new Date();

        // Menu text
        const menuText = `
🔥 *ESCANOR - THE LION SIN OF PRIDE* 🔥

👑 *Master of Pride:* ${settings.botOwner}
⏳ *Uptime:* ${uptimeFormatted}
⏰ *Time:* ${now.toLocaleString()}
⚡ *Speed:* ${ping} ms
📍 *Version:* ${settings.version}

───────────────
🐉 *ADMINISTRATION*
───────────────
.ban
.unban
.promote
.demote
.mute
.unmute
.delete
.kick
.warnings
.warn
.antilink
.antibadword
.clear
.tag
.tagall
.chatbot
.resetlink
.welcome
.goodbye

───────────────
⚔️ *GENERAL*
───────────────
.menu
.ping
.runtime
.tts
.owner
.joke
.quote
.fact
.weather
.news
.time
.reminder

───────────────
🛠️ *SETTINGS*
───────────────
.public
.private
.autostatus
.autoread
.clearsession
.antidelete
.cleartmp
.autoreact
.getpp
.setpp
.autobio
.autotyping
.autorecording
.language
.region

───────────────
🎨 *STICKERS*
───────────────
.blur
.simage
.sticker
.tgsticker
.meme
.take
.emojimix
.stickerinfo

───────────────
🎲 *GAMES*
───────────────
.tictactoe
.hangman
.guess
.trivia
.answer
.truth
.dare
.quiz
.memory

───────────────
🤖 *AI COMMANDS*
───────────────
.gpt
.gptgo
.gemini
.imagine
.flux
.summarize
.translate

───────────────
✨ *OTHER*
───────────────
.compliment
.insult
.flirt
.shayari
.goodnight
.roseday
.character
.wasted
.ship
.simp
.stupid
.weatherforecast
.coinflip

───────────────
⚡ *MAKER*
───────────────
.metallic
.ice
.snow
.impressive
.matrix
.light
.neon
.devil
.purple
.thunder
.leaves
.1917
.arena
.hacker
.sand
.blackpink
.glitch
.fire
.skyline
.vintage

───────────────
🔍 *SEARCH*
───────────────
.play
.song
.instagram
.facebook
.tiktok
.video
.ytmp4
.google
.wikipedia

───────────────
💻 *GITHUB*
───────────────
.git
.github
.sc
.script
.repo
.gitclone
.pullrequest

🔥 *The pride of the Lion Sin will always guide you.* 🔥
        `.trim();

        // Send GIF instead of video
        await sock.sendMessage(chatId, {
            gifPlayback: true,
            video: { url: 'https://files.catbox.moe/r2emn1.mp4' }, // WhatsApp will treat this as looping GIF
            caption: menuText,
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
                    sourceUrl: 'https://github.com/Davemiracle01/ESCANOR-lion-sin-of-pride'
                }
            }
        }, { quoted: message });

        // Audio outro (voice note style)
        await sock.sendMessage(chatId, { 
            audio: { url: "https://files.catbox.moe/w8xll7.mp3" }, 
            mimetype: 'audio/mpeg', 
            ptt: true 
        }, { quoted: message });

    } catch (error) {
        console.error('Error in help command:', error);
        await sock.sendMessage(chatId, { text: '🔥 Escanor\'s pride faltered...\n\n' + error.message });
    }
}

module.exports = helpCommand;
