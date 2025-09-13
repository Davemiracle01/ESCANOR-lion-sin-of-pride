const yts = require('yt-search');
const ytdl = require('ytdl-core');
const ffmpeg = require('fluent-ffmpeg');
const fs = require('fs');
const path = require('path');
const os = require('os');

function formatDuration(seconds) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function formatNumber(num) {
  return num.toLocaleString('en-US');
}

function cleanup(...files) {
  setTimeout(() => {
    for (const file of files) {
      if (fs.existsSync(file)) fs.unlinkSync(file);
    }
  }, 10000);
}

module.exports = async function songCommand(sock, chatId, message) {
  try {
    const text = message.message?.conversation || message.message?.extendedTextMessage?.text || '';
    const searchQuery = text.split(' ').slice(1).join(' ').trim();
    if (!searchQuery) {
      return await sock.sendMessage(chatId, { text: '🎵 Please enter a song name.\nExample: *.song Despacito*' });
    }

    const { videos } = await yts(searchQuery);
    if (!videos || videos.length === 0) {
      return await sock.sendMessage(chatId, { text: '❌ No videos found for your search.' });
    }

    const video = videos.find(v => v.seconds && v.seconds < 600) || videos[0];

    const tempDir = path.join(os.tmpdir(), 'bot_temp');
    if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });

    const timestamp = Date.now();
    const tempRaw = path.join(tempDir, `${timestamp}.webm`);
    const tempMp3 = path.join(tempDir, `${timestamp}.mp3`);
    const safeTitle = video.title.replace(/[<>:"/\\|?*]/g, '').slice(0, 64);
    const fileName = `${safeTitle}.mp3`;

    await sock.sendMessage(chatId, {
      image: { url: video.thumbnail },
      caption: `*${video.title}*\n⏱️ Duration: ${formatDuration(video.seconds || 0)}\n👁️ Views: ${formatNumber(video.views || 0)}\n\n_Processing audio..._`
    }, { quoted: message });

    // Download audio stream to temp file
    await new Promise((resolve, reject) => {
      ytdl(video.url, { filter: 'audioonly', quality: 'highestaudio' })
        .pipe(fs.createWriteStream(tempRaw))
        .on('finish', resolve)
        .on('error', reject);
    });

    // Convert to mp3 using ffmpeg
    await new Promise((resolve, reject) => {
      ffmpeg(tempRaw)
        .audioBitrate(128)
        .format('mp3')
        .on('error', reject)
        .on('end', resolve)
        .save(tempMp3);
    });

    // Send mp3 file to chat
    await sock.sendMessage(chatId, {
      audio: fs.readFileSync(tempMp3),
      mimetype: 'audio/mpeg',
      fileName,
      ptt: false
    }, { quoted: message });

    cleanup(tempRaw, tempMp3);

  } catch (error) {
    console.error('Error in songCommand:', error);
    await sock.sendMessage(chatId, {
      text: '*Failed to process your song request. Please try again later.*'
    }, { quoted: message });
  }
};
