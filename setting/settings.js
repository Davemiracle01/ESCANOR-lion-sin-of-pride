const fs = require('fs')

//~~~~~~~~~~~ Settings Owner ~~~~~~~~~~~//
global.owner = "254799073744"
global.developer = "254769279076"
global.bot = ""
global.devname = "dave"
global.ownername = "dave"
global.botname = "⎋ESCANOR "
global.versisc = "2"
global.packname = "⎋ESCANOR "
global.SESSION_ID = ""
//~~~~~~~~~~~ Settings Sosmed ~~~~~~~~~~~//
global.linkwa = "https://wa.me/254769279076"
global.linkyt = "https://www.youtube.com/@davek254?si=BBz2b216tuIrpqcy"
global.linktt = "https://tiktok.com"
global.linktele = "https://t.me/dkiama"

//~~~~~~~~~~~ Settings Bot ~~~~~~~~~~~//
global.prefix = ["","!",".",",","#","/","🎭","〽"]
global.autoRecording = false
global.autoTyping = false
global.autorecordtype = false
global.autoread = false
global.autobio = false
global.anti92 = false
global.owneroff = false
global.autoswview = true

//~~~~~~~~~~~ Settings Thumbnail ~~~~~~~~~~~//
global.thumbbot = "https://files.catbox.moe/0r0xfv.jpeg"
global.thumbown = "https://files.catbox.moe/0r0xfv.jpeg"

//~~~~~~~~~~~ Settings Channel ~~~~~~~~~~~//
global.idchannel = "120363363333127547@newsletter*"
global.channelname = "ー⎋ESCANOR  UPDATES"
global.channel = "https://whatsapp.com/channel/0029VavpWUvGk1Fkbzz0vz0v"

//~~~~~~~~~~~ Settings Message ~~~~~~~~~~~//
global.mess = {
  developer: " [ Developer Only!! ] \n This feature is for developers only!!",
  owner: " [ Owner Only!! ] \n This feature is for owners only!!",
  group: " [ Group Only!! ] \n This feature is for group chats only!!",
  private: " [ Private Only!! ] \n This feature is for private chats only!!",
  admin: " [ Admin Only!! ] \n This feature is for admins only!!",
  botadmin: " [ Bot Admin Only!! ] \n This feature is for bot admins only!!",
  wait: " [ Wait!! ] \n Please wait, loading...",
  error: " [ Error!! ] \n An error occurred!!",
  done: " [ Done!! ] \n Process completed!!"
}

let file = require.resolve(__filename)
require('fs').watchFile(file, () => {
  require('fs').unwatchFile(file)
  console.log('\x1b[0;32m'+__filename+' \x1b[1;32mupdated!\x1b[0m')
  delete require.cache[file]
  require(file)
})
