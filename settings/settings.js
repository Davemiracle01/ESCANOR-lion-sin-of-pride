const fs = require('fs')

//~~~~~~~~~~~ Settings Owner ~~~~~~~~~~~//
global.owner = "254769279076"
global.developer = "254799073744"
global.bot = ""
global.devname = "dave"
global.ownername = "dave"
global.botname = "ESCANOR BOT"
global.versisc = "2"
global.packname = "⎋LION_SINOFPRIDE"
//~~~~~~~~~~~ Settings Sosmed ~~~~~~~~~~~//
global.linkwa = "https://wa.me/254769279076"
global.linkyt = "https://www.youtube.com/@Davek254"
global.linktt = "https://tiktok.com"
global.linktele = "https://t.me"

//~~~~~~~~~~~ Settings Bot ~~~~~~~~~~~//
global.prefix = ["","!",".",",","#","/","🎭","〽"]
global.autoRecording = false
global.autoTyping = false
global.autorecordtype = false
global.autoread = true
global.autobio = false
global.anti92 = false
global.owneroff = false
global.autoswview = true

//~~~~~~~~~~~ Settings Thumbnail ~~~~~~~~~~~//
global.thumbbot = "https://url.bwmxmd.online/Adams.poh4tuhs.jpg"
global.thumbown = "https://url.bwmxmd.online/Adams.poh4tuhs.jpg"

//~~~~~~~~~~~ Settings Channel ~~~~~~~~~~~//
global.idchannel = "120363363333127547@newsletter"
global.channelname = "ASTATECH"
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
