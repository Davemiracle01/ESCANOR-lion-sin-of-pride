const isAdmin = require('../lib/isAdmin');  // Use helper for admin checks

async function tagAllCommand(sock, chatId, senderId) {
  try {
    const { isSenderAdmin, isBotAdmin } = await isAdmin(sock, chatId, senderId);

    if (!isSenderAdmin && !isBotAdmin) {
      return await sock.sendMessage(chatId, {
        text: 'Only the mighty admins may summon the power to tag all.'
      });
    }

    // Get group metadata and participants
    const groupMetadata = await sock.groupMetadata(chatId);
    const participants = groupMetadata.participants;

    if (!participants || participants.length === 0) {
      return await sock.sendMessage(chatId, { text: 'This battleground has no warriors to summon.' });
    }

    // Escanor-style dramatic proclamation
    const escanorIntro =
      "🔥 *I AM ESCANOR, THE LION SIN OF PRIDE!* 🔥\n" +
      "*consider my summon a blessing*\n\n" +
      "Hear me! Stand proud as I call your names:\n\n";

    // List participants with mentions, one per line
    let message = escanorIntro;
    participants.forEach((p) => {
      message += `@${p.id.split('@')[0]}\n`;
    });

    // Send the message tagging all participants
    await sock.sendMessage(chatId, {
      text: message,
      mentions: participants.map(p => p.id)
    });

  } catch (error) {
    console.error('Error in tagall command:', error);
    await sock.sendMessage(chatId, { text: 'The flames have faltered... Failed to tag all members.' });
  }
}

module.exports = tagAllCommand;
