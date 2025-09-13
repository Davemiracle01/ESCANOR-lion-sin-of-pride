const yts = require('yt-search');
const ytdl = require('ytdl-core');
const fs = require('fs');
const path = require('path');
const os = require('os');

async function playCommand(sock, chatId, message) {
  try {
    const text = message.message?.conversation || message.message?.extendedTextMessage?.text || '';
    const searchQuery = text.split(' ').slice(1).join(' ').trim();

    if (!searchQuery) {
      return await sock.sendMessage(chatId, { text: "What song do you want to download?" });
    }

    // Search for the song on YouTube
    const searchResults = await yts(searchQuery);
    if (!searchResults || !searchResults.videos || searchResults.videos.length === 0) {
      return await sock.sendMessage(chatId, { text: "No songs found!" });
    }

    const video = searchResults.videos[0]; // pick the first video
    const videoUrl = video.url;
    const title = video.title.replace(/[^a-z0-9]/gi, '_').toLowerCase().substring(0, 50); // safe filename limit

    // Notify user downloading
    await sock.sendMessage(chatId, { text: "_Please wait, your download is in progress..._" });

    // Prepare temp file path
    const tempFilePath = path.join(os.tmpdir(), `${title}.mp3`);
    const audioStream = ytdl(videoUrl, { filter: 'audioonly', quality: 'highestaudio' });

    // Save audio stream to temp file
    await new Promise((resolve, reject) => {
      audioStream.pipe(fs.createWriteStream(tempFilePath))
        .on('finish', resolve)
        .on('error', reject);
    });

    // Send audio file to chat with proper metadata
    await sock.sendMessage(chatId, {
      audio: fs.readFileSync(tempFilePath),
      mimetype: 'audio/mpeg',
      fileName: `${video.title}.mp3`
    }, { quoted: message });

    // Cleanup temp file
    fs.unlinkSync(tempFilePath);

  } catch (error) {
    console.error('Error in playCommand:', error);
    await sock.sendMessage(chatId, { text: "*Download failed. Please try again later.*" });
  }
}

module.exports = playCommand;
