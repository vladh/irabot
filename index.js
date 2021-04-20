const fs = require('fs');
const util = require('util')
const stream = require('stream');
const pipeline = util.promisify(stream.pipeline);

const Discord = require('discord.js');
const axios = require('axios');
const htmlentities = require('html-entities');

const config = require('./config');

const PREFIX = '.';
const DATA_DIR = './data/';


function get_command_name(str) {
  if (str.startsWith(PREFIX)) {
    return str.slice(PREFIX.length);
  } else {
    return null;
  }
}


function pause(state, message, arguments) {
  if (state.dispatcher) {
    if (state.dispatcher.paused) {
      message.reply('Already paused.');
    } else {
      state.dispatcher.pause();
      message.reply('Paused.');
    }
  } else {
    message.reply("Not playing, so we can't pause.");
  }
}


function resume(state, message, arguments) {
  if (state.dispatcher) {
    if (state.dispatcher.paused) {
      state.dispatcher.resume();
      message.reply('Resumed.');
    } else {
      message.reply("Not paused, so we can't resume.");
    }
  } else {
    message.reply("Not playing, so we can't resume.");
  }
}


function stop(state, message, arguments) {
  if (state.dispatcher) {
    message.reply('Stopped.');
    state.voice_channel.leave();
    state.dispatcher.destroy();
    state.dispatcher = null;
    state.voice_channel = null;
    state.connection = null;
    state.media_title = '';
    state.media_url = '';
    state.media_local_path = '';
  } else {
    message.reply("Not playing, so we can't stop.");
  }
}


function status(state, message, arguments) {
  if (state.dispatcher) {

    const current_second = state.started_playing_at_second +
      Math.round(state.dispatcher.streamTime / 1000);

    if (state.dispatcher.paused) {
      const pause_time_s = Math.round(state.dispatcher.pausedTime / 1000);
      message.reply(`Status: [Paused for ${pause_time_s}s] ${current_second}s into “${state.media_title}”`);
    } else {
      message.reply(`Status: [Playing] ${current_second}s into “${state.media_title}”`);
    }
  } else {
    message.reply('Not currently playing anything.');
  }
}


function seek(state, message, arguments) {
  if (!state.dispatcher) {
    return message.reply("Not playing, so we can't seek.");
  }

  if (arguments.length == 0) {
    return message.reply(
      `You need to say where to seek to, in a relative or absolute point in ` +
      `time in seconds: ${PREFIX}seek [500|-10|+20]`
    );
  }

  let seek_target;
  if (arguments[0].startsWith('-') || arguments[0].startsWith('+')) {
    const current_second = state.started_playing_at_second +
      Math.round(state.dispatcher.streamTime / 1000);
    seek_target = current_second + (+arguments[0]);
  } else {
    seek_target = (+arguments[0]);
  }

  state.dispatcher = state.connection.play(state.media_local_path, {seek: seek_target + 's'});
  state.started_playing_at_second = seek_target;
}


async function get_media_info_from_html(initial_url) {
  res = await axios.get(initial_url);
  const html = res.data;

  const re_title = /name="og:title" content="(.*)"/;
  const title_match = html.match(re_title);
  if (title_match.length < 2) {
    return {url: null, title: null};
  }
  const title = htmlentities.decode(title_match[1]);

  const re_url = /name="twitter:player:stream" content="(.*)"/;
  const url_match = html.match(re_url);
  if (url_match.length < 2) {
    return {url: null, title: null};
  }
  const url = url_match[1];

  return {url: url, title: title};
}


async function get_media_info(initial_url) {
  res = await axios.head(initial_url);

  if (res.headers['content-type'].includes('text/html')) {
    return get_media_info_from_html(initial_url);
  } else {
    return {
      url: initial_url,
      title: `Podcast at ${initial_url}`,
    };
  }
}


async function play(state, message, arguments) {
  if (arguments.length == 0) {
    return message.reply(`You need to say what you'd like to play: ${PREFIX}play <url>`);
  }

  if (!message.member.voice.channel) {
    return message.reply('You need to join a voice channel first!');
  }

  // Find media URL
  media_info = await get_media_info(arguments[0]);

  if (!media_info.url) {
    return message.reply(
      'Could not find media at given URL. ' +
      'Try an Overcast URL, or a direct URL to the audio file.'
    );
  }

  console.log('Found media.', media_info);

  state.media_url = media_info.url;
  state.media_title = media_info.title;

  // Download media locally
  state.media_local_path = `${DATA_DIR}media`;
  console.log(`Downloading ${state.media_url} -> ${state.media_local_path}`);
  const http_response = await axios({
    method: 'get',
    url: state.media_url,
    responseType: 'stream',
  });
  await pipeline(
    http_response.data,
    fs.createWriteStream(state.media_local_path)
  );

  // Play media
  state.voice_channel = message.member.voice.channel;
  state.connection = await state.voice_channel.join();
  state.dispatcher = state.connection.play(state.media_local_path);

  message.reply(`Playing: ${media_info.title}`);
}


function help(state, message, arguments) {
  message.reply(`
irabot help:

\`${PREFIX}help\`: Print help.
\`${PREFIX}play <url>\`: Play from a certain URL. Supports an Overcast URL, or a direct URL to the audio file.
\`${PREFIX}pause\` or \`${PREFIX}p\`: Pause currently playing audio.
\`${PREFIX}resume\` or \`${PREFIX}r\`: Resume currently playing audio.
\`${PREFIX}stop\` or \`${PREFIX}s\`: Stop currently playing audio.
\`${PREFIX}seek [500|-10|+20] Seek to a certain relative of absolute point in time (in seconds).
\`${PREFIX}status\`: Print current status.
  `.trim());
}


async function main() {
  const client = new Discord.Client();
  let state = {
    dispatcher: null,
    voice_channel: null,
    connection: null,
    media_title: '',
    media_url: '',
    media_local_path: '',
    started_playing_at_second: 0,
  };

  client.on('ready', () => {
    console.log(`Logged in as ${client.user.tag}!`);
  });

  client.on('message', async (message) => {
    if (!message.guild) {
      return;
    }

    message_parts = message.content.split(' ');
    command = get_command_name(message_parts[0]);
    arguments = message_parts.slice(1);

    const handlers = {
      help: help,
      p: pause,
      pause: pause,
      play: play,
      r: resume,
      resume: resume,
      s: stop,
      seek: seek,
      status: status,
      stop: stop,
    };

    if (command in handlers) {
      await handlers[command](state, message, arguments);
    }
  });

  client.on('debug', console.log);
  client.on('error', console.error);
  client.on('warn', console.warn);

  client.login(config.token);
}


main()
