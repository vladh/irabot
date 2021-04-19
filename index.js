const Discord = require('discord.js');
const client = new Discord.Client();

const config = require('./config');


function main() {
  client.login(config.token);

  client.on('message', async (message) => {
    if (!message.guild) return;

    if (message.content === '.join') {
      // Only try to join the sender's voice channel if they are in one themselves
      if (message.member.voice.channel) {
        const connection = await message.member.voice.channel.join();
        const dispatcher = connection.play('./data/lobby.mp3');
      } else {
        message.reply('You need to join a voice channel first!');
      }
    }
  });
}


main()
